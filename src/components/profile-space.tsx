"use client";

import {
  CalendarDays,
  FileText,
  ImagePlus,
  Mail,
  MessageCircle,
  Save,
  Trash2,
  Upload,
  UserRound,
} from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useState } from "react";

import { AdminModerationPanel } from "@/components/admin-moderation-panel";
import {
  compressTripImage,
  formatFileSize,
  isProfileImageUrl,
  removeProfileImageByUrl,
  uploadProfileImage,
  type CompressedImage,
} from "@/lib/image-upload";
import { supabase } from "@/lib/supabase";
import {
  getAuthDisplayName,
  updateProfile,
  type AuthProfile,
  useAuth,
} from "@/lib/use-auth";
import { cn } from "@/lib/utils";

type ProfileStats = {
  questions: number;
  answers: number;
  itineraries: number;
};

export function ProfileSpace() {
  const { user, profile, loading } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [compressedAvatar, setCompressedAvatar] =
    useState<CompressedImage | null>(null);
  const [stats, setStats] = useState<ProfileStats>({
    questions: 0,
    answers: 0,
    itineraries: 0,
  });
  const [saving, setSaving] = useState(false);
  const [loadingStats, setLoadingStats] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDisplayName(profile?.display_name || getAuthDisplayName(user));
    setBio(profile?.bio ?? "");
    setAvatarUrl(profile?.avatar_url ?? "");
  }, [profile, user]);

  useEffect(() => {
    return () => {
      if (compressedAvatar?.previewUrl) {
        URL.revokeObjectURL(compressedAvatar.previewUrl);
      }
    };
  }, [compressedAvatar]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const userId = user.id;

    async function loadStats() {
      setLoadingStats(true);
      const [questions, answers, itineraries] = await Promise.all([
        supabase
          .from("questions")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("wall_type", "travel"),
        supabase
          .from("answers")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId),
        supabase
          .from("itineraries")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId),
      ]);

      if (cancelled) return;
      setStats({
        questions: questions.count ?? 0,
        answers: answers.count ?? 0,
        itineraries: itineraries.count ?? 0,
      });
      setLoadingStats(false);
    }

    void loadStats();
    return () => {
      cancelled = true;
    };
  }, [user]);

  async function handleAvatarFileChange(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setError(null);
    setMessage(null);
    try {
      const nextAvatar = await compressTripImage(file);
      setCompressedAvatar((current) => {
        if (current?.previewUrl) URL.revokeObjectURL(current.previewUrl);
        return nextAvatar;
      });
      setAvatarUrl("");
    } catch (avatarError) {
      setError(
        avatarError instanceof Error
          ? avatarError.message
          : "頭像處理失敗，請改用圖片網址。"
      );
    }
  }

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || saving) return;
    if (!displayName.trim()) {
      setError("請填寫暱稱。");
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);

    const oldAvatarUrl = profile?.avatar_url ?? null;
    let finalAvatarUrl = avatarUrl.trim();
    let uploadedAvatarUrl: string | null = null;

    if (compressedAvatar) {
      try {
        finalAvatarUrl = await uploadProfileImage(
          compressedAvatar.file,
          user.id
        );
        uploadedAvatarUrl = finalAvatarUrl;
      } catch (uploadError) {
        setSaving(false);
        setError(
          uploadError instanceof Error
            ? uploadError.message
            : "頭像上傳失敗，請稍後再試。"
        );
        return;
      }
    }

    const result = await updateProfile(user, {
      display_name: displayName,
      bio,
      avatar_url: finalAvatarUrl,
    });

    if (result.error) {
      if (uploadedAvatarUrl) {
        const cleanup = await removeProfileImageByUrl(uploadedAvatarUrl);
        if (cleanup.error) console.warn("清理未使用頭像失敗", cleanup.error);
      }
      setSaving(false);
      setError(result.error);
      return;
    }

    if (
      oldAvatarUrl &&
      oldAvatarUrl !== finalAvatarUrl &&
      isProfileImageUrl(oldAvatarUrl)
    ) {
      const cleanup = await removeProfileImageByUrl(oldAvatarUrl);
      if (cleanup.error) console.warn("清理舊頭像失敗", cleanup.error);
    }

    setCompressedAvatar((current) => {
      if (current?.previewUrl) URL.revokeObjectURL(current.previewUrl);
      return null;
    });
    syncDraft(result.data);
    setSaving(false);
    setMessage("個人資料已更新。");
  }

  function syncDraft(nextProfile: AuthProfile | null) {
    if (!user) return;
    setDisplayName(nextProfile?.display_name || getAuthDisplayName(user));
    setBio(nextProfile?.bio ?? "");
    setAvatarUrl(nextProfile?.avatar_url ?? "");
  }

  if (loading) {
    return (
      <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="h-36 animate-pulse rounded-xl bg-muted" />
      </section>
    );
  }

  if (!user) {
    return (
      <section className="rounded-xl border border-border bg-card p-6 text-center shadow-sm">
        <UserRound className="mx-auto h-10 w-10 text-primary" />
        <h2 className="mt-3 text-2xl font-semibold">請先登入</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          登入後可以編輯暱稱、頭像和自我介紹，並集中查看自己的旅行內容數量。
        </p>
      </section>
    );
  }

  const previewAvatar = compressedAvatar?.previewUrl || avatarUrl;

  return (
    <section className="grid gap-4" aria-label="個人資料">
      <form
        onSubmit={handleSave}
        className="grid gap-5 rounded-xl border border-border bg-card p-4 shadow-sm lg:grid-cols-[16rem_1fr] lg:p-5"
      >
        <div className="rounded-xl border border-border bg-background/55 p-4">
          <div className="mx-auto grid h-32 w-32 place-items-center overflow-hidden rounded-full border border-border bg-muted">
            {previewAvatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewAvatar}
                alt={`${displayName || "旅人"} 的頭像`}
                className="h-full w-full object-cover"
              />
            ) : (
              <UserRound className="h-12 w-12 text-muted-foreground" />
            )}
          </div>

          <div className="mt-4 flex flex-col gap-2">
            <label className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-full border border-border bg-card px-3 text-sm font-medium transition hover:border-primary/60 hover:text-primary">
              <Upload className="h-4 w-4" />
              上傳頭像
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleAvatarFileChange}
                className="sr-only"
              />
            </label>
            {compressedAvatar ? (
              <p className="text-center text-xs text-muted-foreground">
                {formatFileSize(compressedAvatar.originalSize)} →{" "}
                {formatFileSize(compressedAvatar.compressedSize)}
              </p>
            ) : null}
            {compressedAvatar || avatarUrl ? (
              <button
                type="button"
                onClick={() => {
                  setCompressedAvatar((current) => {
                    if (current?.previewUrl) {
                      URL.revokeObjectURL(current.previewUrl);
                    }
                    return null;
                  });
                  setAvatarUrl("");
                }}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-border bg-card px-3 text-sm text-muted-foreground transition hover:border-destructive/60 hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
                移除頭像
              </button>
            ) : null}
          </div>
        </div>

        <div className="grid gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              TripWall Profile
            </p>
            <h2 className="mt-1 text-3xl font-semibold tracking-tight">
              個人資料
            </h2>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="暱稱" icon={<UserRound className="h-4 w-4" />}>
              <input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                maxLength={30}
                className="field-input pl-9"
              />
            </Field>
            <Field label="Email" icon={<Mail className="h-4 w-4" />}>
              <input
                value={user.email ?? ""}
                readOnly
                className="field-input pl-9 opacity-70"
              />
            </Field>
            <Field label="頭像網址" icon={<ImagePlus className="h-4 w-4" />}>
              <input
                value={avatarUrl}
                onChange={(event) => {
                  if (event.target.value.trim() && compressedAvatar) {
                    setCompressedAvatar((current) => {
                      if (current?.previewUrl) {
                        URL.revokeObjectURL(current.previewUrl);
                      }
                      return null;
                    });
                  }
                  setAvatarUrl(event.target.value);
                }}
                placeholder="https://example.com/avatar.jpg"
                className="field-input pl-9"
              />
            </Field>
          </div>

          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">
              自我介紹
            </span>
            <textarea
              value={bio}
              onChange={(event) => setBio(event.target.value)}
              maxLength={240}
              rows={4}
              placeholder="寫一點你的旅行風格，例如喜歡城市散步、咖啡店、夜景或省錢路線。"
              className={cn(
                "mt-1 w-full resize-none rounded-xl border border-border/70 bg-background/70 px-3 py-2",
                "text-sm leading-relaxed placeholder:text-muted-foreground/60",
                "transition-colors focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-ring/30"
              )}
            />
            <p className="mt-1 text-right text-xs text-muted-foreground">
              {bio.length} / 240
            </p>
          </label>

          {message ? <p className="text-sm text-primary">{message}</p> : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <div className="flex justify-end">
            <motion.button
              type="submit"
              disabled={saving}
              whileTap={saving ? undefined : { scale: 0.97 }}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 disabled:cursor-not-allowed disabled:opacity-55"
            >
              <Save className="h-4 w-4" />
              {saving ? "儲存中" : "儲存個人資料"}
            </motion.button>
          </div>
        </div>
      </form>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          icon={<FileText className="h-4 w-4" />}
          label="我的心得"
          value={stats.questions}
          loading={loadingStats}
        />
        <StatCard
          icon={<MessageCircle className="h-4 w-4" />}
          label="我的留言"
          value={stats.answers}
          loading={loadingStats}
        />
        <StatCard
          icon={<CalendarDays className="h-4 w-4" />}
          label="我的行程表"
          value={stats.itineraries}
          loading={loadingStats}
        />
      </div>
      <AdminModerationPanel enabled={profile?.role === "admin"} />
    </section>
  );
}

function Field({
  label,
  icon,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="relative mt-1">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
          {icon}
        </span>
        {children}
      </div>
    </label>
  );
}

function StatCard({
  icon,
  label,
  value,
  loading,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  loading: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-primary/10 text-primary">
          {icon}
        </span>
        {label}
      </p>
      <p className="mt-4 text-3xl font-semibold">
        {loading ? "..." : value.toLocaleString("zh-TW")}
      </p>
    </div>
  );
}
