"use client";

import { useCallback, useEffect, useState } from "react";

import { getAnonId } from "@/lib/anon-id";
import { normalizeItineraryDays } from "@/lib/itinerary-days";
import { supabase } from "@/lib/supabase";
import { AUTH_OWNERSHIP_CHANGED_EVENT, useAuth } from "@/lib/use-auth";
import type { Itinerary } from "@/types/database";

function normalizeItineraryRow(row: Itinerary): Itinerary {
  return {
    ...row,
    tags: Array.isArray(row.tags) ? row.tags.filter(Boolean) : [],
    days: normalizeItineraryDays(row.days),
    notes: row.notes ?? "",
    author_name: row.author_name || "匿名旅人",
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

export function useItineraries(country: string, scope: ItineraryScope) {
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
        if (userId) query.or(`author_anon_id.eq.${anonId},user_id.eq.${userId}`);
        else query.eq("author_anon_id", anonId);
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
          : "讀取行程表資料時發生未知錯誤。"
      );
      setItineraries([]);
    } finally {
      setLoading(false);
    }
  }, [country, scope, userId]);

  useEffect(() => {
    if (scope === "mine" && authLoading) {
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();

    const channel = supabase
      .channel("itineraries-feed")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "itineraries" },
        () => {
          void load();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [authLoading, load, scope]);

  useEffect(() => {
    if (scope !== "mine") return;
    const reloadMine = () => {
      void load();
    };
    window.addEventListener(AUTH_OWNERSHIP_CHANGED_EVENT, reloadMine);
    return () => {
      window.removeEventListener(AUTH_OWNERSHIP_CHANGED_EVENT, reloadMine);
    };
  }, [load, scope]);

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
          title: `${itinerary.title}（複製）`,
          country: itinerary.country,
          city: itinerary.city,
          author_name: itinerary.author_name,
          trip_days: itinerary.trip_days,
          budget_amount: itinerary.budget_amount,
          trip_style: itinerary.trip_style,
          tags: Array.isArray(itinerary.tags) ? itinerary.tags : [],
          days: normalizeItineraryDays(itinerary.days),
          notes: itinerary.notes ?? "",
          author_anon_id: getAnonId(),
          user_id: currentUser?.id ?? null,
          is_public: true,
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
    loading: loading || (scope === "mine" && authLoading),
    error,
    reload: load,
    deleteItinerary,
    updateItinerary,
    copyItinerary,
  };
}
