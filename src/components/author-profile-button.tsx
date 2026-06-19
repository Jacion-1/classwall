"use client";

import { CalendarDays, FileText, MapPin, UserRound, X } from "lucide-react";
import { useState } from "react";

import { supabase } from "@/lib/supabase";
import type { Itinerary, Profile, Question } from "@/types/database";

type AuthorStats = {
  profile: Profile | null;
  questions: Question[];
  itineraries: Itinerary[];
};

export function AuthorProfileButton({ userId }: { userId: string | null }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<AuthorStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!userId) return null;

  async function openAuthorProfile() {
    setOpen(true);
    if (stats || loading) return;

    setLoading(true);
    setError(null);

    const [profileResult, questionResult, itineraryResult] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, display_name, email, avatar_url, bio, role, created_at, updated_at")
        .eq("id", userId)
        .maybeSingle(),
      supabase
        .from("questions")
        .select("*")
        .eq("user_id", userId)
        .eq("wall_type", "travel")
        .eq("is_hidden", false)
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("itineraries")
        .select("*")
        .eq("user_id", userId)
        .eq("is_public", true)
        .eq("is_hidden", false)
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

    setLoading(false);

    const fetchError =
      profileResult.error?.message ||
      questionResult.error?.message ||
      itineraryResult.error?.message;
    if (fetchError) {
      setError(fetchError);
      return;
    }

    setStats({
      profile: (profileResult.data as Profile | null) ?? null,
      questions: (questionResult.data ?? []) as Question[],
      itineraries: (itineraryResult.data ?? []) as Itinerary[],
    });
  }

  const profile = stats?.profile;
  const displayName = profile?.display_name || "旅行作者";

  return (
    <>
      <button
        type="button"
        onClick={openAuthorProfile}
        className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-border bg-background/70 px-3 text-sm text-muted-foreground transition hover:border-primary/60 hover:text-primary"
      >
        <UserRound className="h-4 w-4" />
        作者
      </button>

      {open ? (
        <div className="fixed inset-0 z-[65] grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
          <section className="max-h-[88dvh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="grid h-14 w-14 place-items-center overflow-hidden rounded-full border border-border bg-muted">
                  {profile?.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={profile.avatar_url}
                      alt={`${displayName} 頭像`}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <UserRound className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    Author
                  </p>
                  <h3 className="text-2xl font-semibold">{displayName}</h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="關閉作者資訊"
                className="grid h-9 w-9 place-items-center rounded-full border border-border bg-background/70 text-muted-foreground transition hover:text-primary"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {loading ? (
              <div className="mt-5 h-32 animate-pulse rounded-xl bg-muted" />
            ) : error ? (
              <p className="mt-5 text-sm text-destructive">{error}</p>
            ) : (
              <>
                {profile?.bio ? (
                  <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-foreground/85">
                    {profile.bio}
                  </p>
                ) : (
                  <p className="mt-4 text-sm text-muted-foreground">
                    這位作者還沒有填寫個人簡介。
                  </p>
                )}

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <Stat
                    icon={<FileText className="h-4 w-4" />}
                    label="公開心得"
                    value={stats?.questions.length ?? 0}
                  />
                  <Stat
                    icon={<CalendarDays className="h-4 w-4" />}
                    label="公開行程"
                    value={stats?.itineraries.length ?? 0}
                  />
                </div>

                <AuthorList title="近期心得" items={stats?.questions ?? []} />
                <AuthorList title="近期行程" items={stats?.itineraries ?? []} />
              </>
            )}
          </section>
        </div>
      ) : null}
    </>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border border-border bg-background/60 p-3">
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        {icon}
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function AuthorList({
  title,
  items,
}: {
  title: string;
  items: Array<Question | Itinerary>;
}) {
  return (
    <div className="mt-5">
      <h4 className="text-sm font-semibold">{title}</h4>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">尚無公開內容。</p>
      ) : (
        <div className="mt-2 grid gap-2">
          {items.map((item) => {
            const place =
              "location" in item
                ? `${item.country} / ${item.location}`
                : `${item.country} / ${item.city}`;
            return (
              <div
                key={item.id}
                className="rounded-xl border border-border bg-background/60 p-3"
              >
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" />
                  {place}
                </p>
                <p className="mt-1 font-medium">{item.title}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
