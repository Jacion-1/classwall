"use client";

import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";

import { QuestionCard } from "@/components/question-card";
import { QuestionForm } from "@/components/question-form";
import { StatsPill } from "@/components/stats-pill";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { useQuestions } from "@/lib/use-questions";
import { cn } from "@/lib/utils";
import type {
  BudgetLevel,
  TripCategory,
  TripFilters,
  TripSeason,
  TripSortMode,
} from "@/types/database";

const PAGE_SIZE = 10;

const categoryOptions: Array<{ value: TripCategory | "all"; label: string }> = [
  { value: "all", label: "全部類型" },
  { value: "spot", label: "景點" },
  { value: "food", label: "美食" },
  { value: "stay", label: "住宿" },
  { value: "route", label: "行程" },
  { value: "transport", label: "交通" },
  { value: "story", label: "心得" },
  { value: "inspiration", label: "靈感" },
];

const seasonOptions: Array<{ value: TripSeason | "all"; label: string }> = [
  { value: "all", label: "全部季節" },
  { value: "spring", label: "春" },
  { value: "summer", label: "夏" },
  { value: "autumn", label: "秋" },
  { value: "winter", label: "冬" },
  { value: "anytime", label: "不限季節" },
];

const budgetOptions: Array<{ value: BudgetLevel | "all"; label: string }> = [
  { value: "all", label: "全部預算" },
  { value: "low", label: "輕預算" },
  { value: "mid", label: "中等" },
  { value: "high", label: "享受型" },
];

const sortOptions: Array<{ value: TripSortMode; label: string }> = [
  { value: "likes", label: "最多想去" },
  { value: "saves", label: "最多收藏" },
  { value: "newest", label: "最新發布" },
];

export default function Home() {
  const [sortMode, setSortMode] = useState<TripSortMode>("likes");
  const [filters, setFilters] = useState<TripFilters>({
    country: "",
    category: "all",
    budget: "all",
    season: "all",
  });

  const { questions, loading, loadingMore, hasMore, error, loadMore } =
    useQuestions(PAGE_SIZE, sortMode, filters);

  const totals = useMemo(
    () => ({
      likes: questions.reduce((sum, trip) => sum + trip.likes, 0),
      saves: questions.reduce((sum, trip) => sum + (trip.saves ?? 0), 0),
      countries: new Set(questions.map((trip) => trip.country)).size,
    }),
    [questions]
  );

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <header className="flex flex-col gap-5 rounded-2xl border border-border/70 bg-card/82 p-4 shadow-sm backdrop-blur-md sm:p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
              TripWall
            </p>
            <h1 className="mt-1 text-4xl font-semibold tracking-tight sm:text-5xl">
              旅行靈感牆
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
              把想去的城市、踩點心得、路線安排和美食口袋名單貼上來。先用低成本的文字與圖片網址版本跑起來，之後再逐步加上真正圖片上傳或會員收藏。
            </p>
          </div>
          <ThemeToggle />
        </div>

        <div className="flex flex-wrap gap-2">
          <StatsPill label="靈感" value={questions.length} accent />
          <StatsPill label="想去" value={totals.likes} />
          <StatsPill label="收藏" value={totals.saves} />
          <StatsPill label="地區" value={totals.countries} />
        </div>
      </header>

      <QuestionForm />

      <section className="flex flex-col gap-4" aria-label="旅行靈感列表">
        <div className="rounded-2xl border border-border/70 bg-card/82 p-4 shadow-sm backdrop-blur-md">
          <div className="grid gap-3 lg:grid-cols-[1.2fr_repeat(4,1fr)]">
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">
                搜尋地點
              </span>
              <input
                value={filters.country}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    country: event.target.value,
                  }))
                }
                placeholder="日本、台東、首爾..."
                className="field-input mt-1"
              />
            </label>

            <FilterSelect
              label="類型"
              value={filters.category}
              options={categoryOptions}
              onChange={(value) =>
                setFilters((current) => ({
                  ...current,
                  category: value as TripCategory | "all",
                }))
              }
            />
            <FilterSelect
              label="季節"
              value={filters.season}
              options={seasonOptions}
              onChange={(value) =>
                setFilters((current) => ({
                  ...current,
                  season: value as TripSeason | "all",
                }))
              }
            />
            <FilterSelect
              label="預算"
              value={filters.budget}
              options={budgetOptions}
              onChange={(value) =>
                setFilters((current) => ({
                  ...current,
                  budget: value as BudgetLevel | "all",
                }))
              }
            />
            <FilterSelect
              label="排序"
              value={sortMode}
              options={sortOptions}
              onChange={(value) => setSortMode(value as TripSortMode)}
            />
          </div>
        </div>

        {loading ? (
          <SkeletonList />
        ) : error ? (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center text-sm text-destructive">
            讀取失敗：{error}
          </div>
        ) : questions.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-dashed border-border/70 bg-card/55 py-14 text-center"
          >
            <p className="text-2xl font-semibold text-muted-foreground">
              還沒有符合條件的靈感
            </p>
            <p className="mt-2 text-sm text-muted-foreground/80">
              換個篩選條件，或發布第一篇旅行靈感。
            </p>
          </motion.div>
        ) : (
          <div className="grid gap-4">
            <AnimatePresence mode="popLayout" initial={false}>
              {questions.map((question) => (
                <QuestionCard key={question.id} question={question} />
              ))}
            </AnimatePresence>

            <div className="flex justify-center pt-2">
              {hasMore ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => loadMore()}
                  disabled={loadingMore}
                  className="rounded-full"
                >
                  {loadingMore ? "載入中..." : "載入更多"}
                </Button>
              ) : (
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground/70">
                  已經到底了
                </p>
              )}
            </div>
          </div>
        )}
      </section>

      <footer className="pb-4 pt-3 text-center text-xs uppercase tracking-[0.2em] text-muted-foreground/70">
        built with Next.js · Supabase · Vercel
      </footer>
    </main>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="field-input mt-1"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function SkeletonList() {
  return (
    <div className="grid gap-4" aria-hidden>
      {[0, 1, 2].map((index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.45, 0.75, 0.45] }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            delay: index * 0.12,
          }}
          className={cn("h-56 rounded-2xl border border-border/60 bg-card/55")}
        />
      ))}
    </div>
  );
}
