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

export type TransactionLogs = Array<
  { transactionName: string; status: "completed" | "failed" | "compensated" }
>;

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

  /**
   * Execute the saga, going through every transaction - and handling compensate in case of failure.
   */
  async execute(): Promise<SagaResult<T>> {
    this.currentTransactionIndex = 0;

    while (this.currentTransactionIndex < this.transactions.length) {
      const currentTransaction =
        this.transactions[this.currentTransactionIndex];

      try {
        this.context = await currentTransaction.execute(this.context);
        this.completedTransactions.push(currentTransaction);
        this.currentTransactionIndex++;
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

  /**
   * Coordinates the compensation for each transaction, from the one that failed and back.
   * In case of a compensate call fails, it'll ignore it and keep comepensating past
   * transaction - caller is responsible for handling any transaction that it was not
   * possible to compensate.
   */
  async compensate(): Promise<SagaResult<T>> {
    this.compensateTransactionLogs = [];

    while (this.currentTransactionIndex >= 0) {
      const currentTransaction =
        this.transactions[this.currentTransactionIndex];

      try {
        this.context = await currentTransaction.compensate(this.context);
        this.compensateTransactionLogs.push({
          transactionName: currentTransaction.name,
          status: "compensated",
        });
        this.currentTransactionIndex--;
      } catch (error) {
        // what to do? terminate the orchestration and let the caller resolve
        // (maybe tell what step failed, what have been compensated etc)?
        // or should we try to compensate every step, even if some of them fail,
        // and let the caller, the same as above, handle it?
        console.error(error);
        this.compensateTransactionLogs.push({
          transactionName: currentTransaction.name,
          status: "failed",
        });
        this.currentTransactionIndex--;
        continue;
      }
    }

    return {
      success: false,
      data: this.context,
      error: "Generic error, check compensate transaction logs for more details",
      compensateTransactionLogs: this.compensateTransactionLogs,
    };
  }
}
