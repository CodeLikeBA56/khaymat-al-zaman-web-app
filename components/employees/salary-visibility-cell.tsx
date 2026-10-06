"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";

type SalaryVisibilityCellProps = {
  salary: number;
  currencySuffix?: string;
};

export function SalaryVisibilityCell({
  salary,
  currencySuffix = "SAR",
}: SalaryVisibilityCellProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className="flex items-center gap-2">
      <span>{isVisible ? `${salary} ${currencySuffix}` : "••••••"}</span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={() => setIsVisible((prev) => !prev)}
        aria-label={isVisible ? "Hide salary" : "Show salary"}
      >
        {isVisible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      </Button>
    </div>
  );
}
