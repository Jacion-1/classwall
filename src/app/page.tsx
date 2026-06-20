"use client";

import { AnimatePresence, motion } from "motion/react";
import {
  ArrowRight,
  Bookmark,
  CalendarDays,
  Compass,
  Filter,
  Flame,
  Heart,
  MapPinned,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
  Tags,
  UserRound,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  DashboardShell,
  type DashboardView,
} from "@/components/dashboard-shell";
import { BudgetSlider } from "@/components/budget-slider";
import { ItineraryErrorBoundary } from "@/components/itinerary-error-boundary";
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
import { useItineraries } from "@/lib/use-itineraries";
import { useQuestions, type TripFeedScope } from "@/lib/use-questions";
import { BUDGET_MAX, DEFAULT_BUDGET_AMOUNT, formatTripBudget } from "@/lib/trip-budget";
import { getSlotValue, ITINERARY_SLOT_KEYS, normalizeItineraryDays } from "@/lib/itinerary-days";
import { cn } from "@/lib/utils";
import type {
  Itinerary,
  Question,
  TripCategory,
  TripFilters,
  TripSeason,
  TripSortMode,
} from "@/types/database";

const PAGE_SIZE = 12;
type MainSpace = "wall" | "itinerary" | "profile";

const DEFAULT_FILTERS: TripFilters = {
  country: "",
  category: "all",
  budgetMax: BUDGET_MAX,
  season: "all",
  tag: "",
};

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
  const [filters, setFilters] = useState<TripFilters>(DEFAULT_FILTERS);

  const { questions, loading, loadingMore, hasMore, error, loadMore } =
    useQuestions(PAGE_SIZE, sortMode, filters, feedScope);
  const popularCities = usePopularCities();
  const { itineraries: latestItineraries, loading: itinerariesLoading } =
    useItineraries("", "public");

  const totals = useMemo(
    () => ({
      trips: questions.length,
      likes: questions.reduce((sum, trip) => sum + trip.likes, 0),
      saves: questions.reduce((sum, trip) => sum + (trip.saves ?? 0), 0),
      countries: new Set(questions.map((trip) => trip.country)).size,
    }),
    [questions]
  );
  const featuredQuestions = useMemo(() => questions.slice(0, 3), [questions]);
  const latestQuestions = useMemo(
    () =>
      [...questions]
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
        .slice(0, 3),
    [questions]
  );
  const popularTags = useMemo(() => getPopularTags(questions), [questions]);

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
    if (action === "home") {
      setFeedScope("all");
      setSortMode("likes");
      setFilters(DEFAULT_FILTERS);
      return;
    }
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
        <ItineraryErrorBoundary
          resetKey={`${activeView}-${itineraryCreateToken}`}
          onBackHome={() => navigate("home")}
        >
          <ItinerarySpace startCreateToken={itineraryCreateToken} />
        </ItineraryErrorBoundary>
      ) : activeView === "home" ? (
        <HomeDashboard
          totals={totals}
          loading={loading}
          error={error}
          featuredQuestions={featuredQuestions}
          latestQuestions={latestQuestions}
          popularCities={popularCities}
          popularTags={popularTags}
          latestItineraries={latestItineraries}
          itinerariesLoading={itinerariesLoading}
          onCreate={() => navigate("create-post")}
          onExplore={() => navigate("explore")}
          onCreateItinerary={() => navigate("create-itinerary")}
          onOpenItineraries={() => navigate("itinerary")}
          onSelectCity={(city) => updateSearch(city)}
          onSelectTag={(tag) => {
            setFilters((current) => ({ ...current, tag }));
            setActiveView("explore");
            setMainSpace("wall");
            setFeedScope("all");
          }}
        />
      ) : (
        <ExploreFeed
          filters={filters}
          sortMode={sortMode}
          feedScope={feedScope}
          questions={questions}
          loading={loading}
          loadingMore={loadingMore}
          hasMore={hasMore}
          error={error}
          onFiltersChange={setFilters}
          onSortChange={setSortMode}
          onLoadMore={loadMore}
          onCreate={() => navigate("create-post")}
          onFeedScopeChange={(nextScope) => {
            setFeedScope(nextScope);
            setActiveView(
              nextScope === "saved"
                ? "saved"
                : nextScope === "mine"
                  ? "mine"
                  : "explore"
            );
          }}
        />
      )}

      {mainSpace === "wall" ? (
        <MobileCreateButton onClick={() => navigate("create-post")} />
      ) : null}
      <CreateTripModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </DashboardShell>
  );
}

function HomeDashboard({
  totals,
  loading,
  error,
  featuredQuestions,
  latestQuestions,
  popularCities,
  popularTags,
  latestItineraries,
  itinerariesLoading,
  onCreate,
  onExplore,
  onCreateItinerary,
  onOpenItineraries,
  onSelectCity,
  onSelectTag,
}: {
  totals: { trips: number; likes: number; saves: number; countries: number };
  loading: boolean;
  error: string | null;
  featuredQuestions: Question[];
  latestQuestions: Question[];
  popularCities: PopularCity[];
  popularTags: Array<{ tag: string; count: number }>;
  latestItineraries: Itinerary[];
  itinerariesLoading: boolean;
  onCreate: () => void;
  onExplore: () => void;
  onCreateItinerary: () => void;
  onOpenItineraries: () => void;
  onSelectCity: (city: string) => void;
  onSelectTag: (tag: string) => void;
}) {
  return (
    <section className="grid max-w-full gap-5 overflow-x-hidden" aria-label="TripWall 首頁總覽">
      <FeaturedBanner onCreate={onCreate} onExplore={onExplore} totals={totals} />
      <QuickActions
        onExplore={onExplore}
        onCreate={onCreate}
        onOpenItineraries={onOpenItineraries}
        onCreateItinerary={onCreateItinerary}
      />

      <div className="grid max-w-full gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid min-w-0 gap-5">
          <PopularCities cities={popularCities} onSelect={onSelectCity} />
          <HomeQuestionSection
            title="推薦心得"
            action="前往探索"
            questions={featuredQuestions}
            loading={loading}
            error={error}
            onAction={onExplore}
          />
          <PopularTags tags={popularTags} onSelect={onSelectTag} />
          <LatestItineraries
            itineraries={latestItineraries}
            loading={itinerariesLoading}
            onOpen={onOpenItineraries}
            onCreate={onCreateItinerary}
          />
        </div>
        <DashboardAside
          totals={totals}
          latestQuestions={latestQuestions}
          popularCities={popularCities}
          popularTags={popularTags}
          onExplore={onExplore}
          onSelectCity={onSelectCity}
          onSelectTag={onSelectTag}
        />
      </div>
    </section>
  );
}

function ExploreFeed({
  filters,
  sortMode,
  feedScope,
  questions,
  loading,
  loadingMore,
  hasMore,
  error,
  onFiltersChange,
  onSortChange,
  onFeedScopeChange,
  onLoadMore,
  onCreate,
}: {
  filters: TripFilters;
  sortMode: TripSortMode;
  feedScope: TripFeedScope;
  questions: Question[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  onFiltersChange: React.Dispatch<React.SetStateAction<TripFilters>>;
  onSortChange: (value: TripSortMode) => void;
  onFeedScopeChange: (value: TripFeedScope) => void;
  onLoadMore: () => void;
  onCreate: () => void;
}) {
  return (
    <section className="grid max-w-full gap-4 overflow-x-hidden" aria-label="探索旅行心得">
      <ExploreHeader onCreate={onCreate} />
      <FilterToolbar
        filters={filters}
        sortMode={sortMode}
        onFiltersChange={onFiltersChange}
        onSortChange={onSortChange}
      />
      <FeedHeader value={feedScope} onChange={onFeedScopeChange} onCreate={onCreate} />
      <FeedContent
        questions={questions}
        loading={loading}
        loadingMore={loadingMore}
        hasMore={hasMore}
        error={error}
        feedScope={feedScope}
        onLoadMore={onLoadMore}
        onCreate={onCreate}
      />
    </section>
  );
}

function FeaturedBanner({
  totals,
  onCreate,
  onExplore,
}: {
  totals: { trips: number; likes: number; saves: number; countries: number };
  onCreate: () => void;
  onExplore: () => void;
}) {
  return (
    <section className="relative min-h-[300px] max-w-full overflow-hidden rounded-2xl border border-border bg-card shadow-sm md:min-h-[340px]">
      <div
        aria-hidden
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage:
            "url(https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1800&q=80)",
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-black/82 via-black/52 to-black/16" />
      <div className="relative z-10 flex min-h-[300px] flex-col justify-between gap-6 p-5 text-white md:min-h-[340px] md:p-8">
        <div className="max-w-3xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/72">
            TripWall Dashboard
          </p>
          <h1 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
            旅行靈感牆，從真實心得開始規劃下一趟旅程
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-white/84 sm:text-base">
            整理城市、景點、美食、行程與旅人心得，把分散的靈感變成可以收藏、比較與出發的旅行資料庫。
          </p>
        </div>
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="grid grid-cols-2 gap-2 text-xs text-white/86 sm:flex sm:flex-wrap">
            <Metric label="心得" value={totals.trips} />
            <Metric label="想去" value={totals.likes} />
            <Metric label="收藏" value={totals.saves} />
            <Metric label="城市" value={totals.countries} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={onExplore}
              className="min-h-11 rounded-full bg-white px-5 text-slate-950 hover:bg-white/90"
            >
              開始探索
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              onClick={onCreate}
              variant="outline"
              className="min-h-11 rounded-full border-white/40 bg-white/10 px-5 text-white hover:bg-white/18"
            >
              <Plus className="h-4 w-4" />
              新增心得
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <span className="rounded-full border border-white/22 bg-white/12 px-3 py-1.5 text-[11px] backdrop-blur-sm">
      {label} {value.toLocaleString("zh-TW")}
    </span>
  );
}

function QuickActions({
  onExplore,
  onCreate,
  onOpenItineraries,
  onCreateItinerary,
}: {
  onExplore: () => void;
  onCreate: () => void;
  onOpenItineraries: () => void;
  onCreateItinerary: () => void;
}) {
  const actions = [
    {
      title: "探索心得",
      body: "搜尋城市、景點與真實旅遊心得。",
      icon: Compass,
      onClick: onExplore,
    },
    {
      title: "建立新心得",
      body: "分享照片、預算、標籤與旅途感受。",
      icon: Plus,
      onClick: onCreate,
    },
    {
      title: "公開行程表",
      body: "查看其他旅人的每日路線安排。",
      icon: CalendarDays,
      onClick: onOpenItineraries,
    },
    {
      title: "建立新行程",
      body: "把接下來的旅行拆成可閱讀的時段。",
      icon: MapPinned,
      onClick: onCreateItinerary,
    },
  ];

  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="快速入口">
      {actions.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.title}
            type="button"
            onClick={item.onClick}
            className="group min-h-28 rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-md"
          >
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary transition group-hover:bg-primary group-hover:text-primary-foreground">
              <Icon className="h-5 w-5" />
            </span>
            <span className="mt-4 block text-sm font-semibold">{item.title}</span>
            <span className="mt-1 block text-xs leading-5 text-muted-foreground">{item.body}</span>
          </button>
        );
      })}
    </section>
  );
}

function HomeQuestionSection({
  title,
  action,
  questions,
  loading,
  error,
  onAction,
}: {
  title: string;
  action: string;
  questions: Question[];
  loading: boolean;
  error: string | null;
  onAction: () => void;
}) {
  return (
    <section className="grid gap-3">
      <SectionTitle
        icon={<Heart className="h-4 w-4 text-primary" />}
        title={title}
        action={
          <button
            type="button"
            onClick={onAction}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            {action}
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        }
      />
      {loading ? (
        <SkeletonGrid count={3} />
      ) : error ? (
        <ErrorState message={error} />
      ) : questions.length === 0 ? (
        <MiniEmpty title="目前還沒有推薦心得" body="新增第一篇旅行心得，首頁就會開始累積內容。" />
      ) : (
        <div className="grid max-w-full gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {questions.map((question) => (
            <QuestionCard key={question.id} question={question} />
          ))}
        </div>
      )}
    </section>
  );
}

function PopularTags({
  tags,
  onSelect,
}: {
  tags: Array<{ tag: string; count: number }>;
  onSelect: (tag: string) => void;
}) {
  const visibleTags = tags.length > 0 ? tags : TRIP_TAGS.slice(0, 7).map((tag) => ({ tag, count: 0 }));

  return (
    <section className="grid gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
      <SectionTitle icon={<Tags className="h-4 w-4 text-primary" />} title="熱門標籤" action="點選後前往探索" />
      <div className="flex flex-wrap gap-2">
        {visibleTags.map((item) => (
          <button
            key={item.tag}
            type="button"
            onClick={() => onSelect(item.tag)}
            className="inline-flex min-h-10 items-center gap-2 rounded-full border border-border bg-background/70 px-4 text-sm transition hover:border-primary/50 hover:bg-primary/10 hover:text-primary"
          >
            #{item.tag}
            {item.count > 0 ? (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                {item.count}
              </span>
            ) : null}
          </button>
        ))}
      </div>
    </section>
  );
}

function LatestItineraries({
  itineraries,
  loading,
  onOpen,
  onCreate,
}: {
  itineraries: Itinerary[];
  loading: boolean;
  onOpen: () => void;
  onCreate: () => void;
}) {
  return (
    <section className="grid gap-3">
      <SectionTitle
        icon={<CalendarDays className="h-4 w-4 text-primary" />}
        title="最新公開行程"
        action={
          <button type="button" onClick={onOpen} className="text-xs font-medium text-primary hover:underline">
            查看行程表
          </button>
        }
      />
      {loading ? (
        <div className="grid gap-3 md:grid-cols-2">
          <div className="h-36 animate-pulse rounded-2xl border border-border bg-card" />
          <div className="h-36 animate-pulse rounded-2xl border border-border bg-card" />
        </div>
      ) : itineraries.length === 0 ? (
        <MiniEmpty title="還沒有公開行程" body="建立一份行程表，讓其他旅人可以參考你的路線。" action="建立行程" onAction={onCreate} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {itineraries.slice(0, 2).map((itinerary) => (
            <ItineraryPreviewCard key={itinerary.id} itinerary={itinerary} onOpen={onOpen} />
          ))}
        </div>
      )}
    </section>
  );
}

function ItineraryPreviewCard({ itinerary, onOpen }: { itinerary: Itinerary; onOpen: () => void }) {
  const title = getDisplayText(itinerary.title, "未命名行程");
  const country = getDisplayText(itinerary.country, "未指定國家");
  const city = getDisplayText(itinerary.city, "未指定城市");
  const tripStyle = getDisplayText(itinerary.trip_style, "自由行");
  const budgetAmount = getFiniteNumber(itinerary.budget_amount, DEFAULT_BUDGET_AMOUNT);
  const dayCount = getItineraryDayCount(itinerary);
  const notes = getDisplayText(itinerary.notes, "");

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold group-hover:text-primary">{title}</p>
          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <MapPinned className="h-3.5 w-3.5" />
            {country} / {city}
          </p>
        </div>
        <span className="rounded-full border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground">
          {dayCount} 天
        </span>
      </div>
      <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
        <span className="rounded-full bg-muted px-2.5 py-1">{tripStyle}</span>
        <span className="rounded-full bg-muted px-2.5 py-1">{formatTripBudget(budgetAmount)}</span>
      </div>
      <p className="mt-4 line-clamp-2 text-sm leading-6 text-muted-foreground">
        {notes || getItinerarySummary(itinerary)}
      </p>
    </button>
  );
}

function DashboardAside({
  totals,
  latestQuestions,
  popularCities,
  popularTags,
  onExplore,
  onSelectCity,
  onSelectTag,
}: {
  totals: { trips: number; likes: number; saves: number; countries: number };
  latestQuestions: Question[];
  popularCities: PopularCity[];
  popularTags: Array<{ tag: string; count: number }>;
  onExplore: () => void;
  onSelectCity: (city: string) => void;
  onSelectTag: (tag: string) => void;
}) {
  return (
    <aside className="grid h-fit gap-4 xl:sticky xl:top-24">
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <SectionTitle icon={<Sparkles className="h-4 w-4 text-primary" />} title="平台總覽" />
        <div className="mt-4 grid grid-cols-2 gap-3">
          <SmallStat label="心得" value={totals.trips} />
          <SmallStat label="想去" value={totals.likes} />
          <SmallStat label="收藏" value={totals.saves} />
          <SmallStat label="城市" value={totals.countries} />
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <SectionTitle title="最新分享" action={<button type="button" onClick={onExplore} className="text-xs text-primary hover:underline">看更多</button>} />
        {latestQuestions.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">目前尚無心得。</p>
        ) : (
          <div className="mt-3 grid gap-3">
            {latestQuestions.map((question) => (
              <button key={question.id} type="button" onClick={onExplore} className="text-left">
                <p className="line-clamp-1 text-sm font-medium hover:text-primary">{question.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{question.country} / {formatDate(question.created_at)}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <SectionTitle title="快速篩選" />
        <div className="mt-3 grid gap-2">
          {popularCities.slice(0, 3).map((city) => (
            <button
              key={city.city}
              type="button"
              onClick={() => onSelectCity(city.city)}
              className="flex min-h-10 items-center justify-between rounded-xl border border-border bg-background/70 px-3 text-sm transition hover:border-primary/40 hover:text-primary"
            >
              <span>{city.city}</span>
              <span className="text-xs text-muted-foreground">{city.count} 則</span>
            </button>
          ))}
          {popularTags.slice(0, 3).map((item) => (
            <button
              key={item.tag}
              type="button"
              onClick={() => onSelectTag(item.tag)}
              className="flex min-h-10 items-center justify-between rounded-xl border border-border bg-background/70 px-3 text-sm transition hover:border-primary/40 hover:text-primary"
            >
              <span>#{item.tag}</span>
              <span className="text-xs text-muted-foreground">{item.count} 則</span>
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}

function ExploreHeader({ onCreate }: { onCreate: () => void }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Explore Feed</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">探索旅行心得</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            用城市、預算、季節與標籤快速篩選，找到適合收藏或參考的旅人分享。
          </p>
        </div>
        <Button type="button" onClick={onCreate} className="min-h-11 rounded-full">
          <Plus className="h-4 w-4" />
          新增心得
        </Button>
      </div>
    </section>
  );
}

function FeedContent({
  questions,
  loading,
  loadingMore,
  hasMore,
  error,
  feedScope,
  onLoadMore,
  onCreate,
}: {
  questions: Question[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  feedScope: TripFeedScope;
  onLoadMore: () => void;
  onCreate: () => void;
}) {
  if (loading) return <SkeletonGrid />;
  if (error) return <ErrorState message={error} />;
  if (questions.length === 0) return <EmptyState scope={feedScope} onCreate={onCreate} />;

  return (
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
            onClick={onLoadMore}
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
  );
}

function SmallStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-background/70 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value.toLocaleString("zh-TW")}</p>
    </div>
  );
}

function MiniEmpty({
  title,
  body,
  action,
  onAction,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
  onAction?: () => void;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center shadow-sm">
      <p className="font-semibold">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">{body}</p>
      {action && onAction ? (
        <Button type="button" onClick={onAction} className="mt-4 min-h-10 rounded-full">
          {action}
        </Button>
      ) : null}
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center text-sm text-destructive">
      讀取失敗：{message}
    </div>
  );
}

function getPopularTags(questions: Question[]): Array<{ tag: string; count: number }> {
  const counts = new Map<string, number>();
  questions.forEach((question) => {
    (question.tags ?? []).forEach((tag) => {
      if (!TRIP_TAGS.includes(tag as (typeof TRIP_TAGS)[number])) return;
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    });
  });
  return Array.from(counts, ([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, "zh-Hant"))
    .slice(0, 7);
}

function getItinerarySummary(itinerary: Itinerary): string {
  const days = normalizeItineraryDays(itinerary.days);
  const firstDay = days[0];
  if (!firstDay) return "查看完整行程安排與交通方式。";
  const slots = ITINERARY_SLOT_KEYS.map((key) => getSlotValue(firstDay, key).text.trim()).filter(Boolean);
  return slots.slice(0, 2).join(" / ") || "查看完整行程安排與交通方式。";
}

function getItineraryDayCount(itinerary: Itinerary): number {
  const explicitDays = getFiniteNumber(itinerary.trip_days, 0);
  if (explicitDays > 0) return explicitDays;
  return normalizeItineraryDays(itinerary.days).length || 1;
}

function getDisplayText(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function getFiniteNumber(value: unknown, fallback: number): number {
  const numericValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
}

function formatDate(value?: string | null): string {
  if (!value) return "尚未更新";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "尚未更新";
  return new Intl.DateTimeFormat("zh-TW", { month: "2-digit", day: "2-digit" }).format(date);
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
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 text-base font-semibold sm:text-lg">
        {icon}
        {title}
      </h2>
      {action ? (
        typeof action === "string" ? (
          <span className="text-xs font-medium text-muted-foreground">{action}</span>
        ) : (
          action
        )
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

function SkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid max-w-full gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-hidden>
      {Array.from({ length: count }).map((_, index) => (
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
