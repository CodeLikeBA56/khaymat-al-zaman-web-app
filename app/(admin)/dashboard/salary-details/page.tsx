"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/finance";
import { buildSalaryDetailsRows, sumRemainingSalaries } from "@/lib/dashboard";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchEmployees } from "@/store/employee/employee.reducer";
import { SalaryDetailsTable } from "@/components/dashboard/salary-details-table";

export default function SalaryDetailsPage() {
  const dispatch = useAppDispatch();
  const { employees, isLoading } = useAppSelector((state) => state.employee);

  useEffect(() => {
    if (employees.length === 0) {
      void dispatch(fetchEmployees());
    }
  }, [dispatch, employees.length]);

  const rows = useMemo(() => buildSalaryDetailsRows(employees), [employees]);
  const totalRemainingSalary = useMemo(
    () => sumRemainingSalaries(rows),
    [rows],
  );

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Salary Payment Details
          </h1>
          <p className="text-sm text-muted-foreground">
            Overall remaining salary: {formatCurrency(totalRemainingSalary)}
          </p>
        </div>

        <Button
          asChild
          variant="outline"
        >
          <Link href="/dashboard">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Link>
        </Button>
      </div>

      {isLoading && rows.length === 0 ? (
        <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
          Loading salary details...
        </div>
      ) : (
        <SalaryDetailsTable rows={rows} />
      )}
    </section>
  );
}
