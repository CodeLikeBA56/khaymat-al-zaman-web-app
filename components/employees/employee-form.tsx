"use client";

import { useEffect, useState } from "react";
import { getApp, getApps, initializeApp } from "firebase/app";
import {
  getAuth,
  signOut,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import {
  deleteField,
  doc,
  setDoc,
  updateDoc,
  Timestamp,
  serverTimestamp,
} from "firebase/firestore";
import { hash } from "bcryptjs";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import {
  DEFAULT_ROLE_ALIASES,
  getPermissionOverridesForPersistence,
  normalizePermissionOverrides,
  ROLES,
  type Role,
} from "@/config/roles";
import { getRecentActiveEmploymentPeriod } from "@/lib/employment";
import type { AuthProviderType, UserDocument } from "@/types/user";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

type EmployeeFormProps = {
  employee?: UserDocument | null;
  employeeId?: string;
  mode: "create" | "update";
};

const roleOptions = Object.values(ROLES);

type DutyScheduleField = {
  startTime: string;
  endTime: string;
};

const initialForm = {
  name: "",
  authProvider: "email" as AuthProviderType,
  email: "",
  phoneNumber: "",
  password: "",
  pin: "",
  role: "cashier" as Role,
  salary: "0",
  workingHoursPerDay: "12",
  alias: "",
  dutySchedule: [
    { startTime: "08:00", endTime: "14:00" },
  ] as DutyScheduleField[],
};

const PIN_BCRYPT_ROUNDS = Number(
  process.env.NEXT_PUBLIC_PIN_BCRYPT_ROUNDS ?? "10",
);

async function hashPin(pin: string) {
  const rounds =
    Number.isFinite(PIN_BCRYPT_ROUNDS) && PIN_BCRYPT_ROUNDS >= 8
      ? PIN_BCRYPT_ROUNDS
      : 10;

  return hash(pin, rounds);
}

function buildEmploymentPeriod(input: {
  joinedAt: unknown;
  leftAt?: unknown | null;
  salary: number;
  role: Role;
  workingHoursPerDay: number;
}) {
  return {
    id: crypto.randomUUID(),
    joinedAt: input.joinedAt,
    leftAt: input.leftAt ?? null,
    salary: input.salary,
    role: input.role,
    workingHoursPerDay: input.workingHoursPerDay,
  };
}

function getSecondaryAuth() {
  const name = "employee-creator";
  const secondaryApp =
    getApps().find((app) => app.name === name) ??
    initializeApp(getApp().options, name);
  return getAuth(secondaryApp);
}

export function EmployeeForm({
  employee,
  employeeId,
  mode,
}: EmployeeFormProps) {
  const router = useRouter();
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const currentEmploymentPeriod = getRecentActiveEmploymentPeriod(
    employee?.workHistory,
  );

  const selectableRoles =
    currentEmploymentPeriod?.role === ROLES.ADMIN
      ? roleOptions
      : roleOptions.filter((role) => role !== ROLES.ADMIN);

  useEffect(() => {
    if (employee) {
      setForm({
        name: employee.name,
        authProvider:
          employee.authProvider ?? (employee.phoneNumber ? "phone" : "email"),
        email: employee.email ?? "",
        phoneNumber: employee.phoneNumber ?? "",
        password: "",
        pin: "",
        role: currentEmploymentPeriod?.role ?? ROLES.CASHIER,
        salary: String(currentEmploymentPeriod?.salary ?? 0),
        workingHoursPerDay: String(
          currentEmploymentPeriod?.workingHoursPerDay ?? 12,
        ),
        alias: employee.alias ?? "",
        dutySchedule:
          employee.dutySchedule?.length > 0
            ? employee.dutySchedule
            : [{ startTime: "08:00", endTime: "14:00" }],
      });
    } else {
      setForm(initialForm);
    }
  }, [currentEmploymentPeriod, employee]);

  function update<K extends keyof typeof form>(
    key: K,
    value: (typeof form)[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function addShift() {
    setForm((prev) => ({
      ...prev,
      dutySchedule: [
        ...prev.dutySchedule,
        { startTime: "08:00", endTime: "14:00" },
      ],
    }));
  }

  function removeShift(index: number) {
    setForm((prev) => ({
      ...prev,
      dutySchedule: prev.dutySchedule.filter(
        (_, itemIndex) => itemIndex !== index,
      ),
    }));
  }

  function updateShift(
    index: number,
    key: keyof DutyScheduleField,
    value: string,
  ) {
    setForm((prev) => ({
      ...prev,
      dutySchedule: prev.dutySchedule.map((shift, itemIndex) =>
        itemIndex === index ? { ...shift, [key]: value } : shift,
      ),
    }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);

    try {
      const authProvider = form.authProvider;
      const normalizedEmail = form.email.trim();
      const normalizedPhone = form.phoneNumber.trim();
      const pinInput = form.pin.trim();
      const hasExistingEncryptedPin = Boolean(employee?.pin);

      if (!pinInput && !hasExistingEncryptedPin) {
        throw new Error("PIN is required.");
      }

      if (authProvider === "email") {
        if (!normalizedEmail) {
          throw new Error("Email is required for email provider.");
        }

        if (!employee && !form.password) {
          throw new Error("Password is required for email provider.");
        }
      } else if (!normalizedPhone) {
        throw new Error("Phone number is required for phone provider.");
      }

      if (employee) {
        const existingWorkHistory = Array.isArray(employee.workHistory)
          ? employee.workHistory
          : [];

        const legacyPinHashCandidate =
          typeof (employee as { pinHash?: unknown }).pinHash === "string"
            ? (employee as { pinHash?: string }).pinHash
            : undefined;

        const nextEncryptedPin = pinInput
          ? await hashPin(pinInput)
          : (employee.pin ?? legacyPinHashCandidate);

        const nextSalary = Number(form.salary);
        const nextRole = form.role;
        const nextWorkingHoursPerDay = Number(form.workingHoursPerDay);

        const activePeriodIndex = existingWorkHistory.findIndex(
          (period) => !period.leftAt,
        );
        const nextWorkHistory = [...existingWorkHistory];

        if (activePeriodIndex === -1) {
          nextWorkHistory.push(
            buildEmploymentPeriod({
              joinedAt: Timestamp.now(),
              salary: nextSalary,
              role: nextRole,
              workingHoursPerDay: nextWorkingHoursPerDay,
            }),
          );
        } else {
          const activePeriod = nextWorkHistory[activePeriodIndex];
          const hasEmploymentChange =
            activePeriod.salary !== nextSalary ||
            activePeriod.role !== nextRole ||
            activePeriod.workingHoursPerDay !== nextWorkingHoursPerDay;

          if (hasEmploymentChange) {
            nextWorkHistory[activePeriodIndex] = {
              ...activePeriod,
              leftAt: Timestamp.now(),
            };

            nextWorkHistory.push(
              buildEmploymentPeriod({
                joinedAt: Timestamp.now(),
                salary: nextSalary,
                role: nextRole,
                workingHoursPerDay: nextWorkingHoursPerDay,
              }),
            );
          }
        }

        await updateDoc(doc(db, "users", employee.uid), {
          name: form.name.trim(),
          authProvider,
          email: authProvider === "email" ? normalizedEmail : "",
          phoneNumber: authProvider === "phone" ? normalizedPhone : "",
          ...(nextEncryptedPin
            ? { pin: nextEncryptedPin, pinHash: deleteField() }
            : {}),
          dutySchedule: form.dutySchedule,
          alias: form.alias.trim() || DEFAULT_ROLE_ALIASES[nextRole],
          permissionOverrides: getPermissionOverridesForPersistence(
            nextRole,
            employee.permissionOverrides,
          ),
          workHistory:
            nextWorkHistory.length > 0
              ? nextWorkHistory
              : [
                  buildEmploymentPeriod({
                    joinedAt: employee.createdAt ?? Timestamp.now(),
                    salary: nextSalary,
                    role: nextRole,
                    workingHoursPerDay: nextWorkingHoursPerDay,
                  }),
                ],
          updatedAt: serverTimestamp(),
        });
      } else {
        const encryptedPin = await hashPin(pinInput);
        const secondaryAuth =
          authProvider === "email" ? getSecondaryAuth() : null;

        const userId =
          authProvider === "email" && secondaryAuth
            ? (
                await createUserWithEmailAndPassword(
                  secondaryAuth,
                  normalizedEmail,
                  form.password,
                )
              ).user.uid
            : crypto.randomUUID();

        await setDoc(doc(db, "users", userId), {
          uid: userId,
          name: form.name.trim(),
          authProvider,
          email: authProvider === "email" ? normalizedEmail : "",
          phoneNumber: authProvider === "phone" ? normalizedPhone : "",
          dutySchedule: form.dutySchedule,
          alias: form.alias.trim() || DEFAULT_ROLE_ALIASES[form.role],
          pin: encryptedPin,
          permissionOverrides: normalizePermissionOverrides([]),
          workHistory: [
            buildEmploymentPeriod({
              joinedAt: Timestamp.now(),
              salary: Number(form.salary),
              role: form.role,
              workingHoursPerDay: Number(form.workingHoursPerDay),
            }),
          ],
          isActive: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        if (secondaryAuth) {
          await signOut(secondaryAuth);
        }
      }

      toast.success(
        employee
          ? "Employee updated successfully."
          : "Employee created successfully.",
      );

      if (mode === "update" && employeeId) {
        router.replace(`/employee/${employeeId}`);
      } else {
        router.replace("/employee");
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not save employee.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mx-auto w-full max-w-4xl space-y-6">
      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight">
          {employee ? "Update employee" : "Create employee"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {employee
            ? "Update account, work schedule, and profile details."
            : "Create a Firebase login and employee profile."}
        </p>
      </div>

      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <form
          onSubmit={handleSubmit}
          className="space-y-4"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                required
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Auth provider</Label>
              <Select
                value={form.authProvider}
                onValueChange={(value) =>
                  update("authProvider", value as AuthProviderType)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Email + Password</SelectItem>
                  <SelectItem value="phone">Phone</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Choose at least one login provider. Use email with password or
                phone.
              </p>
            </div>

            {form.authProvider === "email" ? (
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => update("email", e.target.value)}
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="phoneNumber">Phone number</Label>
                <Input
                  id="phoneNumber"
                  type="tel"
                  placeholder="+9665XXXXXXXX"
                  required
                  value={form.phoneNumber}
                  onChange={(e) => update("phoneNumber", e.target.value)}
                />
              </div>
            )}

            {!employee && form.authProvider === "email" && (
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  minLength={6}
                  required
                  value={form.password}
                  onChange={(e) => update("password", e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Used only by Firebase Authentication. It is never stored in
                  Firestore.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={form.role}
                onValueChange={(value) => update("role", value as Role)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {selectableRoles.map((role) => (
                    <SelectItem
                      key={role}
                      value={role}
                    >
                      {role
                        .replaceAll("_", " ")
                        .replace(/\b\w/g, (c) => c.toUpperCase())}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="alias">Alias</Label>
              <Input
                id="alias"
                placeholder={DEFAULT_ROLE_ALIASES[form.role]}
                value={form.alias}
                onChange={(e) => update("alias", e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Leave empty to use default: {DEFAULT_ROLE_ALIASES[form.role]}.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="salary">Salary</Label>
              <Input
                id="salary"
                type="number"
                min={0}
                value={form.salary}
                onChange={(e) => update("salary", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="hours">Working hours / day</Label>
              <Input
                id="hours"
                type="number"
                min={1}
                max={24}
                value={form.workingHoursPerDay}
                onChange={(e) => update("workingHoursPerDay", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pin">PIN</Label>
              <Input
                id="pin"
                inputMode="numeric"
                maxLength={6}
                required={!employee}
                value={form.pin}
                onChange={(e) =>
                  update("pin", e.target.value.replace(/\D/g, ""))
                }
              />
              <p className="text-xs text-muted-foreground">
                {employee
                  ? "Leave blank to keep current PIN. New PIN is stored as a bcrypt hash."
                  : "PIN will be stored as a bcrypt hash."}
              </p>
            </div>
          </div>

          <div className="space-y-3 rounded-lg border p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="font-medium">Duty schedule</h3>
                <p className="text-xs text-muted-foreground">
                  Add one or multiple shifts. Example: 06:00-12:00 and
                  18:00-00:00.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addShift}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add shift
              </Button>
            </div>

            <div className="space-y-3">
              {form.dutySchedule.map((shift, index) => (
                <div
                  key={`${shift.startTime}-${shift.endTime}-${index}`}
                  className="grid gap-2 rounded-md border p-3 sm:grid-cols-[1fr_1fr_auto]"
                >
                  <div className="space-y-2">
                    <Label htmlFor={`shift-start-${index}`}>Start time</Label>
                    <Input
                      id={`shift-start-${index}`}
                      type="time"
                      value={shift.startTime}
                      onChange={(e) =>
                        updateShift(index, "startTime", e.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`shift-end-${index}`}>End time</Label>
                    <Input
                      id={`shift-end-${index}`}
                      type="time"
                      value={shift.endTime}
                      onChange={(e) =>
                        updateShift(index, "endTime", e.target.value)
                      }
                    />
                  </div>
                  <div className="flex items-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeShift(index)}
                      disabled={form.dutySchedule.length === 1}
                      aria-label={`Remove shift ${index + 1}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving}
            >
              {saving ? "Saving..." : employee ? "Update" : "Create user"}
            </Button>
          </div>
        </form>
      </div>
    </section>
  );
}
