"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { getAnonId } from "@/lib/anon-id";
import { getSavedIds, hasSaved, SAVES_CHANGED_EVENT } from "@/lib/liked-store";
import { supabase } from "@/lib/supabase";
import { BUDGET_MAX } from "@/lib/trip-budget";
import { AUTH_OWNERSHIP_CHANGED_EVENT, useAuth } from "@/lib/use-auth";
import type { Question, TripFilters, TripSortMode } from "@/types/database";

const DEFAULT_PAGE_SIZE = 10;
export type TripFeedScope = "all" | "mine" | "saved";

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

    if (sortMode === "budget") {
      if (a.budget_amount !== b.budget_amount)
        return a.budget_amount - b.budget_amount;
      return byDateDesc(a, b);
    }

    return byDateDesc(a, b);
  });
}

function matchesFilters(
  trip: Question,
  filters: TripFilters,
  scope: TripFeedScope,
  userId: string | null
): boolean {
  const country = filters.country.trim().toLowerCase();
  return (
    trip.wall_type === "travel" &&
    (scope === "all" ||
      (scope === "mine" &&
        (trip.author_anon_id === getAnonId() ||
          Boolean(userId && trip.user_id === userId))) ||
      (scope === "saved" && hasSaved(trip.id))) &&
    (!country ||
      trip.country.toLowerCase().includes(country) ||
      trip.location.toLowerCase().includes(country)) &&
    (filters.category === "all" || trip.category === filters.category) &&
    trip.budget_amount <= filters.budgetMax &&
    (filters.season === "all" || trip.season === filters.season) &&
    (!filters.tag || (trip.tags ?? []).includes(filters.tag))
  );
}

export function useQuestions(
  pageSize = DEFAULT_PAGE_SIZE,
  sortMode: TripSortMode = "likes",
  filters: TripFilters = {
    country: "",
    category: "all",
    budgetMax: BUDGET_MAX,
    season: "all",
    tag: "",
  },
  scope: TripFeedScope = "all"
) {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? null;
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const offsetRef = useRef(0);
  const idSetRef = useRef<Set<string>>(new Set());
  const inFlightRef = useRef(false);
  const requestIdRef = useRef(0);

  const loadMore = useCallback(
    async (reset = false) => {
      if (inFlightRef.current && !reset) return;
      inFlightRef.current = true;
      const requestId = ++requestIdRef.current;

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
      const savedIds = scope === "saved" ? getSavedIds() : [];

      if (scope === "saved" && savedIds.length === 0) {
        if (requestId === requestIdRef.current) inFlightRef.current = false;
        setQuestions([]);
        setHasMore(false);
        setLoading(false);
        setLoadingMore(false);
        return;
      }

      const query = supabase
        .from("questions")
        .select("*")
        .eq("wall_type", "travel");

      if (scope === "mine") {
        const anonId = getAnonId();
        if (userId) query.or(`author_anon_id.eq.${anonId},user_id.eq.${userId}`);
        else query.eq("author_anon_id", anonId);
      } else if (scope === "saved") {
        query.in("id", savedIds);
      }
      if (filters.country.trim()) {
        query.ilike("country", `%${filters.country.trim()}%`);
      }
      if (filters.category !== "all") query.eq("category", filters.category);
      query.lte("budget_amount", filters.budgetMax);
      if (filters.season !== "all") query.eq("season", filters.season);
      if (filters.tag) query.contains("tags", [filters.tag]);

      if (sortMode === "likes") {
        query
          .order("likes", { ascending: false })
          .order("created_at", { ascending: false });
      } else if (sortMode === "saves") {
        query
          .order("saves", { ascending: false })
          .order("created_at", { ascending: false });
      } else if (sortMode === "budget") {
        query
          .order("budget_amount", { ascending: true })
          .order("created_at", { ascending: false });
      } else {
        query.order("created_at", { ascending: false });
      }

      const { data, error: fetchError } = await query.range(from, to);

      if (requestId !== requestIdRef.current) return;

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
      filters.budgetMax,
      filters.category,
      filters.country,
      filters.season,
      filters.tag,
      pageSize,
      scope,
      sortMode,
      userId,
    ]
  );

  useEffect(() => {
    if (scope === "mine" && authLoading) {
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadMore(true);

    const channel = supabase
      .channel("tripwall-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "questions" },
        (payload) => {
          const next = payload.new as Question;
          if (
            !matchesFilters(next, filters, scope, userId) ||
            idSetRef.current.has(next.id)
          ) {
            return;
          }
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
                .filter((q) => matchesFilters(q, filters, scope, userId)),
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
  }, [authLoading, filters, loadMore, scope, sortMode, userId]);

  useEffect(() => {
    if (scope !== "saved" && scope !== "mine") return;
    const reloadScopedTrips = () => {
      void loadMore(true);
    };
    window.addEventListener(SAVES_CHANGED_EVENT, reloadScopedTrips);
    window.addEventListener(AUTH_OWNERSHIP_CHANGED_EVENT, reloadScopedTrips);
    return () => {
      window.removeEventListener(SAVES_CHANGED_EVENT, reloadScopedTrips);
      window.removeEventListener(
        AUTH_OWNERSHIP_CHANGED_EVENT,
        reloadScopedTrips
      );
    };
  }, [loadMore, scope]);

  return {
    questions,
    loading: loading || (scope === "mine" && authLoading),
    loadingMore,
    hasMore,
    error,
    loadMore,
  };
}
