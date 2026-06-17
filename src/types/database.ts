export type Question = {
  id: string;
  title: string;
  location: string;
  country: string;
  category: TripCategory;
  budget_level: BudgetLevel;
  season: TripSeason;
  image_url: string | null;
  content: string;
  likes: number;
  dislikes: number;
  saves: number;
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

export type TripSortMode = "likes" | "newest" | "saves";

export type TripFilters = {
  country: string;
  category: TripCategory | "all";
  budget: BudgetLevel | "all";
  season: TripSeason | "all";
};
