"use client";

import Link from "next/link";
import { LayoutDashboard, Menu, Users } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

export function MobileNav() {
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
        <Link
          href="/dashboard"
          className="flex items-center gap-2 rounded-md px-3 py-2 hover:bg-accent"
        >
          <LayoutDashboard className="h-4 w-4" />
          Dashboard
        </Link>
        <Link
          href="/employee"
          className="flex items-center gap-2 rounded-md px-3 py-2 hover:bg-accent"
        >
          <Users className="h-4 w-4" />
          Employees
        </Link>
      </SheetContent>
    </Sheet>
  );
}
