interface SagaContext<T> {
  data: T;
}

interface SagaResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  // compensations?: Array<{ step: string; status: 'completed' | 'failed' }>;
}

interface SagaTransaction<T> {
  name: string;
  execute: (context: SagaContext<T>) => Promise<SagaContext<T>>;
  compensate: (context: SagaContext<T>) => Promise<SagaContext<T>>;
}

export class SagaOrchestrator<T> {
  private steps: SagaTransaction<T>[];
  private currentStepIndex: number;
  private completedSteps: SagaTransaction<T>[];
  private context: SagaContext<T>;
  private isCompensating: boolean;

  constructor(steps: SagaTransaction<T>[], initialContextData: T) { 
    this.steps = steps;
    this.currentStepIndex = 0;
    this.completedSteps = [];
    this.context = { data: initialContextData };
    this.isCompensating = false;
  }

  async execute(): Promise<SagaResult<T>> {
    this.currentStepIndex = 0;
    this.completedSteps = [];
    this.isCompensating = false;

    while (this.currentStepIndex < this.steps.length) {
      const currentStep = this.steps[this.currentStepIndex];

      try {
        this.context = await currentStep.execute(this.context);

        this.completedSteps.push(currentStep)
        this.currentStepIndex++;
      } catch (error) {
        console.error(`Saga step ${currentStep.name} failed:`, (error as Error).message);
        return this.compensate();
      }
    }

    return { success: true, data: this.context.data };
  }

  async compensate(): Promise<SagaResult<T>> {
    this.isCompensating = true;

    return { success: false, data: this.context.data, error: 'Oops...' }
  }
}

export function sagaOrchestratorFactory<T>(partnership: string, input: T): SagaOrchestrator<T> {
  switch (partnership) {
    case 'BA_LESHUTTLE':
      return new SagaOrchestrator<T>([], input);
    default:
      throw new Error('Unknown partnership, can\'t create the SagaOrchestrator');
  }
}