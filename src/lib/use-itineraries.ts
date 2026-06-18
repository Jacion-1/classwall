"use client";

import { useCallback, useEffect, useState } from "react";

import { getAnonId } from "@/lib/anon-id";
import { supabase } from "@/lib/supabase";
import type { Itinerary } from "@/types/database";

export type ItineraryScope = "public" | "mine";

export function useItineraries(country: string, scope: ItineraryScope) {
  const [itineraries, setItineraries] = useState<Itinerary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const query = supabase
      .from("itineraries")
      .select("*")
      .eq("is_public", true)
      .order("created_at", { ascending: false });

    if (country.trim()) query.ilike("country", `%${country.trim()}%`);
    if (scope === "mine") query.eq("author_anon_id", getAnonId());

    const { data, error: fetchError } = await query;
    if (fetchError) setError(fetchError.message);
    else setItineraries((data ?? []) as Itinerary[]);
    setLoading(false);
  }, [country, scope]);

  useEffect(() => {
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
  }, [load]);

  const deleteItinerary = useCallback(async (id: string) => {
    const { error: deleteError } = await supabase.rpc("delete_itinerary", {
      itinerary_id: id,
      anon: getAnonId(),
    });
    if (deleteError) return { error: deleteError.message };
    setItineraries((prev) => prev.filter((item) => item.id !== id));
    return { error: null };
  }, []);

  return { itineraries, loading, error, reload: load, deleteItinerary };
}
