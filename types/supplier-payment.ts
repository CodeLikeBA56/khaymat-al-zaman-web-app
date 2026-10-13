import type { Timestamp } from "firebase/firestore";

/**
 * Integer amount stored in minor units for a given currency.
 * Examples:
 * - USD 10.25 -> 1025
 * - JPY 1200 -> 1200
 */
export type SupplierPaymentMinorAmount = number;

export enum SupplierPaymentMethod {
  CASH = "CASH",
  BANK_TRANSFER = "BANK_TRANSFER",
  CARD = "CARD",
  CHEQUE = "CHEQUE",
  OTHER = "OTHER",
}

export enum SupplierPaymentStatus {
  RECORDED = "RECORDED",
  VOID = "VOID",
}

export interface SupplierPaymentAllocation {
  invoiceId: string;
  amountMinor: SupplierPaymentMinorAmount;
}

export interface SupplierPaymentDocument {
  paymentNumber: string;
  supplierId: string;
  paymentDate: Timestamp;
  amountMinor: SupplierPaymentMinorAmount;
  currency: string;
  method: SupplierPaymentMethod;
  referenceNumber?: string;
  notes?: string;
  allocations: SupplierPaymentAllocation[];
  status: SupplierPaymentStatus;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface SupplierPayment extends SupplierPaymentDocument {
  id: string;
}

export type CreateSupplierPaymentInput = Pick<
  SupplierPaymentDocument,
  "supplierId" | "paymentDate" | "amountMinor" | "currency" | "method"
> &
  Partial<
    Pick<SupplierPaymentDocument, "referenceNumber" | "notes" | "allocations">
  >;

/**
 * Supports both partial allocation and intentionally unallocated amounts.
 * Allocation sum may be less than or equal to the full payment amount.
 */
export type SupplierPaymentAllocationSummary = {
  allocatedMinor: SupplierPaymentMinorAmount;
  unallocatedMinor: SupplierPaymentMinorAmount;
};

export function validateSupplierPaymentAllocationSummary(input: {
  amountMinor: number;
  allocations?: SupplierPaymentAllocation[];
}): SupplierPaymentAllocationSummary {
  if (!Number.isInteger(input.amountMinor) || input.amountMinor < 0) {
    throw new Error(
      "Payment amount must be a non-negative integer minor amount.",
    );
  }

  const allocations = input.allocations ?? [];
  const allocatedMinor = allocations.reduce((sum, item, index) => {
    if (!item.invoiceId.trim()) {
      throw new Error(`Allocation ${index + 1} invoice id is required.`);
    }

    if (!Number.isInteger(item.amountMinor) || item.amountMinor <= 0) {
      throw new Error(
        `Allocation ${index + 1} amount must be a positive integer minor amount.`,
      );
    }

    return sum + item.amountMinor;
  }, 0);

  if (allocatedMinor > input.amountMinor) {
    throw new Error("Allocated amount cannot exceed payment amount.");
  }

  return {
    allocatedMinor,
    unallocatedMinor: input.amountMinor - allocatedMinor,
  };
}
