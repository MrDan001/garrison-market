import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

// NOTE: unlike /api/blob/upload, this route runs BEFORE a session exists —
// registration happens pre-auth, so there's no owner session yet to check.
// The only guardrails here are content type and file size. If this becomes
// a target for abuse (random uploads hitting this endpoint), add a rate
// limit or CAPTCHA on top of this later.
export async function POST(request: Request): Promise<NextResponse> {
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