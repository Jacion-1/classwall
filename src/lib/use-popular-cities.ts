"use client";

import { useEffect, useState } from "react";

import { supabase } from "@/lib/supabase";

export type PopularCity = {
  city: string;
  count: number;
  imageUrl: string | null;
};

type CitySourceRow = {
  country: string | null;
  location: string | null;
  image_url: string | null;
  image_urls: string[] | null;
  created_at: string;
};

const fallbackImages: Array<{ keywords: string[]; url: string }> = [
  {
    keywords: ["日本", "東京", "tokyo", "japan"],
    url: "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?auto=format&fit=crop&w=900&q=80",
  },
  {
    keywords: ["韓國", "首爾", "seoul", "korea"],
    url: "https://images.unsplash.com/photo-1538485399081-7c8edb8218c5?auto=format&fit=crop&w=900&q=80",
  },
  {
    keywords: ["台灣", "台北", "taipei", "taiwan"],
    url: "https://images.unsplash.com/photo-1513622470522-26c3c8a854bc?auto=format&fit=crop&w=900&q=80",
  },
  {
    keywords: ["法國", "巴黎", "paris", "france"],
    url: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=900&q=80",
  },
  {
    keywords: ["香港", "hong kong"],
    url: "https://images.unsplash.com/photo-1536599018102-9f803c140fc1?auto=format&fit=crop&w=900&q=80",
  },
  {
    keywords: ["泰國", "曼谷", "bangkok", "thailand"],
    url: "https://images.unsplash.com/photo-1508009603885-50cf7c579365?auto=format&fit=crop&w=900&q=80",
  },
];

export function getCityFallbackImage(city: string): string {
  const normalized = city.toLowerCase();
  return (
    fallbackImages.find((item) =>
      item.keywords.some((keyword) => normalized.includes(keyword.toLowerCase()))
    )?.url ??
    "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80"
  );
}

function getRepresentativeImage(row: CitySourceRow): string | null {
  return row.image_url || row.image_urls?.find(Boolean) || null;
}

export function usePopularCities() {
  const [cities, setCities] = useState<PopularCity[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data } = await supabase
        .from("questions")
        .select("country, location, image_url, image_urls, created_at")
        .eq("wall_type", "travel")
        .or("is_hidden.eq.false,is_hidden.is.null")
        .order("created_at", { ascending: false })
        .limit(500);

      if (cancelled) return;

      const destinations = new Map<
        string,
        { count: number; imageUrl: string | null; latestAt: string }
      >();

      for (const item of (data ?? []) as CitySourceRow[]) {
        const city = String(item.country ?? "").trim();
        if (!city) continue;

        const current = destinations.get(city);
        const imageUrl = getRepresentativeImage(item);
        if (!current) {
          destinations.set(city, {
            count: 1,
            imageUrl: imageUrl ?? getCityFallbackImage(city),
            latestAt: item.created_at,
          });
          continue;
        }

        current.count += 1;
        if (!current.imageUrl && imageUrl) current.imageUrl = imageUrl;
        if (new Date(item.created_at).getTime() > new Date(current.latestAt).getTime()) {
          current.latestAt = item.created_at;
          if (imageUrl) current.imageUrl = imageUrl;
        }
      }

      setCities(
        Array.from(destinations, ([city, value]) => ({
          city,
          count: value.count,
          imageUrl: value.imageUrl ?? getCityFallbackImage(city),
        }))
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