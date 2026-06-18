"use client";

import { AnimatePresence, motion } from "motion/react";
import { Bookmark, Compass, Plus, UserRound, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { BudgetSlider } from "@/components/budget-slider";
import { ItinerarySpace } from "@/components/itinerary-space";
import { QuestionCard } from "@/components/question-card";
import { QuestionForm } from "@/components/question-form";
import { StatsPill } from "@/components/stats-pill";
import { ThemeToggle } from "@/components/theme-toggle";
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

const PAGE_SIZE = 10;
type MainSpace = "wall" | "itinerary";

const cityScenes = [
  {
    city: "Tokyo",
    note: "Neon lanes and late trains",
    image:
      "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?auto=format&fit=crop&w=1800&q=80",
  },
  {
    city: "Paris",
    note: "Morning light over old streets",
    image:
      "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=1800&q=80",
  },
  {
    city: "New York",
    note: "Vertical city, restless nights",
    image:
      "https://images.unsplash.com/photo-1496588152823-86ff7695e68f?auto=format&fit=crop&w=1800&q=80",
  },
  {
    city: "Seoul",
    note: "Cafe alleys and skyline walks",
    image:
      "https://images.unsplash.com/photo-1538485399081-7c8edb8218c5?auto=format&fit=crop&w=1800&q=80",
  },
];

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
  const [sortMode, setSortMode] = useState<TripSortMode>("likes");
  const [feedScope, setFeedScope] = useState<TripFeedScope>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [filters, setFilters] = useState<TripFilters>({
    country: "",
    category: "all",
    budgetMax: BUDGET_MAX,
    season: "all",
    tag: "",
  });

  const { questions, loading, loadingMore, hasMore, error, loadMore } =
    useQuestions(PAGE_SIZE, sortMode, filters, feedScope);

  const totals = useMemo(
    () => ({
      likes: questions.reduce((sum, trip) => sum + trip.likes, 0),
      saves: questions.reduce((sum, trip) => sum + (trip.saves ?? 0), 0),
      countries: new Set(questions.map((trip) => trip.country)).size,
    }),
    [questions]
  );
  const emptyCopy = getEmptyCopy(feedScope);
  const popularCities = usePopularCities();

  return (
    <main className="relative min-h-dvh overflow-hidden">
      <CityBackdrop scenes={cityScenes} />

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
        <header className="grid min-h-[430px] content-between overflow-hidden rounded-2xl border border-white/20 bg-black/38 p-4 text-white shadow-2xl shadow-black/25 backdrop-blur-md sm:p-6 lg:min-h-[500px]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.26em] text-white/68">
                TripWall
              </p>
              <h1 className="mt-2 max-w-3xl text-5xl font-semibold tracking-tight sm:text-7xl">
                旅行靈感牆
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-white/78 sm:text-base">
                把城市夜景、巷弄美食、路線安排和旅途心得貼上來。這一版加入完整瀏覽與自己的貼文編輯，讓每則靈感更像一張可以持續更新的城市筆記。
              </p>
            </div>
            <ThemeToggle />
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
            <div className="flex flex-wrap gap-2">
              <StatsPill label="靈感" value={questions.length} accent />
              <StatsPill label="想去" value={totals.likes} />
              <StatsPill label="收藏" value={totals.saves} />
              <StatsPill label="城市" value={totals.countries} />
            </div>
            <div className="rounded-xl border border-white/18 bg-white/12 px-4 py-3 text-right backdrop-blur-md">
              <p className="text-[11px] uppercase tracking-[0.24em] text-white/55">
                City reel
              </p>
              <p className="mt-1 font-display text-3xl italic">
                Tokyo / Paris / NYC / Seoul
              </p>
            </div>
          </div>
        </header>

        <nav className="grid grid-cols-2 rounded-2xl border border-border/70 bg-card/88 p-1 shadow-sm backdrop-blur-md">
          <MainSpaceButton
            active={mainSpace === "wall"}
            onClick={() => setMainSpace("wall")}
          >
            心得牆
          </MainSpaceButton>
          <MainSpaceButton
            active={mainSpace === "itinerary"}
            onClick={() => setMainSpace("itinerary")}
          >
            行程表
          </MainSpaceButton>
        </nav>

        {mainSpace === "itinerary" ? (
          <ItinerarySpace />
        ) : (
        <section className="flex flex-col gap-4" aria-label="旅行靈感列表">
          <PopularCities
            cities={popularCities}
            onSelect={(city) =>
              setFilters((current) => ({ ...current, country: city }))
            }
          />
          <div className="rounded-2xl border border-border/70 bg-card/88 p-4 shadow-sm backdrop-blur-md">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <FeedSwitch value={feedScope} onChange={setFeedScope} />
              <Button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="min-h-11 rounded-full"
              >
                <Plus className="h-4 w-4" />
                新增心得
              </Button>
            </div>

            <div className="grid gap-3 lg:grid-cols-[1.2fr_repeat(3,1fr)]">
              <label className="block">
                <span className="text-xs font-medium text-muted-foreground">
                  搜尋城市
                </span>
                <input
                  value={filters.country}
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      country: event.target.value,
                    }))
                  }
                  placeholder="東京、台北、首爾..."
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
                label="排序"
                value={sortMode}
                options={sortOptions}
                onChange={(value) => setSortMode(value as TripSortMode)}
              />
            </div>
            <FilterSelect
              label="標籤"
              value={filters.tag}
              options={[
                { value: "", label: "全部標籤" },
                ...TRIP_TAGS.map((tag) => ({ value: tag, label: tag })),
              ]}
              onChange={(value) =>
                setFilters((current) => ({ ...current, tag: value }))
              }
            />
            <BudgetSlider
              label="預算上限"
              value={filters.budgetMax}
              onChange={(value) =>
                setFilters((current) => ({ ...current, budgetMax: value }))
              }
              className="mt-3"
            />
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
              className="rounded-2xl border border-dashed border-border/70 bg-card/70 py-14 text-center shadow-sm backdrop-blur-md"
            >
              <p className="text-2xl font-semibold text-muted-foreground">
                {emptyCopy.title}
              </p>
              <p className="mt-2 text-sm text-muted-foreground/80">
                {emptyCopy.body}
              </p>
              {feedScope === "saved" ? (
                <Button
                  type="button"
                  onClick={() => setFeedScope("all")}
                  className="mt-6 rounded-full"
                >
                  <Compass className="h-4 w-4" />
                  探索心得
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={() => setCreateOpen(true)}
                  className="mt-6 rounded-full"
                >
                  <Plus className="h-4 w-4" />
                  新增心得
                </Button>
              )}
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
                    className="rounded-full bg-card/80 backdrop-blur"
                  >
                    {loadingMore ? "讀取中..." : "載入更多"}
                  </Button>
                ) : (
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground/70">
                    目前已到底
                  </p>
                )}
              </div>
            </div>
          )}
        </section>
        )}

        <footer className="pb-4 pt-3 text-center text-xs uppercase tracking-[0.2em] text-muted-foreground/70">
          built with Next.js / Supabase / Vercel
        </footer>
      </div>

      {mainSpace === "wall" ? (
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          aria-label="新增旅行心得"
          className={cn(
            "fixed bottom-5 right-5 z-40 inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-2xl shadow-black/20 transition",
            "hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 sm:bottom-7 sm:right-7"
          )}
        >
          <Plus className="h-6 w-6" />
        </button>
      ) : null}

      <CreateTripModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </main>
  );
}

function FeedSwitch({
  value,
  onChange,
}: {
  value: TripFeedScope;
  onChange: (value: TripFeedScope) => void;
}) {
  const items: Array<{
    value: TripFeedScope;
    label: string;
    icon: typeof Compass;
  }> = [
    { value: "all", label: "探索心得", icon: Compass },
    { value: "mine", label: "我的心得", icon: UserRound },
    { value: "saved", label: "我的收藏", icon: Bookmark },
  ];

  return (
    <div
      className="inline-grid grid-cols-3 rounded-full border border-border bg-background/70 p-1 shadow-sm"
      aria-label="切換心得列表"
      role="tablist"
    >
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
              "inline-flex min-h-10 items-center justify-center gap-2 rounded-full px-4 text-sm font-medium transition",
              active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

function MainSpaceButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "min-h-11 rounded-xl text-sm font-medium transition",
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </button>
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
    <section className="rounded-2xl border border-border/70 bg-card/88 p-4 shadow-sm backdrop-blur-md">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">熱門城市 Top 5</h2>
        <p className="text-xs text-muted-foreground">依公開心得數排序</p>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-5">
        {cities.map((item, index) => (
          <button
            key={item.city}
            type="button"
            onClick={() => onSelect(item.city)}
            className="rounded-xl border border-border bg-background/60 p-3 text-left transition hover:border-primary/60 hover:text-primary"
          >
            <p className="text-[11px] text-muted-foreground">No. {index + 1}</p>
            <p className="mt-1 font-semibold">{item.city}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {item.count} 則
            </p>
          </button>
        ))}
      </div>
    </section>
  );
}

function getEmptyCopy(scope: TripFeedScope) {
  if (scope === "mine") {
    return {
      title: "你還沒有發布旅行心得",
      body: "按下新增，把下一段城市記憶放進自己的旅行牆。",
    };
  }

  if (scope === "saved") {
    return {
      title: "你還沒有收藏任何心得",
      body: "在探索心得裡按下收藏，就能把想回看的城市筆記放進這裡。",
    };
  }

  return {
    title: "城市牆目前還是空的",
    body: "先發布第一則旅行靈感，讓這面牆開始有路線、有光、有故事。",
  };
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
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 backdrop-blur-sm sm:items-center sm:p-5"
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
            className="relative max-h-[94dvh] w-full max-w-4xl overflow-y-auto"
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="關閉新增表單"
              className="absolute right-4 top-4 z-10 hidden h-10 w-10 items-center justify-center rounded-full border border-border bg-background/85 transition hover:border-primary/60 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 sm:inline-flex"
            >
              <X className="h-4 w-4" />
            </button>
            <QuestionForm onCancel={onClose} onSubmitted={onClose} />
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function CityBackdrop({
  scenes,
}: {
  scenes: Array<{ city: string; note: string; image: string }>;
}) {
  return (
    <div aria-hidden className="fixed inset-0 z-0 bg-black">
      {scenes.map((scene, index) => (
        <div
          key={scene.city}
          className="absolute inset-0 animate-city-fade bg-cover bg-center opacity-0"
          style={{
            backgroundImage: `url(${scene.image})`,
            animationDelay: `${index * 6}s`,
          }}
        />
      ))}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(4,8,14,0.46),rgba(4,8,14,0.72)_48%,rgba(245,247,249,0.96)_82%)] dark:bg-[linear-gradient(180deg,rgba(4,8,14,0.38),rgba(4,8,14,0.82)_52%,rgba(10,14,22,0.96)_86%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(rgba(255,255,255,0.07)_1px,transparent_1px)] bg-[length:54px_54px]" />
    </div>
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
          className={cn("h-56 rounded-2xl border border-border/60 bg-card/70")}
        />
      ))}
    </div>
  );
}
