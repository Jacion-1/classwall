"use client";

import {
  BUDGET_MAX,
  BUDGET_MIN,
  BUDGET_STEP,
  budgetLevelFromAmount,
  formatBudgetCap,
  formatTripBudget,
} from "@/lib/trip-budget";
import { cn } from "@/lib/utils";
import { useId } from "react";

const budgetLabels = {
  low: "輕預算",
  mid: "中等預算",
  high: "享受型",
};

type BudgetSliderProps = {
  value: number;
  onChange: (value: number) => void;
  label?: string;
  className?: string;
};

export function BudgetSlider({
  value,
  onChange,
  label = "每人預估花費",
  className,
}: BudgetSliderProps) {
  const sliderId = useId();
  const level = budgetLevelFromAmount(value);
  const progress =
    ((value - BUDGET_MIN) / (BUDGET_MAX - BUDGET_MIN || 1)) * 100;

  return (
    <div className={cn("w-full min-w-0 rounded-xl border border-border bg-background/55 p-3", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="text-xs font-medium text-muted-foreground" htmlFor={sliderId}>
          {label}
        </label>
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
          <span className="rounded-full border border-border bg-muted/70 px-2.5 py-1 text-xs text-muted-foreground">
            {budgetLabels[level]}
          </span>
          <span className="max-w-full truncate text-sm font-semibold tabular-nums text-foreground">
            {formatTripBudget(value)}
          </span>
        </div>
      </div>
      <input
        id={sliderId}
        type="range"
        min={BUDGET_MIN}
        max={BUDGET_MAX}
        step={BUDGET_STEP}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-3 h-2 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
        style={{
          background: `linear-gradient(90deg, var(--primary) ${progress}%, color-mix(in oklch, var(--muted) 88%, transparent) ${progress}%)`,
        }}
      />
      <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
        <span>{formatBudgetCap(BUDGET_MIN)}</span>
        <span>{formatBudgetCap(BUDGET_MAX)}</span>
      </div>
    </div>
  );
}
