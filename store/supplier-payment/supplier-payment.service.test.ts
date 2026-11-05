import assert from "node:assert/strict";
import test from "node:test";
import { Timestamp } from "firebase/firestore";
import { __supplierPaymentServiceInternals } from "./supplier-payment.service";

test("normalizeDateRange rejects invalid range ordering", () => {
  assert.throws(
    () =>
      __supplierPaymentServiceInternals.normalizeDateRange({
        dateFrom: Timestamp.fromDate(new Date("2026-10-20")),
        dateTo: Timestamp.fromDate(new Date("2026-10-01")),
      }),
    /cannot be after/,
  );
});

test("normalizeAmountMinor requires positive integers", () => {
  assert.throws(
    () => __supplierPaymentServiceInternals.normalizeAmountMinor(0),
    /positive integer minor amount/,
  );

  assert.throws(
    () => __supplierPaymentServiceInternals.normalizeAmountMinor(10.5),
    /positive integer minor amount/,
  );

  assert.equal(
    __supplierPaymentServiceInternals.normalizeAmountMinor(100),
    100,
  );
});

test("normalizeIdempotencyKey trims and supports duplicate-request key semantics", () => {
  assert.equal(
    __supplierPaymentServiceInternals.normalizeIdempotencyKey(" abc-1 "),
    "abc-1",
  );
  assert.equal(
    __supplierPaymentServiceInternals.normalizeIdempotencyKey("   "),
    undefined,
  );
});
