export const TRIP_TAGS = [
  "適合情侶",
  "一個人旅行",
  "省錢",
  "拍照景點",
  "雨天備案",
  "交通方便",
  "排隊名店",
] as const;

export type TripTag = (typeof TRIP_TAGS)[number];

export function normalizeTags(tags: string[]): string[] {
  return tags.filter((tag, index, list) => {
    return TRIP_TAGS.includes(tag as TripTag) && list.indexOf(tag) === index;
  });
}
