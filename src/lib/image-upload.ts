import { supabase } from "@/lib/supabase";

const MAX_SOURCE_SIZE = 12 * 1024 * 1024;
const MAX_UPLOAD_SIZE = 5 * 1024 * 1024;
const MAX_EDGE = 1800;
const QUALITY = 0.82;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export type CompressedImage = {
  file: File;
  originalSize: number;
  compressedSize: number;
  previewUrl: string;
};

export async function compressTripImage(file: File): Promise<CompressedImage> {
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error("目前支援 JPG、PNG、WebP 圖片。");
  }
  if (file.size > MAX_SOURCE_SIZE) {
    throw new Error("圖片原檔請小於 12MB。");
  }

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw new Error("瀏覽器無法處理這張圖片，請改用圖片網址。");
  }

  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await canvasToBlob(canvas, "image/webp", QUALITY);
  if (blob.size > MAX_UPLOAD_SIZE) {
    throw new Error("圖片壓縮後仍超過 5MB，請先裁切或換較小的圖片。");
  }

  const compressed = new File([blob], replaceExtension(file.name, "webp"), {
    type: blob.type,
  });

  return {
    file: compressed,
    originalSize: file.size,
    compressedSize: compressed.size,
    previewUrl: URL.createObjectURL(compressed),
  };
}

export async function uploadTripImage(file: File, userId: string) {
  return uploadPublicImage("trip-images", file, userId);
}

export async function uploadProfileImage(file: File, userId: string) {
  return uploadPublicImage("profile-images", file, userId);
}

async function uploadPublicImage(bucket: string, file: File, userId: string) {
  const path = `${userId}/${crypto.randomUUID()}.${extensionForType(file.type)}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: "31536000",
    contentType: file.type,
    upsert: false,
  });

  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

export async function removeTripImageByUrl(url: string | null | undefined) {
  const path = getPublicImagePath(url, "trip-images");
  if (!path) return { removed: false, error: null };

  const { error } = await supabase.storage.from("trip-images").remove([path]);
  return {
    removed: !error,
    error: error?.message ?? null,
  };
}

export async function removeProfileImageByUrl(url: string | null | undefined) {
  const path = getPublicImagePath(url, "profile-images");
  if (!path) return { removed: false, error: null };

  const { error } = await supabase.storage
    .from("profile-images")
    .remove([path]);
  return {
    removed: !error,
    error: error?.message ?? null,
  };
}

export function isTripImageUrl(url: string | null | undefined) {
  return Boolean(getPublicImagePath(url, "trip-images"));
}

export function isProfileImageUrl(url: string | null | undefined) {
  return Boolean(getPublicImagePath(url, "profile-images"));
}

export function getTripImagePath(url: string | null | undefined) {
  return getPublicImagePath(url, "trip-images");
}

function getPublicImagePath(url: string | null | undefined, bucket: string) {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    const marker = `/storage/v1/object/public/${bucket}/`;
    const markerIndex = parsed.pathname.indexOf(marker);
    if (markerIndex === -1) return null;

    return decodeURIComponent(
      parsed.pathname.slice(markerIndex + marker.length)
    );
  } catch {
    return null;
  }
}

export function formatFileSize(size: number) {
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number
) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("圖片壓縮失敗，請改用圖片網址。"));
      },
      type,
      quality
    );
  });
}

function replaceExtension(name: string, extension: string) {
  return name.replace(/\.[^.]+$/, "") + `.${extension}`;
}

function extensionForType(type: string) {
  if (type === "image/png") return "png";
  if (type === "image/jpeg") return "jpg";
  return "webp";
}
