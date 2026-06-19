"use client";

import {
  Bookmark,
  CalendarDays,
  ChevronDown,
  Compass,
  Home,
  Map,
  Menu,
  PenLine,
  PlusCircle,
  Search,
  UserRound,
  X,
} from "lucide-react";
import { useState } from "react";

import { AuthPanel } from "@/components/auth-panel";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

export type DashboardView = "home" | "explore" | "itinerary" | "saved" | "mine" | "profile";

type NavAction = DashboardView | "create-post" | "create-itinerary";

type NavItem = {
  action: NavAction;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  divider?: boolean;
};

const navItems: NavItem[] = [
  { action: "home", label: "首頁", icon: Home },
  { action: "explore", label: "探索心得", icon: Compass },
  { action: "itinerary", label: "行程表", icon: CalendarDays },
  { action: "saved", label: "我的收藏", icon: Bookmark },
  { action: "mine", label: "我的心得", icon: PenLine },
  { action: "profile", label: "個人資料", icon: UserRound },
  { action: "create-post", label: "建立新心得", icon: PlusCircle, divider: true },
  { action: "create-itinerary", label: "建立新行程", icon: Map },
];

const mobileItems: NavItem[] = [
  { action: "home", label: "首頁", icon: Home },
  { action: "explore", label: "探索", icon: Compass },
  { action: "itinerary", label: "行程", icon: CalendarDays },
  { action: "saved", label: "收藏", icon: Bookmark },
  { action: "profile", label: "個人", icon: UserRound },
];

export function DashboardShell({
  activeView,
  searchValue,
  onSearchChange,
  onNavigate,
  children,
}: {
  activeView: DashboardView;
  searchValue: string;
  onSearchChange: (value: string) => void;
  onNavigate: (action: NavAction) => void;
  children: React.ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  function navigate(action: NavAction) {
    onNavigate(action);
    setDrawerOpen(false);
  }

  return (
    <div className="min-h-dvh overflow-x-hidden bg-background text-foreground">
      <TopNav
        searchValue={searchValue}
        onSearchChange={onSearchChange}
        onMenu={() => setDrawerOpen(true)}
      />

      <div className="mx-auto grid w-full max-w-[1680px] lg:grid-cols-[240px_1fr]">
        <aside className="sticky top-[73px] hidden h-[calc(100dvh-73px)] border-r border-border/70 bg-card/78 px-4 py-5 backdrop-blur-xl lg:block">
          <SidebarNav
            activeView={activeView}
            onNavigate={navigate}
            className="h-full"
          />
        </aside>

        <main className="min-w-0 max-w-full overflow-x-hidden px-4 pb-24 pt-4 sm:px-6 lg:px-8 lg:pb-10">
          {children}
        </main>
      </div>

      <MobileNav activeView={activeView} onNavigate={navigate} />

      {drawerOpen ? (
        <div className="fixed inset-0 z-[80] lg:hidden">
          <button
            type="button"
            aria-label="關閉選單"
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 bg-black/50"
          />
          <div className="relative h-full w-[82vw] max-w-80 border-r border-border bg-card p-4 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <Brand />
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="關閉選單"
                className="grid h-10 w-10 place-items-center rounded-full border border-border bg-background/70"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <SidebarNav activeView={activeView} onNavigate={navigate} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function TopNav({
  searchValue,
  onSearchChange,
  onMenu,
}: {
  searchValue: string;
  onSearchChange: (value: string) => void;
  onMenu: () => void;
}) {
  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-card/88 backdrop-blur-xl">
      <div className="mx-auto flex h-[72px] max-w-[1680px] items-center gap-3 px-3 sm:px-5 lg:px-8">
        <button
          type="button"
          onClick={onMenu}
          aria-label="開啟選單"
          className="grid h-11 w-11 place-items-center rounded-full border border-border bg-background/70 lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="hidden w-[220px] shrink-0 lg:block">
          <Brand />
        </div>
        <div className="min-w-0 flex-1">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={searchValue}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="搜尋城市、景點、旅遊心得..."
              className="h-12 w-full rounded-full border border-border bg-background/80 pl-12 pr-4 text-sm shadow-sm outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-ring/20"
            />
          </label>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <ThemeToggle />

          <AuthPanel variant="header" />
          <ChevronDown className="hidden h-4 w-4 text-muted-foreground sm:block" />
        </div>
      </div>
    </header>
  );
}

function Brand() {
  return (
    <div className="leading-none">
      <p className="text-2xl font-bold tracking-tight text-primary">TripWall</p>
      <p className="mt-1 text-xs font-medium text-muted-foreground">
        旅行靈感牆
      </p>
    </div>
  );
}

function SidebarNav({
  activeView,
  onNavigate,
  className,
}: {
  activeView: DashboardView;
  onNavigate: (action: NavAction) => void;
  className?: string;
}) {
  return (
    <nav className={cn("flex flex-col gap-2", className)}>
      {navItems.map((item) => (
        <NavButton
          key={item.action}
          item={item}
          active={item.action === activeView}
          onClick={() => onNavigate(item.action)}
        />
      ))}

      <div className="mt-auto rounded-xl border border-border bg-background/60 p-4">
        <p className="text-sm font-semibold">分享你的旅行靈感</p>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          寫下心得，幫助更多旅人發現世界的美好。
        </p>
        <button
          type="button"
          onClick={() => onNavigate("create-post")}
          className="mt-4 inline-flex min-h-10 w-full items-center justify-center rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          開始分享
        </button>
      </div>
    </nav>
  );
}

function NavButton({
  item,
  active,
  onClick,
}: {
  item: NavItem;
  active: boolean;
  onClick: () => void;
}) {
  const Icon = item.icon;
  return (
    <>
      {item.divider ? <div className="my-2 border-t border-border" /> : null}
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "relative flex min-h-12 items-center gap-3 rounded-lg px-4 text-sm transition",
          active
            ? "bg-primary/12 font-semibold text-primary"
            : "text-foreground/82 hover:bg-muted"
        )}
      >
        {active ? (
          <span className="absolute left-0 top-2 h-8 w-1 rounded-r-full bg-primary" />
        ) : null}
        <Icon className={cn("h-5 w-5", active && "text-primary")} />
        {item.label}
      </button>
    </>
  );
}

function MobileNav({
  activeView,
  onNavigate,
}: {
  activeView: DashboardView;
  onNavigate: (action: NavAction) => void;
}) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card/95 px-2 py-2 backdrop-blur-xl lg:hidden">
      <div className="grid grid-cols-5 gap-1">
        {mobileItems.map((item) => {
          const Icon = item.icon;
          const active = item.action === activeView;
          return (
            <button
              key={item.action}
              type="button"
              onClick={() => onNavigate(item.action)}
              className={cn(
                "grid min-h-12 place-items-center rounded-lg text-[11px] font-medium transition",
                active
                  ? "bg-primary/12 text-primary"
                  : "text-muted-foreground hover:bg-muted"
              )}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
