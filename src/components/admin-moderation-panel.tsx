"use client";

import { CheckCircle2, Eye, EyeOff, ShieldAlert, XCircle } from "lucide-react";
import { useEffect, useState } from "react";

import { supabase } from "@/lib/supabase";
import type { ContentReport } from "@/types/database";
import { cn } from "@/lib/utils";

type ModerationAction = "none" | "hide" | "restore";
type ModerationStatus = ContentReport["status"];

const statusLabels: Record<ModerationStatus, string> = {
  open: "待處理",
  reviewing: "審核中",
  resolved: "已處理",
  dismissed: "已駁回",
};

const targetLabels: Record<ContentReport["target_type"], string> = {
  question: "心得貼文",
  answer: "留言",
  itinerary: "行程表",
};

export function AdminModerationPanel({ enabled }: { enabled: boolean }) {
  const [reports, setReports] = useState<ContentReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    void loadReports();
  }, [enabled]);

  async function loadReports() {
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await supabase
      .from("content_reports")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    setLoading(false);
    if (fetchError) {
      setError(fetchError.message);
      return;
    }
    setReports((data ?? []) as ContentReport[]);
  }

  async function moderate(
    report: ContentReport,
    nextStatus: ModerationStatus,
    action: ModerationAction,
    note: string
  ) {
    setPendingId(report.id);
    setError(null);

    const { data, error: moderationError } = await supabase.rpc(
      "moderate_content",
      {
        report_id: report.id,
        next_status: nextStatus,
        action,
        note,
      }
    );

    setPendingId(null);
    if (moderationError) {
      setError(moderationError.message);
      return;
    }

    setReports((current) =>
      current.map((item) =>
        item.id === report.id ? (data as ContentReport) : item
      )
    );
  }

  if (!enabled) return null;

  return (
    <section className="rounded-2xl border border-border/70 bg-card/92 p-4 shadow-xl shadow-black/6 backdrop-blur-md">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
            <ShieldAlert className="h-4 w-4 text-primary" />
            Moderation
          </p>
          <h2 className="mt-1 text-2xl font-semibold">管理員審核</h2>
        </div>
        <button
          type="button"
          onClick={loadReports}
          className="inline-flex min-h-10 items-center rounded-full border border-border bg-background/70 px-4 text-sm font-medium transition hover:border-primary/60 hover:text-primary"
        >
          重新整理
        </button>
      </div>

      {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
      {loading ? (
        <div className="mt-4 h-32 animate-pulse rounded-xl bg-muted" />
      ) : reports.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">目前沒有檢舉。</p>
      ) : (
        <div className="mt-4 grid gap-3">
          {reports.map((report) => {
            const pending = pendingId === report.id;
            return (
              <article
                key={report.id}
                className="rounded-xl border border-border bg-background/60 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">
                      {targetLabels[report.target_type]} · {report.reason}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Date(report.created_at).toLocaleString("zh-TW")} ·{" "}
                      {report.target_id}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-xs",
                      report.status === "open"
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : "border-border bg-muted text-muted-foreground"
                    )}
                  >
                    {statusLabels[report.status]}
                  </span>
                </div>

                {report.detail ? (
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-foreground/82">
                    {report.detail}
                  </p>
                ) : null}

                {report.admin_note ? (
                  <p className="mt-3 rounded-lg bg-muted/60 p-3 text-xs leading-5 text-muted-foreground">
                    管理備註：{report.admin_note}
                  </p>
                ) : null}

                <div className="mt-4 flex flex-wrap gap-2">
                  <ModerationButton
                    icon={<Eye className="h-4 w-4" />}
                    disabled={pending}
                    onClick={() => moderate(report, "reviewing", "none", "進入審核")}
                  >
                    審核中
                  </ModerationButton>
                  <ModerationButton
                    icon={<EyeOff className="h-4 w-4" />}
                    disabled={pending}
                    destructive
                    onClick={() => moderate(report, "resolved", "hide", "內容已隱藏")}
                  >
                    隱藏內容
                  </ModerationButton>
                  <ModerationButton
                    icon={<CheckCircle2 className="h-4 w-4" />}
                    disabled={pending}
                    onClick={() => moderate(report, "resolved", "restore", "內容已恢復")}
                  >
                    恢復內容
                  </ModerationButton>
                  <ModerationButton
                    icon={<XCircle className="h-4 w-4" />}
                    disabled={pending}
                    onClick={() => moderate(report, "dismissed", "none", "檢舉不成立")}
                  >
                    駁回
                  </ModerationButton>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function ModerationButton({
  children,
  icon,
  destructive = false,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
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
        "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition",
        destructive
          ? "border-destructive/50 bg-destructive/10 text-destructive hover:bg-destructive hover:text-white"
          : "border-border bg-card text-muted-foreground hover:border-primary/60 hover:text-primary",
        disabled && "cursor-not-allowed opacity-55"
      )}
    >
      {icon}
      {children}
    </button>
  );
}
