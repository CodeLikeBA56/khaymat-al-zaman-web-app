"use client";

import { useCallback, useEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchEmployees } from "@/store/employee/employee.reducer";
import { EmployeesTable } from "@/components/employees/employees-table";
import { PageSectionHeader } from "@/components/layout/page-section-header";

export default function EmployeesPage() {
  const dispatch = useAppDispatch();
  const { employees, isLoading, error } = useAppSelector(
    (state) => state.employee,
  );

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
      <PageSectionHeader
        title="Employees"
        description="Manage restaurant staff accounts, roles, salary and duty schedules."
        onRefresh={loadEmployees}
        refreshing={refreshing}
        refreshAriaLabel="Refresh employees"
        addHref="/emplyee/create"
        addLabel="Add employee"
      />

      {error && (
        <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {isLoading && employees.length === 0 ? (
        <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
          Loading employees...
        </div>
      ) : (
        <EmployeesTable data={employees} />
      )}
    </section>
  );
}
