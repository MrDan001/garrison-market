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
  
  // --- Stage 5 addition: reward spin prize pool ----------------------------
  
  // Cosmetic-only by default — labels shown on the wheel and stored on the
  // claimed RewardSpin row. Weight controls relative odds (higher = more
  // common); they don't need to sum to any particular total. If real
  // perks (airtime, discounts) are ever funded by an owner, add them here
  // with a low weight — the picker logic doesn't change.
  export const SPIN_PRIZES: { label: string; weight: number }[] = [
    { label: "🏅 Solid Effort Badge", weight: 35 },
    { label: "⭐ Bonus XP Boost", weight: 25 },
    { label: "🎖️ Today's MVP Title", weight: 15 },
    { label: "🔥 Streak Shield (1 day)", weight: 15 },
    { label: "👑 Legendary Pull", weight: 10 },
  ];
  
  export function pickPrize(): string {
    const totalWeight = SPIN_PRIZES.reduce((sum, p) => sum + p.weight, 0);
    let roll = Math.random() * totalWeight;
    for (const prize of SPIN_PRIZES) {
      roll -= prize.weight;
      if (roll <= 0) return prize.label;
    }
    return SPIN_PRIZES[0].label; // unreachable in practice, satisfies TS
  }