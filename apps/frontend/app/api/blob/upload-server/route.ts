import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth.actions";

export const runtime = "nodejs";

const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const session = await getSessionUser();
    if (!session || session.role !== "owner") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 1. Explicitly check for the token to prevent raw library crashes
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) {
      console.error("BLOB_READ_WRITE_TOKEN environment variable is missing.");
      return NextResponse.json(
        { error: "Storage configuration error. Please check server settings." },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No image file provided." }, { status: 400 });
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Only image files are allowed." }, { status: 400 });
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: "Image is too large after compression. Please choose a smaller image." },
        { status: 413 }
      );
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const pathname = `inventory/${session.id}/${Date.now()}-${crypto.randomUUID()}-${safeName}`;

    // 2. Explicitly pass token to put()
    const blob = await put(pathname, file, {
      access: "public",
      addRandomSuffix: false,
      token: token,
    });

    return NextResponse.json({ url: blob.url });
  } catch (error) {
    console.error("Inventory image upload failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Image upload failed." },
      { status: 500 }
    );
  }
}