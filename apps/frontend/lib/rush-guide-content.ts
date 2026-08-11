// FILE: apps/frontend/lib/rush-guide-content.ts (NEW FILE — Stage 1)
//
// Single source of truth for "how the Rush game works," written for humans
// (staff and owners), not developers. This file is content only — no
// logic, no DB access. It exists so that:
//   1. The in-app "How to Play" guide (Stage 2) can render it directly.
//   2. The Dev Assistant AI (Stage 4) can be given this same text as
//      context, so it answers Rush questions consistently with the guide
//      instead of improvising.
//
// IMPORTANT: keep this in sync with rush-config.ts by hand. If a number
// changes there (an XP amount, a level threshold, a spin prize), it must
// change here too — this file does not import those constants, on purpose,
// so that the wording here stays human-readable rather than interpolated
// from raw config values. Cross-check both files whenever tuning numbers.
//
// Accuracy note (updated after Fix A): STAFF_ON_TIME is now real — it's
// awarded by the clock-in feature (lib/rush-clock.actions.ts). DAILY_LOGIN
// is still defined in XP_AMOUNTS but not awarded anywhere. It's kept out
// of RUSH_XP_SOURCES below and left in RUSH_XP_SOURCES_PLANNED so the
// guide and the AI never tell a user they can earn XP a way that doesn't
// actually work yet.

export type RushRole = "staff" | "owner" | "both";

// --- XP: how it's actually earned today -----------------------------------

export type RushXpSource = {
  /** Matches the key in XP_AMOUNTS in rush-config.ts */
  type: string;
  /** Short, human label for display */
  label: string;
  amount: number;
  /** Plain-language explanation of the exact trigger */
  how: string;
  role: RushRole;
};

export const RUSH_XP_SOURCES: RushXpSource[] = [
  {
    type: "SALE_COMPLETED",
    label: "Complete a sale",
    amount: 5,
    how: "Ring up any sale (standard inventory or scale inventory) and check it out. XP is awarded the moment the order is created — no extra step needed.",
    role: "both",
  },
  {
    type: "STOCK_VERIFIED",
    label: "Verify a stock item (Restock Run)",
    amount: 10,
    how: "Open the Restock Run quest on the Rush world screen and tap to verify one of the day's listed items. Each item can only be verified once per day — tapping it again does nothing.",
    role: "both",
  },
  {
    type: "REGISTER_CLEAN",
    label: "Settle a consignment",
    amount: 20,
    how: "Close out and settle a consignment (standard or scale) at the end of a shift, reconciling what was sold vs. returned. XP fires the moment the settlement is confirmed.",
    role: "both",
  },
  {
    type: "QUEST_COMPLETED",
    label: "Finish a full quest",
    amount: 30,
    how: "Complete all 5 items in that day's Restock Run. This is on top of the 10 XP already earned per item verified along the way, and it's also what unlocks the day's reward spin.",
    role: "both",
  },
  {
    type: "STAFF_ON_TIME",
    label: "Clock in on time",
    amount: 15,
    how: "Tap Clock In on the Rush world screen at or before the store's shift start time (owner-configurable from Manage Prizes, defaults to 8:00 AM). XP is awarded once, at the moment of clocking in — it isn't retroactive if you clock in late. Clocking out has no XP attached; it's just a record of when your shift ended.",
    role: "staff",
  },
];

// Defined in code (rush-config.ts) but not wired to any action yet.
// Keep this list so the guide/AI can correctly say "not live yet" instead
// of staying silent or guessing, if directly asked.
export const RUSH_XP_SOURCES_PLANNED: { type: string; label: string; amount: number }[] = [
  { type: "DAILY_LOGIN", label: "Daily login", amount: 5 },
];

// --- Levels -----------------------------------------------------------------

export const RUSH_LEVELS = {
  summary:
    "Every bit of XP you earn adds to one running total. As that total crosses certain milestones, your level goes up. There's no separate 'XP per level' — it's all one running total, and the game works out which level that puts you at.",
  thresholds: [50, 120, 220, 350, 520, 750, 1050, 1450, 1950],
  details: [
    "You start at Level 1 with 0 XP.",
    "Reaching 50 total XP takes you to Level 2. From there, each next threshold is the amount of additional XP needed (not the running total) to reach the next level — 120 more XP after that gets you to Level 3, then 220 more to Level 4, and so on, getting steeper each time.",
    "Level 10 is the highest level currently defined. Once you hit it, your progress bar shows 'max level' — you keep earning and banking XP (it still counts toward your total and the leaderboard), there just isn't a Level 11 yet.",
  ],
};

// --- Streaks ------------------------------------------------------------

export const RUSH_STREAKS = {
  summary:
    "Your streak counts consecutive days you did something that earns XP. It's shared across all XP sources — any qualifying action on a given day keeps the streak alive.",
  details: [
    "Any XP-earning action (a sale, a stock verification, a consignment settlement, or a completed quest) counts as 'active' for that day.",
    "If you were active yesterday and are active again today, your streak goes up by 1.",
    "If a full calendar day passes with no XP-earning action at all, the streak resets to 0 the following night.",
    "There's a 6-hour grace window after midnight — so if you're active very late (e.g. just after midnight), the game still credits it toward the day that was 'in progress' rather than harshly cutting you off at exactly 12:00 AM.",
    "Your longest streak ever is saved separately and never decreases, even if your current streak resets — it's a permanent personal best.",
    "Winning a Streak Shield from the spin wheel arms one-time protection: the next time you'd otherwise lose your streak from a missed day, the shield absorbs it instead and current streak stays intact. The shield is then used up — winning another one re-arms it.",
    "The streak reset itself runs automatically overnight (a scheduled job), not the moment you miss a day — so a broken streak shows as reset the next time you check, not instantly at midnight.",
  ],
};

// --- Quests ---------------------------------------------------------------

export const RUSH_QUESTS = {
  summary: "Two daily quests reset fresh every day at midnight.",
  restockRun: {
    label: "Restock Run",
    target: 5,
    details: [
      "The game shows you 5 real inventory items from your shop — specifically the ones that haven't been touched/updated in the longest time, so it naturally points you at what's been neglected.",
      "Tap 'verify' on an item to confirm its count is accurate. Each verification earns 10 XP.",
      "Verify all 5 for the day and you complete the quest: +30 bonus XP, and it unlocks that day's reward spin.",
      "Each item can only be verified once per day. The list itself refreshes with a new set of items the next day.",
    ],
    role: "both" as RushRole,
  },
  salesSprint: {
    label: "Sales Sprint",
    details: [
      "Staff see two side-by-side trackers: 'Your Sales' (only sales you personally made count toward this one) and 'Store Target' (every sale in the store, made by anyone, including the owner).",
      "Owners see just the one store-wide tracker — the same 'Store Target' number staff see, since an owner isn't attributed to a single personal number the way a staff member is.",
      "Both trackers compare today's total to yesterday's. On a day with no 'yesterday' to compare to (e.g. a brand new store), the target defaults to ₦10,000 so the bar has something meaningful to fill toward.",
      "Beating yesterday's number on either tracker shows its own 'Record pace' badge. This is a motivational display only — it doesn't currently award its own XP or unlock anything by itself; the XP comes from the individual sales that make up the total.",
    ],
    role: "both" as RushRole,
  },
};

// --- Reward spin ------------------------------------------------------------

export const RUSH_SPIN = {
  summary:
    "A once-a-day spin, unlocked by finishing that day's Restock Run. Every prize on the wheel is owner-managed — some are cosmetic and apply instantly, others are real cash or gifts the owner hands over and confirms afterward.",
  details: [
    "The spin button only lights up once you've completed all 5 items in Restock Run for the day.",
    "You get exactly one spin per day, ever — once claimed, it's locked for that calendar day and can't be spun again, win or lose.",
    "The wheel starts with 5 default cosmetic prizes (badges, an XP boost, a streak shield), but the owner can edit, remove, or add to this list at any time — including adding real cash or gift prizes — from Manage Spin Prizes on the Rush world screen.",
    "Cosmetic wins apply immediately: an XP Boost adds straight to your XP bar, a Streak Shield arms itself right away (see Streaks), and badges/titles are saved to your profile instantly.",
    "Cash or gift wins don't get handed to you automatically — they're marked 'Pending' until your owner physically settles it with you and confirms it on their end via their Settlements page. Check My Wins to see the status of anything you've won.",
    "Odds aren't equal across prizes — the owner sets a weight per prize, so some are common pulls and some are rare. The exact weighting isn't shown on the wheel; it's meant to feel like a genuine surprise each time.",
  ],
};

// --- Shop health & the world view -------------------------------------------

export const RUSH_SHOP_HEALTH = {
  summary:
    "A live score from 0–100 showing how the shop is doing right now, recalculated fresh every time you open the Rush world — nothing about it is saved or 'locked in.'",
  weights: { stock: "40%", sales: "35%", staff: "25%" },
  details: [
    "Stock (40% of the score): the share of tracked inventory items currently above their restock level. If nothing in the shop has a restock level set, this shows as 100% by default.",
    "Sales trend (35%): today's sales compared to yesterday's. Matching or beating yesterday scores well; a quiet day so far scores lower (it updates as the day goes on).",
    "Staff activity (25%): the share of assigned staff who have logged at least one sale today. If a store has no assigned staff yet, this defaults to 100% so a solo owner isn't penalized.",
    "The combined score maps to one of 5 tiers, which changes how the storefront looks on the world screen: Just getting started → Finding its feet → Steady → Thriving → Bustling.",
    "Owners running more than one store also see a store-vs-store comparison, ranking their stores by this same health score side by side.",
  ],
};

// --- Leaderboard ------------------------------------------------------------

export const RUSH_LEADERBOARD = {
  summary: "A weekly ranking of the top 5 most active people in the store, by XP earned in the last 7 days.",
  details: [
    "Only counts XP earned in the trailing 7 days (a rolling window, not a fixed Monday-to-Sunday week) — so it always reflects recent activity, not all-time totals.",
    "Scoped to one store at a time — it ranks people within the currently active store, not across an owner's whole business if they run multiple stores.",
    "Anyone with zero XP in the last 7 days simply doesn't appear, rather than showing at the bottom with 0.",
    "Shows up to the top 5 people, ranked highest XP first.",
  ],
};

// --- Navigating the Rush world screen ---------------------------------------

export const RUSH_NAVIGATION = {
  summary: "Where to find everything and how the screen is laid out top to bottom.",
  details: [
    "Staff reach Rush from their dashboard; owners reach it from theirs — each has its own entry point but shows the same world screen, scoped to their role.",
    "At the top: the shop's storefront visual (its look reflects the current shop health tier) plus the shop health score.",
    "Next: current level, XP progress bar toward the next level.",
    "Then: current streak and best-ever streak, side by side.",
    "Then: Sales Sprint. Staff see two cards here — 'Your Sales' and 'Store Target'; owners see just the one store-wide card.",
    "For staff: a Clock In / Clock Out card — clock in at or before the shift start time (owner-set) to earn on-time XP for the day.",
    "Then: Restock Run — the day's 5 items to verify.",
    "Then: the reward spin (only shows as spinnable once Restock Run is done).",
    "For staff: a 'My Wins' link — every spin you've ever claimed, with Pending/Settled status on any cash or gift prizes.",
    "For owners: a 'Manage prizes' link and a 'Settlements' link, side by side — Manage Prizes is also where you set the shift start time (what counts as 'on time' for staff clock-ins); Settlements shows a badge with how many cash/gift wins are still waiting on you.",
    "Then: the weekly leaderboard, and — for multi-store owners — the store comparison.",
    "At the very bottom: a running total of all-time XP earned.",
    "A 'Back to dashboard' link stays pinned at the top of the screen at all times.",
  ],
};