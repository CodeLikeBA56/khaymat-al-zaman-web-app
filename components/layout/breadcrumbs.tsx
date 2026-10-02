"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";

export function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  return (
    <nav className="flex items-center gap-1 text-sm text-muted-foreground">
      <Link href="/employee" className="hover:text-foreground">Admin</Link>
      {segments.length > 0 && <ChevronRight className="h-4 w-4" />}
      {segments.map((segment, index) => (
        <span key={segment} className={index === segments.length - 1 ? "font-medium text-foreground" : ""}>
          {segment.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
          {index < segments.length - 1 && <ChevronRight className="mx-1 inline h-4 w-4" />}
        </span>
      ))}
    </nav>
  );
}
