"use client";

import {
  Bookmark,
  ChevronDown,
  Heart,
  MapPin,
  MessageCircle,
  Plane,
  WalletCards,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { memo, useEffect, useState } from "react";

import { AnswerSection } from "@/components/answer-section";
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

function QuestionCardImpl({ question }: Props) {
  const [pendingLike, setPendingLike] = useState(false);
  const [pendingSave, setPendingSave] = useState(false);
  const [alreadyLiked, setAlreadyLiked] = useState(false);
  const [alreadySaved, setAlreadySaved] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAlreadyLiked(hasLiked(question.id));
    setAlreadySaved(hasSaved(question.id));
  }, [question.id]);

  async function handleLike() {
    if (pendingLike) return;
    setPendingLike(true);

    const rpcName = alreadyLiked
      ? "decrement_question_like"
      : "increment_question_like";
    const { error } = await supabase.rpc(rpcName, {
      qid: question.id,
      anon: getAnonId(),
    });

    setPendingLike(false);
    if (error) {
      console.error(alreadyLiked ? "取消想去失敗" : "想去失敗", error);
      return;
    }

    if (alreadyLiked) {
      removeLiked(question.id);
      setAlreadyLiked(false);
    } else {
      addLiked(question.id);
      setAlreadyLiked(true);
    }
  }

  async function handleSave() {
    if (pendingSave) return;
    setPendingSave(true);

    const rpcName = alreadySaved
      ? "decrement_trip_save"
      : "increment_trip_save";
    const { error } = await supabase.rpc(rpcName, {
      qid: question.id,
      anon: getAnonId(),
    });

    setPendingSave(false);
    if (error) {
      console.error(alreadySaved ? "取消收藏失敗" : "收藏失敗", error);
      return;
    }

    if (alreadySaved) {
      removeSaved(question.id);
      setAlreadySaved(false);
    } else {
      addSaved(question.id);
      setAlreadySaved(true);
    }
  }

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.24 }}
      className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm"
    >
      {question.image_url ? (
        <div
          className="h-56 bg-cover bg-center sm:h-72"
          style={{ backgroundImage: `url(${question.image_url})` }}
          role="img"
          aria-label={`${question.title} 的旅行照片`}
        />
      ) : (
        <div className="grid h-40 place-items-center bg-[linear-gradient(135deg,var(--trip-sky),var(--trip-leaf),var(--trip-coral))] text-primary-foreground sm:h-52">
          <Plane className="h-10 w-10" aria-hidden />
        </div>
      )}

      <div className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Tag>{categoryLabels[question.category] ?? "靈感"}</Tag>
          <Tag>{seasonLabels[question.season] ?? "不限季節"}</Tag>
          <Tag>
            <WalletCards className="h-3.5 w-3.5" />
            {budgetLabels[question.budget_level] ?? "中等預算"}
          </Tag>
        </div>

        <div className="mt-4 flex flex-col gap-2">
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4 text-primary" />
            {question.country} · {question.location}
          </p>
          <h3 className="text-2xl font-semibold tracking-tight">
            {question.title}
          </h3>
          <p className="whitespace-pre-wrap text-sm leading-7 text-foreground/86">
            {question.content}
          </p>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">
            {new Date(question.created_at).toLocaleString("zh-TW", {
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            })}
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
              count={question.likes}
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
              count={question.saves ?? 0}
            />
            <button
              type="button"
              onClick={() => setExpanded((value) => !value)}
              aria-expanded={expanded}
              className={cn(
                "inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3 py-2",
                "text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
                expanded
                  ? "border-primary/60 bg-primary/10 text-primary"
                  : "border-border bg-background/70 hover:border-primary/60 hover:text-primary"
              )}
            >
              <MessageCircle className="h-4 w-4" />
              補充
              <ChevronDown
                className={cn(
                  "h-4 w-4 transition-transform",
                  expanded && "rotate-180"
                )}
              />
            </button>
          </div>
        </div>

        <AnimatePresence initial={false}>
          {expanded ? (
            <motion.div
              key="answers"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.24 }}
              className="overflow-hidden"
            >
              <AnswerSection questionId={question.id} />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </motion.article>
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

export const QuestionCard = memo(QuestionCardImpl, (prev, next) => {
  return (
    prev.question.id === next.question.id &&
    prev.question.title === next.question.title &&
    prev.question.content === next.question.content &&
    prev.question.likes === next.question.likes &&
    prev.question.saves === next.question.saves &&
    prev.question.image_url === next.question.image_url &&
    prev.question.created_at === next.question.created_at
  );
});
