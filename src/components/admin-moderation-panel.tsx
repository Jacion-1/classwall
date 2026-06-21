"use client";

import { CheckCircle2, Eye, EyeOff, ShieldAlert, X, XCircle } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import type { ContentReport } from "@/types/database";

type ModerationAction = "none" | "hide" | "restore";
type ModerationStatus = ContentReport["status"];
type ReportTargetType = ContentReport["target_type"];

type AdminReport = {
  report_id: string;
  target_type: ReportTargetType;
  target_id: string;
  reason: string;
  detail: string;
  status: ModerationStatus;
  admin_note: string;
  created_at: string;
  updated_at: string;
  reporter_anon_id: string | null;
  target_exists: boolean;
  target_title: string | null;
  target_preview: string | null;
  target_location: string | null;
  target_author_name: string | null;
};

const statusLabels: Record<ModerationStatus, string> = {
  open: "待處理",
  reviewing: "審核中",
  resolved: "已處理",
  dismissed: "已駁回",
};

const targetLabels: Record<ReportTargetType, string> = {
  question: "旅行心得",
  answer: "留言",
  itinerary: "行程表",
};

export function AdminModerationPanel({ enabled }: { enabled: boolean }) {
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [previewReport, setPreviewReport] = useState<AdminReport | null>(null);

  useEffect(() => {
    if (!enabled) return;
    void loadReports();
  }, [enabled]);

  async function loadReports() {
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await supabase.rpc("admin_report_queue");

    setLoading(false);
    if (fetchError) {
      setError(fetchError.message);
      return;
    }
    setReports((data ?? []) as AdminReport[]);
  }

  async function moderate(
    report: AdminReport,
    nextStatus: ModerationStatus,
    action: ModerationAction,
    note: string
  ) {
    setPendingId(report.report_id);
    setError(null);

    const { error: moderationError } = await supabase.rpc("moderate_content", {
      report_id: report.report_id,
      next_status: nextStatus,
      action,
      note,
    });

    setPendingId(null);
    if (moderationError) {
      setError(moderationError.message);
      return;
    }

    await loadReports();
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
          <h2 className="mt-1 text-2xl font-semibold">檢舉審核</h2>
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
        <p className="mt-4 text-sm text-muted-foreground">目前沒有檢舉紀錄。</p>
      ) : (
        <div className="mt-4 grid gap-3">
          {reports.map((report) => {
            const pending = pendingId === report.report_id;
            return (
              <article
                key={report.report_id}
                className="rounded-xl border border-border bg-background/60 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">
                      {targetLabels[report.target_type]} · {report.reason}
                    </p>
                    <p className="mt-1 line-clamp-1 text-sm text-foreground/85">
                      {report.target_exists
                        ? report.target_title || report.target_preview || "未命名內容"
                        : "原始內容已不存在"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDate(report.created_at)}
                      {report.target_location ? ` · ${report.target_location}` : ""}
                      {report.target_author_name ? ` · ${report.target_author_name}` : ""}
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

                <div className="mt-3 rounded-lg border border-border/70 bg-card/60 p-3 text-sm leading-6">
                  <p className="font-medium text-foreground">被檢舉內容</p>
                  <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-muted-foreground">
                    {report.target_exists
                      ? report.target_preview || "沒有可顯示的摘要。"
                      : "原始內容已不存在"}
                  </p>
                </div>

                {report.detail ? (
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-foreground/82">
                    補充說明：{report.detail}
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
                    onClick={() => setPreviewReport(report)}
                  >
                    查看被檢舉內容
                  </ModerationButton>
                  <ModerationButton
                    icon={<Eye className="h-4 w-4" />}
                    disabled={pending}
                    onClick={() => moderate(report, "reviewing", "none", "已進入審核")}
                  >
                    標記審核中
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

      {previewReport ? (
        <ReportPreviewModal
          report={previewReport}
          onClose={() => setPreviewReport(null)}
        />
      ) : null}
    </section>
  );
}

function ReportPreviewModal({
  report,
  onClose,
}: {
  report: AdminReport;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
      <section className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Report Preview
            </p>
            <h3 className="mt-1 text-xl font-semibold">
              {targetLabels[report.target_type]}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="關閉預覽"
            className="grid h-9 w-9 place-items-center rounded-full border border-border bg-background/70 text-muted-foreground transition hover:text-primary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {report.target_exists ? (
          <div className="mt-4 grid gap-3 text-sm leading-6">
            <p>
              <span className="font-medium">標題：</span>
              {report.target_title || "未命名內容"}
            </p>
            {report.target_location ? (
              <p>
                <span className="font-medium">地點：</span>
                {report.target_location}
              </p>
            ) : null}
            {report.target_author_name ? (
              <p>
                <span className="font-medium">作者：</span>
                {report.target_author_name}
              </p>
            ) : null}
            <div className="rounded-xl border border-border bg-background/70 p-3">
              <p className="font-medium">內容摘要</p>
              <p className="mt-2 whitespace-pre-wrap text-muted-foreground">
                {report.target_preview || "沒有可顯示的摘要。"}
              </p>
            </div>
          </div>
        ) : (
          <p className="mt-4 rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground">
            原始內容已不存在，但檢舉紀錄仍可進行狀態處理。
          </p>
        )}

        <div className="mt-4 rounded-xl bg-muted/60 p-3 text-sm leading-6">
          <p>檢舉原因：{report.reason}</p>
          {report.detail ? <p className="mt-1">補充說明：{report.detail}</p> : null}
          <p className="mt-1 text-xs text-muted-foreground">
            檢舉時間：{formatDate(report.created_at)}
          </p>
        </div>

        <div className="mt-5 flex justify-end">
          <Button type="button" onClick={onClose} variant="outline">
            關閉
          </Button>
        </div>
      </section>
    </div>
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

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "時間未知";
  return date.toLocaleString("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
