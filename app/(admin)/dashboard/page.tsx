"use client";

import { useEffect, useMemo, useState } from "react";
import { Coins } from "lucide-react";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/finance";
import type { SalaryPeriod } from "@/types/finance";
import { buildSalaryDetailsRows, sumRemainingSalaries } from "@/lib/dashboard";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchEmployees } from "@/store/employee/employee.reducer";
import { fetchAllOutstandingSalaryPeriodsService } from "@/store/finance/finance.service";
import { StatsCard } from "@/components/dashboard/stats-card";

export default function DashboardPage() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const [outstandingSalaryPeriods, setOutstandingSalaryPeriods] = useState<
    SalaryPeriod[]
  >([]);
  const { employees, isLoading } = useAppSelector((state) => state.employee);

  useEffect(() => {
    if (employees.length === 0) {
      void dispatch(fetchEmployees());
    }
  }, [dispatch, employees.length]);

  useEffect(() => {
    async function loadOutstandingPeriods() {
      const periods = await fetchAllOutstandingSalaryPeriodsService();
      setOutstandingSalaryPeriods(periods);
    }

    void loadOutstandingPeriods();
  }, []);

  const rows = useMemo(
    () => buildSalaryDetailsRows(employees, outstandingSalaryPeriods),
    [employees, outstandingSalaryPeriods],
  );
  const totalRemainingSalary = useMemo(
    () => sumRemainingSalaries(rows),
    [rows],
  );

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Overview of restaurant operations and salary liabilities.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <StatsCard
          icon={Coins}
          title="Overall Salary to Pay"
          description="Outstanding salary from generated salary slips. Click to open details page."
          value={
            isLoading ? "Loading..." : formatCurrency(totalRemainingSalary)
          }
          onClick={() => router.push("/dashboard/salary-details")}
        />
      </div>
    </section>
  );
}
