import { OnPostTransaction, SagaOrchestrator } from "./saga-orchestrator.ts";
import {
  activateTicket,
  activateTicketForceFailure,
  createCode,
  debitPoints,
  Ticket,
} from "./service.ts";

const fakeDb = {
  tickets: new Map(),
};

const onPostTransaction: OnPostTransaction<Ticket> = (context) => {
  const ticket = fakeDb.tickets.get(context.id);
  fakeDb.tickets.set(context.id, { ...ticket, ...context });
  console.debug({
    message: "onPostTransaction",
    oldTicket: ticket,
    newTicket: { ...context },
  });
  return Promise.resolve();
};

async function main() {
  const createTicketDto: Ticket = {
    id: crypto.randomUUID(),
    value: 5.0,
    status: "CREATED",
    debit: {},
  };

  try {
    const sagaSuccess = new SagaOrchestrator(
      [
        createCode,
        debitPoints,
        activateTicket,
      ],
      createTicketDto,
      onPostTransaction,
    );
    const sagaSuccessRes = await sagaSuccess.execute();
    console.info(sagaSuccessRes);

    const sagaFailure = new SagaOrchestrator([
      createCode,
      debitPoints,
      activateTicketForceFailure,
    ], createTicketDto);
    const sagaFailureRes = await sagaFailure.execute();
    console.info(sagaFailureRes);
  } catch (error) {
    console.error(error);
  }
}

if (import.meta.main) {
  await main();
}
