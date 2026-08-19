import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

// NOTE: unlike /api/blob/upload, this route runs BEFORE a session exists —
// registration happens pre-auth, so there's no owner session yet to check.
// Guardrails: content type, file size, and (added after a pentest flagged
// this as an open abuse vector) a per-IP rate limit below.
export async function POST(request: Request): Promise<NextResponse> {
  // 1. Explicitly retrieve token from environment
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    console.error("BLOB_READ_WRITE_TOKEN environment variable is missing.");
    return NextResponse.json(
      { error: "Storage configuration error: Missing Vercel Blob token." },
      { status: 500 }
    );
  }

  const ip = await getClientIp();
  const limit = await checkRateLimit(`blob-register:ip:${ip}`, { max: 20, windowMs: 60 * 60 * 1000 });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many uploads from this connection. Please try again later." },
      { status: 429 }
    );
  }

  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      // 2. Explicitly pass token to handleUpload
      token,
      onBeforeGenerateToken: async () => {
        return {
          allowedContentTypes: ["image/jpeg", "image/png", "image/webp"],
          addRandomSuffix: true,
          maximumSizeInBytes: 5 * 1024 * 1024, // 5MB cap
        };
      },
      onUploadCompleted: async ({ blob }) => {
        console.log("Registration photo uploaded:", blob.url);
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}