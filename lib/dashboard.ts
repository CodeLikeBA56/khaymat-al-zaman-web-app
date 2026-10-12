import type { UserDocument } from "@/types/user";
import type { SalaryPeriod } from "@/types/finance";
import { getCurrentEmploymentSnapshot } from "@/lib/employment";

export type SalaryDetailsRow = {
  uid: string;
  name: string;
  salary: number;
  remainingSalary: number;
};

export function buildSalaryDetailsRows(
  employees: UserDocument[],
  outstandingSalaryPeriods: SalaryPeriod[],
): SalaryDetailsRow[] {
  const remainingByUserId = outstandingSalaryPeriods.reduce<Record<string, number>>(
    (accumulator, period) => {
      accumulator[period.userId] =
        (accumulator[period.userId] ?? 0) + period.remainingAmount;
      return accumulator;
    },
    {},
  );

  return employees.map((employee) => {
    const employment = getCurrentEmploymentSnapshot(employee);
    const salary = employment.salary;
    const remainingSalary = remainingByUserId[employee.uid] ?? 0;

    return {
      uid: employee.uid,
      name: employee.name,
      salary,
      remainingSalary,
    };
  });
}

export function sumSalaries(rows: SalaryDetailsRow[]) {
  return rows.reduce((sum, item) => sum + item.salary, 0);
}

export function sumRemainingSalaries(rows: SalaryDetailsRow[]) {
  return rows.reduce((sum, item) => sum + item.remainingSalary, 0);
}
