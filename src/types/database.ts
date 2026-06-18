export type Question = {
  id: string;
  title: string;
  location: string;
  country: string;
  category: TripCategory;
  budget_level: BudgetLevel;
  budget_amount: number;
  season: TripSeason;
  image_url: string | null;
  content: string;
  likes: number;
  dislikes: number;
  saves: number;
  author_anon_id: string | null;
  updated_at: string;
  wall_type: "travel";
  created_at: string;
};

export type Answer = {
  id: string;
  question_id: string;
  content: string;
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
};
