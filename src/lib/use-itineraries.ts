"use client";

import { useCallback, useEffect, useState } from "react";

import { getAnonId } from "@/lib/anon-id";
import { normalizeItineraryDays } from "@/lib/itinerary-days";
import { DEFAULT_BUDGET_AMOUNT } from "@/lib/trip-budget";
import { supabase } from "@/lib/supabase";
import { AUTH_OWNERSHIP_CHANGED_EVENT, useAuth } from "@/lib/use-auth";
import type { Itinerary } from "@/types/database";

function normalizeText(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function normalizeNumber(value: unknown, fallback: number): number {
  const numericValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
}

function normalizeDate(value: unknown, fallback?: unknown): string {
  const candidate = typeof value === "string" && value ? value : fallback;
  if (typeof candidate !== "string" || !candidate) return new Date().toISOString();
  const date = new Date(candidate);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : candidate;
}

function normalizeTagArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((tag): tag is string => typeof tag === "string" && Boolean(tag.trim()));
}

function normalizeItineraryRow(row: Itinerary): Itinerary {
  const raw = row as Record<string, unknown>;
  const days = normalizeItineraryDays(raw.days);
  const tripDays = normalizeNumber(raw.trip_days, days.length || 1);

  return {
    ...row,
    title: normalizeText(raw.title, "未命名行程"),
    country: normalizeText(raw.country, "未指定國家"),
    city: normalizeText(raw.city, "未指定城市"),
    trip_days: tripDays > 0 ? tripDays : days.length || 1,
    budget_amount: normalizeNumber(raw.budget_amount, DEFAULT_BUDGET_AMOUNT),
    trip_style: normalizeText(raw.trip_style, "自由行"),
    tags: normalizeTagArray(raw.tags),
    days,
    notes: typeof raw.notes === "string" ? raw.notes : "",
    author_name: normalizeText(raw.author_name, "匿名旅人"),
    is_public: raw.is_public === false ? false : true,
    is_hidden: raw.is_hidden === true ? true : false,
    hidden_reason: typeof raw.hidden_reason === "string" ? raw.hidden_reason : null,
    created_at: normalizeDate(raw.created_at),
    updated_at: normalizeDate(raw.updated_at, raw.created_at),
  };
}

export type ItineraryScope = "public" | "mine";
export type ItineraryPayload = Pick<
  Itinerary,
  | "title"
  | "country"
  | "city"
  | "author_name"
  | "trip_days"
  | "budget_amount"
  | "trip_style"
  | "tags"
  | "days"
  | "notes"
>;

export function useItineraries(
  country: string,
  scope: ItineraryScope,
  options: { enabled?: boolean } = {}
) {
  const enabled = options.enabled ?? true;
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? null;
  const [itineraries, setItineraries] = useState<Itinerary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const query = supabase
        .from("itineraries")
        .select("*")
        .eq("is_public", true)
        .or("is_hidden.eq.false,is_hidden.is.null")
        .order("created_at", { ascending: false });

      if (country.trim()) query.ilike("country", `%${country.trim()}%`);
      if (scope === "mine") {
        const anonId = getAnonId();
        if (userId) query.eq("user_id", userId);
        else query.is("user_id", null).eq("author_anon_id", anonId);
      }

      const { data, error: fetchError } = await query;
      if (fetchError) {
        setError(fetchError.message);
        setItineraries([]);
        return;
      }

      setItineraries(((data ?? []) as Itinerary[]).map(normalizeItineraryRow));
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "讀取行程表資料時發生錯誤，請稍後再試"
      );
      setItineraries([]);
    } finally {
      setLoading(false);
    }
  }, [country, scope, userId]);

  useEffect(() => {
    if (!enabled) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(false);
      return;
    }

    if (scope === "mine" && authLoading) {
      return;
    }

    void load();

    const channelName = [
      "itineraries-feed",
      scope,
      country.trim() || "all",
      Date.now().toString(),
      Math.random().toString(36).slice(2),
    ].join("-");

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "itineraries" },
        () => {
          void load();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [authLoading, country, enabled, load, scope]);

  useEffect(() => {
    if (!enabled || scope !== "mine") return;
    const reloadMine = () => {
      void load();
    };
    window.addEventListener(AUTH_OWNERSHIP_CHANGED_EVENT, reloadMine);
    return () => {
      window.removeEventListener(AUTH_OWNERSHIP_CHANGED_EVENT, reloadMine);
    };
  }, [enabled, load, scope]);

  const deleteItinerary = useCallback(async (id: string) => {
    const { error: deleteError } = await supabase.rpc("delete_itinerary", {
      itinerary_id: id,
      anon: getAnonId(),
    });
    if (deleteError) return { error: deleteError.message };
    setItineraries((prev) => prev.filter((item) => item.id !== id));
    return { error: null };
  }, []);

  const updateItinerary = useCallback(
    async (id: string, payload: ItineraryPayload) => {
      const { data, error: updateError } = await supabase.rpc(
        "update_itinerary",
        {
          itinerary_id: id,
          anon: getAnonId(),
          next_title: payload.title,
          next_country: payload.country,
          next_city: payload.city,
          next_author_name: payload.author_name,
          next_trip_days: payload.trip_days,
          next_budget_amount: payload.budget_amount,
          next_trip_style: payload.trip_style,
          next_tags: payload.tags,
          next_days: normalizeItineraryDays(payload.days),
          next_notes: payload.notes,
        }
      );

      if (updateError) return { error: updateError.message };
      setItineraries((prev) =>
        prev.map((item) =>
          item.id === id ? normalizeItineraryRow(data as Itinerary) : item
        )
      );
      return { error: null };
    },
    []
  );

  const copyItinerary = useCallback(
    async (itinerary: Itinerary) => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const currentUser = session?.user ?? user;
      const { data, error: insertError } = await supabase
        .from("itineraries")
        .insert({
          title: `${normalizeText(itinerary.title, "未命名行程")}（複製）`,
          country: normalizeText(itinerary.country, "未指定國家"),
          city: normalizeText(itinerary.city, "未指定城市"),
          author_name: normalizeText(itinerary.author_name, "匿名旅人"),
          trip_days: normalizeNumber(itinerary.trip_days, normalizeItineraryDays(itinerary.days).length || 1),
          budget_amount: normalizeNumber(itinerary.budget_amount, DEFAULT_BUDGET_AMOUNT),
          trip_style: normalizeText(itinerary.trip_style, "自由行"),
          tags: normalizeTagArray(itinerary.tags),
          days: normalizeItineraryDays(itinerary.days),
          notes: typeof itinerary.notes === "string" ? itinerary.notes : "",
          author_anon_id: getAnonId(),
          user_id: currentUser?.id ?? null,
          is_public: true,
          is_hidden: false,
          hidden_reason: null,
        })
        .select("*")
        .single();

      if (insertError) return { error: insertError.message };
      const normalized = normalizeItineraryRow(data as Itinerary);
      setItineraries((prev) => [normalized, ...prev]);
      return { error: null, itinerary: normalized };
    },
    [user]
  );

  return {
    itineraries,
    loading: enabled && (loading || (scope === "mine" && authLoading)),
    error,
    reload: load,
    deleteItinerary,
    updateItinerary,
    copyItinerary,
  };
}
