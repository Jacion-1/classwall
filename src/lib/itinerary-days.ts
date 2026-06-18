import type {
  ItineraryDay,
  ItineraryTimeSlot,
  ItineraryTransport,
} from "@/types/database";

export const ITINERARY_SLOT_KEYS = ["morning", "afternoon", "evening"] as const;
export type ItinerarySlotKey = (typeof ITINERARY_SLOT_KEYS)[number];

export const transportOptions: Array<{
  value: ItineraryTransport;
  label: string;
}> = [
  { value: "walk", label: "步行" },
  { value: "metro", label: "地鐵" },
  { value: "bus", label: "公車" },
  { value: "rail", label: "鐵路" },
  { value: "taxi", label: "計程車" },
  { value: "car", label: "自駕" },
  { value: "bike", label: "單車" },
  { value: "flight", label: "飛機" },
  { value: "ferry", label: "渡輪" },
  { value: "other", label: "其他" },
];

export function createBlankItineraryDays(count: number): ItineraryDay[] {
  return Array.from({ length: count }, (_, index) => ({
    day: index + 1,
    morning: createBlankSlot(),
    afternoon: createBlankSlot(),
    evening: createBlankSlot(),
  }));
}

export function createBlankSlot(): ItineraryTimeSlot {
  return {
    text: "",
    transport: "walk",
  };
}

export function normalizeItineraryDays(days: ItineraryDay[]): ItineraryDay[] {
  return days.map((day, index) => ({
    day: index + 1,
    morning: getSlotValue(day, "morning"),
    afternoon: getSlotValue(day, "afternoon"),
    evening: getSlotValue(day, "evening"),
  }));
}

export function getSlotValue(
  day: ItineraryDay,
  key: ItinerarySlotKey
): ItineraryTimeSlot {
  const value = day[key];
  if (typeof value === "object" && value !== null) {
    return {
      text: value.text ?? "",
      transport: value.transport || day.transport || "walk",
    };
  }

  return {
    text: typeof value === "string" ? value : "",
    transport: day.transport || "walk",
  };
}

export function updateItinerarySlot(
  day: ItineraryDay,
  key: ItinerarySlotKey,
  patch: Partial<ItineraryTimeSlot>
): ItineraryDay {
  return {
    ...day,
    [key]: {
      ...getSlotValue(day, key),
      ...patch,
    },
  };
}

export function getTransportLabel(value: string) {
  return (
    transportOptions.find((option) => option.value === value)?.label ||
    value ||
    "未填寫"
  );
}
