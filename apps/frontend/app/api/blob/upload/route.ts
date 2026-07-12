import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth.actions";

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        // NOTE: relaxed from "owner only" to "any authenticated user" —
        // this route is now shared by inventory uploads (owner-only,
        // enforced inside addItemAction/updateItemAction) AND staff profile
        // photo uploads. The actual save-to-database authorization already
        // happens in each specific server action, so gatekeeping role here
        // too was redundant and blocked legitimate staff uploads.
        const session = await getSessionUser();
        if (!session) {
          throw new Error("Unauthorized");
        }

        return {
          allowedContentTypes: ["image/jpeg", "image/png", "image/webp"],
          addRandomSuffix: true,
          maximumSizeInBytes: 5 * 1024 * 1024,
        };
      },
      onUploadCompleted: async ({ blob }) => {
        console.log("Blob upload completed:", blob.url);
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}