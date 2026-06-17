"use client";

import { ImagePlus, MapPin, Send } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";

import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import type { BudgetLevel, TripCategory, TripSeason } from "@/types/database";

const MAX = 700;

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

const budgets: Array<{ value: BudgetLevel; label: string }> = [
  { value: "low", label: "輕預算" },
  { value: "mid", label: "中等" },
  { value: "high", label: "享受型" },
];

export function QuestionForm() {
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [country, setCountry] = useState("");
  const [category, setCategory] = useState<TripCategory>("inspiration");
  const [season, setSeason] = useState<TripSeason>("anytime");
  const [budget, setBudget] = useState<BudgetLevel>("mid");
  const [imageUrl, setImageUrl] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const length = content.length;
  const nearLimit = length / MAX >= 0.85;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = {
      title: title.trim(),
      location: location.trim(),
      country: country.trim(),
      category,
      season,
      budget_level: budget,
      image_url: imageUrl.trim() || null,
      content: content.trim(),
    };

    if (
      !payload.title ||
      !payload.location ||
      !payload.country ||
      !payload.content
    ) {
      setError("請至少填寫標題、地點、國家/城市與心得。");
      return;
    }

    setSubmitting(true);
    setError(null);

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
    setBudget("mid");
    setImageUrl("");
    setContent("");
  }

  return (
    <motion.form
      onSubmit={handleSubmit}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1, duration: 0.45 }}
      className={cn(
        "rounded-2xl border border-border/70 bg-card/88 p-4 shadow-sm backdrop-blur-md",
        "sm:p-5"
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Share a spark
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">
            新增旅行靈感
          </h2>
        </div>
        <span className="hidden rounded-full border border-border bg-muted px-3 py-1 text-xs text-muted-foreground sm:inline-flex">
          圖片先用網址，省下 Storage 用量
        </span>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <Field label="標題">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={80}
            placeholder="京都三天兩夜慢旅行"
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
              placeholder="嵐山、清水寺、鴨川"
              className="field-input pl-9"
            />
          </div>
        </Field>
        <Field label="國家 / 城市">
          <input
            value={country}
            onChange={(event) => setCountry(event.target.value)}
            maxLength={80}
            placeholder="日本京都"
            className="field-input"
          />
        </Field>
        <Field label="圖片網址">
          <div className="relative">
            <ImagePlus className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={imageUrl}
              onChange={(event) => setImageUrl(event.target.value)}
              placeholder="https://..."
              className="field-input pl-9"
            />
          </div>
        </Field>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
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
        <SelectField
          label="預算"
          value={budget}
          onChange={(value) => setBudget(value as BudgetLevel)}
          options={budgets}
        />
      </div>

      <div className="mt-3">
        <label className="text-xs font-medium text-muted-foreground">
          旅行心得
        </label>
        <Textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="分享路線、適合誰去、預算感、注意事項，或只是那個讓你想再去一次的瞬間。"
          maxLength={MAX}
          rows={4}
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
    </motion.form>
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
