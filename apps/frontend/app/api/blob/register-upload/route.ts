import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

// NOTE: unlike /api/blob/upload, this route runs BEFORE a session exists —
// registration happens pre-auth, so there's no owner session yet to check.
// Guardrails: content type, file size, and (added after a pentest flagged
// this as an open abuse vector) a per-IP rate limit below.
export async function POST(request: Request): Promise<NextResponse> {
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