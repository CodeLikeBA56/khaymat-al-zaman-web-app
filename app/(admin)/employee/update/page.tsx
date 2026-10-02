"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { UserDocument } from "@/types/user";
import { EmployeeForm } from "@/components/employees/employee-form";

export default function UpdateEmployeePage() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");

  const [employee, setEmployee] = useState<UserDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadEmployee() {
      if (!id) {
        setError("Missing employee id in query parameter.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      try {
        const snapshot = await getDoc(doc(db, "users", id));
        if (!snapshot.exists()) {
          setError("Employee not found.");
          return;
        }

        setEmployee(snapshot.data() as UserDocument);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load employee.");
      } finally {
        setLoading(false);
      }
    }

    void loadEmployee();
  }, [id]);

  if (loading) {
    return <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">Loading employee...</div>;
  }

  if (error || !employee || !id) {
    return <div className="rounded-lg bg-destructive/10 p-4 text-sm text-destructive">{error || "Employee not found."}</div>;
  }

  return <EmployeeForm mode="update" employee={employee} employeeId={id} />;
}
