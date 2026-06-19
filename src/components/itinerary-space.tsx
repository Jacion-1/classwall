"use client";

import {
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Clock3,
  Copy,
  MapPin,
  Moon,
  NotebookText,
  Pencil,
  Plus,
  Sun,
  Sunrise,
  Train,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useState } from "react";

import { BudgetSlider } from "@/components/budget-slider";
import { ReportButton } from "@/components/report-button";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getAnonId } from "@/lib/anon-id";
import {
  createBlankItineraryDays,
  getSlotValue,
  getTransportLabel,
  ITINERARY_SLOT_KEYS,
  normalizeItineraryDays,
  transportOptions,
  updateItinerarySlot,
  type ItinerarySlotKey,
} from "@/lib/itinerary-days";
import { DEFAULT_BUDGET_AMOUNT, formatTripBudget } from "@/lib/trip-budget";
import { TRIP_TAGS, normalizeTags } from "@/lib/trip-tags";
import { supabase } from "@/lib/supabase";
import { getAuthDisplayName, useAuth } from "@/lib/use-auth";
import {
  useItineraries,
  type ItineraryPayload,
  type ItineraryScope,
} from "@/lib/use-itineraries";
import { cn } from "@/lib/utils";
import type { Itinerary, ItineraryDay } from "@/types/database";

const styles = ["自由行", "情侶旅行", "獨旅", "親子旅行", "畢業旅行"];

const itinerarySlots: Array<{
  key: ItinerarySlotKey;
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
];

export function ItinerarySpace({
  startCreateToken = 0,
}: {
  startCreateToken?: number;
}) {
  const [scope, setScope] = useState<ItineraryScope>("public");
  const [country, setCountry] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const {
    itineraries,
    loading,
    error,
    deleteItinerary,
    updateItinerary,
    copyItinerary,
  } = useItineraries(country, scope);

  useEffect(() => {
    if (startCreateToken > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCreateOpen(true);
    }
  }, [startCreateToken]);

  async function createItinerary(payload: ItineraryPayload) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const currentUser = session?.user ?? null;

    const { error: insertError } = await supabase.from("itineraries").insert({
      ...payload,
      tags: normalizeTags(payload.tags),
      days: normalizeItineraryDays(payload.days),
      author_anon_id: getAnonId(),
      user_id: currentUser?.id ?? null,
      is_public: true,
    });

    return { error: insertError?.message ?? null };
  }

  return (
    <section className="grid gap-4" aria-label="旅行行程表">
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="inline-grid grid-cols-2 rounded-full border border-border bg-background/70 p-1 shadow-sm">
            <ScopeButton
              active={scope === "public"}
              onClick={() => setScope("public")}
            >
              公開行程表
            </ScopeButton>
            <ScopeButton
              active={scope === "mine"}
              onClick={() => setScope("mine")}
            >
              我的行程表
            </ScopeButton>
          </div>
          <Button
            type="button"
            onClick={() => setCreateOpen((current) => !current)}
            className="min-h-11 rounded-full"
          >
            {createOpen ? (
              <X className="h-4 w-4" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            {createOpen ? "收合新增" : "新增行程表"}
          </Button>
        </div>
        <label className="mt-4 block">
          <span className="text-xs font-medium text-muted-foreground">
            搜尋國家 / 城市
          </span>
          <input
            value={country}
            onChange={(event) => setCountry(event.target.value)}
            placeholder="例如：日本、韓國、台北..."
            className="field-input mt-1"
          />
        </label>
      </div>

      {createOpen ? (
        <ItineraryForm
          onDone={() => setCreateOpen(false)}
          onSubmit={createItinerary}
          submitLabel="發布行程表"
        />
      ) : null}

      {loading ? (
        <p className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground shadow-sm">
          讀取行程表中...
        </p>
      ) : error ? (
        <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive shadow-sm">
          讀取失敗：{error}
        </p>
      ) : itineraries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card py-14 text-center shadow-sm">
          <p className="text-2xl font-semibold text-muted-foreground">
            目前還沒有行程表
          </p>
          <p className="mt-2 text-sm text-muted-foreground/80">
            新增一份可公開參考的旅行安排，讓其他人能快速理解路線與交通。
          </p>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {itineraries.map((itinerary) => (
            <ItineraryCard
              key={itinerary.id}
              itinerary={itinerary}
              onDelete={deleteItinerary}
              onUpdate={updateItinerary}
              onCopy={copyItinerary}
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

function ItineraryForm({
  initialItinerary,
  onDone,
  onSubmit,
  submitLabel,
}: {
  initialItinerary?: Itinerary;
  onDone: () => void;
  onSubmit: (payload: ItineraryPayload) => Promise<{ error: string | null }>;
  submitLabel: string;
}) {
  const { user, profile } = useAuth();
  const normalizedDays = initialItinerary
    ? normalizeItineraryDays(initialItinerary.days ?? [])
    : createBlankItineraryDays(3);
  const [title, setTitle] = useState(initialItinerary?.title ?? "");
  const [country, setCountry] = useState(initialItinerary?.country ?? "");
  const [city, setCity] = useState(initialItinerary?.city ?? "");
  const [authorName, setAuthorName] = useState(
    initialItinerary?.author_name ||
      profile?.display_name ||
      getAuthDisplayName(user)
  );
  const [tripDays, setTripDays] = useState(initialItinerary?.trip_days ?? 3);
  const [budgetAmount, setBudgetAmount] = useState(
    initialItinerary?.budget_amount ?? DEFAULT_BUDGET_AMOUNT
  );
  const [tripStyle, setTripStyle] = useState(
    initialItinerary?.trip_style ?? "自由行"
  );
  const [tags, setTags] = useState<string[]>(initialItinerary?.tags ?? []);
  const [days, setDays] = useState<ItineraryDay[]>(normalizedDays);
  const [notes, setNotes] = useState(initialItinerary?.notes ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateDays(nextCount: number) {
    const count = Math.min(Math.max(nextCount, 1), 14);
    setTripDays(count);
    setDays((current) =>
      Array.from({ length: count }, (_, index) => {
        return current[index] ?? createBlankItineraryDays(1)[0];
      }).map((day, index) => ({ ...day, day: index + 1 }))
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim() || !country.trim() || !city.trim()) {
      setError("請填寫行程標題、國家與城市。");
      return;
    }

    setSubmitting(true);
    setError(null);

    const result = await onSubmit({
      title: title.trim(),
      country: country.trim(),
      city: city.trim(),
      author_name:
        authorName.trim() && authorName !== "匿名旅人"
          ? authorName.trim()
          : profile?.display_name || getAuthDisplayName(user),
      trip_days: tripDays,
      budget_amount: budgetAmount,
      trip_style: tripStyle,
      tags: normalizeTags(tags),
      days: normalizeItineraryDays(days),
      notes: notes.trim(),
    });

    setSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    onDone();
  }

  return (
    <motion.form
      onSubmit={handleSubmit}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5"
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
        <Field label="作者暱稱">
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
        <Field label="旅行風格">
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
            <div className="mt-3 grid gap-3">
              {ITINERARY_SLOT_KEYS.map((slot) => {
                const value = getSlotValue(day, slot);
                return (
                  <div
                    key={slot}
                    className="grid gap-2 rounded-lg border border-border/70 bg-card/50 p-3 lg:grid-cols-[1fr_11rem]"
                  >
                    <label className="block">
                      <span className="text-xs font-medium text-muted-foreground">
                        {slotLabel(slot)}
                      </span>
                      <input
                        value={value.text}
                        onChange={(event) =>
                          setDays((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index
                                ? updateItinerarySlot(item, slot, {
                                    text: event.target.value,
                                  })
                                : item
                            )
                          )
                        }
                        placeholder={`${slotLabel(slot)}安排`}
                        className="field-input mt-1"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-medium text-muted-foreground">
                        交通方式
                      </span>
                      <select
                        value={value.transport}
                        onChange={(event) =>
                          setDays((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index
                                ? updateItinerarySlot(item, slot, {
                                    transport: event.target.value,
                                  })
                                : item
                            )
                          )
                        }
                        className="field-input mt-1"
                      >
                        {transportOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                );
              })}
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
          placeholder="補充預約方式、住宿建議、交通提醒或行前注意事項。"
          className="mt-1 resize-none border-border bg-background/70 text-sm leading-relaxed"
        />
      </div>

      {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
      <div className="mt-5 flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone}>
          取消
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "儲存中" : submitLabel}
        </Button>
      </div>
    </motion.form>
  );
}

function ItineraryCard({
  itinerary,
  onDelete,
  onUpdate,
  onCopy,
}: {
  itinerary: Itinerary;
  onDelete: (id: string) => Promise<{ error: string | null }>;
  onUpdate: (
    id: string,
    payload: ItineraryPayload
  ) => Promise<{ error: string | null }>;
  onCopy: (
    itinerary: Itinerary
  ) => Promise<{ error: string | null; itinerary?: Itinerary }>;
}) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [copiedItinerary, setCopiedItinerary] = useState<Itinerary | null>(
    null
  );
  const [copying, setCopying] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const isMine =
    itinerary.author_anon_id === getAnonId() ||
    Boolean(user?.id && itinerary.user_id === user.id);

  async function handleDelete() {
    if (!window.confirm("確定要刪除這份行程表嗎？")) return;
    const result = await onDelete(itinerary.id);
    if (result.error) setActionError(result.error);
  }

  async function handleCopy() {
    setCopying(true);
    setActionError(null);
    const result = await onCopy(itinerary);
    setCopying(false);
    if (result.error) {
      setActionError(result.error);
      return;
    }
    if (result.itinerary) {
      setCopiedItinerary({
        ...result.itinerary,
        days: normalizeItineraryDays(result.itinerary.days ?? []),
      });
    }
    setOpen(false);
  }

  const normalizedDays = normalizeItineraryDays(itinerary.days ?? []);
  const filledSlotCount = normalizedDays.reduce(
    (total, day) => total + countFilledDaySlots(day),
    0
  );

  if (editing || copiedItinerary) {
    const editableItinerary = copiedItinerary ?? itinerary;
    return (
      <article className="rounded-xl border border-border bg-card p-3 shadow-sm">
        <ItineraryForm
          initialItinerary={{
            ...editableItinerary,
            days: normalizeItineraryDays(editableItinerary.days ?? []),
          }}
          onDone={() => {
            setEditing(false);
            setCopiedItinerary(null);
          }}
          onSubmit={(payload) => onUpdate(editableItinerary.id, payload)}
          submitLabel={copiedItinerary ? "儲存複製行程" : "儲存修改"}
        />
      </article>
    );
  }

  return (
    <article className="overflow-hidden rounded-xl border border-border bg-card shadow-sm transition hover:border-primary/35 hover:shadow-md">
      <div className="border-b border-border bg-card p-4 sm:p-5">
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
                {itinerary.author_name || "匿名旅人"}
              </Tag>
              <Tag>{itinerary.trip_style}</Tag>
              <Tag>{formatTripBudget(itinerary.budget_amount)}</Tag>
              {(itinerary.tags ?? []).map((tag) => (
                <Tag key={tag}>{tag}</Tag>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              aria-expanded={open}
              onClick={() => setOpen(!open)}
              className="min-h-10 rounded-full"
            >
              {open ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
              {open ? "收合" : "閱讀行程"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleCopy}
              disabled={copying}
              className="min-h-10 rounded-full"
            >
              <Copy className="h-4 w-4" />
              {copying ? "複製中" : "複製"}
            </Button>
            {isMine ? (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setEditing(true)}
                  className="min-h-10 rounded-full"
                >
                  <Pencil className="h-4 w-4" />
                  編輯
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDelete}
                  className="min-h-10 rounded-full"
                >
                  <Trash2 className="h-4 w-4" />
                  刪除
                </Button>
              </>
            ) : (
              <ReportButton
                targetType="itinerary"
                targetId={itinerary.id}
                compact
              />
            )}
          </div>
        </div>
        {actionError ? (
          <p className="mt-3 text-sm text-destructive">{actionError}</p>
        ) : null}
        <ItineraryPreview
          itinerary={{ ...itinerary, days: normalizedDays }}
          filledSlotCount={filledSlotCount}
        />
      </div>
      {open ? (
        <div className="grid gap-0 px-4 py-2 sm:px-5">
          {normalizedDays.map((day) => (
            <ItineraryDayTimeline key={day.day} day={day} />
          ))}
          {itinerary.notes ? (
            <div className="mb-3 mt-2 rounded-xl bg-muted/45 p-4 text-sm leading-7">
              <p className="mb-2 flex items-center gap-2 font-medium text-foreground">
                <NotebookText className="h-4 w-4 text-primary" />
                行程備註
              </p>
              <p className="whitespace-pre-wrap text-foreground/82">
                {itinerary.notes}
              </p>
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
  const highlights = firstDay
    ? ITINERARY_SLOT_KEYS.map((key) => getSlotValue(firstDay, key).text).filter(
        Boolean
      )
    : [];

  return (
    <div className="mt-4 grid gap-3 border-t border-border/60 pt-4 sm:grid-cols-[1fr_auto] sm:items-center">
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-xs font-medium uppercase text-muted-foreground">
          <Clock3 className="h-3.5 w-3.5" />
          Day 1 摘要
        </p>
        <p className="mt-1 truncate text-sm text-foreground/82">
          {highlights.length > 0
            ? highlights.join(" -> ")
            : "展開後可查看上午、下午、晚上與各時段交通安排。"}
        </p>
      </div>
      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
        <span className="rounded-full bg-background/70 px-3 py-1">
          {filledSlotCount} 個時段
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
          {countFilledDaySlots(day)} / 3 已安排
        </span>
      </div>
      <div className="mt-3 grid gap-3 lg:grid-cols-3">
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
  const value = getSlotValue(day, slot.key);
  const content = value.text.trim();
  return (
    <div className="grid min-h-40 grid-rows-[auto_1fr_auto] gap-3 rounded-lg border border-border/60 bg-background/55 p-3">
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "grid h-9 w-9 shrink-0 place-items-center rounded-full",
            slot.tone
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium">{slot.label}</p>
          <p className="text-xs text-muted-foreground">{slot.time}</p>
        </div>
      </div>
      <p
        className={cn(
          "whitespace-pre-wrap text-sm leading-6",
          content ? "text-foreground/86" : "text-muted-foreground"
        )}
      >
        {content || slot.empty}
      </p>
      <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-muted/70 px-2.5 py-1 text-xs text-muted-foreground">
        <Train className="h-3.5 w-3.5" />
        {getTransportLabel(value.transport)}
      </span>
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
                  active
                    ? value.filter((item) => item !== tag)
                    : [...value, tag]
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
  return ITINERARY_SLOT_KEYS.filter((key) =>
    Boolean(getSlotValue(day, key).text.trim())
  ).length;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function slotLabel(slot: ItinerarySlotKey) {
  if (slot === "morning") return "上午";
  if (slot === "afternoon") return "下午";
  return "晚上";
}
