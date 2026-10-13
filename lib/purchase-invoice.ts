import { PurchaseInvoiceStatus, type PurchaseInvoiceLine } from "@/types/purchase-invoice";

export const PURCHASE_INVOICES_COLLECTION = "purchaseInvoices";
export const PURCHASE_INVOICE_NUMBERS_COLLECTION = "purchaseInvoiceNumbers";
export const PURCHASE_INVOICE_META_COUNTER_ID = "purchaseInvoiceNumberCounter";

export type InvoiceTotals = {
  subTotalMinor: number;
  taxAmountMinor: number;
  discountAmountMinor: number;
  grandTotalMinor: number;
};

export function normalizeCurrencyCode(currency: string) {
  const normalized = currency.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(normalized)) {
    throw new Error("Currency must be a valid ISO 4217 code.");
  }
  return normalized;
}

export function validateCurrencyMinorUnit(currencyMinorUnit: number) {
  if (!Number.isInteger(currencyMinorUnit) || currencyMinorUnit < 0 || currencyMinorUnit > 6) {
    throw new Error("Currency minor unit must be an integer between 0 and 6.");
  }
  return currencyMinorUnit;
}

export function validateLineItems(lines: PurchaseInvoiceLine[]) {
  if (!Array.isArray(lines) || lines.length === 0) {
    throw new Error("At least one invoice line is required.");
  }

  return lines.map((line, index) => {
    const description = line.description.trim();
    if (!description) {
      throw new Error(`Line ${index + 1} description is required.`);
    }

    if (!Number.isInteger(line.amountMinor) || line.amountMinor <= 0) {
      throw new Error(`Line ${index + 1} amount must be a positive integer minor amount.`);
    }

    return {
      description,
      amountMinor: line.amountMinor,
    };
  });
}

export function validateMinorAmount(name: string, value: number) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer minor amount.`);
  }

  return value;
}

export function calculateInvoiceTotals(input: {
  lines: PurchaseInvoiceLine[];
  taxAmountMinor?: number;
  discountAmountMinor?: number;
}): InvoiceTotals {
  const lines = validateLineItems(input.lines);
  const subTotalMinor = lines.reduce((sum, line) => sum + line.amountMinor, 0);
  const taxAmountMinor = validateMinorAmount("Tax amount", input.taxAmountMinor ?? 0);
  const discountAmountMinor = validateMinorAmount(
    "Discount amount",
    input.discountAmountMinor ?? 0,
  );

  const grandTotalMinor = subTotalMinor + taxAmountMinor - discountAmountMinor;
  if (grandTotalMinor < 0) {
    throw new Error("Grand total cannot be negative.");
  }

  return {
    subTotalMinor,
    taxAmountMinor,
    discountAmountMinor,
    grandTotalMinor,
  };
}

export function normalizeInvoiceNumber(invoiceNumber: string) {
  const normalized = invoiceNumber.trim().toUpperCase();
  if (!normalized) {
    throw new Error("Invoice number is required.");
  }

  if (!/^[A-Z0-9\-\/]+$/.test(normalized)) {
    throw new Error("Invoice number contains invalid characters.");
  }

  return normalized;
}

export function formatGeneratedInvoiceNumber(sequence: number) {
  if (!Number.isInteger(sequence) || sequence <= 0) {
    throw new Error("Invoice sequence must be a positive integer.");
  }

  return `PINV-${String(sequence).padStart(6, "0")}`;
}

export function canVoidStatus(status: PurchaseInvoiceStatus) {
  return (
    status === PurchaseInvoiceStatus.DRAFT ||
    status === PurchaseInvoiceStatus.POSTED ||
    status === PurchaseInvoiceStatus.PARTIALLY_PAID
  );
}
