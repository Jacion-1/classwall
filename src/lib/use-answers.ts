"use client";

import { useCallback, useEffect, useState } from "react";

import { getAnonId } from "@/lib/anon-id";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/use-auth";
import type { Answer } from "@/types/database";

export function useAnswers(questionId: string) {
  const { user } = useAuth();
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const { data, error: fetchError } = await supabase
          .from("answers")
          .select("*")
          .eq("question_id", questionId)
          .eq("is_hidden", false)
          .order("created_at", { ascending: true });

        if (cancelled) return;
        if (fetchError) {
          setError(fetchError.message);
          setAnswers([]);
          return;
        }
        setAnswers((data ?? []) as Answer[]);
      } catch (fetchError) {
        if (cancelled) return;
        setError(
          fetchError instanceof Error
            ? fetchError.message
            : "讀取留言資料時發生未知錯誤。"
        );
        setAnswers([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    const channel = supabase
      .channel(`answers-${questionId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "answers",
          filter: `question_id=eq.${questionId}`,
        },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const old = payload.old as Pick<Answer, "id">;
            setAnswers((prev) => prev.filter((answer) => answer.id !== old.id));
            return;
          }

          const next = payload.new as Answer;
          if (next.is_hidden) {
            setAnswers((prev) =>
              prev.filter((answer) => answer.id !== next.id)
            );
            return;
          }

          setAnswers((prev) =>
            prev.some((answer) => answer.id === next.id)
              ? prev.map((answer) => (answer.id === next.id ? next : answer))
              : [...prev, next]
          );
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [questionId]);

  const addAnswer = useCallback(
    async (content: string, authorName: string) => {
      const trimmed = content.trim();
      if (!trimmed) return { error: "留言內容不能空白。" };

      const {
        data: { session },
      } = await supabase.auth.getSession();
      const currentUser = session?.user ?? user;

      const { error: insertError } = await supabase.from("answers").insert({
        question_id: questionId,
        content: trimmed,
        author_anon_id: getAnonId(),
        user_id: currentUser?.id ?? null,
        author_name: authorName.trim() || "匿名旅人",
      });

      if (insertError) return { error: insertError.message };
      return { error: null };
    },
    [questionId, user]
  );

  const updateAnswer = useCallback(
    async (answerId: string, content: string, authorName: string) => {
      const trimmed = content.trim();
      if (!trimmed) return { error: "留言內容不能空白。" };

      const { data, error: updateError } = await supabase.rpc("update_answer", {
        answer_id: answerId,
        anon: getAnonId(),
        next_author_name: authorName.trim() || "匿名旅人",
        next_content: trimmed,
      });

      if (updateError) return { error: updateError.message };
      setAnswers((prev) =>
        prev.map((answer) =>
          answer.id === answerId ? (data as Answer) : answer
        )
      );
      return { error: null };
    },
    []
  );

  const deleteAnswer = useCallback(async (answerId: string) => {
    const { error: deleteError } = await supabase.rpc("delete_answer", {
      answer_id: answerId,
      anon: getAnonId(),
    });

    if (deleteError) return { error: deleteError.message };
    setAnswers((prev) => prev.filter((answer) => answer.id !== answerId));
    return { error: null };
  }, []);

  return { answers, loading, error, addAnswer, updateAnswer, deleteAnswer };
}
