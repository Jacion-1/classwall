const LIKE_KEY = "classwall:liked";
const DISLIKE_KEY = "classwall:disliked";
const SAVE_KEY = "tripwall:saved";
export const SAVES_CHANGED_EVENT = "tripwall:saves-changed";

function read(key: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr) : new Set();
  } catch {
    return new Set();
  }
}

function write(key: string, set: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(Array.from(set)));
  } catch {
    // localStorage 不可用時靜默 (隱私模式等)
  }
}

export function hasLiked(id: string): boolean {
  return read(LIKE_KEY).has(id);
}

export function addLiked(id: string): void {
  const set = read(LIKE_KEY);
  set.add(id);
  write(LIKE_KEY, set);
}

export function removeLiked(id: string): void {
  const set = read(LIKE_KEY);
  set.delete(id);
  write(LIKE_KEY, set);
}

export function hasDisliked(id: string): boolean {
  return read(DISLIKE_KEY).has(id);
}

export function addDisliked(id: string): void {
  const set = read(DISLIKE_KEY);
  set.add(id);
  write(DISLIKE_KEY, set);
}

export function removeDisliked(id: string): void {
  const set = read(DISLIKE_KEY);
  set.delete(id);
  write(DISLIKE_KEY, set);
}

export function hasSaved(id: string): boolean {
  return read(SAVE_KEY).has(id);
}

export function addSaved(id: string): void {
  const set = read(SAVE_KEY);
  set.add(id);
  write(SAVE_KEY, set);
  notifySavedChanged();
}

export function removeSaved(id: string): void {
  const set = read(SAVE_KEY);
  set.delete(id);
  write(SAVE_KEY, set);
  notifySavedChanged();
}

export function getSavedIds(): string[] {
  return Array.from(read(SAVE_KEY));
}

function notifySavedChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(SAVES_CHANGED_EVENT));
}
