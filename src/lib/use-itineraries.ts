"use client";

import { useCallback, useEffect, useState } from "react";

import { getAnonId } from "@/lib/anon-id";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/use-auth";
import type { Itinerary } from "@/types/database";

export type ItineraryScope = "public" | "mine";

export function useItineraries(country: string, scope: ItineraryScope) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
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
    if (scope === "mine") {
      const anonId = getAnonId();
      if (userId) query.or(`author_anon_id.eq.${anonId},user_id.eq.${userId}`);
      else query.eq("author_anon_id", anonId);
    }

    const { data, error: fetchError } = await query;
    if (fetchError) setError(fetchError.message);
    else setItineraries((data ?? []) as Itinerary[]);
    setLoading(false);
  }, [country, scope, userId]);

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
