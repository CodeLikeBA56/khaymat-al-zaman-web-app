import assert from "node:assert/strict";
import test from "node:test";
import { PurchaseInvoiceStatus } from "@/types/purchase-invoice";
import {
  applySupplierPaymentAllocationToInvoice,
  assertSupplierPaymentVoidable,
  derivePayableInvoiceStatus,
  formatGeneratedSupplierPaymentNumber,
  normalizePaymentAllocations,
  normalizeSupplierPaymentNumber,
  reverseSupplierPaymentAllocationFromInvoice,
  summarizeSupplierPaymentAllocations,
} from "./supplier-payment";

test("normalizePaymentAllocations groups duplicate invoice allocations", () => {
  const grouped = normalizePaymentAllocations([
    { invoiceId: "inv-1", amountMinor: 100 },
    { invoiceId: "inv-1", amountMinor: 250 },
    { invoiceId: "inv-2", amountMinor: 200 },
  ]);

  assert.deepEqual(grouped, [
    { invoiceId: "inv-1", amountMinor: 350 },
    { invoiceId: "inv-2", amountMinor: 200 },
  ]);
});

test("summarizeSupplierPaymentAllocations supports unallocated amounts", () => {
  const summary = summarizeSupplierPaymentAllocations({
    amountMinor: 1000,
    allocations: [{ invoiceId: "inv-1", amountMinor: 600 }],
  });

  assert.deepEqual(summary, {
    allocatedMinor: 600,
    unallocatedMinor: 400,
  });
});

test("summarizeSupplierPaymentAllocations rejects over-allocation", () => {
  assert.throws(
    () =>
      summarizeSupplierPaymentAllocations({
        amountMinor: 500,
        allocations: [{ invoiceId: "inv-1", amountMinor: 600 }],
      }),
    /cannot exceed payment amount/,
  );
});

test("applySupplierPaymentAllocationToInvoice handles partial and full allocation", () => {
  const partial = applySupplierPaymentAllocationToInvoice(
    {
      status: PurchaseInvoiceStatus.POSTED,
      grandTotalMinor: 1000,
      paidAmountMinor: 0,
      remainingPayableMinor: 1000,
    },
    300,
  );

  assert.deepEqual(partial, {
    status: PurchaseInvoiceStatus.PARTIALLY_PAID,
    grandTotalMinor: 1000,
    paidAmountMinor: 300,
    remainingPayableMinor: 700,
  });

  const full = applySupplierPaymentAllocationToInvoice(partial, 700);
  assert.deepEqual(full, {
    status: PurchaseInvoiceStatus.PAID,
    grandTotalMinor: 1000,
    paidAmountMinor: 1000,
    remainingPayableMinor: 0,
  });
});

test("reverseSupplierPaymentAllocationFromInvoice restores balances", () => {
  const reversed = reverseSupplierPaymentAllocationFromInvoice(
    {
      status: PurchaseInvoiceStatus.PAID,
      grandTotalMinor: 900,
      paidAmountMinor: 900,
      remainingPayableMinor: 0,
    },
    400,
  );

  assert.deepEqual(reversed, {
    status: PurchaseInvoiceStatus.PARTIALLY_PAID,
    grandTotalMinor: 900,
    paidAmountMinor: 500,
    remainingPayableMinor: 400,
  });
});

test("normalize/format payment numbers and void guard", () => {
  assert.equal(normalizeSupplierPaymentNumber(" spay-4/2 "), "SPAY-4/2");
  assert.equal(formatGeneratedSupplierPaymentNumber(12), "SPAY-000012");
  assert.equal(
    derivePayableInvoiceStatus(0, 100),
    PurchaseInvoiceStatus.POSTED,
  );

  assert.throws(() => assertSupplierPaymentVoidable("VOID" as never), /recorded payments/);
});
