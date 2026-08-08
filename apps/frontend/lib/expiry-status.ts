// FILE: apps/frontend/lib/expiry-status.ts

// Shared by InventoryGrid, ScaleInventoryGrid, and OwnerScaleInventoryGrid so
// "expiring soon" means the same thing (7 days) everywhere in the app.
export type ExpiryStatus = "expired" | "soon" | null;

const SOON_THRESHOLD_DAYS = 30;

export function getExpiryStatus(trackExpiry: boolean | undefined, expiryDate: string | Date | null | undefined): ExpiryStatus {
  if (!trackExpiry || !expiryDate) return null;

  const date = expiryDate instanceof Date ? expiryDate : new Date(expiryDate);
  if (isNaN(date.getTime())) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);

  const diffDays = Math.round((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return "expired";
  if (diffDays <= SOON_THRESHOLD_DAYS) return "soon";
  return null;
}