"use client";

import type { User } from "@supabase/supabase-js";
import { useEffect, useState } from "react";

import { supabase } from "@/lib/supabase";

export type AuthProfile = {
  id: string;
  display_name: string;
  email: string | null;
};

export function getAuthDisplayName(user: User | null, fallback = "旅人") {
  if (!user) return fallback;
  const metadataName = user.user_metadata?.display_name;
  if (typeof metadataName === "string" && metadataName.trim()) {
    return metadataName.trim();
  }
  return user.email?.split("@")[0] || fallback;
}

export async function upsertProfile(user: User, displayName?: string) {
  const name = displayName?.trim() || getAuthDisplayName(user);
  await supabase.from("profiles").upsert({
    id: user.id,
    display_name: name,
    email: user.email ?? null,
  });
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile(nextUser: User | null) {
      if (!nextUser) {
        if (!cancelled) setProfile(null);
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("id, display_name, email")
        .eq("id", nextUser.id)
        .maybeSingle();

      if (!cancelled) setProfile((data as AuthProfile | null) ?? null);
    }

    async function loadSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      setUser(session?.user ?? null);
      await loadProfile(session?.user ?? null);
      if (!cancelled) setLoading(false);
    }

    void loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      void loadProfile(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  return { user, profile, loading };
}
