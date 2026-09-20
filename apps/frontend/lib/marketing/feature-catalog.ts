export type MarketingFeature = {
  id: string;
  name: string;
  category: string;
  description: string;
  angles: string[];
  keywords: string[];
};

export const GARRISON_MARKET_MARKETING_FEATURES: MarketingFeature[] = [
  {
    id: "inventory",
    name: "Inventory Management",
    category: "Operations",
    description: "Track stock, prices, categories, restock levels, product images, SKUs and expiry information.",
    angles: ["stop guessing stock levels", "know what needs restocking", "keep product records organized"],
    keywords: ["inventory", "stock", "restock", "expiry", "SKU"],
  },
  {
    id: "batch-stock",
    name: "Batch Stock Tracking",
    category: "Inventory",
    description: "Track stock in batches for products that need traceable quantity and stock movement records.",
    angles: ["trace stock more clearly", "reduce stock confusion", "keep stock movements accountable"],
    keywords: ["batch", "stock batch", "stock movement"],
  },
  {
    id: "scale-inventory",
    name: "Scale-Based Inventory",
    category: "Inventory",
    description: "Manage stock sold or tracked by measurable units such as weight and quantity.",
    angles: ["manage measured goods", "handle weight-based stock", "keep measured inventory organized"],
    keywords: ["scale", "weight", "measured goods", "kg"],
  },
  {
    id: "sales-orders",
    name: "Sales & Orders",
    category: "Sales",
    description: "Record store sales and orders with payment details and staff attribution.",
    angles: ["record sales properly", "see where sales are coming from", "keep sales history usable"],
    keywords: ["sales", "orders", "POS", "payments"],
  },
  {
    id: "invoices",
    name: "Invoices & Summaries",
    category: "Sales",
    description: "Create and review invoices and invoice summaries for store activity.",
    angles: ["look more organized", "keep customer transactions documented", "review invoice activity"],
    keywords: ["invoice", "receipt", "summary"],
  },
  {
    id: "sales-history-reports",
    name: "Sales History & Reports",
    category: "Insights",
    description: "Review historical sales and operational reporting to understand store activity.",
    angles: ["stop relying on memory", "see patterns in sales", "make decisions from records"],
    keywords: ["reports", "sales history", "analytics"],
  },
  {
    id: "customers",
    name: "Customer Profiles",
    category: "Customers",
    description: "Keep customer records connected to store activity and orders.",
    angles: ["remember your customers", "keep customer history organized", "build a cleaner customer book"],
    keywords: ["customers", "customer profiles", "customer history"],
  },
  {
    id: "debtors",
    name: "Debtor Tracking",
    category: "Finance",
    description: "Track outstanding customer balances and payments instead of relying on loose notes.",
    angles: ["know who owes the shop", "track payments", "reduce forgotten balances"],
    keywords: ["debtor", "debt", "owing", "payment"],
  },
  {
    id: "expenses",
    name: "Expense Tracking",
    category: "Finance",
    description: "Record store expenses and review them by period.",
    angles: ["know where money is going", "stop losing expense records", "understand operating costs"],
    keywords: ["expenses", "costs", "spending"],
  },
  {
    id: "consignment",
    name: "Consignment Management",
    category: "Operations",
    description: "Track items sent out on consignment, quantities sold or returned, and settlement activity.",
    angles: ["track goods outside the shop", "know what came back", "keep consignments accountable"],
    keywords: ["consignment", "goods out", "returns", "settlement"],
  },
  {
    id: "wastage",
    name: "Wastage Tracking",
    category: "Inventory",
    description: "Record inventory wastage and review wastage activity with staff involvement where applicable.",
    angles: ["see stock losses clearly", "record wastage properly", "reduce invisible losses"],
    keywords: ["wastage", "loss", "stock loss"],
  },
  {
    id: "multi-store",
    name: "Multi-Store Management",
    category: "Operations",
    description: "Support owner accounts managing stores and store-specific operational data.",
    angles: ["manage more than one location", "keep branches organized", "separate store activity"],
    keywords: ["multiple stores", "branches", "locations"],
  },
  {
    id: "staff-management",
    name: "Staff Management",
    category: "Team",
    description: "Create staff accounts, assign them to stores and review operational activity.",
    angles: ["know what the team is doing", "organize staff access", "run a more accountable team"],
    keywords: ["staff", "team", "employees"],
  },
  {
    id: "rush",
    name: "Rush Staff Gamification",
    category: "Team",
    description: "Use XP, levels, streaks, quests, leaderboards and rewards to make staff activity more engaging.",
    angles: ["make daily work more engaging", "turn routine tasks into challenges", "recognize consistent staff activity"],
    keywords: ["Rush", "XP", "streaks", "leaderboard", "rewards"],
  },
  {
    id: "clock-in-out",
    name: "Clock In / Clock Out",
    category: "Team",
    description: "Record staff attendance and on-time clock-ins for store operations.",
    angles: ["keep attendance visible", "track punctuality", "replace loose attendance notes"],
    keywords: ["clock in", "attendance", "punctuality"],
  },
  {
    id: "shop-health",
    name: "Shop Health",
    category: "Insights",
    description: "Surface an overall shop-health signal using stock, sales trend and staff activity inputs.",
    angles: ["get a quick health check", "spot operational pressure", "see the shop at a glance"],
    keywords: ["shop health", "health score", "store health"],
  },
  {
    id: "ask-me",
    name: "Ask Me Business Assistant",
    category: "AI",
    description: "Ask questions about verified store sales, inventory, customers, staff activity and other operational data.",
    angles: ["ask instead of digging through screens", "get answers from your store records", "turn your records into useful answers"],
    keywords: ["AI", "assistant", "Ask Me", "business intelligence"],
  },
  {
    id: "messaging-support",
    name: "Owner, Staff & Support Messaging",
    category: "Communication",
    description: "Provide in-app messaging between store users and Garrison Market support.",
    angles: ["keep store conversations organized", "get help without leaving the app", "keep operational questions in one place"],
    keywords: ["messages", "support", "chat"],
  },
  {
    id: "notifications",
    name: "Notifications & Alerts",
    category: "Communication",
    description: "Deliver application notifications for important account and store events.",
    angles: ["stay on top of important events", "reduce missed alerts", "keep the team informed"],
    keywords: ["notifications", "alerts"],
  },
  {
    id: "referrals",
    name: "Referral & Affiliate Features",
    category: "Growth",
    description: "Support referral codes and an affiliate program for bringing new business owners into Garrison Market.",
    angles: ["grow through referrals", "give customers a reason to share", "turn recommendations into tracked referrals"],
    keywords: ["referral", "affiliate", "referral code"],
  },
];

export function getMarketingFeature(featureId: string) {
  return GARRISON_MARKET_MARKETING_FEATURES.find((feature) => feature.id === featureId) ?? null;
}
