// FILE: apps/frontend/lib/rush-config.ts (UPDATED — Stage 5 adds the spin prize pool + picker. Everything else unchanged from Stage 4.)
//
// All tunable numbers for the Rush game live here, and nowhere else.
// Changing how much a sale is worth, or how steep leveling gets, should
// only ever mean editing this file — never rush.actions.ts.

export const XP_AMOUNTS: Record<string, number> = {
    SALE_COMPLETED: 5,
    STOCK_VERIFIED: 10,
    REGISTER_CLEAN: 20,
    STAFF_ON_TIME: 15,
    DAILY_LOGIN: 5,
    QUEST_COMPLETED: 30,
  };
  
  export const LEVEL_THRESHOLDS = [
    50, 120, 220, 350, 520, 750, 1050, 1450, 1950,
  ];
  
  export const MAX_DEFINED_LEVEL = LEVEL_THRESHOLDS.length + 1;
  
  export const STREAK_GRACE_HOURS = 6;
  
  const MAX_STORE_NAME_LENGTH = 24;
  
  export function formatRushDisplayName(storeName: string): string {
    const trimmed = storeName.trim();
    if (trimmed.length <= MAX_STORE_NAME_LENGTH) return trimmed;
    return trimmed.slice(0, MAX_STORE_NAME_LENGTH - 1).trimEnd() + "…";
  }
  
  export const SHOP_HEALTH_WEIGHTS = {
    stock: 0.4,
    sales: 0.35,
    staff: 0.25,
  };
  
  export const SHOP_TIERS = [
    { tier: 1, minScore: 0, label: "Just getting started" },
    { tier: 2, minScore: 21, label: "Finding its feet" },
    { tier: 3, minScore: 41, label: "Steady" },
    { tier: 4, minScore: 61, label: "Thriving" },
    { tier: 5, minScore: 81, label: "Bustling" },
  ] as const;
  
  export function scoreToTier(score: number): { tier: number; label: string } {
    let match: (typeof SHOP_TIERS)[number] = SHOP_TIERS[0];
    for (const t of SHOP_TIERS) {
      if (score >= t.minScore) match = t;
    }
    return { tier: match.tier, label: match.label };
  }
  
  // --- Fix C2: reward spin prize pool ---------------------------------------
  //
  // Prizes now live in the DB (SpinPrizeOption, per store), owner-managed —
  // this file only holds the *default seed set* used the first time a
  // store's pool is read, plus a generic weighted picker any list of
  // {weight} items can use. See lib/rush-rewards.actions.ts for the
  // seeding + picking logic.

  export type SpinPrizeKind = "xp_boost" | "badge" | "streak_shield" | "cash" | "gift";

  export type DefaultSpinPrizeSeed = {
    label: string;
    kind: SpinPrizeKind;
    xpAmount?: number;
    weight: number;
  };

  export const DEFAULT_SPIN_PRIZES: DefaultSpinPrizeSeed[] = [
    { label: "🏅 Solid Effort Badge", kind: "badge", weight: 35 },
    { label: "⭐ Bonus XP Boost", kind: "xp_boost", xpAmount: 25, weight: 25 },
    { label: "🎖️ Today's MVP Title", kind: "badge", weight: 15 },
    { label: "🔥 Streak Shield (1 day)", kind: "streak_shield", weight: 15 },
    { label: "👑 Legendary Pull", kind: "badge", weight: 10 },
  ];

  // Generic weighted draw — works for the seeded defaults, owner-added
  // custom prizes, or a mix of both. Weights don't need to sum to any
  // particular total; a weight of 0 or less is simply never drawn.
  export function weightedPick<T extends { weight: number }>(items: T[]): T | null {
    if (items.length === 0) return null;
    const totalWeight = items.reduce((sum, item) => sum + Math.max(0, item.weight), 0);
    if (totalWeight <= 0) return items[0];

    let roll = Math.random() * totalWeight;
    for (const item of items) {
      roll -= Math.max(0, item.weight);
      if (roll <= 0) return item;
    }
    return items[items.length - 1]; // unreachable in practice, satisfies TS
  }