import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type StatsCardProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  value: string;
  onClick?: () => void;
  className?: string;
};

export function StatsCard({
  icon: Icon,
  title,
  description,
  value,
  onClick,
  className,
}: StatsCardProps) {
  const isInteractive = typeof onClick === "function";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!isInteractive}
      className={cn(
        "w-full rounded-xl border bg-card p-4 text-left transition",
        isInteractive
          ? "hover:border-primary/40 hover:shadow-sm"
          : "cursor-default",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">{title}</p>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>
        <span className="rounded-md bg-primary/10 p-2 text-primary">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-4 text-2xl font-semibold tracking-tight">{value}</p>
    </button>
  );
}
