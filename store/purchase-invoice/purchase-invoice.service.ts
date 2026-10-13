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
  setDoc,
  startAfter,
  Timestamp,
  updateDoc,
  where,
  type DocumentData,
  type DocumentSnapshot,
  type QueryConstraint,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  PURCHASE_INVOICE_META_COUNTER_ID,
  PURCHASE_INVOICE_NUMBERS_COLLECTION,
  PURCHASE_INVOICES_COLLECTION,
  calculateInvoiceTotals,
  canVoidStatus,
  formatGeneratedInvoiceNumber,
  normalizeCurrencyCode,
  normalizeInvoiceNumber,
  validateCurrencyMinorUnit,
  validateLineItems,
} from "@/lib/purchase-invoice";
import {
  getSupplierByIdService,
  type ListSuppliersPageInput,
  listSuppliersPageService,
} from "@/store/supplier/supplier.service";
import {
  PurchaseInvoiceStatus,
  type CreatePurchaseInvoiceInput,
  type PurchaseInvoice,
  type PurchaseInvoiceDocument,
  type PurchaseInvoiceLine,
} from "@/types/purchase-invoice";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const PURCHASE_INVOICE_META_COLLECTION = "meta";

type PurchaseInvoiceDocumentInternal = PurchaseInvoiceDocument & {
  invoiceNumberSearch?: string;
  postedAt?: Timestamp | null;
  voidedAt?: Timestamp | null;
  voidReason?: string;
};

export type PurchaseInvoiceDateRangeFilter = {
  from?: Timestamp;
  to?: Timestamp;
};

export type ListPurchaseInvoicesPageInput = {
  pageSize?: number;
  cursor?: Timestamp | null;
  supplierId?: string;
  status?: PurchaseInvoiceStatus;
  dateRange?: PurchaseInvoiceDateRangeFilter;
  invoiceNumber?: string;
};

export type PurchaseInvoicesPage = {
  invoices: PurchaseInvoice[];
  hasMore: boolean;
  nextCursor: Timestamp | null;
};

export type UpdateDraftPurchaseInvoiceInput = Partial<
  Pick<
    CreatePurchaseInvoiceInput,
    | "supplierId"
    | "invoiceDate"
    | "dueDate"
    | "lines"
    | "currency"
    | "currencyMinorUnit"
    | "taxAmountMinor"
    | "discountAmountMinor"
    | "notes"
  >
>;

function resolvePageSize(pageSize?: number) {
  if (!pageSize) return DEFAULT_PAGE_SIZE;
  if (!Number.isFinite(pageSize) || pageSize <= 0) {
    throw new Error("Page size must be a positive number.");
  }

  return Math.min(pageSize, MAX_PAGE_SIZE);
}

function mapPurchaseInvoiceDocument(
  snapshot:
    | QueryDocumentSnapshot<DocumentData>
    | DocumentSnapshot<DocumentData>,
): PurchaseInvoice {
  const data = snapshot.data() as PurchaseInvoiceDocumentInternal | undefined;
  if (!data) {
    throw new Error("Purchase invoice document data is missing.");
  }

  return {
    id: snapshot.id,
    invoiceNumber: data.invoiceNumber,
    supplierId: data.supplierId,
    invoiceDate: data.invoiceDate,
    dueDate: data.dueDate,
    lines: data.lines,
    subTotalMinor: data.subTotalMinor,
    taxAmountMinor: data.taxAmountMinor,
    discountAmountMinor: data.discountAmountMinor,
    grandTotalMinor: data.grandTotalMinor,
    currency: data.currency,
    currencyMinorUnit: data.currencyMinorUnit,
    status: data.status,
    notes: data.notes,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

async function assertActiveSupplierExists(supplierId: string) {
  const normalizedSupplierId = supplierId.trim();
  if (!normalizedSupplierId) {
    throw new Error("Supplier id is required.");
  }

  const supplier = await getSupplierByIdService(normalizedSupplierId);
  if (!supplier) {
    throw new Error("Supplier not found.");
  }

  if (!supplier.isActive) {
    throw new Error("Supplier is inactive and cannot be used for invoices.");
  }

  return normalizedSupplierId;
}

function normalizeLines(lines: PurchaseInvoiceLine[]) {
  return validateLineItems(lines);
}

function normalizeOptionalText(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeDateRange(input?: PurchaseInvoiceDateRangeFilter) {
  if (!input) return undefined;

  const from = input.from;
  const to = input.to;

  if (from && !(from instanceof Timestamp)) {
    throw new Error("Date range 'from' must be a Firestore Timestamp.");
  }

  if (to && !(to instanceof Timestamp)) {
    throw new Error("Date range 'to' must be a Firestore Timestamp.");
  }

  if (from && to && from.toMillis() > to.toMillis()) {
    throw new Error("Date range 'from' cannot be after 'to'.");
  }

  return { from, to };
}

async function reserveProvidedInvoiceNumber(normalizedInvoiceNumber: string) {
  const reservationRef = doc(
    db,
    PURCHASE_INVOICE_NUMBERS_COLLECTION,
    normalizedInvoiceNumber,
  );

  await runTransaction(db, async (transaction) => {
    const reservationSnapshot = await transaction.get(reservationRef);
    if (reservationSnapshot.exists()) {
      throw new Error("Invoice number already exists.");
    }

    transaction.set(reservationRef, {
      invoiceNumber: normalizedInvoiceNumber,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      source: "manual",
    });
  });

  return normalizedInvoiceNumber;
}

async function reserveGeneratedInvoiceNumber() {
  const counterRef = doc(
    db,
    PURCHASE_INVOICE_META_COLLECTION,
    PURCHASE_INVOICE_META_COUNTER_ID,
  );

  const invoiceNumber = await runTransaction(db, async (transaction) => {
    const counterSnapshot = await transaction.get(counterRef);
    const lastValue = counterSnapshot.exists()
      ? Number(
          (counterSnapshot.data() as { lastValue?: unknown }).lastValue ?? 0,
        )
      : 0;

    let nextValue =
      Number.isFinite(lastValue) && lastValue > 0 ? lastValue + 1 : 1;

    while (true) {
      const candidate = formatGeneratedInvoiceNumber(nextValue);
      const reservationRef = doc(
        db,
        PURCHASE_INVOICE_NUMBERS_COLLECTION,
        candidate,
      );
      const reservationSnapshot = await transaction.get(reservationRef);

      if (!reservationSnapshot.exists()) {
        transaction.set(
          counterRef,
          {
            lastValue: nextValue,
            updatedAt: serverTimestamp(),
            ...(counterSnapshot.exists()
              ? {}
              : { createdAt: serverTimestamp() }),
          },
          { merge: true },
        );

        transaction.set(reservationRef, {
          invoiceNumber: candidate,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          source: "auto",
        });

        return candidate;
      }

      nextValue += 1;
    }
  });

  return invoiceNumber;
}

async function reserveInvoiceNumber(invoiceNumber?: string) {
  const normalized = normalizeOptionalText(invoiceNumber);
  if (normalized) {
    return reserveProvidedInvoiceNumber(normalizeInvoiceNumber(normalized));
  }

  return reserveGeneratedInvoiceNumber();
}

function assertDraftEditableStatus(status: PurchaseInvoiceStatus) {
  if (status !== PurchaseInvoiceStatus.DRAFT) {
    throw new Error("Only draft invoices can be updated.");
  }
}

function assertPostableStatus(status: PurchaseInvoiceStatus) {
  if (status !== PurchaseInvoiceStatus.DRAFT) {
    throw new Error("Only draft invoices can be posted.");
  }
}

function assertVoidableStatus(status: PurchaseInvoiceStatus) {
  if (!canVoidStatus(status)) {
    throw new Error("Only draft or posted invoices can be voided.");
  }
}

function assertUpdateDraftInputAllowed(input: UpdateDraftPurchaseInvoiceInput) {
  const forbiddenKeys = [
    "status",
    "subTotalMinor",
    "grandTotalMinor",
    "invoiceNumber",
  ];
  const inputRecord = input as Record<string, unknown>;

  for (const key of forbiddenKeys) {
    if (key in inputRecord) {
      throw new Error(
        `Field '${key}' is controlled by business logic and cannot be updated directly.`,
      );
    }
  }
}

export async function createPurchaseInvoiceDraftService(
  input: CreatePurchaseInvoiceInput,
) {
  const supplierId = await assertActiveSupplierExists(input.supplierId);

  if (!(input.invoiceDate instanceof Timestamp)) {
    throw new Error("Invoice date must be a Firestore Timestamp.");
  }

  const lines = normalizeLines(input.lines);
  const currency = normalizeCurrencyCode(input.currency);
  const currencyMinorUnit = validateCurrencyMinorUnit(
    input.currencyMinorUnit ?? 2,
  );

  const totals = calculateInvoiceTotals({
    lines,
    taxAmountMinor: input.taxAmountMinor ?? 0,
    discountAmountMinor: input.discountAmountMinor ?? 0,
  });

  const reservedInvoiceNumber = await reserveInvoiceNumber(input.invoiceNumber);

  const invoiceRef = doc(collection(db, PURCHASE_INVOICES_COLLECTION));

  const payload: Record<string, unknown> = {
    invoiceNumber: reservedInvoiceNumber,
    invoiceNumberSearch: reservedInvoiceNumber.toLowerCase(),
    supplierId,
    invoiceDate: input.invoiceDate,
    ...(input.dueDate ? { dueDate: input.dueDate } : {}),
    lines,
    subTotalMinor: totals.subTotalMinor,
    taxAmountMinor: totals.taxAmountMinor,
    discountAmountMinor: totals.discountAmountMinor,
    grandTotalMinor: totals.grandTotalMinor,
    currency,
    currencyMinorUnit,
    status: PurchaseInvoiceStatus.DRAFT,
    ...(normalizeOptionalText(input.notes)
      ? { notes: normalizeOptionalText(input.notes) }
      : {}),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(invoiceRef, payload);
  return invoiceRef.id;
}

export async function getPurchaseInvoiceByIdService(invoiceId: string) {
  const normalizedInvoiceId = invoiceId.trim();
  if (!normalizedInvoiceId) {
    throw new Error("Invoice id is required.");
  }

  const snapshot = await getDoc(
    doc(db, PURCHASE_INVOICES_COLLECTION, normalizedInvoiceId),
  );
  if (!snapshot.exists()) return null;
  return mapPurchaseInvoiceDocument(snapshot);
}

function assertListFilterCompatibility(input: ListPurchaseInvoicesPageInput) {
  if (
    input.invoiceNumber &&
    input.dateRange &&
    (input.dateRange.from || input.dateRange.to)
  ) {
    throw new Error(
      "Invoice number filter cannot be combined with date range filter in a single query.",
    );
  }

  if (input.invoiceNumber && input.cursor) {
    throw new Error(
      "Invoice number filter does not support cursor pagination.",
    );
  }
}

export async function listPurchaseInvoicesPageService(
  input: ListPurchaseInvoicesPageInput = {},
): Promise<PurchaseInvoicesPage> {
  const pageSize = resolvePageSize(input.pageSize);
  assertListFilterCompatibility(input);

  const constraints: QueryConstraint[] = [];

  if (input.supplierId?.trim()) {
    constraints.push(where("supplierId", "==", input.supplierId.trim()));
  }

  if (input.status) {
    constraints.push(where("status", "==", input.status));
  }

  const dateRange = normalizeDateRange(input.dateRange);
  if (dateRange?.from) {
    constraints.push(where("invoiceDate", ">=", dateRange.from));
  }

  if (dateRange?.to) {
    constraints.push(where("invoiceDate", "<=", dateRange.to));
  }

  if (input.invoiceNumber?.trim()) {
    constraints.push(
      where(
        "invoiceNumberSearch",
        "==",
        normalizeInvoiceNumber(input.invoiceNumber).toLowerCase(),
      ),
    );
    constraints.push(limit(pageSize));

    const snapshot = await getDocs(
      query(collection(db, PURCHASE_INVOICES_COLLECTION), ...constraints),
    );

    return {
      invoices: snapshot.docs.map((item) => mapPurchaseInvoiceDocument(item)),
      hasMore: false,
      nextCursor: null,
    };
  }

  constraints.push(orderBy("invoiceDate", "desc"));

  if (input.cursor) {
    constraints.push(startAfter(input.cursor));
  }

  constraints.push(limit(pageSize));

  const snapshot = await getDocs(
    query(collection(db, PURCHASE_INVOICES_COLLECTION), ...constraints),
  );

  const invoices = snapshot.docs.map((item) =>
    mapPurchaseInvoiceDocument(item),
  );
  const lastDocument = snapshot.docs[snapshot.docs.length - 1];
  const nextCursorRaw = (
    lastDocument?.data() as { invoiceDate?: unknown } | undefined
  )?.invoiceDate;

  return {
    invoices,
    hasMore: snapshot.docs.length === pageSize,
    nextCursor: nextCursorRaw instanceof Timestamp ? nextCursorRaw : null,
  };
}

export async function updateDraftPurchaseInvoiceService(
  invoiceId: string,
  input: UpdateDraftPurchaseInvoiceInput,
) {
  const normalizedInvoiceId = invoiceId.trim();
  if (!normalizedInvoiceId) {
    throw new Error("Invoice id is required.");
  }

  assertUpdateDraftInputAllowed(input);

  const invoiceRef = doc(db, PURCHASE_INVOICES_COLLECTION, normalizedInvoiceId);
  const snapshot = await getDoc(invoiceRef);
  if (!snapshot.exists()) {
    throw new Error("Invoice not found.");
  }

  const current = snapshot.data() as PurchaseInvoiceDocumentInternal;
  assertDraftEditableStatus(current.status);

  const nextSupplierId =
    input.supplierId !== undefined
      ? await assertActiveSupplierExists(input.supplierId)
      : current.supplierId;

  const nextInvoiceDate =
    input.invoiceDate !== undefined ? input.invoiceDate : current.invoiceDate;

  if (!(nextInvoiceDate instanceof Timestamp)) {
    throw new Error("Invoice date must be a Firestore Timestamp.");
  }

  const nextLines =
    input.lines !== undefined ? normalizeLines(input.lines) : current.lines;
  const nextCurrency =
    input.currency !== undefined
      ? normalizeCurrencyCode(input.currency)
      : current.currency;

  const nextCurrencyMinorUnit =
    input.currencyMinorUnit !== undefined
      ? validateCurrencyMinorUnit(input.currencyMinorUnit)
      : current.currencyMinorUnit;

  const totals = calculateInvoiceTotals({
    lines: nextLines,
    taxAmountMinor:
      input.taxAmountMinor !== undefined
        ? input.taxAmountMinor
        : current.taxAmountMinor,
    discountAmountMinor:
      input.discountAmountMinor !== undefined
        ? input.discountAmountMinor
        : current.discountAmountMinor,
  });

  const payload: Record<string, unknown> = {
    supplierId: nextSupplierId,
    invoiceDate: nextInvoiceDate,
    ...(input.dueDate !== undefined ? { dueDate: input.dueDate ?? null } : {}),
    lines: nextLines,
    subTotalMinor: totals.subTotalMinor,
    taxAmountMinor: totals.taxAmountMinor,
    discountAmountMinor: totals.discountAmountMinor,
    grandTotalMinor: totals.grandTotalMinor,
    currency: nextCurrency,
    currencyMinorUnit: nextCurrencyMinorUnit,
    ...(input.notes !== undefined
      ? { notes: normalizeOptionalText(input.notes) ?? null }
      : {}),
    updatedAt: serverTimestamp(),
  };

  await updateDoc(invoiceRef, payload);
}

export async function postPurchaseInvoiceService(invoiceId: string) {
  const normalizedInvoiceId = invoiceId.trim();
  if (!normalizedInvoiceId) {
    throw new Error("Invoice id is required.");
  }

  const invoiceRef = doc(db, PURCHASE_INVOICES_COLLECTION, normalizedInvoiceId);
  const snapshot = await getDoc(invoiceRef);
  if (!snapshot.exists()) {
    throw new Error("Invoice not found.");
  }

  const current = snapshot.data() as PurchaseInvoiceDocumentInternal;
  if (current.status === PurchaseInvoiceStatus.POSTED) {
    return;
  }

  assertPostableStatus(current.status);

  await assertActiveSupplierExists(current.supplierId);

  const totals = calculateInvoiceTotals({
    lines: current.lines,
    taxAmountMinor: current.taxAmountMinor,
    discountAmountMinor: current.discountAmountMinor,
  });

  await updateDoc(invoiceRef, {
    subTotalMinor: totals.subTotalMinor,
    taxAmountMinor: totals.taxAmountMinor,
    discountAmountMinor: totals.discountAmountMinor,
    grandTotalMinor: totals.grandTotalMinor,
    status: PurchaseInvoiceStatus.POSTED,
    postedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export type VoidPurchaseInvoiceInput = {
  reason: string;
};

export async function voidPurchaseInvoiceService(
  invoiceId: string,
  input: VoidPurchaseInvoiceInput,
) {
  const normalizedInvoiceId = invoiceId.trim();
  if (!normalizedInvoiceId) {
    throw new Error("Invoice id is required.");
  }

  const reason = input.reason.trim();
  if (!reason) {
    throw new Error("Void reason is required.");
  }

  const invoiceRef = doc(db, PURCHASE_INVOICES_COLLECTION, normalizedInvoiceId);
  const snapshot = await getDoc(invoiceRef);
  if (!snapshot.exists()) {
    throw new Error("Invoice not found.");
  }

  const current = snapshot.data() as PurchaseInvoiceDocumentInternal;
  if (current.status === PurchaseInvoiceStatus.VOID) {
    return;
  }

  assertVoidableStatus(current.status);

  await updateDoc(invoiceRef, {
    status: PurchaseInvoiceStatus.VOID,
    voidReason: reason,
    voidedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function validateInvoiceSupplierSelectableForNewInvoices(
  supplierId: string,
) {
  await assertActiveSupplierExists(supplierId);
}

export const __purchaseInvoiceServiceInternals = {
  assertDraftEditableStatus,
  assertPostableStatus,
  assertVoidableStatus,
  assertListFilterCompatibility,
  assertUpdateDraftInputAllowed,
  normalizeDateRange,
};

export async function listActiveSuppliersForInvoiceService() {
  const input: ListSuppliersPageInput = {
    status: "active",
    pageSize: 100,
  };

  const result = await listSuppliersPageService(input);
  return result.suppliers;
}
