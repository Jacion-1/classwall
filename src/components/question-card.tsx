"use client";

import {
  Bookmark,
  CalendarDays,
  Heart,
  MapPin,
  MessageCircle,
  Pencil,
  Plane,
  Save,
  WalletCards,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { memo, useEffect, useMemo, useState } from "react";

import { AnswerSection } from "@/components/answer-section";
import { Textarea } from "@/components/ui/textarea";
import { getAnonId } from "@/lib/anon-id";
import {
  addLiked,
  addSaved,
  hasLiked,
  hasSaved,
  removeLiked,
  removeSaved,
} from "@/lib/liked-store";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import type {
  BudgetLevel,
  Question,
  TripCategory,
  TripSeason,
} from "@/types/database";

type Props = {
  question: Question;
};

type EditDraft = {
  title: string;
  location: string;
  country: string;
  category: TripCategory;
  budget_level: BudgetLevel;
  season: TripSeason;
  image_url: string;
  content: string;
};

const MAX = 1200;

const categoryLabels: Record<TripCategory, string> = {
  spot: "景點",
  food: "美食",
  stay: "住宿",
  route: "行程",
  transport: "交通",
  story: "心得",
  inspiration: "靈感",
};

const budgetLabels: Record<BudgetLevel, string> = {
  low: "輕預算",
  mid: "中等預算",
  high: "享受型",
};

const seasonLabels: Record<TripSeason, string> = {
  spring: "春",
  summer: "夏",
  autumn: "秋",
  winter: "冬",
  anytime: "不限季節",
};

const categories = Object.entries(categoryLabels).map(([value, label]) => ({
  value,
  label,
}));

const budgets = Object.entries(budgetLabels).map(([value, label]) => ({
  value,
  label,
}));

const seasons = Object.entries(seasonLabels).map(([value, label]) => ({
  value,
  label,
}));

function toDraft(question: Question): EditDraft {
  return {
    title: question.title,
    location: question.location,
    country: question.country,
    category: question.category,
    budget_level: question.budget_level,
    season: question.season,
    image_url: question.image_url ?? "",
    content: question.content,
  };
}

function QuestionCardImpl({ question }: Props) {
  const [localQuestion, setLocalQuestion] = useState<Question | null>(null);
  const [pendingLike, setPendingLike] = useState(false);
  const [pendingSave, setPendingSave] = useState(false);
  const [alreadyLiked, setAlreadyLiked] = useState(false);
  const [alreadySaved, setAlreadySaved] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [isMine, setIsMine] = useState(false);

  const displayQuestion =
    localQuestion?.id === question.id ? localQuestion : question;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAlreadyLiked(hasLiked(displayQuestion.id));
    setAlreadySaved(hasSaved(displayQuestion.id));
    setIsMine(displayQuestion.author_anon_id === getAnonId());
  }, [displayQuestion.author_anon_id, displayQuestion.id]);

  async function handleLike() {
    if (pendingLike) return;
    setPendingLike(true);

    const rpcName = alreadyLiked
      ? "decrement_question_like"
      : "increment_question_like";
    const { error } = await supabase.rpc(rpcName, {
      qid: displayQuestion.id,
      anon: getAnonId(),
    });

    setPendingLike(false);
    if (error) {
      console.error(alreadyLiked ? "取消想去失敗" : "標記想去失敗", error);
      return;
    }

    if (alreadyLiked) {
      removeLiked(displayQuestion.id);
      setAlreadyLiked(false);
      setLocalQuestion((current) => ({
        ...(current ?? displayQuestion),
        likes: Math.max((current ?? displayQuestion).likes - 1, 0),
      }));
    } else {
      addLiked(displayQuestion.id);
      setAlreadyLiked(true);
      setLocalQuestion((current) => ({
        ...(current ?? displayQuestion),
        likes: (current ?? displayQuestion).likes + 1,
      }));
    }
  }

  async function handleSave() {
    if (pendingSave) return;
    setPendingSave(true);

    const rpcName = alreadySaved
      ? "decrement_trip_save"
      : "increment_trip_save";
    const { error } = await supabase.rpc(rpcName, {
      qid: displayQuestion.id,
      anon: getAnonId(),
    });

    setPendingSave(false);
    if (error) {
      console.error(alreadySaved ? "取消收藏失敗" : "收藏失敗", error);
      return;
    }

    if (alreadySaved) {
      removeSaved(displayQuestion.id);
      setAlreadySaved(false);
      setLocalQuestion((current) => ({
        ...(current ?? displayQuestion),
        saves: Math.max(((current ?? displayQuestion).saves ?? 0) - 1, 0),
      }));
    } else {
      addSaved(displayQuestion.id);
      setAlreadySaved(true);
      setLocalQuestion((current) => ({
        ...(current ?? displayQuestion),
        saves: ((current ?? displayQuestion).saves ?? 0) + 1,
      }));
    }
  }

  return (
    <>
      <motion.article
        layout
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.24 }}
        className="grid overflow-hidden rounded-2xl border border-border/70 bg-card/92 shadow-xl shadow-black/6 backdrop-blur-md lg:grid-cols-[320px_1fr]"
      >
        <TripImage question={displayQuestion} compact />

        <div className="p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Tag>{categoryLabels[displayQuestion.category]}</Tag>
            <Tag>{seasonLabels[displayQuestion.season]}</Tag>
            <Tag>
              <WalletCards className="h-3.5 w-3.5" />
              {budgetLabels[displayQuestion.budget_level]}
            </Tag>
            {isMine ? <Tag>我的貼文</Tag> : null}
          </div>

          <div className="mt-4 flex flex-col gap-2">
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4 text-primary" />
              {displayQuestion.country} / {displayQuestion.location}
            </p>
            <h3 className="text-2xl font-semibold tracking-tight">
              {displayQuestion.title}
            </h3>
            <p className="line-clamp-3 whitespace-pre-wrap text-sm leading-7 text-foreground/86">
              {displayQuestion.content}
            </p>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground">
              {formatDate(displayQuestion.created_at)}
            </span>

            <div className="flex flex-wrap items-center gap-2">
              <ActionButton
                pressed={alreadyLiked}
                pending={pendingLike}
                onClick={handleLike}
                icon={
                  <Heart
                    className={cn("h-4 w-4", alreadyLiked && "fill-current")}
                  />
                }
                label={alreadyLiked ? "已想去" : "想去"}
                count={displayQuestion.likes}
              />
              <ActionButton
                pressed={alreadySaved}
                pending={pendingSave}
                onClick={handleSave}
                icon={
                  <Bookmark
                    className={cn("h-4 w-4", alreadySaved && "fill-current")}
                  />
                }
                label={alreadySaved ? "已收藏" : "收藏"}
                count={displayQuestion.saves ?? 0}
              />
              <button
                type="button"
                onClick={() => setDetailsOpen(true)}
                className={cn(
                  "inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3 py-2",
                  "border-primary/55 bg-primary/10 text-sm font-medium text-primary transition-colors",
                  "hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                )}
              >
                <MessageCircle className="h-4 w-4" />
                閱讀心得
              </button>
            </div>
          </div>
        </div>
      </motion.article>

      {detailsOpen ? (
        <TripDetailModal
          question={displayQuestion}
          isMine={isMine}
          onClose={() => setDetailsOpen(false)}
          onUpdated={setLocalQuestion}
        />
      ) : null}
    </>
  );
}

function TripDetailModal({
  question,
  isMine,
  onClose,
  onUpdated,
}: {
  question: Question;
  isMine: boolean;
  onClose: () => void;
  onUpdated: (question: Question) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<EditDraft>(() => toDraft(question));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    if (
      !draft.title.trim() ||
      !draft.location.trim() ||
      !draft.country.trim() ||
      !draft.content.trim()
    ) {
      setError("請填寫標題、地點、城市與旅行心得。");
      return;
    }

    setSaving(true);
    setError(null);
    const { data, error: updateError } = await supabase.rpc(
      "update_trip_post",
      {
        qid: question.id,
        anon: getAnonId(),
        next_title: draft.title,
        next_location: draft.location,
        next_country: draft.country,
        next_category: draft.category,
        next_budget_level: draft.budget_level,
        next_season: draft.season,
        next_image_url: draft.image_url,
        next_content: draft.content,
      }
    );
    setSaving(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    onUpdated(data as Question);
    setEditing(false);
  }

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
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
            aria-labelledby={`trip-${question.id}-title`}
            initial={{ opacity: 0, y: 28, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.98 }}
            transition={{ duration: 0.22 }}
            className="max-h-[94dvh] w-full max-w-5xl overflow-y-auto rounded-t-2xl border border-border bg-card shadow-2xl sm:rounded-2xl"
          >
            <TripImage question={question} />
            <div className="p-4 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4 text-primary" />
                    {question.country} / {question.location}
                  </p>
                  <h2
                    id={`trip-${question.id}-title`}
                    className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl"
                  >
                    {question.title}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="關閉"
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-background/70 transition hover:border-primary/60 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Tag>{categoryLabels[question.category]}</Tag>
                <Tag>{seasonLabels[question.season]}</Tag>
                <Tag>{budgetLabels[question.budget_level]}</Tag>
                <Tag>
                  <CalendarDays className="h-3.5 w-3.5" />
                  {formatDate(question.created_at)}
                </Tag>
                {question.updated_at !== question.created_at ? (
                  <Tag>更新 {formatDate(question.updated_at)}</Tag>
                ) : null}
              </div>

              {editing ? (
                <EditForm
                  draft={draft}
                  saving={saving}
                  error={error}
                  onDraftChange={setDraft}
                  onCancel={() => {
                    setDraft(toDraft(question));
                    setEditing(false);
                    setError(null);
                  }}
                  onSubmit={handleSave}
                />
              ) : (
                <>
                  <p className="mt-6 whitespace-pre-wrap text-base leading-8 text-foreground/90">
                    {question.content}
                  </p>
                  <div className="mt-6 flex flex-wrap items-center gap-2">
                    {isMine ? (
                      <button
                        type="button"
                        onClick={() => setEditing(true)}
                        className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-primary/60 bg-primary/10 px-4 py-2 text-sm font-medium text-primary transition hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                      >
                        <Pencil className="h-4 w-4" />
                        編輯貼文
                      </button>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        只有原本發布這則貼文的瀏覽器可以編輯。
                      </p>
                    )}
                  </div>
                  <AnswerSection questionId={question.id} />
                </>
              )}
            </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function EditForm({
  draft,
  saving,
  error,
  onDraftChange,
  onCancel,
  onSubmit,
}: {
  draft: EditDraft;
  saving: boolean;
  error: string | null;
  onDraftChange: (draft: EditDraft) => void;
  onCancel: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  const contentLength = draft.content.length;
  return (
    <form onSubmit={onSubmit} className="mt-6 grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="標題">
          <input
            value={draft.title}
            onChange={(event) =>
              onDraftChange({ ...draft, title: event.target.value })
            }
            maxLength={80}
            className="field-input"
          />
        </Field>
        <Field label="地點">
          <input
            value={draft.location}
            onChange={(event) =>
              onDraftChange({ ...draft, location: event.target.value })
            }
            maxLength={80}
            className="field-input"
          />
        </Field>
        <Field label="國家 / 城市">
          <input
            value={draft.country}
            onChange={(event) =>
              onDraftChange({ ...draft, country: event.target.value })
            }
            maxLength={80}
            className="field-input"
          />
        </Field>
        <Field label="圖片網址">
          <input
            value={draft.image_url}
            onChange={(event) =>
              onDraftChange({ ...draft, image_url: event.target.value })
            }
            placeholder="https://..."
            className="field-input"
          />
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <SelectField
          label="類型"
          value={draft.category}
          options={categories}
          onChange={(value) =>
            onDraftChange({ ...draft, category: value as TripCategory })
          }
        />
        <SelectField
          label="季節"
          value={draft.season}
          options={seasons}
          onChange={(value) =>
            onDraftChange({ ...draft, season: value as TripSeason })
          }
        />
        <SelectField
          label="預算"
          value={draft.budget_level}
          options={budgets}
          onChange={(value) =>
            onDraftChange({ ...draft, budget_level: value as BudgetLevel })
          }
        />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground">
          旅行心得
        </label>
        <Textarea
          value={draft.content}
          onChange={(event) =>
            onDraftChange({ ...draft, content: event.target.value })
          }
          maxLength={MAX}
          rows={8}
          className="mt-1 resize-none border-border bg-background/70 text-sm leading-relaxed"
        />
        <p className="mt-1 text-right text-xs tabular-nums text-muted-foreground">
          {contentLength} / {MAX}
        </p>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex min-h-10 items-center justify-center rounded-full border border-border bg-background/70 px-4 py-2 text-sm font-medium transition hover:border-primary/60 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
        >
          取消
        </button>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 disabled:cursor-not-allowed disabled:opacity-55"
        >
          <Save className="h-4 w-4" />
          {saving ? "儲存中" : "儲存修改"}
        </button>
      </div>
    </form>
  );
}

function TripImage({
  question,
  compact = false,
}: {
  question: Question;
  compact?: boolean;
}) {
  const style = useMemo(
    () =>
      question.image_url
        ? { backgroundImage: `url(${question.image_url})` }
        : undefined,
    [question.image_url]
  );

  if (question.image_url) {
    return (
      <div
        className={cn(
          "relative bg-cover bg-center",
          compact ? "min-h-56 lg:min-h-full" : "h-64 sm:h-80"
        )}
        style={style}
        role="img"
        aria-label={`${question.title} 的旅行圖片`}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black/52 via-black/8 to-transparent" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "grid bg-[linear-gradient(135deg,var(--trip-sky),var(--trip-night),var(--trip-coral))] text-primary-foreground",
        compact ? "min-h-56 lg:min-h-full" : "h-64 sm:h-80"
      )}
    >
      <div className="m-5 flex items-end justify-between rounded-xl border border-white/18 bg-white/12 p-4 backdrop-blur-sm">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-white/68">
            no image yet
          </p>
          <p className="mt-1 font-display text-3xl italic">
            {question.country}
          </p>
        </div>
        <Plane className="h-9 w-9" aria-hidden />
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

function ActionButton({
  icon,
  label,
  count,
  pressed,
  pending,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  pressed: boolean;
  pending: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={pending}
      aria-pressed={pressed}
      whileTap={pending ? undefined : { scale: 0.96 }}
      className={cn(
        "inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3 py-2",
        "text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
        pressed
          ? "border-primary/60 bg-primary/10 text-primary"
          : "border-border bg-background/70 hover:border-primary/60 hover:text-primary",
        pending && "opacity-60"
      )}
    >
      {icon}
      {label}
      <span className="tabular-nums">{count}</span>
    </motion.button>
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

function SelectField({
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

function formatDate(value: string) {
  return new Date(value).toLocaleString("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const QuestionCard = memo(QuestionCardImpl, (prev, next) => {
  return (
    prev.question.id === next.question.id &&
    prev.question.title === next.question.title &&
    prev.question.content === next.question.content &&
    prev.question.likes === next.question.likes &&
    prev.question.saves === next.question.saves &&
    prev.question.image_url === next.question.image_url &&
    prev.question.author_anon_id === next.question.author_anon_id &&
    prev.question.updated_at === next.question.updated_at &&
    prev.question.created_at === next.question.created_at
  );
});
