import {
  addDoc,
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
  updateDoc,
  where,
  type DocumentData,
  type DocumentSnapshot,
  type QueryConstraint,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type {
  Address,
  CreateSupplierInput,
  Supplier,
  SupplierDocument,
  UpdateSupplierInput,
} from "@/types/supplier";
import { SupplierType } from "@/types/supplier";

const VENDORS_COLLECTION = "vendors";
const META_COLLECTION = "meta";
const SUPPLIER_CODE_COUNTER_DOCUMENT_ID = "vendorCodeCounter";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const SUPPLIER_CODE_PREFIX = "VND";

type SearchField = "name" | "code" | "phone";

type SearchInput = {
  field: SearchField;
  text: string;
};

export type ListSuppliersPageInput = {
  pageSize?: number;
  cursor?: string | null;
  includeInactive?: boolean;
  type?: SupplierType;
  country?: string;
  search?: SearchInput;
};

export type SuppliersPage = {
  suppliers: Supplier[];
  hasMore: boolean;
  nextCursor: string | null;
};

function toSearchValue(value: string) {
  return value.trim().toLowerCase();
}

function normalizeAddress(address: Address): Address {
  const line1 = address.line1.trim();
  const city = address.city.trim();
  const country = address.country.trim();

  if (!line1) {
    throw new Error("Address line 1 is required.");
  }

  if (!city) {
    throw new Error("Address city is required.");
  }

  if (!country) {
    throw new Error("Address country is required.");
  }

  return {
    line1,
    line2: address.line2?.trim() || undefined,
    zip: address.zip?.trim() || undefined,
    city,
    state: address.state?.trim() || undefined,
    country,
  };
}

function normalizeCreateInput(input: CreateSupplierInput) {
  const name = input.name.trim();
  const phone = input.phone.trim();

  if (!name) {
    throw new Error("Supplier name is required.");
  }

  if (!phone) {
    throw new Error("Supplier phone is required.");
  }

  if (!Object.values(SupplierType).includes(input.type)) {
    throw new Error("Supplier type is invalid.");
  }

  return {
    name,
    type: input.type,
    phone,
    address: normalizeAddress(input.address),
    email: input.email?.trim() || undefined,
    taxNumber: input.taxNumber?.trim() || undefined,
    registrationNumber: input.registrationNumber?.trim() || undefined,
  };
}

function assertHasAnyUpdatableField(payload: Record<string, unknown>) {
  const updatableFieldCount = Object.keys(payload).filter(
    (key) => key !== "updatedAt",
  ).length;

  if (updatableFieldCount === 0) {
    throw new Error("No supplier fields were provided to update.");
  }
}

function mapSupplierDocument(
  snapshot:
    | QueryDocumentSnapshot<DocumentData>
    | DocumentSnapshot<DocumentData>,
): Supplier {
  const data = snapshot.data() as
    | (SupplierDocument & {
        nameSearch?: string;
        codeSearch?: string;
        phoneSearch?: string;
        addressCountrySearch?: string;
      })
    | undefined;

  if (!data) {
    throw new Error("Supplier document data is missing.");
  }

  return {
    id: snapshot.id,
    code: data.code,
    name: data.name,
    type: data.type,
    email: data.email,
    phone: data.phone,
    address: data.address,
    taxNumber: data.taxNumber,
    registrationNumber: data.registrationNumber,
    isActive: data.isActive,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

function resolvePageSize(pageSize?: number) {
  if (!pageSize) return DEFAULT_PAGE_SIZE;
  if (!Number.isFinite(pageSize) || pageSize <= 0) {
    throw new Error("Page size must be a positive number.");
  }

  return Math.min(pageSize, MAX_PAGE_SIZE);
}

function resolveSearchField(search?: SearchInput) {
  if (!search?.text.trim()) return null;

  if (!["name", "code", "phone"].includes(search.field)) {
    throw new Error("Search field is invalid.");
  }

  if (search.field === "name") return "nameSearch";
  if (search.field === "code") return "codeSearch";
  return "phoneSearch";
}

function formatSupplierCode(sequenceNumber: number) {
  return `${SUPPLIER_CODE_PREFIX}-${String(sequenceNumber).padStart(6, "0")}`;
}

async function reserveSupplierCode() {
  const counterRef = doc(
    db,
    META_COLLECTION,
    SUPPLIER_CODE_COUNTER_DOCUMENT_ID,
  );

  const sequenceNumber = await runTransaction(db, async (transaction) => {
    const counterSnapshot = await transaction.get(counterRef);
    const lastValue = counterSnapshot.exists()
      ? Number(
          (counterSnapshot.data() as { lastValue?: unknown }).lastValue ?? 0,
        )
      : 0;

    const nextValue =
      Number.isFinite(lastValue) && lastValue > 0 ? lastValue + 1 : 1;

    transaction.set(
      counterRef,
      {
        lastValue: nextValue,
        updatedAt: serverTimestamp(),
        ...(counterSnapshot.exists() ? {} : { createdAt: serverTimestamp() }),
      },
      { merge: true },
    );

    return nextValue;
  });

  return formatSupplierCode(sequenceNumber);
}

export async function createSupplierService(input: CreateSupplierInput) {
  const normalized = normalizeCreateInput(input);
  const code = await reserveSupplierCode();

  const payload: Record<string, unknown> = {
    code,
    name: normalized.name,
    type: normalized.type,
    email: normalized.email,
    phone: normalized.phone,
    address: normalized.address,
    taxNumber: normalized.taxNumber,
    registrationNumber: normalized.registrationNumber,
    isActive: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),

    // Firestore-supported search fields (prefix search only)
    nameSearch: toSearchValue(normalized.name),
    codeSearch: toSearchValue(code),
    phoneSearch: toSearchValue(normalized.phone),
    addressCountrySearch: toSearchValue(normalized.address.country),
  };

  const created = await addDoc(collection(db, VENDORS_COLLECTION), payload);
  return created.id;
}

export async function listSuppliersPageService(
  input: ListSuppliersPageInput = {},
): Promise<SuppliersPage> {
  const pageSize = resolvePageSize(input.pageSize);
  const searchField = resolveSearchField(input.search);
  const searchText = input.search?.text ? toSearchValue(input.search.text) : "";

  if (input.type && !Object.values(SupplierType).includes(input.type)) {
    throw new Error("Supplier type filter is invalid.");
  }

  if (input.type && input.country?.trim()) {
    throw new Error(
      "Please filter by either supplier type or country in a single request.",
    );
  }

  const constraints: QueryConstraint[] = [];

  if (!input.includeInactive) {
    constraints.push(where("isActive", "==", true));
  }

  if (input.type) {
    constraints.push(where("type", "==", input.type));
  }

  if (input.country?.trim()) {
    constraints.push(
      where("addressCountrySearch", "==", toSearchValue(input.country)),
    );
  }

  const orderField = searchField ?? "nameSearch";

  constraints.push(orderBy(orderField, "asc"));

  if (searchField && searchText) {
    constraints.push(where(searchField, ">=", searchText));
    constraints.push(where(searchField, "<=", `${searchText}\uf8ff`));
  }

  if (input.cursor?.trim()) {
    constraints.push(startAfter(toSearchValue(input.cursor)));
  }

  constraints.push(limit(pageSize));

  const snapshot = await getDocs(
    query(collection(db, VENDORS_COLLECTION), ...constraints),
  );

  const suppliers = snapshot.docs.map((item) => mapSupplierDocument(item));

  const lastDocument = snapshot.docs[snapshot.docs.length - 1];
  const nextCursorRaw = (
    lastDocument?.data() as Record<string, unknown> | undefined
  )?.[orderField];

  return {
    suppliers,
    hasMore: snapshot.docs.length === pageSize,
    nextCursor: typeof nextCursorRaw === "string" ? nextCursorRaw : null,
  };
}

export async function getSupplierByIdService(supplierId: string) {
  const normalizedSupplierId = supplierId.trim();
  if (!normalizedSupplierId) {
    throw new Error("Supplier id is required.");
  }

  const snapshot = await getDoc(doc(db, "vendors", normalizedSupplierId));
  if (!snapshot.exists()) return null;

  return mapSupplierDocument(snapshot);
}

export async function updateSupplierService(
  supplierId: string,
  input: UpdateSupplierInput,
) {
  const normalizedSupplierId = supplierId.trim();
  if (!normalizedSupplierId) {
    throw new Error("Supplier id is required.");
  }

  const payload: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };

  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) {
      throw new Error("Supplier name is required.");
    }

    payload.name = name;
    payload.nameSearch = toSearchValue(name);
  }

  if (input.type !== undefined) {
    if (!Object.values(SupplierType).includes(input.type)) {
      throw new Error("Supplier type is invalid.");
    }

    payload.type = input.type;
  }

  if (input.phone !== undefined) {
    const phone = input.phone.trim();
    if (!phone) {
      throw new Error("Supplier phone is required.");
    }

    payload.phone = phone;
    payload.phoneSearch = toSearchValue(phone);
  }

  if (input.address !== undefined) {
    const normalizedAddress = normalizeAddress(input.address);
    payload.address = normalizedAddress;
    payload.addressCountrySearch = toSearchValue(normalizedAddress.country);
  }

  if (input.email !== undefined) {
    payload.email = input.email.trim() || null;
  }

  if (input.taxNumber !== undefined) {
    payload.taxNumber = input.taxNumber.trim() || null;
  }

  if (input.registrationNumber !== undefined) {
    payload.registrationNumber = input.registrationNumber.trim() || null;
  }

  assertHasAnyUpdatableField(payload);

  await updateDoc(doc(db, VENDORS_COLLECTION, normalizedSupplierId), payload);
}
