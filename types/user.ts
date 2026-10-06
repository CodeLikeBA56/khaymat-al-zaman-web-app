import type { Role, Permission } from "@/config/roles";

export type DutySchedule = {
  startTime: string;
  endTime: string;
};

export type EmploymentPeriod = {
  id: string;
  joinedAt: unknown;
  leftAt?: unknown | null;
  salary: number;
  role: Role;
  workingHoursPerDay: number;
  reasonForLeaving?: string;
};

export type PermissionOverrides = {
  allow: Permission[];
  deny: Permission[];
};

export type AuthProviderType = "email" | "phone";

export type UserDocument = {
  uid: string;
  name: string;
  authProvider: AuthProviderType;
  email?: string;
  phoneNumber?: string;
  dutySchedule: DutySchedule[];
  alias: string;
  pin: string;
  permissionOverrides: PermissionOverrides;
  workHistory: EmploymentPeriod[];
  isActive: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
};
