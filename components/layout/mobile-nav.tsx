"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  Building2,
  HandCoins,
  LayoutDashboard,
  Menu,
  ReceiptText,
  Users,
} from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import {
  canViewLink,
  getEffectivePermissions,
  isPathEnabled,
} from "@/config/access-control";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

export function MobileNav() {
  const { profile } = useAuth();
  const permissions = useMemo(
    () => getEffectivePermissions(profile),
    [profile],
  );

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="md:hidden"
        >
          <Menu className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent>
        <div className="mb-8 font-semibold">Restaurant ERP</div>
        {canViewLink("/dashboard", permissions) ? (
          isPathEnabled("/dashboard") ? (
            <Link
              href="/dashboard"
              className="flex items-center gap-2 rounded-md px-3 py-2 hover:bg-accent"
            >
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </Link>
          ) : (
            <div
              aria-disabled="true"
              className="flex cursor-not-allowed items-center gap-2 rounded-md px-3 py-2 opacity-50"
            >
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </div>
          )
        ) : null}
        {canViewLink("/employee", permissions) ? (
          isPathEnabled("/employee") ? (
            <Link
              href="/employee"
              className="flex items-center gap-2 rounded-md px-3 py-2 hover:bg-accent"
            >
              <Users className="h-4 w-4" />
              Employees
            </Link>
          ) : (
            <div
              aria-disabled="true"
              className="flex cursor-not-allowed items-center gap-2 rounded-md px-3 py-2 opacity-50"
            >
              <Users className="h-4 w-4" />
              Employees
            </div>
          )
        ) : null}
        {canViewLink("/vendor", permissions) ? (
          isPathEnabled("/vendor") ? (
            <Link
              href="/vendor"
              className="flex items-center gap-2 rounded-md px-3 py-2 hover:bg-accent"
            >
              <Building2 className="h-4 w-4" />
              Vendors
            </Link>
          ) : (
            <div
              aria-disabled="true"
              className="flex cursor-not-allowed items-center gap-2 rounded-md px-3 py-2 opacity-50"
            >
              <Building2 className="h-4 w-4" />
              Vendors
            </div>
          )
        ) : null}
        {canViewLink("/purchase-invoice", permissions) ? (
          isPathEnabled("/purchase-invoice") ? (
            <Link
              href="/purchase-invoice"
              className="flex items-center gap-2 rounded-md px-3 py-2 hover:bg-accent"
            >
              <ReceiptText className="h-4 w-4" />
              Purchase Invoices
            </Link>
          ) : (
            <div
              aria-disabled="true"
              className="flex cursor-not-allowed items-center gap-2 rounded-md px-3 py-2 opacity-50"
            >
              <ReceiptText className="h-4 w-4" />
              Purchase Invoices
            </div>
          )
        ) : null}
        {canViewLink("/supplier-payment", permissions) ? (
          isPathEnabled("/supplier-payment") ? (
            <Link
              href="/supplier-payment"
              className="flex items-center gap-2 rounded-md px-3 py-2 hover:bg-accent"
            >
              <HandCoins className="h-4 w-4" />
              Supplier Payments
            </Link>
          ) : (
            <div
              aria-disabled="true"
              className="flex cursor-not-allowed items-center gap-2 rounded-md px-3 py-2 opacity-50"
            >
              <HandCoins className="h-4 w-4" />
              Supplier Payments
            </div>
          )
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
