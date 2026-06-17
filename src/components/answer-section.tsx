"use client";

import { MessageCircle, Send } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";

import { useAnswers } from "@/lib/use-answers";
import { cn } from "@/lib/utils";

type Props = {
  questionId: string;
};

const MAX = 500;

export function AnswerSection({ questionId }: Props) {
  const { answers, loading, error, addAnswer } = useAnswers(questionId);
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = content.trim();
    if (!trimmed || submitting) return;

    setSubmitting(true);
    setSubmitError(null);
    const result = await addAnswer(trimmed);
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
              <motion.div
                key={answer.id}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22 }}
                className="rounded-lg border border-border/60 bg-muted/45 px-3 py-2.5 text-sm leading-relaxed"
              >
                <p className="whitespace-pre-wrap">{answer.content}</p>
                <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground/70">
                  {new Date(answer.created_at).toLocaleString("zh-TW", {
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      <form onSubmit={handleSubmit} className="mt-3 flex flex-col gap-2">
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
