"use client";

import { ImagePlus, MapPin, Send, Upload, X } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";

import { BudgetSlider } from "@/components/budget-slider";
import { Textarea } from "@/components/ui/textarea";
import { getAnonId } from "@/lib/anon-id";
import {
  compressTripImage,
  formatFileSize,
  removeTripImageByUrl,
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

const MAX_CONTENT_LENGTH = 1200;
const MAX_IMAGES = 3;

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
  const [compressedImages, setCompressedImages] = useState<CompressedImage[]>(
    []
  );
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const length = content.length;
  const nearLimit = length / MAX_CONTENT_LENGTH >= 0.85;
  const imageUrlCount = imageUrl.trim() ? 1 : 0;
  const imageCount = imageUrlCount + compressedImages.length;
  const canUploadMoreImages = imageCount < MAX_IMAGES;

  const previewImages = useMemo(
    () => compressedImages.map((image) => image.previewUrl),
    [compressedImages]
  );

  useEffect(() => {
    return () => {
      compressedImages.forEach((image) => URL.revokeObjectURL(image.previewUrl));
    };
  }, [compressedImages]);

  async function handleImageFileChange(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0) return;

    const remainingSlots = MAX_IMAGES - imageUrlCount - compressedImages.length;
    if (remainingSlots <= 0) {
      setError(`最多只能放 ${MAX_IMAGES} 張圖片。`);
      return;
    }

    setError(null);
    try {
      const nextImages = await Promise.all(
        files.slice(0, remainingSlots).map((file) => compressTripImage(file))
      );
      setCompressedImages((current) => [...current, ...nextImages]);
      if (files.length > remainingSlots) {
        setError(`已保留前 ${remainingSlots} 張圖片，單篇貼文最多 ${MAX_IMAGES} 張。`);
      }
    } catch (imageError) {
      setError(
        imageError instanceof Error
          ? imageError.message
          : "圖片壓縮失敗，請改用 JPG、PNG 或 WebP。"
      );
    }
  }

  function removeCompressedImage(index: number) {
    setCompressedImages((current) => {
      const target = current[index];
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return current.filter((_, itemIndex) => itemIndex !== index);
    });
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
      setError("請填寫標題、地點、國家或城市，以及旅行心得。");
      return;
    }

    if (imageCount > MAX_IMAGES) {
      setError(`單篇貼文最多 ${MAX_IMAGES} 張圖片。`);
      return;
    }

    setSubmitting(true);
    setError(null);

    const {
      data: { session },
    } = await supabase.auth.getSession();
    const currentUser = session?.user ?? user;
    const uploadedImageUrls: string[] = [];

    if (trimmedImageUrl) {
      const imageProblem = await validateLoadableImageUrl(trimmedImageUrl);
      if (imageProblem) {
        setSubmitting(false);
        setError(imageProblem);
        return;
      }
    }

    if (compressedImages.length > 0 && !currentUser) {
      setSubmitting(false);
      setError("請先登入，才能上傳圖片到 TripWall。");
      return;
    }

    try {
      for (const image of compressedImages) {
        if (!currentUser) break;
        uploadedImageUrls.push(await uploadTripImage(image.file, currentUser.id));
      }
    } catch (uploadError) {
      await Promise.all(uploadedImageUrls.map((url) => removeTripImageByUrl(url)));
      setSubmitting(false);
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "圖片上傳失敗，請稍後再試。"
      );
      return;
    }

    const imageUrls = [trimmedImageUrl, ...uploadedImageUrls]
      .filter(Boolean)
      .slice(0, MAX_IMAGES);

    const payload = {
      title: trimmedTitle,
      location: trimmedLocation,
      country: trimmedCountry,
      category,
      season,
      budget_level: budgetLevelFromAmount(budgetAmount),
      budget_amount: budgetAmount,
      tags: normalizeTags(tags),
      image_url: imageUrls[0] || null,
      image_urls: imageUrls,
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
      await Promise.all(uploadedImageUrls.map((url) => removeTripImageByUrl(url)));
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
    setCompressedImages((current) => {
      current.forEach((image) => URL.revokeObjectURL(image.previewUrl));
      return [];
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
            發布旅行靈感
          </h2>
        </div>
        <span className="hidden rounded-full border border-border bg-muted px-3 py-1 text-xs text-muted-foreground sm:inline-flex">
          {user ? "會同步到你的個人資料" : "登入後可保留作者資料"}
        </span>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            aria-label="關閉發布表單"
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
            placeholder="例如：東京雨夜拉麵散步"
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
              placeholder="新宿、弘大、信義區..."
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
        <Field label={`圖片（${imageCount}/${MAX_IMAGES}）`}>
          <div className="relative">
            <ImagePlus className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={imageUrl}
              onChange={(event) => setImageUrl(event.target.value)}
              placeholder="https://example.com/photo.jpg"
              className="field-input pl-9"
            />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <label
              className={cn(
                "inline-flex min-h-9 items-center justify-center gap-2 rounded-full border px-3 text-xs font-medium transition",
                canUploadMoreImages
                  ? "cursor-pointer border-border bg-background/70 hover:border-primary/60 hover:text-primary"
                  : "cursor-not-allowed border-border bg-muted text-muted-foreground/60"
              )}
            >
              <Upload className="h-3.5 w-3.5" />
              上傳圖片
              <input
                type="file"
                multiple
                disabled={!canUploadMoreImages}
                accept="image/jpeg,image/png,image/webp"
                onChange={handleImageFileChange}
                className="sr-only"
              />
            </label>
            <span className="text-xs text-muted-foreground">
              會自動壓縮，最多 {MAX_IMAGES} 張。
            </span>
          </div>
          {previewImages.length > 0 ? (
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {compressedImages.map((image, index) => (
                <div
                  key={image.previewUrl}
                  className="overflow-hidden rounded-xl border border-border bg-background/65"
                >
                  <div className="relative aspect-[4/3]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={image.previewUrl}
                      alt={`上傳圖片預覽 ${index + 1}`}
                      className="h-full w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeCompressedImage(index)}
                      aria-label="移除圖片"
                      className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-background/90 text-muted-foreground shadow transition hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <p className="px-3 py-2 text-xs text-muted-foreground">
                    {formatFileSize(image.originalSize)} 變成{" "}
                    {formatFileSize(image.compressedSize)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              外部圖片網址需要是可直接載入的圖片檔，Google Photos 分享連結通常不會直接顯示。
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
          placeholder="分享你覺得值得收藏的路線、店家、避雷點或當下感受。"
          maxLength={MAX_CONTENT_LENGTH}
          rows={5}
          disabled={submitting}
          className="mt-1 resize-none border-border bg-background/70 text-sm leading-relaxed"
        />
        <div className="mt-2 flex items-center gap-3">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
            <motion.div
              initial={false}
              animate={{
                width: `${Math.min(
                  (length / MAX_CONTENT_LENGTH) * 100,
                  100
                )}%`,
              }}
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
            {length} / {MAX_CONTENT_LENGTH}
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
