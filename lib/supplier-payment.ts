import { PurchaseInvoiceStatus } from "@/types/purchase-invoice";
import {
  SupplierPaymentStatus,
  type SupplierPaymentAllocation,
  type SupplierPaymentAllocationSummary,
} from "@/types/supplier-payment";

export const SUPPLIER_PAYMENTS_COLLECTION = "supplierPayments";
export const SUPPLIER_PAYMENT_NUMBERS_COLLECTION = "supplierPaymentNumbers";
export const SUPPLIER_PAYMENT_REQUESTS_COLLECTION = "supplierPaymentRequests";
export const SUPPLIER_PAYMENT_META_COUNTER_ID = "supplierPaymentNumberCounter";

export type PayableInvoiceFinancialState = {
  status: PurchaseInvoiceStatus;
  grandTotalMinor: number;
  paidAmountMinor: number;
  remainingPayableMinor: number;
};

export function normalizeSupplierPaymentNumber(paymentNumber: string) {
  const normalized = paymentNumber.trim().toUpperCase();
  if (!normalized) {
    throw new Error("Payment number is required.");
  }

  if (!/^[A-Z0-9\-/]+$/.test(normalized)) {
    throw new Error("Payment number contains invalid characters.");
  }

  return normalized;
}

export function formatGeneratedSupplierPaymentNumber(sequenceNumber: number) {
  if (!Number.isInteger(sequenceNumber) || sequenceNumber <= 0) {
    throw new Error("Payment sequence must be a positive integer.");
  }

  return `SPAY-${String(sequenceNumber).padStart(6, "0")}`;
}

export function normalizePaymentAllocations(
  allocations?: SupplierPaymentAllocation[],
): SupplierPaymentAllocation[] {
  const normalized = allocations ?? [];
  const grouped = new Map<string, number>();

  for (const [index, allocation] of normalized.entries()) {
    const invoiceId = allocation.invoiceId.trim();
    if (!invoiceId) {
      throw new Error(`Allocation ${index + 1} invoice id is required.`);
    }

    if (
      !Number.isInteger(allocation.amountMinor) ||
      allocation.amountMinor <= 0
    ) {
      throw new Error(
        `Allocation ${index + 1} amount must be a positive integer minor amount.`,
      );
    }

    grouped.set(
      invoiceId,
      (grouped.get(invoiceId) ?? 0) + allocation.amountMinor,
    );
  }

  return Array.from(grouped.entries()).map(([invoiceId, amountMinor]) => ({
    invoiceId,
    amountMinor,
  }));
}

export function summarizeSupplierPaymentAllocations(input: {
  amountMinor: number;
  allocations?: SupplierPaymentAllocation[];
}): SupplierPaymentAllocationSummary {
  if (!Number.isInteger(input.amountMinor) || input.amountMinor <= 0) {
    throw new Error("Payment amount must be a positive integer minor amount.");
  }

  const allocations = normalizePaymentAllocations(input.allocations);
  const allocatedMinor = allocations.reduce(
    (sum, item) => sum + item.amountMinor,
    0,
  );

  if (allocatedMinor > input.amountMinor) {
    throw new Error("Allocated amount cannot exceed payment amount.");
  }

  return {
    allocatedMinor,
    unallocatedMinor: input.amountMinor - allocatedMinor,
  };
}

export function derivePayableInvoiceStatus(
  paidAmountMinor: number,
  remainingPayableMinor: number,
): PurchaseInvoiceStatus {
  if (remainingPayableMinor <= 0) {
    return PurchaseInvoiceStatus.PAID;
  }

  if (paidAmountMinor <= 0) {
    return PurchaseInvoiceStatus.POSTED;
  }

  return PurchaseInvoiceStatus.PARTIALLY_PAID;
}

export function applySupplierPaymentAllocationToInvoice(
  invoice: PayableInvoiceFinancialState,
  allocationAmountMinor: number,
): PayableInvoiceFinancialState {
  if (
    invoice.status !== PurchaseInvoiceStatus.POSTED &&
    invoice.status !== PurchaseInvoiceStatus.PARTIALLY_PAID
  ) {
    throw new Error(
      "Only posted and partially paid invoices can receive allocations.",
    );
  }

  if (!Number.isInteger(allocationAmountMinor) || allocationAmountMinor <= 0) {
    throw new Error(
      "Allocation amount must be a positive integer minor amount.",
    );
  }

  if (allocationAmountMinor > invoice.remainingPayableMinor) {
    throw new Error("Allocation exceeds invoice remaining payable balance.");
  }

  const paidAmountMinor = invoice.paidAmountMinor + allocationAmountMinor;
  const remainingPayableMinor =
    invoice.remainingPayableMinor - allocationAmountMinor;

  return {
    ...invoice,
    paidAmountMinor,
    remainingPayableMinor,
    status: derivePayableInvoiceStatus(paidAmountMinor, remainingPayableMinor),
  };
}

export function reverseSupplierPaymentAllocationFromInvoice(
  invoice: PayableInvoiceFinancialState,
  allocationAmountMinor: number,
): PayableInvoiceFinancialState {
  if (!Number.isInteger(allocationAmountMinor) || allocationAmountMinor <= 0) {
    throw new Error(
      "Allocation amount must be a positive integer minor amount.",
    );
  }

  if (allocationAmountMinor > invoice.paidAmountMinor) {
    throw new Error("Cannot reverse more than invoice paid amount.");
  }

  const paidAmountMinor = invoice.paidAmountMinor - allocationAmountMinor;
  const remainingPayableMinor =
    invoice.remainingPayableMinor + allocationAmountMinor;

  if (paidAmountMinor + remainingPayableMinor !== invoice.grandTotalMinor) {
    throw new Error("Invoice financial state is inconsistent for reversal.");
  }

  return {
    ...invoice,
    paidAmountMinor,
    remainingPayableMinor,
    status: derivePayableInvoiceStatus(paidAmountMinor, remainingPayableMinor),
  };
}

export function assertSupplierPaymentVoidable(status: SupplierPaymentStatus) {
  if (status !== SupplierPaymentStatus.RECORDED) {
    throw new Error("Only recorded payments can be voided.");
  }
}
