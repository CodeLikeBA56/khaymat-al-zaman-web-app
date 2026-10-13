import assert from "node:assert/strict";
import test from "node:test";
import { PurchaseInvoiceStatus } from "./purchase-invoice";

test("PurchaseInvoiceStatus enum values are stable", () => {
  assert.deepEqual(Object.values(PurchaseInvoiceStatus), [
    "DRAFT",
    "POSTED",
    "PARTIALLY_PAID",
    "PAID",
    "VOID",
  ]);
});
