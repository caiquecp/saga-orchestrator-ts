# Deno Saga Orchestrator

A simple and generic Saga pattern implementation for Deno to handle distributed transactions.

## Features

- Generic transaction orchestration with compensation handling
- Type-safe transaction context
- Transaction logging for compensation steps
- Asynchronous execution

## Usage

```ts
const saga = new SagaOrchestrator([
  createCode,
  debitPoints,  
  activateTicket
], initialData);

const result = await saga.execute();
```

## License

MIT