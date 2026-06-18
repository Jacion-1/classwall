// 一個瀏覽器設定檔一個 UUID，存 localStorage 跨 tab/重開仍有效。
// 保留舊 key fallback，讓 ClassWall 升級到 TripWall 後同一台裝置仍可辨識。
const KEY = "tripwall:anon-id";
const LEGACY_KEY = "classwall:anon-id";

export function getAnonId(): string {
  if (typeof window === "undefined") return "";
  try {
    const existing = localStorage.getItem(KEY);
    if (existing) return existing;
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      localStorage.setItem(KEY, legacy);
      return legacy;
    }
    const id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
    return id;
  } catch {
    // 隱私模式 storage 不可用：回傳一次性 id
    return crypto.randomUUID();
  }
}
