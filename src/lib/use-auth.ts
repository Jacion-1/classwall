"use client";

import type { User } from "@supabase/supabase-js";
import { useEffect, useState } from "react";

import { getAnonId } from "@/lib/anon-id";
import { supabase } from "@/lib/supabase";

export const AUTH_OWNERSHIP_CHANGED_EVENT =
  "tripwall:auth-ownership-changed";

export type AuthProfile = {
  id: string;
  display_name: string;
  email: string | null;
};

const claimedSessionKeys = new Set<string>();

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

async function claimLocalTripWallItems(user: User) {
  if (typeof window === "undefined") return;

  const anon = getAnonId();
  const claimKey = `${user.id}:${anon}`;
  if (claimedSessionKeys.has(claimKey)) return;
  claimedSessionKeys.add(claimKey);

  const { data, error } = await supabase.rpc("claim_tripwall_items", { anon });
  if (error) {
    claimedSessionKeys.delete(claimKey);
    console.error("同步本機旅行內容到帳號失敗", error);
    return;
  }

  const result = Array.isArray(data) ? data[0] : null;
  const claimedCount =
    (result?.questions_claimed ?? 0) +
    (result?.answers_claimed ?? 0) +
    (result?.itineraries_claimed ?? 0);

  if (claimedCount > 0) {
    window.dispatchEvent(new Event(AUTH_OWNERSHIP_CHANGED_EVENT));
  }
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

    async function syncUser(nextUser: User | null) {
      if (cancelled) return;
      setUser(nextUser);
      if (nextUser) await claimLocalTripWallItems(nextUser);
      await loadProfile(nextUser);
      if (!cancelled) setLoading(false);
    }

    async function loadSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      await syncUser(session?.user ?? null);
    }

    void loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void syncUser(session?.user ?? null);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  return { user, profile, loading };
}
