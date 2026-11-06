"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  ChevronDown,
  ChevronRight,
  HandCoins,
  LayoutDashboard,
  ReceiptText,
  Users,
  Utensils,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import {
  canViewLink,
  getEffectivePermissions,
  isPathEnabled,
} from "@/config/access-control";
import { cn } from "@/lib/utils";

const navigationGroups = [
  {
    name: "Administration",
    icon: LayoutDashboard,
    links: [
      { name: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
      { name: "Employees", icon: Users, href: "/employee" },
    ],
  },
  {
    name: "Restaurant",
    icon: Utensils,
    links: [
      { name: "Vendors", icon: Building2, href: "/vendor" },
      {
        name: "Purchase Invoices",
        icon: ReceiptText,
        href: "/purchase-invoice",
      },
      {
        name: "Supplier Payments",
        icon: HandCoins,
        href: "/supplier-payment",
      },
    ],
  },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { profile } = useAuth();
  const permissions = useMemo(() => getEffectivePermissions(profile), [profile]);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    Administration: true,
    Restaurant: true,
  });

  return (
    <aside className="hidden w-64 shrink-0 border-r bg-card md:block">
      <div className="flex h-full min-h-screen flex-col">
        <div className="flex h-16 items-center border-b px-6">
          <div>
            <p className="font-semibold">Restaurant ERP</p>
            <p className="text-xs text-muted-foreground">Management System</p>
          </div>
        </div>

        <nav className="flex-1 space-y-2 p-3">
          {navigationGroups.map((group) => {
            const GroupIcon = group.icon;
            const isOpen = openGroups[group.name];
            const permittedLinks = group.links.filter((link) =>
              canViewLink(link.href, permissions),
            );

            if (permittedLinks.length === 0) {
              return null;
            }

            return (
              <div key={group.name}>
                <button
                  type="button"
                  onClick={() =>
                    setOpenGroups((prev) => ({
                      ...prev,
                      [group.name]: !prev[group.name],
                    }))
                  }
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-accent"
                >
                  <GroupIcon className="h-4 w-4" />
                  <span className="flex-1 text-left">{group.name}</span>
                  {isOpen ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>

                {isOpen && permittedLinks.length > 0 && (
                  <div className="mt-1 space-y-1 pl-4">
                    {permittedLinks.map((link) => {
                      const Icon = link.icon;
                      const enabled = isPathEnabled(link.href);
                      const active =
                        pathname === link.href ||
                        pathname.startsWith(`${link.href}/`);

                      if (!enabled) {
                        return (
                          <div
                            key={link.href}
                            aria-disabled="true"
                            className="flex cursor-not-allowed items-center gap-2 rounded-md px-3 py-2 text-sm opacity-50"
                            title="This module is disabled outside production allowlist."
                          >
                            <Icon className="h-4 w-4" />
                            {link.name}
                          </div>
                        );
                      }

                      return (
                        <Link
                          key={link.href}
                          href={link.href}
                          className={cn(
                            "flex items-center gap-2 rounded-md px-3 py-2 text-sm",
                            active
                              ? "bg-primary text-primary-foreground"
                              : "hover:bg-accent",
                          )}
                        >
                          <Icon className="h-4 w-4" />
                          {link.name}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
