"use client";

import { Flag, Send, X } from "lucide-react";
import { useState } from "react";

import { getAnonId } from "@/lib/anon-id";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import type { ContentReport } from "@/types/database";

type ReportTarget = ContentReport["target_type"];

const reasons = [
  "不適合公開內容",
  "廣告或洗版",
  "錯誤資訊",
  "冒犯或騷擾",
  "其他",
];

export function ReportButton({
  targetType,
  targetId,
  compact = false,
}: {
  targetType: ReportTarget;
  targetId: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(reasons[0]);
  const [detail, setDetail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submitReport(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setError(null);
    setMessage(null);

    const { error: reportError } = await supabase.rpc("submit_content_report", {
      target_type: targetType,
      target_id: targetId,
      reason,
      detail: detail.trim(),
      reporter_anon_id: getAnonId(),
    });

    setSubmitting(false);
    if (reportError) {
      setError(reportError.message);
      return;
    }

    setMessage("已送出檢舉，管理員會再確認。");
    setDetail("");
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex items-center justify-center gap-1.5 rounded-full border border-border bg-background/70 text-sm text-muted-foreground transition",
          "hover:border-destructive/50 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
          compact ? "min-h-9 px-3" : "min-h-10 px-4 py-2"
        )}
      >
        <Flag className="h-4 w-4" />
        檢舉
      </button>

      {open ? (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
          <form
            onSubmit={submitReport}
            className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  Report
                </p>
                <h3 className="mt-1 text-xl font-semibold">檢舉內容</h3>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="關閉檢舉視窗"
                className="grid h-9 w-9 place-items-center rounded-full border border-border bg-background/70 text-muted-foreground transition hover:text-primary"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <label className="mt-4 block">
              <span className="text-xs font-medium text-muted-foreground">
                檢舉原因
              </span>
              <select
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                className="field-input mt-1"
              >
                {reasons.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <label className="mt-3 block">
              <span className="text-xs font-medium text-muted-foreground">
                補充說明
              </span>
              <textarea
                value={detail}
                onChange={(event) => setDetail(event.target.value)}
                maxLength={500}
                rows={4}
                className="mt-1 w-full resize-none rounded-xl border border-border bg-background/70 px-3 py-2 text-sm leading-relaxed focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-ring/30"
                placeholder="可補充哪裡不適合公開。"
              />
            </label>

            {message ? <p className="mt-3 text-sm text-primary">{message}</p> : null}
            {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex min-h-10 items-center rounded-full border border-border bg-background/70 px-4 text-sm font-medium transition hover:border-primary/60 hover:text-primary"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-55"
              >
                <Send className="h-4 w-4" />
                {submitting ? "送出中" : "送出檢舉"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
