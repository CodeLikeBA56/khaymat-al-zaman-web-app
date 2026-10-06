import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  ATTENDANCE_COLLECTION,
  getMonthDateRange,
  toAttendanceDocId,
} from "@/lib/finance";
import type { AttendanceDocument, AttendanceStatus } from "@/types/finance";

export async function fetchMonthlyAttendanceService(
  userId: string,
  year: number,
  month: number,
) {
  const { startDateString, endDateString } = getMonthDateRange(year, month);

  const attendanceQuery = query(
    collection(db, ATTENDANCE_COLLECTION),
    where("userId", "==", userId),
    where("date", ">=", startDateString),
    where("date", "<=", endDateString),
    orderBy("date", "asc"),
  );

  const snapshot = await getDocs(attendanceQuery);
  return snapshot.docs.map((item) => item.data() as AttendanceDocument);
}

export type UpsertAttendanceInput = {
  userId: string;
  date: string;
  status: AttendanceStatus;
  checkIn?: string | null;
  checkOut?: string | null;
  workingMinutes?: number;
  notes?: string;
};

export async function upsertAttendanceService(input: UpsertAttendanceInput) {
  if (input.workingMinutes !== undefined && input.workingMinutes < 0) {
    throw new Error("Working minutes cannot be negative.");
  }

  const id = toAttendanceDocId(input.userId, input.date);
  const ref = doc(db, ATTENDANCE_COLLECTION, id);

  await setDoc(
    ref,
    {
      id,
      userId: input.userId,
      date: input.date,
      status: input.status,
      checkIn: input.checkIn ?? null,
      checkOut: input.checkOut ?? null,
      workingMinutes:
        input.workingMinutes === undefined ? null : input.workingMinutes,
      notes: input.notes ?? "",
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    },
    { merge: true },
  );

  return id;
}
