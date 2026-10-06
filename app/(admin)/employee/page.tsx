"use client";

import Link from "next/link";
import { Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCallback, useEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchEmployees } from "@/store/employee/employee.reducer";
import { EmployeesTable } from "@/components/employees/employees-table";

export default function EmployeesPage() {
  const dispatch = useAppDispatch();
  const { employees, isLoading, error } = useAppSelector((state) => state.employee);
  
  const [refreshing, setRefreshing] = useState(false);

  const loadEmployees = useCallback(async () => {
    setRefreshing(true);
    await dispatch(fetchEmployees({ force: true }));
    setRefreshing(false);
  }, [dispatch]);

  useEffect(() => {
    if (employees.length === 0) {
      void dispatch(fetchEmployees());
    }
  }, [dispatch, employees.length]);

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Employees</h1>
          <p className="text-sm text-muted-foreground">Manage restaurant staff accounts, roles, salary and duty schedules.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={() => void loadEmployees()} aria-label="Refresh employees">
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
          <Button asChild>
            <Link href="/emplyee/create">
            <Plus className="mr-2 h-4 w-4" />
            Add employee
            </Link>
          </Button>
        </div>
      </div>

      {error && <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}

      {isLoading && employees.length === 0 ? (
        <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">Loading employees...</div>
      ) : (
        <EmployeesTable data={employees} />
      )}
    </section>
  );
}
