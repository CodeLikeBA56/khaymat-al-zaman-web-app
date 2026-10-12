"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/finance";
import type { SalaryPeriod } from "@/types/finance";
import { buildSalaryDetailsRows, sumRemainingSalaries } from "@/lib/dashboard";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchEmployees } from "@/store/employee/employee.reducer";
import { fetchAllOutstandingSalaryPeriodsService } from "@/store/finance/finance.service";
import { SalaryDetailsTable } from "@/components/dashboard/salary-details-table";

export default function SalaryDetailsPage() {
  const dispatch = useAppDispatch();
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
