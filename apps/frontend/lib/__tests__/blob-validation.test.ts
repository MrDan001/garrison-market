import { describe, expect, it } from "vitest";
import { isOwnBlobUrl, sanitizeOwnBlobUrl } from "../blob-validation";

describe("blob URL validation", () => {
  it("accepts HTTPS URLs from the configured Vercel Blob host", () => {
    const url = "https://fg3uwdlr4t2605wl.public.blob.vercel-storage.com/inventory/1/photo.jpg";
    expect(isOwnBlobUrl(url)).toBe(true);
    expect(sanitizeOwnBlobUrl(url)).toBe(url);
  });

  it("rejects non-HTTPS and foreign hosts", () => {
    expect(isOwnBlobUrl("http://fg3uwdlr4t2605wl.public.blob.vercel-storage.com/a.jpg")).toBe(false);
    expect(isOwnBlobUrl("https://example.com/a.jpg")).toBe(false);
    expect(isOwnBlobUrl("javascript:alert(1)")).toBe(false);
  });

  it("handles missing and malformed values safely", () => {
    expect(isOwnBlobUrl(undefined)).toBe(false);
    expect(isOwnBlobUrl(null)).toBe(false);
    expect(isOwnBlobUrl("not-a-url")).toBe(false);
    expect(sanitizeOwnBlobUrl("https://example.com/a.jpg")).toBeNull();
  });
});
