"use client";

import {
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Clock3,
  MapPin,
  Moon,
  NotebookText,
  Plus,
  Sun,
  Sunrise,
  Train,
  Trash2,
  UserRound,
} from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";

import { BudgetSlider } from "@/components/budget-slider";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getAnonId } from "@/lib/anon-id";
import {
  DEFAULT_BUDGET_AMOUNT,
  formatTripBudget,
} from "@/lib/trip-budget";
import { TRIP_TAGS, normalizeTags } from "@/lib/trip-tags";
import { supabase } from "@/lib/supabase";
import { getAuthDisplayName, useAuth } from "@/lib/use-auth";
import { useItineraries, type ItineraryScope } from "@/lib/use-itineraries";
import { cn } from "@/lib/utils";
import type { Itinerary, ItineraryDay } from "@/types/database";

const styles = ["自由行", "情侶旅行", "獨旅", "親子旅行", "畢業旅行"];
type SlotKey = keyof Omit<ItineraryDay, "day">;

const itinerarySlots: Array<{
  key: SlotKey;
  label: string;
  time: string;
  empty: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
}> = [
  {
    key: "morning",
    label: "上午",
    time: "09:00 - 12:00",
    empty: "上午未安排",
    icon: Sunrise,
    tone: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
  {
    key: "afternoon",
    label: "下午",
    time: "13:00 - 17:00",
    empty: "下午未安排",
    icon: Sun,
    tone: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  },
  {
    key: "evening",
    label: "晚上",
    time: "18:00 後",
    empty: "晚上未安排",
    icon: Moon,
    tone: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
  },
  {
    key: "transport",
    label: "交通",
    time: "移動方式",
    empty: "交通未填寫",
    icon: Train,
    tone: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
];

function blankDays(count: number): ItineraryDay[] {
  return Array.from({ length: count }, (_, index) => ({
    day: index + 1,
    morning: "",
    afternoon: "",
    evening: "",
    transport: "",
  }));
}

export function ItinerarySpace() {
  const [scope, setScope] = useState<ItineraryScope>("public");
  const [country, setCountry] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const { itineraries, loading, error, deleteItinerary } = useItineraries(
    country,
    scope
  );

  return (
    <section className="grid gap-4" aria-label="公開行程表">
      <div className="rounded-2xl border border-border/70 bg-card/88 p-4 shadow-sm backdrop-blur-md">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="inline-grid grid-cols-2 rounded-full border border-border bg-background/70 p-1 shadow-sm">
            <ScopeButton active={scope === "public"} onClick={() => setScope("public")}>
              公開行程
            </ScopeButton>
            <ScopeButton active={scope === "mine"} onClick={() => setScope("mine")}>
              我的行程
            </ScopeButton>
          </div>
          <Button
            type="button"
            onClick={() => setCreateOpen((current) => !current)}
            className="min-h-11 rounded-full"
          >
            <Plus className="h-4 w-4" />
            建立行程表
          </Button>
        </div>
        <label className="mt-4 block">
          <span className="text-xs font-medium text-muted-foreground">
            搜尋國家 / 城市
          </span>
          <input
            value={country}
            onChange={(event) => setCountry(event.target.value)}
            placeholder="日本、韓國、東京、首爾..."
            className="field-input mt-1"
          />
        </label>
      </div>

      {createOpen ? <ItineraryForm onDone={() => setCreateOpen(false)} /> : null}

      {loading ? (
        <p className="rounded-2xl border border-border/70 bg-card/75 p-6 text-sm text-muted-foreground">
          讀取行程表中...
        </p>
      ) : error ? (
        <p className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
          讀取失敗：{error}
        </p>
      ) : itineraries.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-card/70 py-14 text-center shadow-sm backdrop-blur-md">
          <p className="text-2xl font-semibold text-muted-foreground">
            還沒有公開行程表
          </p>
          <p className="mt-2 text-sm text-muted-foreground/80">
            建立一份行程，讓其他旅人可以參考你的國家路線安排。
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {itineraries.map((itinerary) => (
            <ItineraryCard
              key={itinerary.id}
              itinerary={itinerary}
              onDelete={deleteItinerary}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function ScopeButton({
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
        "inline-flex min-h-10 items-center justify-center rounded-full px-4 text-sm font-medium transition",
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

function ItineraryForm({ onDone }: { onDone: () => void }) {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [authorName, setAuthorName] = useState(() => getAuthDisplayName(user));
  const [tripDays, setTripDays] = useState(3);
  const [budgetAmount, setBudgetAmount] = useState(DEFAULT_BUDGET_AMOUNT);
  const [tripStyle, setTripStyle] = useState("自由行");
  const [tags, setTags] = useState<string[]>([]);
  const [days, setDays] = useState<ItineraryDay[]>(() => blankDays(3));
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateDays(nextCount: number) {
    const count = Math.min(Math.max(nextCount, 1), 14);
    setTripDays(count);
    setDays((current) =>
      Array.from({ length: count }, (_, index) => {
        return (
          current[index] ?? {
            day: index + 1,
            morning: "",
            afternoon: "",
            evening: "",
            transport: "",
          }
        );
      }).map((day, index) => ({ ...day, day: index + 1 }))
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim() || !country.trim() || !city.trim()) {
      setError("請填寫標題、國家與城市。");
      return;
    }

    setSubmitting(true);
    setError(null);

    const {
      data: { session },
    } = await supabase.auth.getSession();
    const currentUser = session?.user ?? user;

    const { error: insertError } = await supabase.from("itineraries").insert({
      title: title.trim(),
      country: country.trim(),
      city: city.trim(),
      author_name:
        authorName.trim() && authorName !== "旅人"
          ? authorName.trim()
          : getAuthDisplayName(user),
      trip_days: tripDays,
      budget_amount: budgetAmount,
      trip_style: tripStyle,
      tags: normalizeTags(tags),
      days,
      notes: notes.trim(),
      author_anon_id: getAnonId(),
      user_id: currentUser?.id ?? null,
      is_public: true,
    });

    setSubmitting(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    onDone();
  }

  return (
    <motion.form
      onSubmit={handleSubmit}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-border/70 bg-card/92 p-4 shadow-xl shadow-black/6 backdrop-blur-md sm:p-5"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="行程標題">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={90}
            placeholder="東京 5 天 4 夜城市散步"
            className="field-input"
          />
        </Field>
        <Field label="暱稱">
          <input
            value={authorName}
            onChange={(event) => setAuthorName(event.target.value)}
            maxLength={30}
            className="field-input"
          />
        </Field>
        <Field label="國家">
          <input
            value={country}
            onChange={(event) => setCountry(event.target.value)}
            maxLength={80}
            placeholder="日本"
            className="field-input"
          />
        </Field>
        <Field label="城市">
          <input
            value={city}
            onChange={(event) => setCity(event.target.value)}
            maxLength={80}
            placeholder="東京"
            className="field-input"
          />
        </Field>
        <Field label="天數">
          <input
            type="number"
            min={1}
            max={14}
            value={tripDays}
            onChange={(event) => updateDays(Number(event.target.value))}
            className="field-input"
          />
        </Field>
        <Field label="旅行類型">
          <select
            value={tripStyle}
            onChange={(event) => setTripStyle(event.target.value)}
            className="field-input"
          >
            {styles.map((style) => (
              <option key={style}>{style}</option>
            ))}
          </select>
        </Field>
      </div>

      <BudgetSlider
        value={budgetAmount}
        onChange={setBudgetAmount}
        className="mt-3"
      />
      <TagPicker value={tags} onChange={setTags} />

      <div className="mt-4 grid gap-3">
        {days.map((day, index) => (
          <div
            key={day.day}
            className="rounded-xl border border-border bg-background/55 p-3"
          >
            <p className="text-sm font-semibold">Day {day.day}</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {(["morning", "afternoon", "evening", "transport"] as const).map(
                (slot) => (
                  <input
                    key={slot}
                    value={day[slot]}
                    onChange={(event) =>
                      setDays((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, [slot]: event.target.value }
                            : item
                        )
                      )
                    }
                    placeholder={slotLabel(slot)}
                    className="field-input"
                  />
                )
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3">
        <label className="text-xs font-medium text-muted-foreground">
          備註
        </label>
        <Textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          maxLength={1200}
          rows={4}
          placeholder="補充票券、交通卡、排隊時間或雨天備案。"
          className="mt-1 resize-none border-border bg-background/70 text-sm leading-relaxed"
        />
      </div>

      {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
      <div className="mt-5 flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone}>
          取消
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "建立中" : "公開行程"}
        </Button>
      </div>
    </motion.form>
  );
}

function ItineraryCard({
  itinerary,
  onDelete,
}: {
  itinerary: Itinerary;
  onDelete: (id: string) => Promise<{ error: string | null }>;
}) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const isMine =
    itinerary.author_anon_id === getAnonId() ||
    Boolean(user?.id && itinerary.user_id === user.id);

  async function handleDelete() {
    if (!window.confirm("確定要刪除這份行程表嗎？")) return;
    await onDelete(itinerary.id);
  }

  const filledSlotCount = (itinerary.days ?? []).reduce(
    (total, day) =>
      total +
      itinerarySlots.filter((slot) => Boolean(day[slot.key]?.trim())).length,
    0
  );

  return (
    <article className="overflow-hidden rounded-2xl border border-border/70 bg-card/92 shadow-xl shadow-black/6 backdrop-blur-md">
      <div className="border-b border-border/70 bg-gradient-to-r from-primary/10 via-card to-accent/10 p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4 text-primary" />
            {itinerary.country} / {itinerary.city}
          </p>
          <h3 className="mt-1 text-2xl font-semibold tracking-tight">
            {itinerary.title}
          </h3>
          <div className="mt-3 flex flex-wrap gap-2">
            <Tag>
              <CalendarDays className="h-3.5 w-3.5" />
              {itinerary.trip_days} 天
            </Tag>
            <Tag>
              <UserRound className="h-3.5 w-3.5" />
              {itinerary.author_name || "旅人"}
            </Tag>
            <Tag>{itinerary.trip_style}</Tag>
            <Tag>{formatTripBudget(itinerary.budget_amount)}</Tag>
            {(itinerary.tags ?? []).map((tag) => (
              <Tag key={tag}>{tag}</Tag>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
            className="min-h-10 rounded-full"
          >
            {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            {open ? "收合" : "查看行程"}
          </Button>
          {isMine ? (
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              className="min-h-10 rounded-full"
            >
              <Trash2 className="h-4 w-4" />
              刪除
            </Button>
          ) : null}
        </div>
      </div>
      <ItineraryPreview itinerary={itinerary} filledSlotCount={filledSlotCount} />
      </div>
      {open ? (
        <div className="grid gap-0 px-4 py-2 sm:px-5">
          {(itinerary.days ?? []).map((day) => (
            <ItineraryDayTimeline key={day.day} day={day} />
          ))}
          {itinerary.notes ? (
            <div className="mb-3 mt-2 rounded-xl bg-muted/45 p-4 text-sm leading-7">
              <p className="mb-2 flex items-center gap-2 font-medium text-foreground">
                <NotebookText className="h-4 w-4 text-primary" />
                行程備註
              </p>
              <p className="whitespace-pre-wrap text-foreground/82">{itinerary.notes}</p>
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function ItineraryPreview({
  itinerary,
  filledSlotCount,
}: {
  itinerary: Itinerary;
  filledSlotCount: number;
}) {
  const firstDay = itinerary.days?.[0];
  const highlights = [
    firstDay?.morning,
    firstDay?.afternoon,
    firstDay?.evening,
  ].filter(Boolean);

  return (
    <div className="mt-4 grid gap-3 border-t border-border/60 pt-4 sm:grid-cols-[1fr_auto] sm:items-center">
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-xs font-medium uppercase text-muted-foreground">
          <Clock3 className="h-3.5 w-3.5" />
          行程摘要
        </p>
        <p className="mt-1 truncate text-sm text-foreground/82">
          {highlights.length > 0
            ? highlights.join(" → ")
            : "展開後可以查看每天上午、下午、晚上與交通安排。"}
        </p>
      </div>
      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
        <span className="rounded-full bg-background/70 px-3 py-1">
          {filledSlotCount} 個安排
        </span>
        <span className="rounded-full bg-background/70 px-3 py-1">
          更新 {formatDate(itinerary.updated_at)}
        </span>
      </div>
    </div>
  );
}

function ItineraryDayTimeline({ day }: { day: ItineraryDay }) {
  return (
    <section className="relative border-l border-border/80 py-5 pl-5 sm:pl-6">
      <div className="absolute -left-3 top-5 grid h-6 w-6 place-items-center rounded-full border border-primary/40 bg-card text-xs font-semibold text-primary shadow-sm">
        {day.day}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-base font-semibold">Day {day.day}</h4>
        <span className="text-xs text-muted-foreground">
          {countFilledDaySlots(day)} / 4 已安排
        </span>
      </div>
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        {itinerarySlots.map((slot) => (
          <ItinerarySlot key={slot.key} day={day} slot={slot} />
        ))}
      </div>
    </section>
  );
}

function ItinerarySlot({
  day,
  slot,
}: {
  day: ItineraryDay;
  slot: (typeof itinerarySlots)[number];
}) {
  const Icon = slot.icon;
  const content = day[slot.key]?.trim();
  return (
    <div className="grid grid-cols-[2.25rem_1fr] gap-3 rounded-lg bg-background/55 p-3">
      <span
        className={cn(
          "grid h-9 w-9 place-items-center rounded-full",
          slot.tone
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="text-sm font-medium">{slot.label}</p>
          <p className="text-xs text-muted-foreground">{slot.time}</p>
        </div>
        <p
          className={cn(
            "mt-1 whitespace-pre-wrap text-sm leading-6",
            content ? "text-foreground/86" : "text-muted-foreground"
          )}
        >
          {content || slot.empty}
        </p>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function TagPicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (tags: string[]) => void;
}) {
  return (
    <div className="mt-3">
      <p className="text-xs font-medium text-muted-foreground">行程標籤</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {TRIP_TAGS.map((tag) => {
          const active = value.includes(tag);
          return (
            <button
              key={tag}
              type="button"
              aria-pressed={active}
              onClick={() =>
                onChange(
                  active ? value.filter((item) => item !== tag) : [...value, tag]
                )
              }
              className={cn(
                "inline-flex min-h-8 items-center rounded-full border px-3 text-xs transition",
                active
                  ? "border-primary/60 bg-primary/10 text-primary"
                  : "border-border bg-background/70 text-muted-foreground hover:border-primary/50 hover:text-primary"
              )}
            >
              {tag}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex min-h-7 items-center gap-1.5 rounded-full border border-border bg-muted/60 px-2.5 text-xs text-muted-foreground">
      {children}
    </span>
  );
}

function countFilledDaySlots(day: ItineraryDay) {
  return itinerarySlots.filter((slot) => Boolean(day[slot.key]?.trim())).length;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function slotLabel(slot: SlotKey) {
  if (slot === "morning") return "上午安排";
  if (slot === "afternoon") return "下午安排";
  if (slot === "evening") return "晚上安排";
  return "交通方式";
}
