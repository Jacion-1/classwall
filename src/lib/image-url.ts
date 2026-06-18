const IMAGE_TIMEOUT_MS = 8000;

export function getImageUrlProblem(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return "圖片網址格式不正確。";
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return "圖片網址需要以 http:// 或 https:// 開頭。";
  }

  if (
    url.hostname === "photos.app.goo.gl" ||
    url.hostname.endsWith(".photos.google.com") ||
    url.hostname === "photos.google.com"
  ) {
    return "Google Photos 分享連結是相簿頁面，不是圖片直連，瀏覽器無法把它當貼文圖片顯示。請改用圖片檔直連網址。";
  }

  return null;
}

export async function validateLoadableImageUrl(
  value: string
): Promise<string | null> {
  const problem = getImageUrlProblem(value);
  if (problem) return problem;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const canLoad = await new Promise<boolean>((resolve) => {
    const image = new Image();
    const timeout = window.setTimeout(() => resolve(false), IMAGE_TIMEOUT_MS);

    image.onload = () => {
      window.clearTimeout(timeout);
      resolve(image.naturalWidth > 0 && image.naturalHeight > 0);
    };
    image.onerror = () => {
      window.clearTimeout(timeout);
      resolve(false);
    };
    image.src = trimmed;
  });

  return canLoad
    ? null
    : "這個網址無法直接載入成圖片。請使用可公開讀取的 .jpg、.png、.webp，或 Unsplash / Imgur / Cloudinary 這類圖片直連。";
}
