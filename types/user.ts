import type { Role, Permission } from "@/config/roles";

export type DutySchedule = {
  startTime: string;
  endTime: string;
};

export type EmploymentPeriod = {
  joinedAt: unknown;
  leftAt?: unknown | null;
};

export type PermissionOverrides = {
  allow: Permission[];
  deny: Permission[];
};

export type UserDocument = {
  uid: string;
  name: string;
  email: string;
  role: Role;
  salary: number;
  workingHoursPerDay: number;
  dutySchedule: DutySchedule[];
  alias: string;
  pin: string;
  permissionOverrides: PermissionOverrides;
  workHistory: EmploymentPeriod[];
  isActive: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
};
