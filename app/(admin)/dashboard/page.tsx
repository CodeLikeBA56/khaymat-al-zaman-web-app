"use client";

import { useEffect, useMemo } from "react";
import { Coins } from "lucide-react";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/finance";
import { buildSalaryDetailsRows, sumSalaries } from "@/lib/dashboard";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchEmployees } from "@/store/employee/employee.reducer";
import { StatsCard } from "@/components/dashboard/stats-card";

export default function DashboardPage() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const { employees, isLoading } = useAppSelector((state) => state.employee);

  useEffect(() => {
    if (employees.length === 0) {
      void dispatch(fetchEmployees());
    }
  }, [dispatch, employees.length]);

  const rows = useMemo(() => buildSalaryDetailsRows(employees), [employees]);
  const totalSalaryToPay = useMemo(() => sumSalaries(rows), [rows]);

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
          description="Total current salary of all employees. Click to open details page."
          value={isLoading ? "Loading..." : formatCurrency(totalSalaryToPay)}
          onClick={() => router.push("/dashboard/salary-details")}
        />
      </div>
    </section>
  );
}
