// deno-lint-ignore-file require-await

import { TransactionDefinition } from "./saga-orchestrator.ts";

export interface Ticket {
  id: string;
  code?: string | null;
  value: number;
  status: "CREATED" | "ACTIVE" | "USED" | "FAILED";
  debit: {
    id?: string;
    reverseDebitId?: string;
  };
}

export const debitPoints: TransactionDefinition<Ticket> = {
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

export const createCode: TransactionDefinition<Ticket> = {
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

export const activateTicket: TransactionDefinition<Ticket> = {
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

export const activateTicketForceFailure: TransactionDefinition<Ticket> = {
  name: "ActivateTicket",
  execute: async (_context) => {
    throw new Error("Could not create ticket code");
  },
  compensate: async (context) => {
    context.status = "FAILED";
    return Promise.resolve(context);
  },
};
