// FILE: apps/frontend/app/admin/broadcast/page.tsx

import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth.actions";
import { getOwnersForAdminPicker } from "@/lib/admin-message.actions";
import {
  getStoresForBroadcastPicker,
  getBroadcastHistory,
} from "@/lib/broadcast.actions";
import BroadcastClient from "./broadcast-client";

export const dynamic = "force-dynamic";

export default async function AdminBroadcastPage() {
  const session = await getSessionUser();
  if (!session || session.role !== "admin") redirect("/login");

  const [owners, stores, history] = await Promise.all([
    getOwnersForAdminPicker(),
    getStoresForBroadcastPicker(),
    getBroadcastHistory(0),
  ]);

  return (
    <BroadcastClient
      owners={owners}
      stores={stores}
      initialHistory={history.broadcasts}
      initialHasMore={history.hasMore}
    />
  );
}