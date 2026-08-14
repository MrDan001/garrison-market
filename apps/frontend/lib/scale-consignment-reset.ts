// FILE: apps/frontend/lib/scale-consignment-reset.ts

import prisma from "@/lib/prisma";
import { autoSettleScaleConsignmentForCron } from "@/lib/consignment.actions";

// Runs once a day (see app/api/cron/scale-consignment-reset/route.ts).
// Only touches consignments on STANDARD stores (the override-created kind)
// — matched by store.storeType, not the owner's current toggle state.
// This matters: if admin turns the toggle off while a consignment is still
// open, it must still get auto-settled — keying off the toggle would leave
// it stranded open forever. Native scale-store consignments (storeType
// "scale") run their own external-recipient cycle and are never touched.
export async function runMidnightScaleConsignmentReset() {
  const openConsignments = await prisma.consignment.findMany({
    where: {
      status: "out",
      scaleItems: { some: {} },
      store: { storeType: { not: "scale" } },
    },
    select: { id: true },
  });

  const results: { id: number; success: boolean; error?: string }[] = [];

  for (const c of openConsignments) {
    try {
      await autoSettleScaleConsignmentForCron(c.id, process.env.CRON_SECRET!);
      results.push({ id: c.id, success: true });
    } catch (err: any) {
      results.push({ id: c.id, success: false, error: err?.message || "Unknown error" });
    }
  }

  return { settledCount: results.filter((r) => r.success).length, failedCount: results.filter((r) => !r.success).length, results };
}