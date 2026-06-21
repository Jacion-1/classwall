"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { getAnonId } from "@/lib/anon-id";
import { fetchSavedIds, SAVES_CHANGED_EVENT } from "@/lib/liked-store";
import { supabase } from "@/lib/supabase";
import {
  BUDGET_MAX,
  defaultBudgetAmountForLevel,
} from "@/lib/trip-budget";
import { AUTH_OWNERSHIP_CHANGED_EVENT, useAuth } from "@/lib/use-auth";
import type { Question, TripFilters, TripSortMode } from "@/types/database";

const DEFAULT_PAGE_SIZE = 10;
export type TripFeedScope = "all" | "mine" | "saved";

function byDateDesc(a: Question, b: Question) {
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
}

function getTripBudgetAmount(trip: Question): number {
  return trip.budget_amount ?? defaultBudgetAmountForLevel(trip.budget_level);
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
      const budgetA = getTripBudgetAmount(a);
      const budgetB = getTripBudgetAmount(b);
      if (budgetA !== budgetB) return budgetA - budgetB;
      return byDateDesc(a, b);
    }

    return byDateDesc(a, b);
  });
}

function matchesFilters(
  trip: Question,
  filters: TripFilters,
  scope: TripFeedScope,
  userId: string | null,
  savedIds: Set<string>
): boolean {
  const country = filters.country.trim().toLowerCase();
  return (
    trip.wall_type === "travel" &&
    !trip.is_hidden &&
    (scope === "all" ||
      (scope === "mine" &&
        (trip.user_id
          ? Boolean(userId && trip.user_id === userId)
          : trip.author_anon_id === getAnonId())) ||
      (scope === "saved" && savedIds.has(trip.id))) &&
    (!country ||
      trip.country.toLowerCase().includes(country) ||
      trip.location.toLowerCase().includes(country) ||
      trip.title.toLowerCase().includes(country) ||
      trip.content.toLowerCase().includes(country) ||
      (trip.tags ?? []).some((tag) => tag.toLowerCase().includes(country))) &&
    (filters.category === "all" || trip.category === filters.category) &&
    getTripBudgetAmount(trip) <= filters.budgetMax &&
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
  const savedIdsRef = useRef<Set<string>>(new Set());

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
      try {
        const savedIds = scope === "saved" ? await fetchSavedIds(userId) : [];
        savedIdsRef.current = new Set(savedIds);
        if (scope === "saved" && savedIds.length === 0) {
          setQuestions([]);
          setHasMore(false);
          return;
        }

        const query = supabase
          .from("questions")
          .select("*")
          .eq("wall_type", "travel")
          .or("is_hidden.eq.false,is_hidden.is.null");

        if (scope === "mine") {
          const anonId = getAnonId();
          if (userId) query.eq("user_id", userId);
          else query.is("user_id", null).eq("author_anon_id", anonId);
        } else if (scope === "saved") {
          query.in("id", savedIds);
        }

        const keyword = filters.country.trim().replace(/[,%]/g, "");
        if (keyword) {
          query.or(
            [
              `country.ilike.%${keyword}%`,
              `location.ilike.%${keyword}%`,
              `title.ilike.%${keyword}%`,
              `content.ilike.%${keyword}%`,
            ].join(",")
          );
        }
        if (filters.category !== "all") query.eq("category", filters.category);
        if (filters.budgetMax < BUDGET_MAX) {
          query.or(`budget_amount.is.null,budget_amount.lte.${filters.budgetMax}`);
        }
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

        if (fetchError) {
          setError(fetchError.message);
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
      } catch (fetchError) {
        if (requestId !== requestIdRef.current) return;
        setError(
          fetchError instanceof Error
            ? fetchError.message
            : "讀取心得資料時發生未知錯誤。"
        );
      } finally {
        if (requestId === requestIdRef.current) {
          inFlightRef.current = false;
          setLoading(false);
          setLoadingMore(false);
        }
      }
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
    if ((scope === "mine" || scope === "saved") && authLoading) {
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
            !matchesFilters(next, filters, scope, userId, savedIdsRef.current) ||
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
                .filter((q) =>
                matchesFilters(q, filters, scope, userId, savedIdsRef.current)
              ),
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
    loading: loading || ((scope === "mine" || scope === "saved") && authLoading),
    loadingMore,
    hasMore,
    error,
    loadMore,
  };
}
