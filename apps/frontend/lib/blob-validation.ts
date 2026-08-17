// FILE: apps/frontend/lib/blob-validation.ts
//
// registerOwnerAction writes `imageUrl` straight from form input into the
// new user's `image` column. In practice it's always a URL the app's own
// upload flow (/api/blob/upload or /api/blob/register-upload) just
// produced, but nothing enforced that — a raw form field accepts any
// string. Low impact today (nothing server-side fetches the URL, and it's
// just rendered as an <img src>, which can't execute a javascript: URI),
// but there's no reason to store an arbitrary attacker-supplied URL
// un-checked, especially if this field is ever used for something more
// than display later. Restricting it to the app's own Blob hostname costs
// nothing for the legitimate case.

// Keep in sync with BLOB_HOSTNAME in next.config.ts.
const OWN_BLOB_HOSTNAME = "fg3uwdlr4t2605wl.public.blob.vercel-storage.com";

export function isOwnBlobUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && parsed.hostname === OWN_BLOB_HOSTNAME;
  } catch {
    return false;
  }
}

/** Convenience wrapper for the common "use this URL if it's ours, else
 * drop it" pattern — returns the URL unchanged if valid, `null`
 * otherwise. Used anywhere a form field writes an image URL straight to
 * the database (product photos, avatars, etc.). */
export function sanitizeOwnBlobUrl(url: string | null | undefined): string | null {
  return isOwnBlobUrl(url) ? (url as string) : null;
}