import { assertEquals } from "jsr:@std/assert";
import {
  SagaOrchestrator,
  TransactionDefinition,
} from "./saga-orchestrator.ts";

/**
 * Note: tests/mocks will be based on a ticket system.
 */

interface Ticket {
  id: string;
  code?: string;
  value: number;
  status: "CREATED" | "ACTIVE" | "USED" | "FAILED";
  debit: {
    id?: string;
    restoreId?: string;
  };
}

const createCode: TransactionDefinition<Ticket> = {
  name: "CreateCode",
  execute: (ctx) => {
    ctx.code = "A9C090EA";
    return Promise.resolve(ctx);
  },
  compensate: (ctx) => {
    ctx.code = "NO_CODE";
    return Promise.resolve(ctx);
  },
};

const debit: TransactionDefinition<Ticket> = {
  name: "Debit",
  execute: (ctx) => {
    ctx.debit.id = "dfefe41b-08d6-532a-a26c-a72b6a13473a";
    return Promise.resolve(ctx);
  },
  compensate: (ctx) => {
    ctx.debit.restoreId = "bd972387-6df6-53bf-8fec-d484e4e6bdc9";
    return Promise.resolve(ctx);
  },
};

const debitForceErrorCompensate: TransactionDefinition<Ticket> = {
  ...debit,
  compensate: (_ctx) => {
    return Promise.reject(new Error("Unexpected error"));
  },
};

const activate: TransactionDefinition<Ticket> = {
  name: "Activate",
  execute: (ctx) => {
    ctx.status = "ACTIVE";
    return Promise.resolve(ctx);
  },
  compensate: (ctx) => {
    ctx.status = "FAILED";
    return Promise.resolve(ctx);
  },
};

const activateForceError: TransactionDefinition<Ticket> = {
  ...activate,
  execute: (_ctx) => {
    return Promise.reject(new Error("Unexpected error"));
  },
};

Deno.test("test SagaOrchestrator execute for a successful path", async () => {
  const initialData: Ticket = {
    id: "cf9a761c-b06b-54d9-a8c2-d576c9506140",
    status: "CREATED",
    value: 5,
    debit: {},
  };
  const saga = new SagaOrchestrator([createCode, debit, activate], initialData);
  const res = await saga.execute();

  assertEquals(res.success, true);
  assertEquals(res.data, {
    id: "cf9a761c-b06b-54d9-a8c2-d576c9506140",
    code: "A9C090EA",
    status: "ACTIVE",
    value: 5,
    debit: {
      id: "dfefe41b-08d6-532a-a26c-a72b6a13473a",
    },
  });
});

Deno.test("test SagaOrchestrator execute for a failure path - triggering compensate", async () => {
  const initialData: Ticket = {
    id: "cf9a761c-b06b-54d9-a8c2-d576c9506140",
    status: "CREATED",
    value: 5,
    debit: {},
  };
  const saga = new SagaOrchestrator(
    [createCode, debit, activateForceError],
    initialData,
  );
  const res = await saga.execute();

  assertEquals(res.success, false);
  assertEquals(
    res.error,
    "Generic error, check compensate transaction logs for more details",
  );
  assertEquals(res.data, {
    id: "cf9a761c-b06b-54d9-a8c2-d576c9506140",
    code: "NO_CODE",
    status: "FAILED",
    value: 5,
    debit: {
      id: "dfefe41b-08d6-532a-a26c-a72b6a13473a",
      restoreId: "bd972387-6df6-53bf-8fec-d484e4e6bdc9",
    },
  });
  assertEquals(res.compensateTransactionLogs, [
    { status: "compensated", transactionName: "Activate" },
    { status: "compensated", transactionName: "Debit" },
    { status: "compensated", transactionName: "CreateCode" },
  ]);
});

Deno.test("test SagaOrchestrator compensate handling of failures - must keep going", async () => {
  const initialData: Ticket = {
    id: "cf9a761c-b06b-54d9-a8c2-d576c9506140",
    status: "CREATED",
    value: 5,
    debit: {},
  };
  const saga = new SagaOrchestrator(
    [createCode, debitForceErrorCompensate, activateForceError],
    initialData,
  );
  const res = await saga.execute();

  assertEquals(res.success, false);
  assertEquals(
    res.error,
    "Generic error, check compensate transaction logs for more details",
  );
  assertEquals(res.data, {
    id: "cf9a761c-b06b-54d9-a8c2-d576c9506140",
    code: "NO_CODE",
    status: "FAILED",
    value: 5,
    debit: {
      id: "dfefe41b-08d6-532a-a26c-a72b6a13473a",
    },
  });
  assertEquals(res.compensateTransactionLogs, [
    { status: "compensated", transactionName: "Activate" },
    { status: "failed", transactionName: "Debit" },
    { status: "compensated", transactionName: "CreateCode" },
  ]);
});
