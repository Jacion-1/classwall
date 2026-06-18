"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { supabase } from "@/lib/supabase";
import type { Question, TripFilters, TripSortMode } from "@/types/database";

const DEFAULT_PAGE_SIZE = 10;

function byDateDesc(a: Question, b: Question) {
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
}

function sortTrips(list: Question[], sortMode: TripSortMode): Question[] {
  return [...list].sort((a, b) => {
    if (sortMode === "likes") {
      if (b.likes !== a.likes) return b.likes - a.likes;
      return byDateDesc(a, b);
    }

    if (sortMode === "saves") {
      if ((b.saves ?? 0) !== (a.saves ?? 0))
        return (b.saves ?? 0) - (a.saves ?? 0);
      return byDateDesc(a, b);
    }

    return byDateDesc(a, b);
  });
}

function matchesFilters(trip: Question, filters: TripFilters): boolean {
  const country = filters.country.trim().toLowerCase();
  return (
    trip.wall_type === "travel" &&
    (!country ||
      trip.country.toLowerCase().includes(country) ||
      trip.location.toLowerCase().includes(country)) &&
    (filters.category === "all" || trip.category === filters.category) &&
    (filters.budget === "all" || trip.budget_level === filters.budget) &&
    (filters.season === "all" || trip.season === filters.season)
  );
}

export function useQuestions(
  pageSize = DEFAULT_PAGE_SIZE,
  sortMode: TripSortMode = "likes",
  filters: TripFilters = {
    country: "",
    category: "all",
    budget: "all",
    season: "all",
  }
) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const offsetRef = useRef(0);
  const idSetRef = useRef<Set<string>>(new Set());
  const inFlightRef = useRef(false);

  const loadMore = useCallback(
    async (reset = false) => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;

      if (reset) {
        offsetRef.current = 0;
        idSetRef.current.clear();
        setQuestions([]);
        setHasMore(true);
        setError(null);
      }

      const isFirst = offsetRef.current === 0;
      if (isFirst) setLoading(true);
      else setLoadingMore(true);

      const from = offsetRef.current;
      const to = from + pageSize - 1;
      const query = supabase
        .from("questions")
        .select("*")
        .eq("wall_type", "travel");

      if (filters.country.trim()) {
        query.ilike("country", `%${filters.country.trim()}%`);
      }
      if (filters.category !== "all") query.eq("category", filters.category);
      if (filters.budget !== "all") query.eq("budget_level", filters.budget);
      if (filters.season !== "all") query.eq("season", filters.season);

      if (sortMode === "likes") {
        query
          .order("likes", { ascending: false })
          .order("created_at", { ascending: false });
      } else if (sortMode === "saves") {
        query
          .order("saves", { ascending: false })
          .order("created_at", { ascending: false });
      } else {
        query.order("created_at", { ascending: false });
      }

      const { data, error: fetchError } = await query.range(from, to);
      inFlightRef.current = false;

      if (fetchError) {
        setError(fetchError.message);
        setLoading(false);
        setLoadingMore(false);
        return;
      }

      const batch = (data ?? []).filter((q) => {
        if (idSetRef.current.has(q.id)) return false;
        idSetRef.current.add(q.id);
        return true;
      }) as Question[];

      setQuestions((prev) => sortTrips([...prev, ...batch], sortMode));
      offsetRef.current = from + (data?.length ?? 0);
      setHasMore((data?.length ?? 0) === pageSize);
      setLoading(false);
      setLoadingMore(false);
    },
    [
      filters.budget,
      filters.category,
      filters.country,
      filters.season,
      pageSize,
      sortMode,
    ]
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadMore(true);

    const channel = supabase
      .channel("tripwall-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "questions" },
        (payload) => {
          const next = payload.new as Question;
          if (!matchesFilters(next, filters) || idSetRef.current.has(next.id))
            return;
          idSetRef.current.add(next.id);
          setQuestions((prev) => sortTrips([next, ...prev], sortMode));
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "questions" },
        (payload) => {
          const next = payload.new as Question;
          setQuestions((prev) =>
            sortTrips(
              prev
                .map((q) => (q.id === next.id ? next : q))
                .filter((q) => matchesFilters(q, filters)),
              sortMode
            )
          );
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "questions" },
        (payload) => {
          const old = payload.old as Pick<Question, "id">;
          idSetRef.current.delete(old.id);
          setQuestions((prev) => prev.filter((q) => q.id !== old.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [filters, loadMore, sortMode]);

  return { questions, loading, loadingMore, hasMore, error, loadMore };
}
