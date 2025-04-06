// deno-lint-ignore-file require-await

import {
  SagaOrchestrator,
  TransactionDefinition,
} from "./saga-orchestrator.ts";

interface Ticket {
  id: string;
  code?: string | null;
  value: number;
  status: "CREATED" | "ACTIVE" | "USED" | "FAILED";
  debit: {
    id?: string;
    reverseDebitId?: string;
  };
}

const debitPoints: TransactionDefinition<Ticket> = {
  name: "DebitPoints",
  execute: async (context) => {
    context.debit.id = crypto.randomUUID();
    return Promise.resolve(context);
  },
  compensate: async (context) => {
    context.debit.reverseDebitId = crypto.randomUUID();
    return Promise.resolve(context);
  },
};

const createCode: TransactionDefinition<Ticket> = {
  name: "CreateCode",
  execute: async (context) => {
    context.code = crypto.randomUUID();
    return Promise.resolve(context);
  },
  compensate: async (context) => {
    context.code = null;
    return Promise.resolve(context);
  },
};

const activateTicket: TransactionDefinition<Ticket> = {
  name: "ActivateTicket",
  execute: async (context) => {
    context.status = "ACTIVE";
    return Promise.resolve(context);
  },
  compensate: async (context) => {
    context.status = "FAILED";
    return Promise.resolve(context);
  },
};

const activateTicketForceFailure: TransactionDefinition<Ticket> = {
  name: "ActivateTicket",
  execute: async (_context) => {
    throw new Error("Could not create ticket code");
  },
  compensate: async (context) => {
    context.status = "FAILED";
    return Promise.resolve(context);
  },
};

async function main() {
  const createTicketDto: Ticket = {
    id: crypto.randomUUID(),
    value: 5.0,
    status: "CREATED",
    debit: {},
  };

  try {
    const sagaSuccess = new SagaOrchestrator([
      createCode,
      debitPoints,
      activateTicket,
    ], createTicketDto);
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
