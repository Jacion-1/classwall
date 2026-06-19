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
  X,
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
import {
  getCityFallbackImage,
  usePopularCities,
  type PopularCity,
} from "@/lib/use-popular-cities";
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
        <section className="grid max-w-full gap-4 overflow-x-hidden" aria-label="旅行靈感列表">
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
              <div className="grid max-w-full gap-4 sm:grid-cols-2 xl:grid-cols-3">
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

      {mainSpace === "wall" ? (
        <MobileCreateButton onClick={() => navigate("create-post")} />
      ) : null}
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
    <section className="relative min-h-[250px] max-w-full overflow-hidden rounded-2xl border border-border bg-card shadow-sm md:min-h-[176px]">
      <div
        aria-hidden
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage:
            "url(https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1800&q=80)",
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-black/76 via-black/46 to-black/12" />
      <div className="relative z-10 flex min-h-[250px] flex-col justify-center gap-4 p-5 text-white md:min-h-[176px] md:flex-row md:items-center md:justify-between md:p-6">
        <div className="max-w-2xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/72">
            Featured Journey
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl md:text-4xl">
            探索世界，收集靈感
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-white/82">
            從旅人的真實體驗中獲得靈感，規劃屬於你的下趟旅行。
          </p>
        </div>
        <div className="flex flex-col gap-3 md:items-end">
          <Button
            type="button"
            onClick={onCreate}
            className="min-h-10 w-fit rounded-full bg-white px-4 text-slate-950 hover:bg-white/90"
          >
            <Plus className="h-4 w-4" />
            新增心得
          </Button>
          <div className="hidden flex-wrap justify-end gap-2 text-xs text-white/82 sm:flex">
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
    <span className="rounded-full border border-white/22 bg-white/12 px-2.5 py-1 text-[11px] backdrop-blur-sm">
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
  const [expanded, setExpanded] = useState(false);
  const activeFilterCount = [
    filters.category !== "all",
    filters.season !== "all",
    Boolean(filters.tag),
    filters.budgetMax < BUDGET_MAX,
    sortMode !== "likes",
  ].filter(Boolean).length;

  return (
    <section className="max-w-full overflow-hidden rounded-2xl border border-border bg-card/95 p-3 shadow-sm">
      <div className="flex max-w-full gap-2 lg:grid lg:grid-cols-[minmax(220px,1.15fr)_repeat(4,minmax(130px,0.7fr))_auto] lg:gap-3">
        <label className="relative min-w-0 flex-1 lg:flex-none">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={filters.country}
            onChange={(event) =>
              onFiltersChange((current) => ({
                ...current,
                country: event.target.value,
              }))
            }
            placeholder="搜尋城市、景點、心得..."
            className="field-input h-11 pl-9"
          />
        </label>

        <div className="hidden lg:contents">
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
        </div>

        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((current) => !current)}
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-border bg-background/70 px-3 text-sm font-medium text-muted-foreground transition hover:border-primary/60 hover:text-primary lg:pointer-events-none lg:min-w-32"
        >
          {expanded ? <X className="h-4 w-4 lg:hidden" /> : <SlidersHorizontal className="h-4 w-4" />}
          <span>篩選</span>
          {activeFilterCount > 0 ? (
            <span className="grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[11px] text-primary-foreground">
              {activeFilterCount}
            </span>
          ) : null}
        </button>
      </div>

      <div
        className={cn(
          "grid gap-3 overflow-hidden transition-all duration-200 lg:mt-3 lg:max-h-none lg:opacity-100",
          expanded ? "mt-3 max-h-[720px] opacity-100" : "max-h-0 opacity-0 lg:max-h-none"
        )}
      >
        <div className="grid gap-2 sm:grid-cols-2 lg:hidden">
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
        </div>
        <BudgetSlider
          label="預算上限"
          value={filters.budgetMax}
          onChange={(value) =>
            onFiltersChange((current) => ({ ...current, budgetMax: value }))
          }
          className="w-full min-w-0"
        />
      </div>
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
    <label className="min-w-0 shrink-0 lg:min-w-0 lg:shrink">
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
  cities: PopularCity[];
  onSelect: (city: string) => void;
}) {
  if (cities.length === 0) return null;

  return (
    <section className="grid max-w-full gap-3 overflow-hidden">
      <SectionTitle
        icon={<Flame className="h-4 w-4 text-destructive" />}
        title="熱門目的地"
        action="查看全部"
      />
      <div className="flex max-w-full gap-3 overflow-x-auto overscroll-x-contain pb-2 lg:grid lg:grid-cols-5 lg:overflow-visible lg:pb-0">
        {cities.slice(0, 5).map((item, index) => (
          <button
            key={item.city}
            type="button"
            onClick={() => onSelect(item.city)}
            className="group relative h-[118px] w-[184px] shrink-0 overflow-hidden rounded-2xl border border-border bg-card text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-md lg:w-auto"
          >
            <div
              className="absolute inset-0 bg-cover bg-center transition duration-300 group-hover:scale-105"
              style={{
                backgroundImage:
                  "url(" + (item.imageUrl ?? getCityFallbackImage(item.city)) + ")",
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/82 via-black/25 to-transparent" />
            <div className="relative z-10 flex h-full flex-col justify-between p-3 text-white">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-white/90 text-xs font-semibold text-slate-900">
                {index + 1}
              </span>
              <div className="min-w-0">
                <p className="truncate text-base font-semibold">{item.city}</p>
                <p className="text-xs text-white/78">{item.count} 則心得</p>
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
    <section className="grid gap-3">
      <SectionTitle title="旅行心得" action="即時更新" />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0" role="tablist" aria-label="心得範圍">
          {items.map((item) => {
            const Icon = item.icon;
            const active = item.value === value;
            return (
              <button
                key={item.value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onChange(item.value)}
                className={cn(
                  "inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-medium transition",
                  active
                    ? "border-primary/50 bg-primary/12 text-primary shadow-sm"
                    : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-primary"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </div>
        <Button
          type="button"
          onClick={onCreate}
          className="hidden min-h-11 rounded-full sm:inline-flex"
        >
          <Plus className="h-4 w-4" />
          新增心得
        </Button>
      </div>
    </section>
  );
}

function SectionTitle({
  icon,
  title,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  action?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 text-base font-semibold sm:text-lg">
        {icon}
        {title}
      </h2>
      {action ? (
        <span className="text-xs font-medium text-muted-foreground">{action}</span>
      ) : null}
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
      ? {
          title: "你還沒有發布心得",
          body:
            "未登入時，我的心得只會綁定目前瀏覽器。若要在手機與電腦同步，請登入同一個帳號。",
        }
      : scope === "saved"
        ? { title: "你還沒有收藏心得", body: "在探索心得中按下收藏，之後就能快速回來查看。" }
        : { title: "目前沒有符合條件的心得", body: "試著調整搜尋或篩選條件，也可以先發布第一篇。" };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-dashed border-border bg-card px-5 py-12 text-center shadow-sm"
    >
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
        <Filter className="h-6 w-6" />
      </div>
      <p className="mt-4 text-xl font-semibold sm:text-2xl">{copy.title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">{copy.body}</p>
      <Button type="button" onClick={onCreate} className="mt-6 min-h-11 rounded-full">
        <Plus className="h-4 w-4" />
        新增心得
      </Button>
    </motion.div>
  );
}

function MobileCreateButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="新增旅行心得"
      className="fixed bottom-20 right-4 z-40 inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/25 transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 sm:hidden"
    >
      <Plus className="h-6 w-6" />
    </button>
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
    <div className="grid max-w-full gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-hidden>
      {Array.from({ length: 6 }).map((_, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.45, 0.75, 0.45] }}
          transition={{ duration: 1.5, repeat: Infinity, delay: index * 0.08 }}
          className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
        >
          <div className="aspect-video bg-muted" />
          <div className="space-y-3 p-4">
            <div className="h-4 w-24 rounded-full bg-muted" />
            <div className="h-5 w-3/4 rounded-full bg-muted" />
            <div className="h-4 w-full rounded-full bg-muted" />
            <div className="h-4 w-2/3 rounded-full bg-muted" />
          </div>
        </motion.div>
      ))}
    </div>
  );
}
