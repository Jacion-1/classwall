"use client";

import { useEffect, useState } from "react";

import { supabase } from "@/lib/supabase";

export function useAnswerCount(questionId: string) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { count: nextCount } = await supabase
        .from("answers")
        .select("id", { count: "exact", head: true })
        .eq("question_id", questionId);

      if (!cancelled) setCount(nextCount ?? 0);
    }

    void load();

    const channel = supabase
      .channel(`answer-count-${questionId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "answers",
          filter: `question_id=eq.${questionId}`,
        },
        () => {
          void load();
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [questionId]);

  return count;
}
