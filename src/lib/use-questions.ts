"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { supabase } from "@/lib/supabase";
import type { Question } from "@/types/database";

const DEFAULT_PAGE_SIZE = 10;

type SortMode = "likes" | "newest";

function sortQuestions(list: Question[], sortMode: SortMode): Question[] {
  return [...list].sort((a, b) => {
    if (sortMode === "likes") {
      if (b.likes !== a.likes) return b.likes - a.likes;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }

    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

/**
 * 分頁載入 questions + Realtime 訂閱
 *
 * 策略：
 * - DB 端按 likes DESC, created_at DESC 分頁（高讚的永遠在前面）或按 created_at DESC
 * - 不再 client 端二次排序，由 DB 與 hook 統一維持順序
 * - INSERT / UPDATE 後都重新排序，確保位置正確
 * - 用 idSet 去重避免分頁與 realtime 同時拿到同一筆
 *
 * 已知代價：高讚題目按讚變動時可能在分頁邊界漂移，
 * 教學情境量級不大、可接受。
 */
export function useQuestions(pageSize = DEFAULT_PAGE_SIZE, sortMode: SortMode = "likes") {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const offsetRef = useRef(0);
  const idSetRef = useRef<Set<string>>(new Set());
  const inFlightRef = useRef(false);

  const loadMore = useCallback(async (reset = false) => {
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

    const query = supabase.from("questions").select("*");
    if (sortMode === "likes") {
      query.order("likes", { ascending: false }).order("created_at", { ascending: false });
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
    });

    setQuestions((prev) => sortQuestions([...prev, ...batch], sortMode));
    offsetRef.current = from + (data?.length ?? 0);
    setHasMore((data?.length ?? 0) === pageSize);
    setLoading(false);
    setLoadingMore(false);
  }, [pageSize, sortMode]);

  useEffect(() => {
    async function fetchFirstPage() {
      await loadMore(true);
    }

    void fetchFirstPage();

    const channel = supabase
      .channel("questions-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "questions" },
        (payload) => {
          const next = payload.new as Question;
          if (idSetRef.current.has(next.id)) return;
          idSetRef.current.add(next.id);
          // 新題依目前排序插入正確位置
          setQuestions((prev) => sortQuestions([next, ...prev], sortMode));
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "questions" },
        (payload) => {
          const next = payload.new as Question;
          // 按讚變動後重新排序，讓位置即時跟著動
          setQuestions((prev) =>
            sortQuestions(prev.map((q) => (q.id === next.id ? next : q)), sortMode)
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
  }, [loadMore, sortMode]);

  return { questions, loading, loadingMore, hasMore, error, loadMore };
}
