import assert from "node:assert/strict";
import test from "node:test";
import { Timestamp } from "firebase/firestore";
import { PurchaseInvoiceStatus } from "@/types/purchase-invoice";
import { __purchaseInvoiceServiceInternals } from "./purchase-invoice.service";

test("draft-only update guard blocks non-draft edits", () => {
  assert.throws(
    () =>
      __purchaseInvoiceServiceInternals.assertDraftEditableStatus(
        PurchaseInvoiceStatus.POSTED,
      ),
    /Only draft invoices can be updated/,
  );
});

test("posting guard allows only draft invoices", () => {
  assert.throws(
    () =>
      __purchaseInvoiceServiceInternals.assertPostableStatus(
        PurchaseInvoiceStatus.PAID,
      ),
    /Only draft invoices can be posted/,
  );
});

test("voiding guard blocks non-voidable statuses", () => {
  assert.throws(
    () =>
      __purchaseInvoiceServiceInternals.assertVoidableStatus(
        PurchaseInvoiceStatus.PAID,
      ),
    /Only draft or posted invoices can be voided/,
  );
});

test("unauthorized field mutation is blocked in ordinary draft update", () => {
  assert.throws(
    () =>
      __purchaseInvoiceServiceInternals.assertUpdateDraftInputAllowed({
        // @ts-expect-error runtime guard test
        status: PurchaseInvoiceStatus.PAID,
      }),
    /controlled by business logic/,
  );
});

test("list filter compatibility rejects invoiceNumber plus dateRange", () => {
  assert.throws(
    () =>
      __purchaseInvoiceServiceInternals.assertListFilterCompatibility({
        invoiceNumber: "PINV-000001",
        dateRange: {
          from: Timestamp.fromMillis(0),
        },
      }),
    /cannot be combined with date range/,
  );
});

test("date range normalization validates ordering", () => {
  assert.throws(
    () =>
      __purchaseInvoiceServiceInternals.normalizeDateRange({
        from: Timestamp.fromDate(new Date("2026-10-10")),
        to: Timestamp.fromDate(new Date("2026-10-01")),
      }),
    /cannot be after/,
  );
});
