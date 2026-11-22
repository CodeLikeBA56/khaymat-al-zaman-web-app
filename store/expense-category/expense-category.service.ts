import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  setDoc,
  where,
  type DocumentData,
  type DocumentSnapshot,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import type {
  CreateExpenseCategoryInput,
  ExpenseCategory,
  ExpenseCategoryDocument,
  UpdateExpenseCategoryInput,
} from "@/types/expense";

const EXPENSE_CATEGORIES_COLLECTION = "expenseCategories";

function getAuthenticatedUid() {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("You must be signed in.");
  return uid;
}

function mapExpenseCategory(
  snapshot:
    | QueryDocumentSnapshot<DocumentData>
    | DocumentSnapshot<DocumentData>,
): ExpenseCategory {
  const data = snapshot.data() as ExpenseCategoryDocument | undefined;
  if (!data) throw new Error("Expense category document data is missing.");
  return { id: snapshot.id, ...data };
}

function normalizeName(name: string) {
  const normalized = name.trim();
  if (!normalized) throw new Error("Expense category name is required.");
  return normalized;
}

export async function createExpenseCategory(input: CreateExpenseCategoryInput) {
  const userId = getAuthenticatedUid();
  const name = normalizeName(input.name);
  const categoryRef = doc(collection(db, EXPENSE_CATEGORIES_COLLECTION));

  await setDoc(categoryRef, {
    userId,
    name,
    ...(input.description?.trim()
      ? { description: input.description.trim() }
      : {}),
    ...(input.icon?.trim() ? { icon: input.icon.trim() } : {}),
    ...(input.color?.trim() ? { color: input.color.trim() } : {}),
    isActive: input.isActive ?? true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const created = await getDoc(categoryRef);
  if (!created.exists())
    throw new Error("Could not load the created category.");
  return mapExpenseCategory(created);
}

export async function getExpenseCategories(): Promise<ExpenseCategory[]> {
  const userId = getAuthenticatedUid();
  const snapshot = await getDocs(
    query(
      collection(db, EXPENSE_CATEGORIES_COLLECTION),
      where("userId", "==", userId),
      orderBy("name"),
    ),
  );
  return snapshot.docs.map(mapExpenseCategory);
}

export async function getExpenseCategoryById(categoryId: string) {
  const normalizedId = categoryId.trim();
  if (!normalizedId) throw new Error("Expense category id is required.");
  const snapshot = await getDoc(
    doc(db, EXPENSE_CATEGORIES_COLLECTION, normalizedId),
  );
  if (!snapshot.exists()) return null;

  const category = mapExpenseCategory(snapshot);
  if (category.userId !== getAuthenticatedUid()) return null;
  return category;
}

export async function updateExpenseCategory(
  categoryId: string,
  input: UpdateExpenseCategoryInput,
) {
  const category = await getExpenseCategoryById(categoryId);
  if (!category) throw new Error("Expense category not found.");

  const updates: Record<string, unknown> = { updatedAt: serverTimestamp() };
  if (input.name !== undefined) updates.name = normalizeName(input.name);
  if (input.description !== undefined)
    updates.description = input.description?.trim() || "";
  if (input.icon !== undefined) updates.icon = input.icon?.trim() || "";
  if (input.color !== undefined) updates.color = input.color?.trim() || "";
  if (input.isActive !== undefined) updates.isActive = input.isActive;

  await updateDoc(doc(db, EXPENSE_CATEGORIES_COLLECTION, category.id), updates);
  return (await getExpenseCategoryById(category.id)) as ExpenseCategory;
}

export async function deactivateExpenseCategory(categoryId: string) {
  const category = await getExpenseCategoryById(categoryId);
  if (!category) throw new Error("Expense category not found.");
  await updateDoc(doc(db, EXPENSE_CATEGORIES_COLLECTION, category.id), {
    isActive: false,
    updatedAt: serverTimestamp(),
  });
  return { ...category, isActive: false };
}
