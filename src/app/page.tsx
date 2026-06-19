"use client";

import { AnimatePresence, motion } from "motion/react";
import {
  Bookmark,
  Compass,
  Filter,
  Flame,
  Plus,
  Search,
  SlidersHorizontal,
  UserRound,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  DashboardShell,
  type DashboardView,
} from "@/components/dashboard-shell";
import { BudgetSlider } from "@/components/budget-slider";
import { ItinerarySpace } from "@/components/itinerary-space";
import { ProfileSpace } from "@/components/profile-space";
import { QuestionCard } from "@/components/question-card";
import { QuestionForm } from "@/components/question-form";
import { Button } from "@/components/ui/button";
import { TRIP_TAGS } from "@/lib/trip-tags";
import { usePopularCities } from "@/lib/use-popular-cities";
import { useQuestions, type TripFeedScope } from "@/lib/use-questions";
import { BUDGET_MAX } from "@/lib/trip-budget";
import { cn } from "@/lib/utils";
import type {
  TripCategory,
  TripFilters,
  TripSeason,
  TripSortMode,
} from "@/types/database";

const PAGE_SIZE = 12;
type MainSpace = "wall" | "itinerary" | "profile";

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

const sortOptions: Array<{ value: TripSortMode; label: string }> = [
  { value: "likes", label: "最多想去" },
  { value: "saves", label: "最多收藏" },
  { value: "budget", label: "預算低到高" },
  { value: "newest", label: "最新發布" },
];

const cityImages = [
  "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1513622470522-26c3c8a854bc?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1538485399081-7c8edb8218c5?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1534274867514-d5b47ef89ed7?auto=format&fit=crop&w=900&q=80",
];

export default function Home() {
  const [mainSpace, setMainSpace] = useState<MainSpace>("wall");
  const [activeView, setActiveView] = useState<DashboardView>("home");
  const [sortMode, setSortMode] = useState<TripSortMode>("likes");
  const [feedScope, setFeedScope] = useState<TripFeedScope>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [itineraryCreateToken, setItineraryCreateToken] = useState(0);
  const [filters, setFilters] = useState<TripFilters>({
    country: "",
    category: "all",
    budgetMax: BUDGET_MAX,
    season: "all",
    tag: "",
  });

  const { questions, loading, loadingMore, hasMore, error, loadMore } =
    useQuestions(PAGE_SIZE, sortMode, filters, feedScope);
  const popularCities = usePopularCities();

  const totals = useMemo(
    () => ({
      trips: questions.length,
      likes: questions.reduce((sum, trip) => sum + trip.likes, 0),
      saves: questions.reduce((sum, trip) => sum + (trip.saves ?? 0), 0),
      countries: new Set(questions.map((trip) => trip.country)).size,
    }),
    [questions]
  );

  function navigate(action: DashboardView | "create-post" | "create-itinerary") {
    if (action === "create-post") {
      setMainSpace("wall");
      setActiveView("explore");
      setFeedScope("all");
      setCreateOpen(true);
      return;
    }

    if (action === "create-itinerary") {
      setMainSpace("itinerary");
      setActiveView("itinerary");
      setItineraryCreateToken((current) => current + 1);
      return;
    }

    setActiveView(action);
    if (action === "itinerary") {
      setMainSpace("itinerary");
      return;
    }
    if (action === "profile") {
      setMainSpace("profile");
      return;
    }

    setMainSpace("wall");
    if (action === "saved") setFeedScope("saved");
    else if (action === "mine") setFeedScope("mine");
    else setFeedScope("all");
  }

  function updateSearch(value: string) {
    setFilters((current) => ({ ...current, country: value }));
    setMainSpace("wall");
    setActiveView(value.trim() ? "explore" : "home");
    setFeedScope("all");
  }

  return (
    <DashboardShell
      activeView={activeView}
      searchValue={filters.country}
      onSearchChange={updateSearch}
      onNavigate={navigate}
    >
      {mainSpace === "profile" ? (
        <ProfileSpace />
      ) : mainSpace === "itinerary" ? (
        <ItinerarySpace startCreateToken={itineraryCreateToken} />
      ) : (
        <section className="grid gap-5" aria-label="旅行靈感列表">
          <FeaturedBanner onCreate={() => navigate("create-post")} totals={totals} />
          <FilterToolbar
            filters={filters}
            sortMode={sortMode}
            onFiltersChange={setFilters}
            onSortChange={setSortMode}
          />
          <PopularCities
            cities={popularCities}
            onSelect={(city) => updateSearch(city)}
          />
          <FeedHeader
            value={feedScope}
            onChange={(nextScope) => {
              setFeedScope(nextScope);
              setActiveView(
                nextScope === "saved"
                  ? "saved"
                  : nextScope === "mine"
                    ? "mine"
                    : "explore"
              );
            }}
            onCreate={() => navigate("create-post")}
          />

          {loading ? (
            <SkeletonGrid />
          ) : error ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center text-sm text-destructive">
              讀取失敗：{error}
            </div>
          ) : questions.length === 0 ? (
            <EmptyState scope={feedScope} onCreate={() => navigate("create-post")} />
          ) : (
            <>
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                <AnimatePresence mode="popLayout" initial={false}>
                  {questions.map((question) => (
                    <QuestionCard key={question.id} question={question} />
                  ))}
                </AnimatePresence>
              </div>

              <div className="flex justify-center pt-2">
                {hasMore ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => loadMore()}
                    disabled={loadingMore}
                    className="rounded-full bg-card/80 backdrop-blur"
                  >
                    {loadingMore ? "載入中..." : "載入更多"}
                  </Button>
                ) : (
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground/70">
                    已經到底了
                  </p>
                )}
              </div>
            </>
          )}
        </section>
      )}

      <CreateTripModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </DashboardShell>
  );
}

function FeaturedBanner({
  totals,
  onCreate,
}: {
  totals: { trips: number; likes: number; saves: number; countries: number };
  onCreate: () => void;
}) {
  return (
    <section className="relative min-h-[220px] overflow-hidden rounded-xl border border-border bg-card shadow-sm md:min-h-[260px]">
      <div
        aria-hidden
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage:
            "url(https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1800&q=80)",
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-black/72 via-black/42 to-black/10" />
      <div className="relative z-10 grid min-h-[220px] content-center gap-4 p-5 text-white md:min-h-[260px] md:p-8">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-white/72">
            Featured Journey
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-5xl">
            探索世界，收集靈感
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-white/82 md:text-base">
            從旅人的真實體驗中獲得靈感，規劃屬於你的下趟旅行。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" onClick={onCreate} className="rounded-full bg-white text-slate-950 hover:bg-white/90">
            <Plus className="h-4 w-4" />
            新增心得
          </Button>
          <div className="flex flex-wrap gap-2 text-xs text-white/82">
            <Metric label="靈感" value={totals.trips} />
            <Metric label="想去" value={totals.likes} />
            <Metric label="收藏" value={totals.saves} />
            <Metric label="城市" value={totals.countries} />
          </div>
        </div>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <span className="rounded-full border border-white/24 bg-white/14 px-3 py-1.5 backdrop-blur-sm">
      {label} {value.toLocaleString("zh-TW")}
    </span>
  );
}

function FilterToolbar({
  filters,
  sortMode,
  onFiltersChange,
  onSortChange,
}: {
  filters: TripFilters;
  sortMode: TripSortMode;
  onFiltersChange: React.Dispatch<React.SetStateAction<TripFilters>>;
  onSortChange: (value: TripSortMode) => void;
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-3 shadow-sm">
      <div className="flex gap-3 overflow-x-auto pb-1 lg:grid lg:grid-cols-[minmax(220px,1.1fr)_repeat(4,minmax(130px,0.7fr))_auto] lg:overflow-visible lg:pb-0">
        <label className="relative min-w-[240px] lg:min-w-0">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={filters.country}
            onChange={(event) =>
              onFiltersChange((current) => ({
                ...current,
                country: event.target.value,
              }))
            }
            placeholder="搜尋關鍵字"
            className="field-input h-11 pl-9"
          />
        </label>
        <FilterSelect
          label="類型"
          value={filters.category}
          options={categoryOptions}
          onChange={(value) =>
            onFiltersChange((current) => ({
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
            onFiltersChange((current) => ({
              ...current,
              season: value as TripSeason | "all",
            }))
          }
        />
        <FilterSelect
          label="排序"
          value={sortMode}
          options={sortOptions}
          onChange={(value) => onSortChange(value as TripSortMode)}
        />
        <FilterSelect
          label="標籤"
          value={filters.tag}
          options={[
            { value: "", label: "全部標籤" },
            ...TRIP_TAGS.map((tag) => ({ value: tag, label: tag })),
          ]}
          onChange={(value) =>
            onFiltersChange((current) => ({ ...current, tag: value }))
          }
        />
        <button
          type="button"
          className="inline-flex min-h-11 min-w-32 items-center justify-center gap-2 rounded-lg border border-border bg-background/70 px-3 text-sm text-muted-foreground transition hover:border-primary/60 hover:text-primary"
        >
          <SlidersHorizontal className="h-4 w-4" />
          篩選更多
        </button>
      </div>
      <BudgetSlider
        label="預算上限"
        value={filters.budgetMax}
        onChange={(value) =>
          onFiltersChange((current) => ({ ...current, budgetMax: value }))
        }
        className="mt-3"
      />
    </section>
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
    <label className="min-w-[150px] lg:min-w-0">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="field-input h-11"
        aria-label={label}
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

function PopularCities({
  cities,
  onSelect,
}: {
  cities: Array<{ city: string; count: number }>;
  onSelect: (city: string) => void;
}) {
  if (cities.length === 0) return null;

  return (
    <section className="grid gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Flame className="h-5 w-5 text-destructive" />
          熱門城市
        </h2>
        <button className="text-sm text-muted-foreground hover:text-primary" type="button">
          查看全部
        </button>
      </div>
      <div className="grid auto-cols-[220px] grid-flow-col gap-4 overflow-x-auto pb-2 lg:grid-flow-row lg:grid-cols-5 lg:overflow-visible lg:pb-0">
        {cities.slice(0, 5).map((item, index) => (
          <button
            key={item.city}
            type="button"
            onClick={() => onSelect(item.city)}
            className="group relative h-36 overflow-hidden rounded-xl border border-border bg-card text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div
              className="absolute inset-0 bg-cover bg-center transition duration-300 group-hover:scale-105"
              style={{ backgroundImage: `url(${cityImages[index % cityImages.length]})` }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/78 via-black/25 to-transparent" />
            <div className="relative z-10 flex h-full flex-col justify-between p-3 text-white">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-white/88 text-sm font-semibold text-slate-900">
                {index + 1}
              </span>
              <div>
                <p className="text-lg font-semibold">{item.city}</p>
                <p className="text-xs text-white/76">{item.count} 則心得</p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

function FeedHeader({
  value,
  onChange,
  onCreate,
}: {
  value: TripFeedScope;
  onChange: (value: TripFeedScope) => void;
  onCreate: () => void;
}) {
  const items: Array<{ value: TripFeedScope; label: string; icon: typeof Compass }> = [
    { value: "all", label: "推薦心得", icon: Compass },
    { value: "mine", label: "我的心得", icon: UserRound },
    { value: "saved", label: "我的收藏", icon: Bookmark },
  ];

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0">
        {items.map((item) => {
          const Icon = item.icon;
          const active = item.value === value;
          return (
            <button
              key={item.value}
              type="button"
              onClick={() => onChange(item.value)}
              className={cn(
                "inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-medium transition",
                active
                  ? "border-primary/50 bg-primary/12 text-primary"
                  : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-primary"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </button>
          );
        })}
      </div>
      <Button type="button" onClick={onCreate} className="min-h-11 rounded-full">
        <Plus className="h-4 w-4" />
        新增心得
      </Button>
    </div>
  );
}

function EmptyState({
  scope,
  onCreate,
}: {
  scope: TripFeedScope;
  onCreate: () => void;
}) {
  const copy =
    scope === "mine"
      ? { title: "你還沒有發布心得", body: "新增一篇旅行筆記，讓你的城市經驗被看見。" }
      : scope === "saved"
        ? { title: "你還沒有收藏心得", body: "在探索心得中按下收藏，之後就能快速回來查看。" }
        : { title: "目前沒有符合條件的心得", body: "試著調整搜尋或篩選條件，也可以先發布第一篇。" };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-dashed border-border bg-card py-14 text-center shadow-sm"
    >
      <Filter className="mx-auto h-9 w-9 text-primary" />
      <p className="mt-3 text-2xl font-semibold">{copy.title}</p>
      <p className="mt-2 text-sm text-muted-foreground">{copy.body}</p>
      <Button type="button" onClick={onCreate} className="mt-6 rounded-full">
        <Plus className="h-4 w-4" />
        新增心得
      </Button>
    </motion.div>
  );
}

function CreateTripModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-5"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) onClose();
          }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="新增旅行心得"
            initial={{ opacity: 0, y: 28, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.98 }}
            transition={{ duration: 0.22 }}
            className="relative max-h-[96dvh] w-full max-w-5xl overflow-y-auto rounded-t-2xl sm:rounded-2xl"
          >
            <QuestionForm onCancel={onClose} onSubmitted={onClose} />
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3" aria-hidden>
      {Array.from({ length: 6 }).map((_, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.45, 0.75, 0.45] }}
          transition={{ duration: 1.5, repeat: Infinity, delay: index * 0.08 }}
          className="h-80 rounded-xl border border-border bg-card"
        />
      ))}
    </div>
  );
}
