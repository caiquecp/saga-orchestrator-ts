// Requirements:
// 1. it needs to go over an array of steps/transactions, execute each, 
// and if it fails rollback every step executed until the current one
// 2. it needs to hold a context of data, which will be updated at each transaction
// 3. it needs to be generic, at least related to the data type it'll work/manipulate

// Notes:
// 1. at first, I'll make it accept, hold (as context) and resolve with the same data type
// but ideally there should be a separation of what is the input, what is the context and what is the output

export interface TransactionDefinition<T> {
  name: string;
  execute: (context: T) => Promise<T>;
  compensate: (context: T) => Promise<T>;
}

export type TransactionLogs = Array<{ transactionName: string; status: 'completed' | 'failed' | 'compensated' }>;

export interface SagaResult<T> {
  success: boolean;
  data: T;
  error?: string;
  compensateTransactionLogs?: TransactionLogs;
}

export class SagaOrchestrator<T> {
  private transactions: TransactionDefinition<T>[];
  private completedTransactions: TransactionDefinition<T>[];
  private context: T;
  private currentTransactionIndex: number;
  private compensateTransactionLogs?: TransactionLogs;

  constructor(transactions: TransactionDefinition<T>[], initialData: T) {
    this.transactions = transactions;
    this.completedTransactions = [];
    this.context = initialData;
    this.currentTransactionIndex = 0;
  }

  async execute(): Promise<SagaResult<T>> {
    this.currentTransactionIndex = 0;

    while (this.currentTransactionIndex < this.transactions.length) {
      const currentTransaction = this.transactions[this.currentTransactionIndex];
      
      try {
        const newContext = await currentTransaction.execute(this.context);
        this.context = { ...this.context, ...newContext };
        this.currentTransactionIndex++;
        this.completedTransactions.push(currentTransaction);
      } catch (error) {
        console.error(error);
        return this.compensate();
      }
    }

    return {
      success: true,
      data: this.context,
    };
  }

  async compensate(): Promise<SagaResult<T>> {
    this.compensateTransactionLogs = [];

    while (this.currentTransactionIndex >= 0) {
      const currentTransaction = this.transactions[this.currentTransactionIndex];
      
      try {
        const newContext = await currentTransaction.compensate(this.context);
        this.context = { ...this.context, ...newContext };
        this.currentTransactionIndex--;
        this.compensateTransactionLogs.push({ transactionName: currentTransaction.name, status: 'compensated' });
      } catch (error) {
        // what to do? terminate the orchestration and let the caller resolve
        // (maybe tell what step failed, what have been compensated etc)?
        // or should we try to compensate every step, even if some of them fail,
        // and let the caller, the same as above, handle it?
        console.error(error);
        this.compensateTransactionLogs.push({ transactionName: currentTransaction.name, status: 'failed' });
        // throw error;
        continue;
      }
    }

    return {
      success: false,
      data: this.context,
      error: 'Generic error, check transaction logs for more details',
      compensateTransactionLogs: this.compensateTransactionLogs,
    };
  }
}