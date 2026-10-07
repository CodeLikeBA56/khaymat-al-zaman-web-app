import type { Role } from "@/config/roles";

export type AttendanceStatus =
  | "present"
  | "absent"
  | "half_day"
  | "leave"
  | "holiday";

export type AttendanceDocument = {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  status: AttendanceStatus;
  checkIn?: string | null;
  checkOut?: string | null;
  workingMinutes?: number;
  notes?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export type SalaryStatus =
  | "pending"
  | "partial"
  | "paid"
  | "final_settlement";

export type SalaryAdjustmentType =
  | "advance"
  | "bonus"
  | "overtime"
  | "deduction"
  | "other";

export type SalaryAdjustment = {
  id: string;
  type: SalaryAdjustmentType;
  amount: number;
  description?: string;
  referenceId?: string;
};

export type SalaryPeriod = {
  id: string;
  userId: string;
  year: number;
  month: number;
  periodStart: unknown;
  periodEnd: unknown;
  baseSalary: number;
  adjustments: SalaryAdjustment[];
  grossSalary: number;
  totalDeductions: number;
  netSalary: number;
  paidAmount: number;
  remainingAmount: number;
  status: SalaryStatus;
  roleAtPeriod?: Role;
  workingHoursPerDayAtPeriod?: number;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export type SalaryPaymentAllocation = {
  salaryPeriodId: string;
  amount: number;
};

export type SalaryPayment = {
  id: string;
  userId: string;
  date: unknown;
  amount: number;
  allocations: SalaryPaymentAllocation[];
  paymentMethod: "cash" | "bank_transfer" | "other";
  description?: string;
  paidBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export type SalaryAdvanceStatus =
  | "unpaid"
  | "partially_deducted"
  | "fully_deducted";

export type SalaryAdvance = {
  id: string;
  userId: string;
  date: unknown;
  amount: number;
  remainingAmount: number;
  description?: string;
  paymentMethod: "cash" | "bank_transfer" | "other";
  paidBy: string;
  status: SalaryAdvanceStatus;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export type EmployeeAttendanceSummary = {
  present: number;
  absent: number;
  half_day: number;
  leave: number;
  holiday: number;
};
