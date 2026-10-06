import {
  doc,
  query,
  getDoc,
  getDocs,
  orderBy,
  collection,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { EmploymentPeriod } from "@/types/user";
import type { UserDocument } from "@/types/user";

function toSerializableDate(value: unknown): unknown {
  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as { toDate?: () => Date }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }

  if (
    typeof value === "object" &&
    value !== null &&
    "seconds" in value &&
    typeof (value as { seconds?: unknown }).seconds === "number"
  ) {
    const millis = (value as { seconds: number }).seconds * 1000;
    return new Date(millis).toISOString();
  }

  return value;
}

function toSerializableWorkHistory(
  workHistory: EmploymentPeriod[] | undefined,
) {
  if (!Array.isArray(workHistory)) return [];

  return workHistory.map((item) => ({
    ...item,
    joinedAt: toSerializableDate(item.joinedAt),
    leftAt: item.leftAt == null ? item.leftAt : toSerializableDate(item.leftAt),
  }));
}

function toSerializableUserDocument(user: UserDocument): UserDocument {
  return {
    ...user,
    createdAt: toSerializableDate(user.createdAt),
    updatedAt: toSerializableDate(user.updatedAt),
    workHistory: toSerializableWorkHistory(user.workHistory),
  };
}

export async function fetchEmployeesService() {
  const snapshot = await getDocs(
    query(collection(db, "users"), orderBy("name")),
  );
  return snapshot.docs.map((item) =>
    toSerializableUserDocument(item.data() as UserDocument),
  );
}

export async function fetchUserDocumentById(
  userId: string,
): Promise<UserDocument | null> {
  const userRef = doc(db, "users", userId);
  const snapshot = await getDoc(userRef);

  if (!snapshot.exists()) {
    return null;
  }

  return toSerializableUserDocument(snapshot.data() as UserDocument);
}
