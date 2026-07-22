export type IntakeCategory =
  | "billing"
  | "inventory"
  | "orders"
  | "staff"
  | "technical"
  | "other";

export interface DetailOption {
  value: string;
  label: string;
  dynamicTrialInfo?: boolean;
  deflection?: string;
  deflectionLink?: {
    href: string;
    label: string;
    ownerOnly?: boolean;
  };
}

interface DetailQuestionConfig {
  question: string;
  options: DetailOption[];
}

export const CATEGORY_OPTIONS: { id: IntakeCategory; label: string }[] = [
  { id: "billing", label: "Billing & subscription" },
  { id: "inventory", label: "Inventory & stock" },
  { id: "orders", label: "Orders & sales" },
  { id: "staff", label: "Staff accounts" },
  { id: "technical", label: "Something's not working" },
  { id: "other", label: "Something else" },
];

export const URGENCY_OPTIONS: { id: string; label: string }[] = [
  { id: "urgent", label: "Urgent — I need help right now" },
  { id: "important", label: "Important, but it can wait a bit" },
  { id: "question", label: "Just a question" },
];

export const YES_NO_OPTIONS: { id: string; label: string }[] = [
  { id: "yes", label: "Yes" },
  { id: "no", label: "No" },
];

export const SELF_HELP_OPTIONS: { id: string; label: string }[] = [
  { id: "none", label: "No, haven't tried anything" },
  { id: "some", label: "Yes, tried a few things" },
  { id: "everything", label: "Yes, tried everything I could think of" },
];

export const DETAIL_QUESTIONS: Record<IntakeCategory, DetailQuestionConfig> = {
  billing: {
    question: "What's going on with billing?",
    options: [
      { value: "trial_status", label: "How much time is left on my trial?", dynamicTrialInfo: true },
      {
        value: "change_plan",
        label: "I want to upgrade or change my plan",
        deflection: "You can change plans anytime from the Billing page.",
        deflectionLink: { href: "/owner/billing", label: "Go to Billing", ownerOnly: true },
      },
      {
        value: "payment_failed",
        label: "My payment didn't go through",
        deflection:
          "Double check your card details and try again from the Billing page. If it keeps failing, let us know your bank so we can look into it.",
        deflectionLink: { href: "/owner/billing", label: "Go to Billing", ownerOnly: true },
      },
    ],
  },
  inventory: {
    question: "What's the issue with inventory?",
    options: [
      {
        value: "low_stock",
        label: "Stock counts look wrong",
        deflection:
          "Check the Inventory page — quantities update automatically after each sale, so a mismatch usually means an order or restock wasn't logged there yet.",
        deflectionLink: { href: "/owner/inventory", label: "Go to Inventory" },
      },
      {
        value: "cant_add_item",
        label: "I can't add or edit an item",
        deflection:
          "Make sure required fields (name, price, quantity) are filled in — the save button stays disabled until they are.",
      },
    ],
  },
  orders: {
    question: "What's going on with orders?",
    options: [
      {
        value: "missing_order",
        label: "An order isn't showing up",
        deflection: "Check the Orders page filters — orders are scoped to the store currently selected.",
        deflectionLink: { href: "/owner/orders", label: "Go to Orders" },
      },
      {
        value: "wrong_total",
        label: "An order total looks wrong",
        deflection:
          "Totals include any per-item discounts applied at checkout — open the order to see the breakdown.",
      },
    ],
  },
  staff: {
    question: "What's the issue with staff accounts?",
    options: [
      {
        value: "cant_login",
        label: "A staff member can't log in",
        deflection:
          "Check the Staff page to confirm their account status is active, not pending or suspended.",
        deflectionLink: { href: "/owner/staff", label: "Go to Staff", ownerOnly: true },
      },
      {
        value: "permissions",
        label: "I need to change what a staff member can access",
        deflection: "Staff permissions can be toggled per person from the Staff page.",
        deflectionLink: { href: "/owner/staff", label: "Go to Staff", ownerOnly: true },
      },
    ],
  },
  technical: {
    question: "What's not working?",
    options: [
      {
        value: "error_message",
        label: "I'm seeing an error message",
        deflection: "Try refreshing the page first — if it keeps happening, tell us exactly what it says.",
      },
      {
        value: "slow_or_stuck",
        label: "The app is slow or stuck loading",
        deflection: "Try refreshing, or logging out and back in if a page won't load.",
      },
    ],
  },
  other: {
    question: "",
    options: [],
  },
};

export function labelForCategory(category: string): string {
  return CATEGORY_OPTIONS.find((c) => c.id === category)?.label ?? category;
}

export function labelForUrgency(urgency: string): string {
  return URGENCY_OPTIONS.find((u) => u.id === urgency)?.label ?? urgency;
}

export function labelForDetail(category: string, detailAnswer: string): string {
  const config = DETAIL_QUESTIONS[category as IntakeCategory];
  return config?.options.find((o) => o.value === detailAnswer)?.label ?? detailAnswer;
}