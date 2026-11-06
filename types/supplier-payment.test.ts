import assert from "node:assert/strict";
import test from "node:test";
import {
  SupplierPaymentMethod,
  SupplierPaymentStatus,
  validateSupplierPaymentAllocationSummary,
} from "./supplier-payment";

test("SupplierPaymentMethod enum values are stable", () => {
  assert.deepEqual(Object.values(SupplierPaymentMethod), [
    "CASH",
    "BANK_TRANSFER",
    "CARD",
    "CHEQUE",
    "OTHER",
  ]);
});

test("SupplierPaymentStatus enum values are stable", () => {
  assert.deepEqual(Object.values(SupplierPaymentStatus), ["RECORDED", "VOID"]);
});

test("allocation summary supports partial and unallocated amounts", () => {
  const summary = validateSupplierPaymentAllocationSummary({
    amountMinor: 1000,
    allocations: [{ invoiceId: "inv-1", amountMinor: 250 }],
  });

  assert.deepEqual(summary, {
    allocatedMinor: 250,
    unallocatedMinor: 750,
  });
});

test("allocation summary supports fully unallocated payment", () => {
  const summary = validateSupplierPaymentAllocationSummary({
    amountMinor: 900,
    allocations: [],
  });

  assert.deepEqual(summary, {
    allocatedMinor: 0,
    unallocatedMinor: 900,
  });
});

test("allocation summary rejects over-allocation", () => {
  assert.throws(
    () =>
      validateSupplierPaymentAllocationSummary({
        amountMinor: 500,
        allocations: [{ invoiceId: "inv-1", amountMinor: 600 }],
      }),
    /cannot exceed payment amount/,
  );
});

test("allocation summary enforces integer minor amounts", () => {
  assert.throws(
    () =>
      validateSupplierPaymentAllocationSummary({
        amountMinor: 100,
        allocations: [{ invoiceId: "inv-1", amountMinor: 10.5 }],
      }),
    /positive integer minor amount/,
  );
});
