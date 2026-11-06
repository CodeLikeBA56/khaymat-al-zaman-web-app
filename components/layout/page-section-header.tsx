"use client";

import Link from "next/link";
import { Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

type PageSectionHeaderProps = {
  title: string;
  description: string;
  onRefresh?: () => void | Promise<void>;
  refreshing?: boolean;
  refreshAriaLabel?: string;
  addHref?: string;
  addLabel?: string;
};

export function PageSectionHeader({
  title,
  description,
  onRefresh,
  refreshing = false,
  refreshAriaLabel,
  addHref,
  addLabel,
}: PageSectionHeaderProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      <div className="flex gap-2">
        {onRefresh ? (
          <Button
            variant="outline"
            size="icon"
            onClick={() => void onRefresh()}
            aria-label={refreshAriaLabel ?? `Refresh ${title.toLowerCase()}`}
          >
            <RefreshCw
              className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
            />
          </Button>
        ) : null}

        {addHref && addLabel ? (
          <Button asChild>
            <Link href={addHref}>
              <Plus className="mr-2 h-4 w-4" />
              {addLabel}
            </Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
