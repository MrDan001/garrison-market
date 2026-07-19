"use client";

// lib/image-compress.ts
// Resizes + re-encodes images client-side before upload. A raw phone photo
// is often 3-8MB; this typically brings it down to 100-400KB, which is the
// single biggest lever on upload speed for people on mobile data.

interface CompressOptions {
  maxDimension?: number; // longest edge, in px
  quality?: number; // 0-1, JPEG/WebP quality
}

export async function compressImage(
  file: File,
  { maxDimension = 1280, quality = 0.8 }: CompressOptions = {}
): Promise<File> {
  // Skip compression for already-small files — not worth the CPU time.
  if (file.size <= 300 * 1024) return file;

  try {
    const bitmap = await createImageBitmap(file);

    let { width, height } = bitmap;
    if (width > maxDimension || height > maxDimension) {
      if (width > height) {
        height = Math.round((height / width) * maxDimension);
        width = maxDimension;
      } else {
        width = Math.round((width / height) * maxDimension);
        height = maxDimension;
      }
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;

    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality)
    );
    if (!blob) return file;

    // Don't "compress" into something bigger than the original.
    if (blob.size >= file.size) return file;

    const newName = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], newName, { type: "image/jpeg" });
  } catch (err) {
    // If compression fails for any reason (unsupported format, browser
    // quirk, etc.), fall back to uploading the original rather than
    // blocking the user.
    console.warn("Image compression skipped:", err);
    return file;
  }
}
