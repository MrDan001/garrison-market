// FILE: apps/frontend/app/admin/waitlist/export/route.ts
//
// Streams the full waitlist as a downloadable CSV. Separate route
// rather than a server action because browsers need a real HTTP
// response with Content-Disposition to trigger a file download — a
// server action can't do that directly.

import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getAllWaitlistForExport } from "@/lib/waitlist.actions";

export const dynamic = "force-dynamic";

// Wraps a value in double quotes and escapes any internal quotes,
// per standard CSV rules — needed since names, feedback answers, etc.
// can contain commas, quotes, or newlines that would otherwise break
// column alignment when opened in Excel/Sheets.
function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  return `"${str.replace(/"/g, '""')}"`;
}

export async function GET() {
  const session = await getSessionUser();
  if (!session || session.role?.toLowerCase() !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const signups = await getAllWaitlistForExport();

  const headers = [
    "ID",
    "Full Name",
    "Email",
    "Phone",
    "State",
    "LGA",
    "Sells",
    "What They Want To See",
    "Tool Frustrations",
    "Biggest Challenge",
    "Referral Code",
    "Referred By Code",
    "Referred By Type",
    "Referral Boost",
    "Status",
    "Invited At",
    "Joined At",
  ];

  const rows = signups.map((s) => [
    csvCell(s.id),
    csvCell(s.fullName),
    csvCell(s.email),
    csvCell(s.phone),
    csvCell(s.state),
    csvCell(s.lga),
    csvCell(s.sells),
    csvCell(s.wantToSee),
    csvCell(s.toolFrustrations),
    csvCell(s.biggestChallenge),
    csvCell(s.referralCode),
    csvCell(s.referredByCode),
    csvCell(s.referredByType),
    csvCell(s.referralBoost),
    csvCell(s.status),
    csvCell(s.invitedAt ? s.invitedAt.toISOString() : ""),
    csvCell(s.createdAt.toISOString()),
  ]);

  const csv = [headers.map(csvCell).join(","), ...rows.map((r) => r.join(","))].join("\r\n");

  // Leading BOM so Excel on Windows reads UTF-8 (accented names, etc.)
  // correctly instead of mangling them.
  const csvWithBom = "\uFEFF" + csv;

  const filename = `garrison-market-waitlist-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csvWithBom, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}