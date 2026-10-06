import type { UserDocument } from "@/types/user";
import { getCurrentEmploymentSnapshot } from "@/lib/employment";

export type SalaryDetailsRow = {
  uid: string;
  name: string;
  salary: number;
  remainingSalary: number;
};

export function buildSalaryDetailsRows(
  employees: UserDocument[],
): SalaryDetailsRow[] {
  return employees.map((employee) => {
    const employment = getCurrentEmploymentSnapshot(employee);
    const salary = employment.salary;
    const remainingSalary = salary;

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
