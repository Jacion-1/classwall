export type Question = {
  id: string;
  title: string;
  location: string;
  country: string;
  category: TripCategory;
  budget_level: BudgetLevel;
  budget_amount: number;
  season: TripSeason;
  tags: string[];
  image_url: string | null;
  content: string;
  likes: number;
  dislikes: number;
  saves: number;
  author_anon_id: string | null;
  user_id: string | null;
  updated_at: string;
  wall_type: "travel";
  created_at: string;
};

export type Answer = {
  id: string;
  question_id: string;
  content: string;
  author_anon_id: string | null;
  user_id: string | null;
  author_name: string;
  updated_at: string;
  created_at: string;
};

export type ItineraryTransport =
  | "walk"
  | "metro"
  | "bus"
  | "rail"
  | "taxi"
  | "car"
  | "bike"
  | "flight"
  | "ferry"
  | "other";

export type ItineraryTimeSlot = {
  text: string;
  transport: ItineraryTransport | string;
};

export type ItineraryDay = {
  day: number;
  morning: string | ItineraryTimeSlot;
  afternoon: string | ItineraryTimeSlot;
  evening: string | ItineraryTimeSlot;
  transport?: string;
};

export type Itinerary = {
  id: string;
  title: string;
  country: string;
  city: string;
  trip_days: number;
  budget_amount: number;
  trip_style: string;
  tags: string[];
  days: ItineraryDay[];
  notes: string;
  author_anon_id: string | null;
  user_id: string | null;
  author_name: string;
  is_public: boolean;
  updated_at: string;
  created_at: string;
};

export type TripCategory =
  | "spot"
  | "food"
  | "stay"
  | "route"
  | "transport"
  | "story"
  | "inspiration";

export type BudgetLevel = "low" | "mid" | "high";

export type TripSeason = "spring" | "summer" | "autumn" | "winter" | "anytime";

export type TripSortMode = "likes" | "newest" | "saves" | "budget";

export type TripFilters = {
  country: string;
  category: TripCategory | "all";
  budgetMax: number;
  season: TripSeason | "all";
  tag: string;
};

export type Profile = {
  id: string;
  display_name: string;
  email: string | null;
  avatar_url: string | null;
  bio: string;
  created_at: string;
  updated_at: string;
};
