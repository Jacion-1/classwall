"use client";

import { MessageCircle, Pencil, Save, Send, Trash2, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { cloneElement, useState } from "react";

import { getAnonId } from "@/lib/anon-id";
import { getAuthDisplayName, useAuth } from "@/lib/use-auth";
import { useAnswers } from "@/lib/use-answers";
import { cn } from "@/lib/utils";
import type { Answer } from "@/types/database";

type Props = {
  questionId: string;
};

const MAX = 500;

export function AnswerSection({ questionId }: Props) {
  const { user, profile } = useAuth();
  const { answers, loading, error, addAnswer, updateAnswer, deleteAnswer } =
    useAnswers(questionId);
  const [content, setContent] = useState("");
  const [authorName, setAuthorName] = useState("旅人");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = content.trim();
    if (!trimmed || submitting) return;

    setSubmitting(true);
    setSubmitError(null);
    const effectiveName =
      authorName.trim() && authorName !== "旅人"
        ? authorName
        : profile?.display_name || getAuthDisplayName(user);
    const result = await addAnswer(trimmed, effectiveName);
    setSubmitting(false);

    if (result.error) {
      setSubmitError(result.error);
      return;
    }
    setContent("");
  }

  return (
    <div className="mt-5 border-t border-border/60 pt-5">
      <div className="mb-3 flex items-center gap-2 text-sm font-medium">
        <MessageCircle className="h-4 w-4 text-primary" />
        旅行補充
        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
          {answers.length}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        {loading ? (
          <p className="text-xs text-muted-foreground">讀取留言中...</p>
        ) : error ? (
          <p className="text-xs text-destructive">讀取失敗：{error}</p>
        ) : answers.length === 0 ? (
          <p className="text-xs italic text-muted-foreground/80">
            還沒有補充。可以留下交通提醒、餐廳建議或實際踩點心得。
          </p>
        ) : (
          <AnimatePresence initial={false}>
            {answers.map((answer) => (
              <AnswerItem
                key={answer.id}
                answer={answer}
                onUpdate={updateAnswer}
                onDelete={deleteAnswer}
              />
            ))}
          </AnimatePresence>
        )}
      </div>

      <form onSubmit={handleSubmit} className="mt-3 flex flex-col gap-2">
        <input
          value={authorName}
          onChange={(event) => setAuthorName(event.target.value)}
          maxLength={30}
          placeholder="暱稱"
          className="field-input"
        />
        <textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="補充一個小提醒，例如交通、排隊時間、附近美食..."
          maxLength={MAX}
          rows={2}
          disabled={submitting}
          className={cn(
            "w-full resize-none rounded-lg border border-border/70 bg-background/70 px-3 py-2",
            "text-sm leading-relaxed placeholder:text-muted-foreground/60",
            "transition-colors focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-ring/30",
            "disabled:cursor-not-allowed disabled:opacity-60"
          )}
        />
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] tabular-nums text-muted-foreground/70">
            {content.length} / {MAX}
          </span>
          <motion.button
            type="submit"
            disabled={submitting || content.trim().length === 0}
            whileTap={{ scale: 0.96 }}
            className={cn(
              "inline-flex min-h-9 items-center gap-1.5 rounded-full px-4 py-1.5",
              "border border-primary/60 bg-primary/10 text-xs font-medium text-primary",
              "transition-colors hover:bg-primary hover:text-primary-foreground",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
              "disabled:cursor-not-allowed disabled:opacity-50"
            )}
          >
            <Send className="h-3.5 w-3.5" />
            {submitting ? "送出中" : "送出補充"}
          </motion.button>
        </div>
        {submitError ? (
          <p className="text-xs text-destructive">{submitError}</p>
        ) : null}
      </form>
    </div>
  );
}

function AnswerItem({
  answer,
  onUpdate,
  onDelete,
}: {
  answer: Answer;
  onUpdate: (
    answerId: string,
    content: string,
    authorName: string
  ) => Promise<{ error: string | null }>;
  onDelete: (answerId: string) => Promise<{ error: string | null }>;
}) {
  const { user } = useAuth();
  const isMine =
    answer.author_anon_id === getAnonId() ||
    Boolean(user?.id && answer.user_id === user.id);
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(answer.author_name);
  const [draftContent, setDraftContent] = useState(answer.content);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpdate() {
    if (pending) return;
    setPending(true);
    setError(null);
    const result = await onUpdate(answer.id, draftContent, draftName);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setEditing(false);
  }

  async function handleDelete() {
    if (pending || !window.confirm("確定要刪除這則補充嗎？")) return;
    setPending(true);
    setError(null);
    const result = await onDelete(answer.id);
    setPending(false);
    if (result.error) setError(result.error);
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.22 }}
      className="rounded-lg border border-border/60 bg-muted/45 px-3 py-2.5 text-sm leading-relaxed"
    >
      {editing ? (
        <div className="grid gap-2">
          <input
            value={draftName}
            onChange={(event) => setDraftName(event.target.value)}
            maxLength={30}
            className="field-input"
          />
          <textarea
            value={draftContent}
            onChange={(event) => setDraftContent(event.target.value)}
            maxLength={MAX}
            rows={3}
            className={cn(
              "w-full resize-none rounded-lg border border-border/70 bg-background/70 px-3 py-2",
              "text-sm leading-relaxed focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-ring/30"
            )}
          />
          <div className="flex flex-wrap justify-end gap-2">
            <SmallButton onClick={() => setEditing(false)} icon={<X />}>
              取消
            </SmallButton>
            <SmallButton
              onClick={handleUpdate}
              disabled={pending}
              icon={<Save />}
            >
              {pending ? "儲存中" : "儲存"}
            </SmallButton>
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-medium text-primary">
              {answer.author_name}
            </p>
            {isMine ? (
              <div className="flex gap-1.5">
                <SmallButton onClick={() => setEditing(true)} icon={<Pencil />}>
                  編輯
                </SmallButton>
                <SmallButton
                  onClick={handleDelete}
                  disabled={pending}
                  icon={<Trash2 />}
                  destructive
                >
                  刪除
                </SmallButton>
              </div>
            ) : null}
          </div>
          <p className="mt-1 whitespace-pre-wrap">{answer.content}</p>
          <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground/70">
            {new Date(answer.updated_at ?? answer.created_at).toLocaleString(
              "zh-TW",
              {
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              }
            )}
          </p>
        </>
      )}
      {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
    </motion.div>
  );
}

function SmallButton({
  children,
  icon,
  destructive = false,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  icon: React.ReactElement<{ className?: string }>;
  destructive?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex min-h-7 items-center gap-1 rounded-full border px-2 text-[11px] transition",
        destructive
          ? "border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive hover:text-white"
          : "border-border bg-background/70 text-muted-foreground hover:border-primary/50 hover:text-primary",
        disabled && "cursor-not-allowed opacity-55"
      )}
    >
      {cloneElement(icon, { className: "h-3 w-3" })}
      {children}
    </button>
  );
}
