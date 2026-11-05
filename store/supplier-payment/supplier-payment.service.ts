import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  startAfter,
  Timestamp,
  where,
  type QueryConstraint,
  type Transaction,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  SUPPLIER_PAYMENT_META_COUNTER_ID,
  SUPPLIER_PAYMENT_NUMBERS_COLLECTION,
  SUPPLIER_PAYMENT_REQUESTS_COLLECTION,
  SUPPLIER_PAYMENTS_COLLECTION,
  applySupplierPaymentAllocationToInvoice,
  assertSupplierPaymentVoidable,
  formatGeneratedSupplierPaymentNumber,
  normalizeSupplierPaymentNumber,
  reverseSupplierPaymentAllocationFromInvoice,
  summarizeSupplierPaymentAllocations,
  type PayableInvoiceFinancialState,
} from "@/lib/supplier-payment";
import {
  normalizeCurrencyCode,
  resolveCurrencyMinorUnit,
  validateCurrencyMinorUnit,
} from "@/lib/purchase-invoice";
import {
  DEFAULT_CURRENCY_CODE,
  DEFAULT_CURRENCY_MINOR_UNIT,
} from "@/config/currency";
import {
  PurchaseInvoiceStatus,
  type PurchaseInvoiceDocument,
} from "@/types/purchase-invoice";
import {
  SupplierPaymentMethod,
  SupplierPaymentStatus,
  type CreateSupplierPaymentInput,
  type SupplierPayment,
  type SupplierPaymentAllocation,
  type SupplierPaymentDocument,
} from "@/types/supplier-payment";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const META_COLLECTION = "meta";
const VENDORS_COLLECTION = "vendors";
const PURCHASE_INVOICES_COLLECTION = "purchaseInvoices";

type SupplierPaymentDocumentInternal = SupplierPaymentDocument & {
  paymentNumberSearch?: string;
  unallocatedAmountMinor?: number;
  voidReason?: string;
  voidedAt?: Timestamp | null;
  idempotencyKey?: string;
};

type PurchaseInvoiceFinancialDocument = PurchaseInvoiceDocument & {
  paymentStatusUpdatedAt?: Timestamp | null;
};

export type RecordSupplierPaymentInput = CreateSupplierPaymentInput & {
  paymentNumber?: string;
  idempotencyKey?: string;
};

export type ListSupplierPaymentsInput = {
  supplierId: string;
  pageSize?: number;
  cursor?: Timestamp | null;
  dateFrom?: Timestamp;
  dateTo?: Timestamp;
  status?: SupplierPaymentStatus;
};

export type SupplierPaymentsPage = {
  payments: SupplierPayment[];
  hasMore: boolean;
  nextCursor: Timestamp | null;
};

export type VoidSupplierPaymentInput = {
  reason: string;
};

function resolvePageSize(pageSize?: number) {
  if (!pageSize) return DEFAULT_PAGE_SIZE;
  if (!Number.isFinite(pageSize) || pageSize <= 0) {
    throw new Error("Page size must be a positive number.");
  }

  return Math.min(pageSize, MAX_PAGE_SIZE);
}

function mapSupplierPaymentDocument(
  id: string,
  data: SupplierPaymentDocumentInternal,
): SupplierPayment {
  return {
    id,
    paymentNumber: data.paymentNumber,
    supplierId: data.supplierId,
    paymentDate: data.paymentDate,
    amountMinor: data.amountMinor,
    currency: data.currency,
    currencyMinorUnit:
      typeof data.currencyMinorUnit === "number"
        ? data.currencyMinorUnit
        : resolveCurrencyMinorUnit(data.currency),
    method: data.method,
    referenceNumber: data.referenceNumber,
    notes: data.notes,
    allocations: data.allocations,
    unallocatedAmountMinor: data.unallocatedAmountMinor ?? 0,
    status: data.status,
    voidReason: data.voidReason,
    voidedAt: data.voidedAt,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

function isSupplierActive(data: Record<string, unknown> | undefined) {
  return data?.isActive === true;
}

function normalizeOptionalText(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeMethod(value: SupplierPaymentMethod) {
  if (!Object.values(SupplierPaymentMethod).includes(value)) {
    throw new Error("Payment method is invalid.");
  }

  return value;
}

function normalizeSupplierId(supplierId: string) {
  const normalized = supplierId.trim();
  if (!normalized) {
    throw new Error("Supplier id is required.");
  }

  return normalized;
}

function normalizeIdempotencyKey(idempotencyKey?: string) {
  const normalized = idempotencyKey?.trim();
  return normalized || undefined;
}

function normalizeDate(value: Timestamp, fieldName: string) {
  if (!(value instanceof Timestamp)) {
    throw new Error(`${fieldName} must be a Firestore Timestamp.`);
  }

  return value;
}

function normalizeAmountMinor(amountMinor: number) {
  if (!Number.isInteger(amountMinor) || amountMinor <= 0) {
    throw new Error("Payment amount must be a positive integer minor amount.");
  }

  return amountMinor;
}

function normalizeDateRange(input: {
  dateFrom?: Timestamp;
  dateTo?: Timestamp;
}) {
  const { dateFrom, dateTo } = input;

  if (dateFrom && !(dateFrom instanceof Timestamp)) {
    throw new Error("Date from must be a Firestore Timestamp.");
  }

  if (dateTo && !(dateTo instanceof Timestamp)) {
    throw new Error("Date to must be a Firestore Timestamp.");
  }

  if (dateFrom && dateTo && dateFrom.toMillis() > dateTo.toMillis()) {
    throw new Error("Date from cannot be after date to.");
  }

  return { dateFrom, dateTo };
}

async function reserveSupplierPaymentNumberInTransaction(
  transaction: Transaction,
  providedPaymentNumber?: string,
) {
  const normalizedProvided = normalizeOptionalText(providedPaymentNumber);
  if (normalizedProvided) {
    const paymentNumber = normalizeSupplierPaymentNumber(normalizedProvided);
    const reservationRef = doc(
      db,
      SUPPLIER_PAYMENT_NUMBERS_COLLECTION,
      paymentNumber,
    );
    const reservationSnapshot = await transaction.get(reservationRef);

    if (reservationSnapshot.exists()) {
      throw new Error("Payment number already exists.");
    }

    transaction.set(reservationRef, {
      paymentNumber,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      source: "manual",
    });

    return paymentNumber;
  }

  const counterRef = doc(db, META_COLLECTION, SUPPLIER_PAYMENT_META_COUNTER_ID);
  const counterSnapshot = await transaction.get(counterRef);
  const lastValue = counterSnapshot.exists()
    ? Number((counterSnapshot.data() as { lastValue?: unknown }).lastValue ?? 0)
    : 0;

  let nextValue =
    Number.isFinite(lastValue) && lastValue > 0 ? lastValue + 1 : 1;

  while (true) {
    const candidate = formatGeneratedSupplierPaymentNumber(nextValue);
    const reservationRef = doc(
      db,
      SUPPLIER_PAYMENT_NUMBERS_COLLECTION,
      candidate,
    );
    const reservationSnapshot = await transaction.get(reservationRef);

    if (!reservationSnapshot.exists()) {
      transaction.set(
        counterRef,
        {
          lastValue: nextValue,
          updatedAt: serverTimestamp(),
          ...(counterSnapshot.exists() ? {} : { createdAt: serverTimestamp() }),
        },
        { merge: true },
      );

      transaction.set(reservationRef, {
        paymentNumber: candidate,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        source: "auto",
      });

      return candidate;
    }

    nextValue += 1;
  }
}

function getInvoiceFinancialState(
  data: PurchaseInvoiceFinancialDocument,
): PayableInvoiceFinancialState {
  const paidAmountMinor = Number.isInteger(data.paidAmountMinor)
    ? data.paidAmountMinor
    : 0;
  const remainingPayableMinor = Number.isInteger(data.remainingPayableMinor)
    ? data.remainingPayableMinor
    : data.grandTotalMinor - paidAmountMinor;

  return {
    status: data.status,
    grandTotalMinor: data.grandTotalMinor,
    paidAmountMinor,
    remainingPayableMinor,
  };
}

export async function recordSupplierPaymentService(
  input: RecordSupplierPaymentInput,
) {
  const supplierId = normalizeSupplierId(input.supplierId);
  const paymentDate = normalizeDate(input.paymentDate, "Payment date");
  const amountMinor = normalizeAmountMinor(input.amountMinor);
  const currency = normalizeCurrencyCode(DEFAULT_CURRENCY_CODE);
  const currencyMinorUnit = validateCurrencyMinorUnit(
    DEFAULT_CURRENCY_MINOR_UNIT,
  );
  const method = normalizeMethod(input.method);
  const idempotencyKey = normalizeIdempotencyKey(input.idempotencyKey);

  const normalizedAllocations = summarizeSupplierPaymentAllocations({
    amountMinor,
    allocations: input.allocations,
  });
  const allocations = input.allocations ? input.allocations : [];
  const groupedAllocations = summarizeSupplierPaymentAllocations({
    amountMinor,
    allocations,
  });

  const groupedAllocationsMap = new Map<string, number>();
  for (const item of allocations) {
    const invoiceId = item.invoiceId.trim();
    if (!invoiceId) continue;
    groupedAllocationsMap.set(
      invoiceId,
      (groupedAllocationsMap.get(invoiceId) ?? 0) + item.amountMinor,
    );
  }

  const groupedAllocationsList: SupplierPaymentAllocation[] = Array.from(
    groupedAllocationsMap.entries(),
  ).map(([invoiceId, amountMinor]) => ({
    invoiceId,
    amountMinor,
  }));

  const result = await runTransaction(db, async (transaction) => {
    if (idempotencyKey) {
      const requestRef = doc(
        db,
        SUPPLIER_PAYMENT_REQUESTS_COLLECTION,
        idempotencyKey,
      );
      const requestSnapshot = await transaction.get(requestRef);
      if (requestSnapshot.exists()) {
        const existingPaymentId = (
          requestSnapshot.data() as { paymentId?: unknown }
        ).paymentId;
        if (typeof existingPaymentId === "string" && existingPaymentId.trim()) {
          return { paymentId: existingPaymentId, isDuplicate: true };
        }
      }
    }

    const supplierRef = doc(db, VENDORS_COLLECTION, supplierId);
    const supplierSnapshot = await transaction.get(supplierRef);
    if (!supplierSnapshot.exists()) {
      throw new Error("Supplier not found.");
    }

    if (!isSupplierActive(supplierSnapshot.data() as Record<string, unknown>)) {
      throw new Error("Supplier is inactive and cannot receive payments.");
    }

    const paymentNumber = await reserveSupplierPaymentNumberInTransaction(
      transaction,
      input.paymentNumber,
    );

    const paymentRef = doc(collection(db, SUPPLIER_PAYMENTS_COLLECTION));

    for (const allocation of groupedAllocationsList) {
      const invoiceRef = doc(
        db,
        PURCHASE_INVOICES_COLLECTION,
        allocation.invoiceId,
      );
      const invoiceSnapshot = await transaction.get(invoiceRef);
      if (!invoiceSnapshot.exists()) {
        throw new Error(
          `Allocated invoice ${allocation.invoiceId} was not found.`,
        );
      }

      const invoice =
        invoiceSnapshot.data() as PurchaseInvoiceFinancialDocument;
      if (invoice.supplierId !== supplierId) {
        throw new Error(
          `Allocated invoice ${allocation.invoiceId} does not belong to supplier.`,
        );
      }

      if (invoice.currency !== currency) {
        throw new Error(
          `Allocated invoice ${allocation.invoiceId} currency does not match payment currency.`,
        );
      }

      if (invoice.currencyMinorUnit !== currencyMinorUnit) {
        throw new Error(
          `Allocated invoice ${allocation.invoiceId} currency precision does not match payment currency precision.`,
        );
      }

      const invoiceFinancialState = getInvoiceFinancialState(invoice);
      if (
        invoiceFinancialState.status !== PurchaseInvoiceStatus.POSTED &&
        invoiceFinancialState.status !== PurchaseInvoiceStatus.PARTIALLY_PAID
      ) {
        throw new Error(
          `Allocated invoice ${allocation.invoiceId} is not payable.`,
        );
      }

      const nextInvoiceState = applySupplierPaymentAllocationToInvoice(
        invoiceFinancialState,
        allocation.amountMinor,
      );

      transaction.update(invoiceRef, {
        paidAmountMinor: nextInvoiceState.paidAmountMinor,
        remainingPayableMinor: nextInvoiceState.remainingPayableMinor,
        status: nextInvoiceState.status,
        paymentStatusUpdatedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    const paymentDoc: Record<string, unknown> = {
      paymentNumber,
      paymentNumberSearch: paymentNumber.toLowerCase(),
      supplierId,
      paymentDate,
      amountMinor,
      currency,
      currencyMinorUnit,
      method,
      ...(normalizeOptionalText(input.referenceNumber)
        ? { referenceNumber: normalizeOptionalText(input.referenceNumber) }
        : {}),
      ...(normalizeOptionalText(input.notes)
        ? { notes: normalizeOptionalText(input.notes) }
        : {}),
      allocations: groupedAllocationsList,
      unallocatedAmountMinor: groupedAllocations.unallocatedMinor,
      status: SupplierPaymentStatus.RECORDED,
      ...(idempotencyKey ? { idempotencyKey } : {}),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    transaction.set(paymentRef, paymentDoc);

    if (idempotencyKey) {
      const requestRef = doc(
        db,
        SUPPLIER_PAYMENT_REQUESTS_COLLECTION,
        idempotencyKey,
      );
      transaction.set(requestRef, {
        paymentId: paymentRef.id,
        supplierId,
        paymentNumber,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    return { paymentId: paymentRef.id, isDuplicate: false };
  });

  return {
    paymentId: result.paymentId,
    isDuplicate: result.isDuplicate,
    allocatedMinor: normalizedAllocations.allocatedMinor,
    unallocatedMinor: normalizedAllocations.unallocatedMinor,
  };
}

export async function getSupplierPaymentByIdService(paymentId: string) {
  const normalizedPaymentId = paymentId.trim();
  if (!normalizedPaymentId) {
    throw new Error("Payment id is required.");
  }

  const snapshot = await getDoc(
    doc(db, SUPPLIER_PAYMENTS_COLLECTION, normalizedPaymentId),
  );
  if (!snapshot.exists()) return null;

  return mapSupplierPaymentDocument(
    snapshot.id,
    snapshot.data() as SupplierPaymentDocumentInternal,
  );
}

export async function listSupplierPaymentsBySupplierService(
  input: ListSupplierPaymentsInput,
): Promise<SupplierPaymentsPage> {
  const supplierId = normalizeSupplierId(input.supplierId);
  const pageSize = resolvePageSize(input.pageSize);
  const { dateFrom, dateTo } = normalizeDateRange({
    dateFrom: input.dateFrom,
    dateTo: input.dateTo,
  });

  const constraints: QueryConstraint[] = [
    where("supplierId", "==", supplierId),
  ];

  if (input.status) {
    constraints.push(where("status", "==", input.status));
  }

  if (dateFrom) {
    constraints.push(where("paymentDate", ">=", dateFrom));
  }

  if (dateTo) {
    constraints.push(where("paymentDate", "<=", dateTo));
  }

  constraints.push(orderBy("paymentDate", "desc"));

  if (input.cursor) {
    constraints.push(startAfter(input.cursor));
  }

  constraints.push(limit(pageSize));

  const snapshot = await getDocs(
    query(collection(db, SUPPLIER_PAYMENTS_COLLECTION), ...constraints),
  );

  const payments = snapshot.docs.map((item) =>
    mapSupplierPaymentDocument(
      item.id,
      item.data() as SupplierPaymentDocumentInternal,
    ),
  );

  const lastDocument = snapshot.docs[snapshot.docs.length - 1];
  const nextCursorRaw = (
    lastDocument?.data() as { paymentDate?: unknown } | undefined
  )?.paymentDate;

  return {
    payments,
    hasMore: snapshot.docs.length === pageSize,
    nextCursor: nextCursorRaw instanceof Timestamp ? nextCursorRaw : null,
  };
}

export async function voidSupplierPaymentService(
  paymentId: string,
  input: VoidSupplierPaymentInput,
) {
  const normalizedPaymentId = paymentId.trim();
  if (!normalizedPaymentId) {
    throw new Error("Payment id is required.");
  }

  const reason = input.reason.trim();
  if (!reason) {
    throw new Error("Void reason is required.");
  }

  await runTransaction(db, async (transaction) => {
    const paymentRef = doc(
      db,
      SUPPLIER_PAYMENTS_COLLECTION,
      normalizedPaymentId,
    );
    const paymentSnapshot = await transaction.get(paymentRef);
    if (!paymentSnapshot.exists()) {
      throw new Error("Payment not found.");
    }

    const payment = paymentSnapshot.data() as SupplierPaymentDocumentInternal;

    if (payment.status === SupplierPaymentStatus.VOID) {
      return;
    }

    assertSupplierPaymentVoidable(payment.status);

    const allocations = payment.allocations ?? [];

    for (const allocation of allocations) {
      const invoiceRef = doc(
        db,
        PURCHASE_INVOICES_COLLECTION,
        allocation.invoiceId,
      );
      const invoiceSnapshot = await transaction.get(invoiceRef);
      if (!invoiceSnapshot.exists()) {
        throw new Error(
          `Allocated invoice ${allocation.invoiceId} was not found.`,
        );
      }

      const invoice =
        invoiceSnapshot.data() as PurchaseInvoiceFinancialDocument;
      if (invoice.supplierId !== payment.supplierId) {
        throw new Error(
          `Allocated invoice ${allocation.invoiceId} does not belong to supplier.`,
        );
      }

      if (invoice.currency !== payment.currency) {
        throw new Error(
          `Allocated invoice ${allocation.invoiceId} currency does not match payment currency.`,
        );
      }

      const invoiceCurrencyMinorUnit =
        typeof invoice.currencyMinorUnit === "number"
          ? invoice.currencyMinorUnit
          : resolveCurrencyMinorUnit(invoice.currency);
      const paymentCurrencyMinorUnit =
        typeof payment.currencyMinorUnit === "number"
          ? payment.currencyMinorUnit
          : resolveCurrencyMinorUnit(payment.currency);

      if (invoiceCurrencyMinorUnit !== paymentCurrencyMinorUnit) {
        throw new Error(
          `Allocated invoice ${allocation.invoiceId} currency precision does not match payment currency precision.`,
        );
      }

      if (invoice.status === PurchaseInvoiceStatus.VOID) {
        throw new Error(
          `Allocated invoice ${allocation.invoiceId} is void and cannot be reversed.`,
        );
      }

      const invoiceFinancialState = getInvoiceFinancialState(invoice);
      const nextInvoiceState = reverseSupplierPaymentAllocationFromInvoice(
        invoiceFinancialState,
        allocation.amountMinor,
      );

      transaction.update(invoiceRef, {
        paidAmountMinor: nextInvoiceState.paidAmountMinor,
        remainingPayableMinor: nextInvoiceState.remainingPayableMinor,
        status: nextInvoiceState.status,
        paymentStatusUpdatedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    transaction.update(paymentRef, {
      status: SupplierPaymentStatus.VOID,
      voidReason: reason,
      voidedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
}

export const __supplierPaymentServiceInternals = {
  normalizeDateRange,
  normalizeAmountMinor,
  normalizeIdempotencyKey,
};
