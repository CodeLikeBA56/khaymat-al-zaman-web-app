"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  ChevronRight,
  LayoutDashboard,
  Users,
  Utensils,
} from "lucide-react";
import { useState } from "react";
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
    links: [],
  },
];

export function AppSidebar() {
  const pathname = usePathname();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    Administration: true,
    Restaurant: false,
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

                {isOpen && group.links.length > 0 && (
                  <div className="mt-1 space-y-1 pl-4">
                    {group.links.map((link) => {
                      const Icon = link.icon;
                      const active =
                        pathname === link.href ||
                        pathname.startsWith(`${link.href}/`);
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
