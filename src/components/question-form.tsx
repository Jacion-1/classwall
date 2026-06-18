"use client";

import { ImagePlus, MapPin, Send, Upload, X } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useState } from "react";

import { BudgetSlider } from "@/components/budget-slider";
import { Textarea } from "@/components/ui/textarea";
import { getAnonId } from "@/lib/anon-id";
import {
  compressTripImage,
  formatFileSize,
  uploadTripImage,
  type CompressedImage,
} from "@/lib/image-upload";
import { validateLoadableImageUrl } from "@/lib/image-url";
import { supabase } from "@/lib/supabase";
import {
  DEFAULT_BUDGET_AMOUNT,
  budgetLevelFromAmount,
} from "@/lib/trip-budget";
import { TRIP_TAGS, normalizeTags } from "@/lib/trip-tags";
import { useAuth } from "@/lib/use-auth";
import { cn } from "@/lib/utils";
import type { TripCategory, TripSeason } from "@/types/database";

const MAX = 1200;

const categories: Array<{ value: TripCategory; label: string }> = [
  { value: "spot", label: "景點" },
  { value: "food", label: "美食" },
  { value: "stay", label: "住宿" },
  { value: "route", label: "行程" },
  { value: "transport", label: "交通" },
  { value: "story", label: "心得" },
  { value: "inspiration", label: "靈感" },
];

const seasons: Array<{ value: TripSeason; label: string }> = [
  { value: "anytime", label: "不限季節" },
  { value: "spring", label: "春" },
  { value: "summer", label: "夏" },
  { value: "autumn", label: "秋" },
  { value: "winter", label: "冬" },
];

type QuestionFormProps = {
  className?: string;
  onCancel?: () => void;
  onSubmitted?: () => void;
};

export function QuestionForm({
  className,
  onCancel,
  onSubmitted,
}: QuestionFormProps) {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [country, setCountry] = useState("");
  const [category, setCategory] = useState<TripCategory>("inspiration");
  const [season, setSeason] = useState<TripSeason>("anytime");
  const [budgetAmount, setBudgetAmount] = useState(DEFAULT_BUDGET_AMOUNT);
  const [tags, setTags] = useState<string[]>([]);
  const [imageUrl, setImageUrl] = useState("");
  const [compressedImage, setCompressedImage] =
    useState<CompressedImage | null>(null);
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const length = content.length;
  const nearLimit = length / MAX >= 0.85;

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
      setImageUrl("");
    } catch (imageError) {
      setError(
        imageError instanceof Error
          ? imageError.message
          : "圖片處理失敗，請改用圖片網址。"
      );
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedImageUrl = imageUrl.trim();
    const trimmedTitle = title.trim();
    const trimmedLocation = location.trim();
    const trimmedCountry = country.trim();
    const trimmedContent = content.trim();

    if (
      !trimmedTitle ||
      !trimmedLocation ||
      !trimmedCountry ||
      !trimmedContent
    ) {
      setError("請填寫標題、地點、城市與旅行心得。");
      return;
    }

    setSubmitting(true);
    setError(null);

    const {
      data: { session },
    } = await supabase.auth.getSession();
    const currentUser = session?.user ?? user;
    let finalImageUrl = trimmedImageUrl;

    if (compressedImage) {
      if (!currentUser) {
        setSubmitting(false);
        setError("請先登入再上傳圖片，或改用可公開讀取的圖片網址。");
        return;
      }

      try {
        finalImageUrl = await uploadTripImage(
          compressedImage.file,
          currentUser.id
        );
      } catch (uploadError) {
        setSubmitting(false);
        setError(
          uploadError instanceof Error
            ? uploadError.message
            : "圖片上傳失敗，請稍後再試。"
        );
        return;
      }
    } else {
      const imageProblem = await validateLoadableImageUrl(trimmedImageUrl);
      if (imageProblem) {
        setSubmitting(false);
        setError(imageProblem);
        return;
      }
    }

    const payload = {
      title: trimmedTitle,
      location: trimmedLocation,
      country: trimmedCountry,
      category,
      season,
      budget_level: budgetLevelFromAmount(budgetAmount),
      budget_amount: budgetAmount,
      tags: normalizeTags(tags),
      image_url: finalImageUrl || null,
      content: trimmedContent,
      author_anon_id: getAnonId(),
      user_id: currentUser?.id ?? null,
      wall_type: "travel" as const,
    };

    const { error: insertError } = await supabase
      .from("questions")
      .insert(payload);
    setSubmitting(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setTitle("");
    setLocation("");
    setCountry("");
    setCategory("inspiration");
    setSeason("anytime");
    setBudgetAmount(DEFAULT_BUDGET_AMOUNT);
    setTags([]);
    setImageUrl("");
    setCompressedImage((current) => {
      if (current?.previewUrl) URL.revokeObjectURL(current.previewUrl);
      return null;
    });
    setContent("");
    onSubmitted?.();
  }

  return (
    <motion.form
      onSubmit={handleSubmit}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1, duration: 0.45 }}
      className={cn(
        "rounded-2xl border border-border/70 bg-card/90 p-4 shadow-xl shadow-black/5 backdrop-blur-md",
        "sm:p-5",
        className
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Share a city note
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">
            新增旅行靈感
          </h2>
        </div>
        <span className="hidden rounded-full border border-border bg-muted px-3 py-1 text-xs text-muted-foreground sm:inline-flex">
          {user ? "已登入，會同步到你的帳號" : "登入後可跨瀏覽器同步"}
        </span>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            aria-label="關閉新增表單"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-background/70 transition hover:border-primary/60 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 sm:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <Field label="標題">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={80}
            placeholder="東京雨夜拉麵散步路線"
            className="field-input"
          />
        </Field>
        <Field label="地點">
          <div className="relative">
            <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              maxLength={80}
              placeholder="新宿、惠比壽、澀谷"
              className="field-input pl-9"
            />
          </div>
        </Field>
        <Field label="國家 / 城市">
          <input
            value={country}
            onChange={(event) => setCountry(event.target.value)}
            maxLength={80}
            placeholder="日本東京"
            className="field-input"
          />
        </Field>
        <Field label="圖片網址">
          <div className="relative">
            <ImagePlus className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={imageUrl}
              onChange={(event) => {
                setImageUrl(event.target.value);
                if (event.target.value.trim()) {
                  setCompressedImage((current) => {
                    if (current?.previewUrl) {
                      URL.revokeObjectURL(current.previewUrl);
                    }
                    return null;
                  });
                }
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
                onChange={handleImageFileChange}
                className="sr-only"
              />
            </label>
            {compressedImage ? (
              <button
                type="button"
                onClick={() =>
                  setCompressedImage((current) => {
                    if (current?.previewUrl) {
                      URL.revokeObjectURL(current.previewUrl);
                    }
                    return null;
                  })
                }
                className="inline-flex min-h-9 items-center rounded-full border border-border bg-background/70 px-3 text-xs text-muted-foreground transition hover:border-destructive/60 hover:text-destructive"
              >
                移除圖片
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
              可貼公開圖片網址，也可登入後直接上傳；Google Photos
              分享頁通常不是直接圖片網址。
            </p>
          )}
        </Field>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <SelectField
          label="類型"
          value={category}
          onChange={(value) => setCategory(value as TripCategory)}
          options={categories}
        />
        <SelectField
          label="季節"
          value={season}
          onChange={(value) => setSeason(value as TripSeason)}
          options={seasons}
        />
      </div>

      <BudgetSlider
        value={budgetAmount}
        onChange={setBudgetAmount}
        className="mt-3"
      />

      <TagPicker value={tags} onChange={setTags} />

      <div className="mt-3">
        <label className="text-xs font-medium text-muted-foreground">
          旅行心得
        </label>
        <Textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="分享路線、預算感、適合誰去、實際踩點提醒，或那個讓你想再回去的瞬間。"
          maxLength={MAX}
          rows={5}
          disabled={submitting}
          className="mt-1 resize-none border-border bg-background/70 text-sm leading-relaxed"
        />
        <div className="mt-2 flex items-center gap-3">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
            <motion.div
              initial={false}
              animate={{ width: `${Math.min((length / MAX) * 100, 100)}%` }}
              className={cn(
                "h-full",
                nearLimit ? "bg-destructive" : "bg-primary"
              )}
            />
          </div>
          <span
            className={cn(
              "text-xs tabular-nums",
              nearLimit && "text-destructive"
            )}
          >
            {length} / {MAX}
          </span>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {error ? <p className="text-sm text-destructive">{error}</p> : <span />}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {onCancel ? (
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-border bg-background/70 px-5 py-2.5 text-sm font-medium transition hover:border-primary/60 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
            >
              取消
            </button>
          ) : null}
          <motion.button
            type="submit"
            disabled={submitting}
            whileTap={{ scale: 0.97 }}
            className={cn(
              "inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5",
              "text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70",
              "disabled:cursor-not-allowed disabled:opacity-55"
            )}
          >
            <Send className="h-4 w-4" />
            {submitting ? "發布中" : "發布靈感"}
          </motion.button>
        </div>
      </div>
    </motion.form>
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
