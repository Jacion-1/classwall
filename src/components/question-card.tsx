"use client";

import {
  Bookmark,
  CalendarDays,
  Heart,
  ImagePlus,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Save,
  Trash2,
  Upload,
  WalletCards,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { memo, useEffect, useState } from "react";

import { AnswerSection } from "@/components/answer-section";
import { AuthorProfileButton } from "@/components/author-profile-button";
import { BudgetSlider } from "@/components/budget-slider";
import { ReportButton } from "@/components/report-button";
import { Textarea } from "@/components/ui/textarea";
import { getAnonId } from "@/lib/anon-id";
import {
  compressTripImage,
  formatFileSize,
  isTripImageUrl,
  removeTripImageByUrl,
  uploadTripImage,
  type CompressedImage,
} from "@/lib/image-upload";
import { validateLoadableImageUrl } from "@/lib/image-url";
import { useAnswerCount } from "@/lib/use-answer-count";
import {
  addLiked,
  addSaved,
  hasLiked,
  hasSaved,
  removeLiked,
  removeSaved,
} from "@/lib/liked-store";
import { supabase } from "@/lib/supabase";
import {
  budgetLevelFromAmount,
  defaultBudgetAmountForLevel,
  formatTripBudget,
} from "@/lib/trip-budget";
import { TRIP_TAGS, normalizeTags } from "@/lib/trip-tags";
import { useAuth } from "@/lib/use-auth";
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
  budget_amount: number;
  season: TripSeason;
  tags: string[];
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

function getBudgetAmount(question: Question): number {
  return (
    question.budget_amount ?? defaultBudgetAmountForLevel(question.budget_level)
  );
}

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
    budget_amount: getBudgetAmount(question),
    season: question.season,
    tags: question.tags ?? [],
    image_url: question.image_url ?? "",
    content: question.content,
  };
}

function QuestionCardImpl({ question }: Props) {
  const { user } = useAuth();
  const answerCount = useAnswerCount(question.id);
  const [localQuestion, setLocalQuestion] = useState<Question | null>(null);
  const [pendingLike, setPendingLike] = useState(false);
  const [pendingSave, setPendingSave] = useState(false);
  const [alreadyLiked, setAlreadyLiked] = useState(false);
  const [alreadySaved, setAlreadySaved] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [isMine, setIsMine] = useState(false);
  const [removed, setRemoved] = useState(false);

  const displayQuestion =
    localQuestion?.id === question.id ? localQuestion : question;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAlreadyLiked(hasLiked(displayQuestion.id));
    setAlreadySaved(hasSaved(displayQuestion.id));
    setIsMine(
      displayQuestion.author_anon_id === getAnonId() ||
        Boolean(user?.id && displayQuestion.user_id === user.id)
    );
  }, [
    displayQuestion.author_anon_id,
    displayQuestion.id,
    displayQuestion.user_id,
    user?.id,
  ]);

  async function handleLike() {
    if (pendingLike) return;
    setPendingLike(true);

    const rpcName = alreadyLiked
      ? "decrement_question_like"
      : "increment_question_like";
    const { data, error } = await supabase.rpc(rpcName, {
      qid: displayQuestion.id,
      anon: getAnonId(),
    });

    setPendingLike(false);
    if (error) {
      console.error(alreadyLiked ? "取消想去失敗" : "標記想去失敗", error);
      return;
    }

    const nextLikes =
      typeof data === "number"
        ? data
        : alreadyLiked
          ? Math.max(displayQuestion.likes - 1, 0)
          : displayQuestion.likes + 1;

    if (alreadyLiked) {
      removeLiked(displayQuestion.id);
      setAlreadyLiked(false);
    } else {
      addLiked(displayQuestion.id);
      setAlreadyLiked(true);
    }

    setLocalQuestion((current) => ({
      ...(current ?? displayQuestion),
      likes: nextLikes,
    }));
  }

  async function handleSave() {
    if (pendingSave) return;
    setPendingSave(true);

    const rpcName = alreadySaved
      ? "decrement_trip_save"
      : "increment_trip_save";
    const { data, error } = await supabase.rpc(rpcName, {
      qid: displayQuestion.id,
      anon: getAnonId(),
    });

    setPendingSave(false);
    if (error) {
      console.error(alreadySaved ? "取消收藏失敗" : "收藏失敗", error);
      return;
    }

    const currentSaves = displayQuestion.saves ?? 0;
    const nextSaves =
      typeof data === "number"
        ? data
        : alreadySaved
          ? Math.max(currentSaves - 1, 0)
          : currentSaves + 1;

    if (alreadySaved) {
      removeSaved(displayQuestion.id);
      setAlreadySaved(false);
    } else {
      addSaved(displayQuestion.id);
      setAlreadySaved(true);
    }

    setLocalQuestion((current) => ({
      ...(current ?? displayQuestion),
      saves: nextSaves,
    }));
  }

  if (removed) return null;

  return (
    <>
      <motion.article
        layout
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.24 }}
        className="group flex h-full w-full max-w-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-lg"
      >
        <TripImageGallery question={displayQuestion} compact />

        <div className="flex min-w-0 flex-1 flex-col p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Tag>{categoryLabels[displayQuestion.category]}</Tag>
            <Tag>{seasonLabels[displayQuestion.season]}</Tag>
            <Tag>
              <WalletCards className="h-3.5 w-3.5" />
              {formatTripBudget(getBudgetAmount(displayQuestion))}
            </Tag>
            <Tag>
              {
                budgetLabels[
                  budgetLevelFromAmount(getBudgetAmount(displayQuestion))
                ]
              }
            </Tag>
            {(displayQuestion.tags ?? []).map((tag) => (
              <Tag key={tag}>{tag}</Tag>
            ))}
            {isMine ? <Tag>我的貼文</Tag> : null}
          </div>

          <div className="mt-4 flex min-w-0 flex-col gap-2">
            <p className="flex min-w-0 items-center gap-1.5 truncate text-sm text-muted-foreground">
              <MapPin className="h-4 w-4 text-primary" />
              {displayQuestion.country} / {displayQuestion.location}
            </p>
            <h3 className="line-clamp-2 text-lg font-semibold leading-snug tracking-tight group-hover:text-primary">
              {displayQuestion.title}
            </h3>
            <p className="line-clamp-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
              {displayQuestion.content}
            </p>
          </div>

          <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-5">
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
                <span className="tabular-nums">{answerCount}</span>
              </button>
              <button
                type="button"
                onClick={() => setDetailsOpen(true)}
                aria-label="更多操作"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background/70 text-muted-foreground transition hover:border-primary/60 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
              >
                <MoreHorizontal className="h-4 w-4" />
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
          onDeleted={() => setRemoved(true)}
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
  onDeleted,
}: {
  question: Question;
  isMine: boolean;
  onClose: () => void;
  onUpdated: (question: Question) => void;
  onDeleted: () => void;
}) {
  const { user } = useAuth();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<EditDraft>(() => toDraft(question));
  const [compressedImage, setCompressedImage] =
    useState<CompressedImage | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (compressedImage?.previewUrl) {
        URL.revokeObjectURL(compressedImage.previewUrl);
      }
    };
  }, [compressedImage]);

  async function handleImageFileChange(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setError(null);
    try {
      const nextImage = await compressTripImage(file);
      setCompressedImage((current) => {
        if (current?.previewUrl) URL.revokeObjectURL(current.previewUrl);
        return nextImage;
      });
      setDraft((current) => ({ ...current, image_url: "" }));
    } catch (imageError) {
      setError(
        imageError instanceof Error
          ? imageError.message
          : "圖片處理失敗，請改用圖片網址。"
      );
    }
  }

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

    let finalImageUrl = draft.image_url.trim();
    let uploadedImageUrl: string | null = null;
    if (compressedImage) {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const currentUser = session?.user ?? user;
      if (!currentUser) {
        setSaving(false);
        setError("請先登入再上傳圖片，或改用可公開讀取的圖片網址。");
        return;
      }

      try {
        finalImageUrl = await uploadTripImage(
          compressedImage.file,
          currentUser.id
        );
        uploadedImageUrl = finalImageUrl;
      } catch (uploadError) {
        setSaving(false);
        setError(
          uploadError instanceof Error
            ? uploadError.message
            : "圖片上傳失敗，請稍後再試。"
        );
        return;
      }
    } else {
      const imageProblem = await validateLoadableImageUrl(finalImageUrl);
      if (imageProblem) {
        setSaving(false);
        setError(imageProblem);
        return;
      }
    }

    const { data, error: updateError } = await supabase.rpc(
      "update_trip_post",
      {
        qid: question.id,
        anon: getAnonId(),
        next_title: draft.title,
        next_location: draft.location,
        next_country: draft.country,
        next_category: draft.category,
        next_budget_level: budgetLevelFromAmount(draft.budget_amount),
        next_budget_amount: draft.budget_amount,
        next_season: draft.season,
        next_tags: normalizeTags(draft.tags),
        next_image_url: finalImageUrl,
        next_content: draft.content,
      }
    );
    setSaving(false);

    if (updateError) {
      if (uploadedImageUrl) {
        const cleanup = await removeTripImageByUrl(uploadedImageUrl);
        if (cleanup.error) console.warn("清理未使用圖片失敗", cleanup.error);
      }
      setError(updateError.message);
      return;
    }

    if (
      question.image_url &&
      question.image_url !== finalImageUrl &&
      isTripImageUrl(question.image_url)
    ) {
      const cleanup = await removeTripImageByUrl(question.image_url);
      if (cleanup.error) console.warn("清理舊圖片失敗", cleanup.error);
    }

    setCompressedImage((current) => {
      if (current?.previewUrl) URL.revokeObjectURL(current.previewUrl);
      return null;
    });
    onUpdated(data as Question);
    setEditing(false);
  }

  async function handleDelete() {
    if (deleting) return;
    const confirmed = window.confirm("確定要刪除這則旅行心得嗎？");
    if (!confirmed) return;

    setDeleting(true);
    setError(null);

    const { error: deleteError } = await supabase.rpc("delete_trip_post", {
      qid: question.id,
      anon: getAnonId(),
    });
    setDeleting(false);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    const cleanup = await removeTripImageByUrl(question.image_url);
    if (cleanup.error) console.warn("刪除貼文圖片失敗", cleanup.error);
    await Promise.all(
      (question.image_urls ?? [])
        .filter((url) => url !== question.image_url)
        .map((url) => removeTripImageByUrl(url))
    );
    removeSaved(question.id);
    onDeleted();
    onClose();
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
          <TripImageGallery question={question} />
          <div className="p-4 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="flex min-w-0 items-center gap-1.5 truncate text-sm text-muted-foreground">
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
              <AuthorProfileButton userId={question.user_id} />
              <Tag>{categoryLabels[question.category]}</Tag>
              <Tag>{seasonLabels[question.season]}</Tag>
              <Tag>{formatTripBudget(getBudgetAmount(question))}</Tag>
              <Tag>
                {budgetLabels[budgetLevelFromAmount(getBudgetAmount(question))]}
              </Tag>
              {(question.tags ?? []).map((tag) => (
                <Tag key={tag}>{tag}</Tag>
              ))}
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
                  setCompressedImage((current) => {
                    if (current?.previewUrl) {
                      URL.revokeObjectURL(current.previewUrl);
                    }
                    return null;
                  });
                  setEditing(false);
                  setError(null);
                }}
                compressedImage={compressedImage}
                onImageFileChange={handleImageFileChange}
                onRemoveCompressedImage={() =>
                  setCompressedImage((current) => {
                    if (current?.previewUrl) {
                      URL.revokeObjectURL(current.previewUrl);
                    }
                    return null;
                  })
                }
                onSubmit={handleSave}
              />
            ) : (
              <>
                <p className="mt-6 whitespace-pre-wrap text-base leading-8 text-foreground/90">
                  {question.content}
                </p>
                <div className="mt-6 flex flex-wrap items-center gap-2">
                  {isMine ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setEditing(true)}
                        className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-primary/60 bg-primary/10 px-4 py-2 text-sm font-medium text-primary transition hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
                      >
                        <Pencil className="h-4 w-4" />
                        編輯貼文
                      </button>
                      <button
                        type="button"
                        onClick={handleDelete}
                        disabled={deleting}
                        className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm font-medium text-destructive transition hover:bg-destructive hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40 disabled:cursor-not-allowed disabled:opacity-55"
                      >
                        <Trash2 className="h-4 w-4" />
                        {deleting ? "刪除中" : "刪除貼文"}
                      </button>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      只有原本發布這則貼文的瀏覽器可以編輯。
                    </p>
                  )}
                </div>
                {!isMine ? (
                  <div className="mt-3">
                    <ReportButton targetType="question" targetId={question.id} />
                  </div>
                ) : null}
                {error ? (
                  <p className="mt-3 text-sm text-destructive">{error}</p>
                ) : null}
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
  compressedImage,
  onDraftChange,
  onImageFileChange,
  onRemoveCompressedImage,
  onCancel,
  onSubmit,
}: {
  draft: EditDraft;
  saving: boolean;
  error: string | null;
  compressedImage: CompressedImage | null;
  onDraftChange: (draft: EditDraft) => void;
  onImageFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveCompressedImage: () => void;
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
          <div className="relative">
            <ImagePlus className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={draft.image_url}
              onChange={(event) => {
                if (event.target.value.trim() && compressedImage) {
                  onRemoveCompressedImage();
                }
                onDraftChange({ ...draft, image_url: event.target.value });
              }}
              placeholder="https://example.com/photo.jpg"
              className="field-input pl-9"
            />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <label className="inline-flex min-h-9 cursor-pointer items-center justify-center gap-2 rounded-full border border-border bg-background/70 px-3 text-xs font-medium transition hover:border-primary/60 hover:text-primary">
              <Upload className="h-3.5 w-3.5" />
              上傳並壓縮圖片
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={onImageFileChange}
                className="sr-only"
              />
            </label>
            {compressedImage ? (
              <button
                type="button"
                onClick={onRemoveCompressedImage}
                className="inline-flex min-h-9 items-center rounded-full border border-border bg-background/70 px-3 text-xs text-muted-foreground transition hover:border-destructive/60 hover:text-destructive"
              >
                移除上傳圖片
              </button>
            ) : draft.image_url ? (
              <button
                type="button"
                onClick={() => onDraftChange({ ...draft, image_url: "" })}
                className="inline-flex min-h-9 items-center rounded-full border border-border bg-background/70 px-3 text-xs text-muted-foreground transition hover:border-destructive/60 hover:text-destructive"
              >
                清空圖片網址
              </button>
            ) : null}
          </div>
          {compressedImage ? (
            <div className="mt-2 overflow-hidden rounded-xl border border-border bg-background/65">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={compressedImage.previewUrl}
                alt="上傳圖片預覽"
                className="h-36 w-full object-cover"
              />
              <p className="px-3 py-2 text-xs text-muted-foreground">
                已壓縮：{formatFileSize(compressedImage.originalSize)} →{" "}
                {formatFileSize(compressedImage.compressedSize)}
              </p>
            </div>
          ) : (
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              可貼公開圖片網址，也可登入後直接上傳；清空後儲存會移除貼文圖片。
            </p>
          )}
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
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
      </div>
      <BudgetSlider
        value={draft.budget_amount}
        onChange={(value) =>
          onDraftChange({
            ...draft,
            budget_amount: value,
            budget_level: budgetLevelFromAmount(value),
          })
        }
      />
      <TagPicker
        value={draft.tags}
        onChange={(tags) => onDraftChange({ ...draft, tags })}
      />
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

function TagPicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (tags: string[]) => void;
}) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">旅行標籤</p>
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function TripImage({
  question,
  compact = false,
}: {
  question: Question;
  compact?: boolean;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const imageFailed = Boolean(
    question.image_url && failedUrl === question.image_url
  );

  if (question.image_url && !imageFailed) {
    return (
      <div
        className={cn(
          "relative overflow-hidden bg-muted",
          compact ? "aspect-video min-h-0" : "h-64 sm:h-80"
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- User-supplied external image URLs are intentionally not constrained to Next image domains. */}
        <img
          src={question.image_url}
          alt={question.title + " 的旅行圖片"}
          className="absolute inset-0 h-full w-full object-cover"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailedUrl(question.image_url)}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/52 via-black/8 to-transparent" />
      </div>
    );
  }

  return (
    <TravelImagePlaceholder
      compact={compact}
      country={question.country}
      failed={imageFailed}
    />
  );
}

function TripImageGallery({
  question,
  compact = false,
}: {
  question: Question;
  compact?: boolean;
}) {
  const [failedUrls, setFailedUrls] = useState<Set<string>>(() => new Set());
  const images =
    question.image_urls?.length > 0
      ? question.image_urls
      : question.image_url
        ? [question.image_url]
        : [];
  const visibleImages = images
    .filter(Boolean)
    .filter((url) => !failedUrls.has(url))
    .slice(0, 3);
  const coverImage = visibleImages[0];
  const imageFailed = images.length > 0 && visibleImages.length === 0;

  function markFailed(url: string) {
    setFailedUrls((current) => new Set(current).add(url));
  }

  if (coverImage) {
    return (
      <div
        className={cn(
          "relative overflow-hidden bg-muted",
          compact ? "aspect-video min-h-0" : "h-72 sm:h-96"
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={coverImage}
          alt={question.title + " 旅行圖片"}
          className="absolute inset-0 h-full w-full object-cover"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => markFailed(coverImage)}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/52 via-black/10 to-transparent" />
        {!compact && visibleImages.length > 1 ? (
          <div className="absolute bottom-4 left-4 right-4 grid grid-cols-3 gap-2">
            {visibleImages.map((url, index) => (
              <div
                key={url + "-" + index}
                className={cn(
                  "aspect-[4/3] overflow-hidden rounded-xl border bg-background/20 shadow-lg",
                  index === 0 ? "border-primary/80" : "border-white/55"
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={question.title + " 圖片 " + (index + 1)}
                  className="h-full w-full object-cover"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  onError={() => markFailed(url)}
                />
              </div>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <TravelImagePlaceholder
      compact={compact}
      country={question.country}
      failed={imageFailed}
    />
  );
}

function TravelImagePlaceholder({
  compact,
  country,
  failed,
}: {
  compact: boolean;
  country: string;
  failed: boolean;
}) {
  return (
    <div
      className={cn(
        "grid overflow-hidden bg-[radial-gradient(circle_at_20%_20%,color-mix(in_oklch,var(--primary)_18%,transparent),transparent_36%),linear-gradient(135deg,var(--muted),var(--background))] text-foreground",
        compact ? "aspect-video min-h-0" : "h-64 sm:h-80"
      )}
    >
      <div className="m-4 grid place-items-center rounded-2xl border border-border/80 bg-card/72 p-4 text-center shadow-sm backdrop-blur-sm sm:m-5">
        <div className="grid h-14 w-14 place-items-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
          <ImagePlus className="h-6 w-6" aria-hidden />
        </div>
        <div className="mt-3 space-y-1">
          <p className="text-sm font-semibold">
            {failed ? "圖片暫時無法顯示" : "尚未加入圖片"}
          </p>
          <p className="text-xs leading-5 text-muted-foreground">
            {failed
              ? "請使用可公開讀取的圖片直連或重新上傳圖片。"
              : "TripWall Travel Note"}
          </p>
        </div>
        <span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-border bg-background/70 px-2.5 py-1 text-xs text-muted-foreground">
          <MapPin className="h-3.5 w-3.5 text-primary" />
          {country || "旅行目的地"}
        </span>
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
    prev.question.budget_amount === next.question.budget_amount &&
    prev.question.image_url === next.question.image_url &&
    (prev.question.image_urls ?? []).join("|") ===
      (next.question.image_urls ?? []).join("|") &&
    prev.question.author_anon_id === next.question.author_anon_id &&
    prev.question.user_id === next.question.user_id &&
    prev.question.updated_at === next.question.updated_at &&
    prev.question.created_at === next.question.created_at
  );
});
