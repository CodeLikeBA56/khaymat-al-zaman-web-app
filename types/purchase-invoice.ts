import type { Timestamp } from "firebase/firestore";

/**
 * Integer amount stored in minor units for a given currency.
 * Examples:
 * - USD 10.25 -> 1025 (minor unit 2)
 * - JPY 1200 -> 1200 (minor unit 0)
 * - BHD 1.234 -> 1234 (minor unit 3)
 */
export type MinorUnitAmount = number;

/**
 * Explicit currency precision for minor-unit conversion.
 * Do not assume 2 for every currency.
 */
export type CurrencyMinorUnit = number;

export enum PurchaseInvoiceStatus {
  DRAFT = "DRAFT",
  POSTED = "POSTED",
  PARTIALLY_PAID = "PARTIALLY_PAID",
  PAID = "PAID",
  VOID = "VOID",
}

export interface PurchaseInvoiceLine {
  description: string;
  amountMinor: MinorUnitAmount;
}

export interface PurchaseInvoiceDocument {
  invoiceNumber: string;
  supplierId: string;
  invoiceDate: Timestamp;
  dueDate?: Timestamp;
  lines: PurchaseInvoiceLine[];
  subTotalMinor: MinorUnitAmount;
  taxAmountMinor: MinorUnitAmount;
  discountAmountMinor: MinorUnitAmount;
  grandTotalMinor: MinorUnitAmount;
  currency: string;
  currencyMinorUnit: CurrencyMinorUnit;
  status: PurchaseInvoiceStatus;
  notes?: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface PurchaseInvoice extends PurchaseInvoiceDocument {
  id: string;
}

export type CreatePurchaseInvoiceInput = Pick<
  PurchaseInvoiceDocument,
  "supplierId" | "invoiceDate" | "lines" | "currency"
> &
  Partial<
    Pick<
      PurchaseInvoiceDocument,
      | "invoiceNumber"
      | "dueDate"
      | "taxAmountMinor"
      | "discountAmountMinor"
      | "notes"
      | "currencyMinorUnit"
    >
  >;
