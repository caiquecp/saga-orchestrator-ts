interface TransactionResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

interface TransactionContext<T> {
  input: T;
  state: Record<string, unknown>;
}

interface TransactionDefinition<T> {
  name: string;
  execute: (context: TransactionContext<T>) => Promise<TransactionResult>;
  compensate: (context: TransactionContext<T>) => Promise<void>;
}

interface SagaState {
  id: string;
  workflowName: string;
  currentStep: string | null;
  status: 'in_progress' | 'completed' | 'failed';
  context: TransactionContext<unknown>;
  executionLog: Array<{step: string; status: 'completed' | 'failed' | 'compensated'}>;
}

// Mock database operations
class SagaStateRepository {
  async save(state: SagaState): Promise<void> {
    console.log('Saving state to database:', state);
    // Implement actual database save logic here
  }

  async load(sagaId: string): Promise<SagaState | null> {
    console.log('Loading state from database for saga:', sagaId);
    // Implement actual database load logic here
    return null;
  }
}

// Mock transactions
async function transaction1(context: TransactionContext<unknown>): Promise<TransactionResult> {
  // Simulating a successful transaction
  return { success: true, data: "Transaction 1 completed" };
}

async function transaction2(context: TransactionContext<unknown>): Promise<TransactionResult> {
  // Simulating a transaction that might fail
  const random = Math.random();
  if (random < 0.5) {
    return { success: false, error: "Transaction 2 failed" };
  }
  return { success: true, data: "Transaction 2 completed" };
}

async function transaction3(context: TransactionContext<unknown>): Promise<TransactionResult> {
  // Simulating a successful transaction
  return { success: true, data: "Transaction 3 completed" };
}

// Compensating transactions (rollbacks)
async function compensateTransaction1(context: TransactionContext<unknown>): Promise<void> {
  console.log("Rolling back transaction 1");
  // Implementation to undo transaction1
}

async function compensateTransaction2(context: TransactionContext<unknown>): Promise<void> {
  console.log("Rolling back transaction 2");
  // Implementation to undo transaction2
}

async function compensateTransaction3(context: TransactionContext<unknown>): Promise<void> {
  console.log("Rolling back transaction 3");
  // Implementation to undo transaction3
}

class SagaOrchestrator<T> {
  private transactions: Map<string, TransactionDefinition<T>> = new Map();
  private workflow: string[] = [];
  private executionLog: Array<{step: string; status: 'completed' | 'failed' | 'compensated'}> = [];
  private stateRepository: SagaStateRepository;
  private workflowName: string;

  constructor(workflowName: string, stateRepository: SagaStateRepository) {
    this.workflowName = workflowName;
    this.stateRepository = stateRepository;
  }

  registerTransaction(transaction: TransactionDefinition<T>) {
    this.transactions.set(transaction.name, transaction);
  }

  defineWorkflow(steps: string[]) {
    this.workflow = steps;
  }

  async execute(input: T, sagaId: string): Promise<boolean> {
    const context: TransactionContext<T> = {
      input,
      state: {}
    };

    const sagaState: SagaState = {
      id: sagaId,
      workflowName: this.workflowName,
      currentStep: null,
      status: 'in_progress',
      context: context as TransactionContext<unknown>,
      executionLog: this.executionLog
    };

    try {
      // Forward execution
      for (const step of this.workflow) {
        const transaction = this.transactions.get(step);
        if (!transaction) {
          throw new Error(`Transaction ${step} not found`);
        }

        sagaState.currentStep = step;
        await this.stateRepository.save(sagaState);

        const result = await transaction.execute(context);
        if (!result.success) {
          console.error(`Transaction ${step} failed:`, result.error);
          sagaState.status = 'failed';
          await this.stateRepository.save(sagaState);
          await this.compensate(context);
          return false;
        }

        this.executionLog.push({ step, status: 'completed' });
        sagaState.executionLog = this.executionLog;
        await this.stateRepository.save(sagaState);
        
        console.log(`${step} completed:`, result.data);
      }

      sagaState.status = 'completed';
      sagaState.currentStep = null;
      await this.stateRepository.save(sagaState);
      return true;

    } catch (error) {
      console.error("Orchestrator error:", error);
      sagaState.status = 'failed';
      await this.stateRepository.save(sagaState);
      await this.compensate(context);
      return false;
    }
  }

  private async compensate(context: TransactionContext<T>) {
    for (let i = this.executionLog.length - 1; i >= 0; i--) {
      const {step} = this.executionLog[i];
      const transaction = this.transactions.get(step)!;
      await transaction.compensate(context);
      this.executionLog[i].status = 'compensated';
    }
  }

  getExecutionLog() {
    return this.executionLog;
  }
}

// Usage example:
async function main() {
  const stateRepository = new SagaStateRepository();
  const orchestrator = new SagaOrchestrator<unknown>('OrderWorkflow', stateRepository);

  // Register transactions
  orchestrator.registerTransaction({
    name: 'CreateOrder',
    execute: transaction1,
    compensate: compensateTransaction1
  });
  orchestrator.registerTransaction({
    name: 'ProcessPayment',
    execute: transaction2,
    compensate: compensateTransaction2
  });
  orchestrator.registerTransaction({
    name: 'UpdateInventory',
    execute: transaction3,
    compensate: compensateTransaction3
  });

  // Define workflow
  orchestrator.defineWorkflow(['CreateOrder', 'ProcessPayment', 'UpdateInventory']);

  // Execute saga
  const success = await orchestrator.execute({}, 'saga-123');
  console.log("Saga execution", success ? "succeeded" : "failed");
  console.log("Execution log:", orchestrator.getExecutionLog());
}

// Learn more at https://docs.deno.com/runtime/manual/examples/module_metadata#concepts
if (import.meta.main) {
  await main();
}


