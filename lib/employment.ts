import type { Role } from "@/config/roles";
import type { EmploymentPeriod, UserDocument } from "@/types/user";

function toMillis(value: unknown) {
  if (
    typeof value === "object" &&
    value !== null &&
    "toMillis" in value &&
    typeof (value as { toMillis?: () => number }).toMillis === "function"
  ) {
    return (value as { toMillis: () => number }).toMillis();
  }

  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as { toDate?: () => Date }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate().getTime();
  }

  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function isActivePeriod(period: EmploymentPeriod) {
  return period.leftAt == null;
}

export function getRecentActiveEmploymentPeriod(
  workHistory?: EmploymentPeriod[] | null,
) {
  if (!Array.isArray(workHistory) || workHistory.length === 0) return null;

  const sorted = [...workHistory].sort(
    (a, b) => toMillis(b.joinedAt) - toMillis(a.joinedAt),
  );

  return sorted.find(isActivePeriod) ?? sorted[0] ?? null;
}

export function getCurrentRoleFromProfile(
  profile?: Pick<UserDocument, "workHistory"> | null,
): Role | null {
  return getRecentActiveEmploymentPeriod(profile?.workHistory)?.role ?? null;
}

export function getCurrentEmploymentSnapshot(
  profile?: Pick<UserDocument, "workHistory"> | null,
) {
  const period = getRecentActiveEmploymentPeriod(profile?.workHistory);
  return {
    role: period?.role ?? null,
    salary: period?.salary ?? 0,
    workingHoursPerDay: period?.workingHoursPerDay ?? 0,
  };
}

export function getUserPrimaryContact(
  profile?: Pick<UserDocument, "email" | "phoneNumber"> | null,
) {
  return profile?.email || profile?.phoneNumber || "—";
}
