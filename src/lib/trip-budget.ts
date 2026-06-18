import type { BudgetLevel } from "@/types/database";

export const BUDGET_MIN = 0;
export const BUDGET_MAX = 50000;
export const BUDGET_STEP = 1000;
export const DEFAULT_BUDGET_AMOUNT = 12000;

export function budgetLevelFromAmount(amount: number): BudgetLevel {
  if (amount <= 8000) return "low";
  if (amount <= 25000) return "mid";
  return "high";
}

export function defaultBudgetAmountForLevel(level: BudgetLevel): number {
  if (level === "low") return 5000;
  if (level === "high") return 35000;
  return 15000;
}

export function clampBudgetAmount(amount: number): number {
  if (!Number.isFinite(amount)) return DEFAULT_BUDGET_AMOUNT;
  return Math.min(Math.max(Math.round(amount / BUDGET_STEP) * BUDGET_STEP, BUDGET_MIN), BUDGET_MAX);
}

export function formatCurrency(amount: number): string {
  return `NT$${amount.toLocaleString("zh-TW")}`;
}

export function formatTripBudget(amount: number): string {
  const clamped = clampBudgetAmount(amount);
  if (clamped >= BUDGET_MAX) return `${formatCurrency(BUDGET_MAX)}+ / 人`;
  if (clamped === 0) return "免費 / 人";
  return `約 ${formatCurrency(clamped)} / 人`;
}

export function formatBudgetCap(amount: number): string {
  const clamped = clampBudgetAmount(amount);
  if (clamped >= BUDGET_MAX) return `${formatCurrency(BUDGET_MAX)}+`;
  return formatCurrency(clamped);
}
