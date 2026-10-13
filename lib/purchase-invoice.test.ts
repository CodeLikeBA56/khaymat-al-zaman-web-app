import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateInvoiceTotals,
  formatGeneratedInvoiceNumber,
  normalizeCurrencyCode,
  normalizeInvoiceNumber,
  validateCurrencyMinorUnit,
  validateLineItems,
} from "./purchase-invoice";

test("calculateInvoiceTotals computes derived totals", () => {
  const totals = calculateInvoiceTotals({
    lines: [
      { description: "Line A", amountMinor: 1000 },
      { description: "Line B", amountMinor: 2500 },
    ],
    taxAmountMinor: 350,
    discountAmountMinor: 200,
  });

  assert.deepEqual(totals, {
    subTotalMinor: 3500,
    taxAmountMinor: 350,
    discountAmountMinor: 200,
    grandTotalMinor: 3650,
  });
});

test("calculateInvoiceTotals rejects negative grand total", () => {
  assert.throws(
    () =>
      calculateInvoiceTotals({
        lines: [{ description: "A", amountMinor: 100 }],
        taxAmountMinor: 0,
        discountAmountMinor: 101,
      }),
    /Grand total cannot be negative/,
  );
});

test("validateLineItems enforces positive integer line amounts", () => {
  assert.throws(
    () =>
      validateLineItems([
        { description: "A", amountMinor: 100 },
        { description: "B", amountMinor: -1 },
      ]),
    /amount must be a positive integer minor amount/,
  );
});

test("currency normalization and precision validation", () => {
  assert.equal(normalizeCurrencyCode(" sar "), "SAR");
  assert.equal(validateCurrencyMinorUnit(3), 3);
  assert.throws(() => validateCurrencyMinorUnit(7), /between 0 and 6/);
});

test("invoice number normalization and sequence formatting", () => {
  assert.equal(normalizeInvoiceNumber(" inv-23/4 "), "INV-23/4");
  assert.equal(formatGeneratedInvoiceNumber(9), "PINV-000009");
  assert.notEqual(
    formatGeneratedInvoiceNumber(9),
    formatGeneratedInvoiceNumber(10),
  );
});
