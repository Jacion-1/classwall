"use client";

import { useEffect, useState } from "react";

import { supabase } from "@/lib/supabase";

export type PopularCity = {
  city: string;
  count: number;
};

export function usePopularCities() {
  const [cities, setCities] = useState<PopularCity[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data } = await supabase
        .from("questions")
        .select("country")
        .eq("wall_type", "travel")
        .eq("is_hidden", false)
        .limit(500);

      if (cancelled) return;

      const counts = new Map<string, number>();
      for (const item of data ?? []) {
        const city = String(item.country ?? "").trim();
        if (!city) continue;
        counts.set(city, (counts.get(city) ?? 0) + 1);
      }

      setCities(
        Array.from(counts, ([city, count]) => ({ city, count }))
          .sort((a, b) => b.count - a.count || a.city.localeCompare(b.city))
          .slice(0, 5)
      );
    }

    void load();

    const channel = supabase
      .channel("popular-cities")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "questions" },
        () => {
          void load();
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  return cities;
}
