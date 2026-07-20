// lib/support-intake-config.ts
// Single source of truth for the pre-chat "why are you contacting admin"
// triage flow. Edit the options/deflection text here — the wizard and the
// summary message sent to admin both read from this file.

export type IntakeCategory = "billing" | "login" | "bug" | "howto" | "staff_mgmt" | "other";

export interface Option {
  value: string;
  label: string;
}

export const CATEGORY_OPTIONS: Option[] = [
  { value: "billing", label: "Billing, payment, or free trial" },
  { value: "login", label: "Login or account access" },
  { value: "bug", label: "Something's broken / a bug" },
  { value: "howto", label: "How do I do something?" },
  { value: "staff_mgmt", label: "Staff or store management" },
  { value: "other", label: "Something else" },
];

export const URGENCY_OPTIONS: Option[] = [
  { value: "urgent", label: "Urgent — I can't work right now" },
  { value: "important", label: "Important, but not blocking" },
  { value: "question", label: "Just a general question" },
];

export const YES_NO_OPTIONS: Option[] = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
];

export const SELF_HELP_OPTIONS: Option[] = [
  { value: "yes_no_luck", label: "Yes, already tried — didn't help" },
  { value: "no", label: "No, haven't tried anything yet" },
  { value: "na", label: "Not applicable" },
];

export interface DetailOption extends Option {
  /** Static deflection text. Use dynamicTrialInfo for a live trial-days answer instead. */
  deflection?: string;
  deflectionLink?: { href: string; label: string; ownerOnly?: boolean };
  /** Special-cased in the wizard to inject the live trial-days-left count. */
  dynamicTrialInfo?: boolean;
}

export const DETAIL_QUESTIONS: Record<IntakeCategory, { question: string; options: DetailOption[] }> = {
  billing: {
    question: "What specifically about billing?",
    options: [
      { value: "trial_days", label: "How many trial days do I have left?", dynamicTrialInfo: true },
      {
        value: "upgrade",
        label: "I want to upgrade or change my plan",
        deflection: "You can compare plans and upgrade any time from the Billing page — it takes about a minute.",
        deflectionLink: { href: "/owner/billing", label: "Go to Billing", ownerOnly: true },
      },
      { value: "payment_failed", label: "My payment didn't go through" },
      { value: "other_billing", label: "Something else about billing" },
    ],
  },
  login: {
    question: "What's happening?",
    options: [
      {
        value: "forgot_password",
        label: "I forgot my password",
        deflection: 'Tap "Forgot password" on the login screen to reset it by email — no need to wait for us.',
        deflectionLink: { href: "/login", label: "Go to Login" },
      },
      {
        value: "pending_approval",
        label: "My account is pending approval",
        deflection:
          "New owner accounts are reviewed before activation. This usually clears within a business day — check your status page for the latest.",
        deflectionLink: { href: "/pending", label: "Check status", ownerOnly: true },
      },
      { value: "other_login", label: "Something else" },
    ],
  },
  bug: {
    question: "What were you trying to do when it broke?",
    options: [
      { value: "sale", label: "Making a sale / using the POS" },
      { value: "inventory", label: "Adding or editing inventory" },
      { value: "report", label: "Viewing or generating a report" },
      { value: "other_bug", label: "Something else" },
    ],
  },
  howto: {
    question: "What do you need to do?",
    options: [
      {
        value: "add_staff",
        label: "Add a staff member",
        deflection: "Go to Staff → Add Staff, fill in their details, and they'll get login access right away.",
        deflectionLink: { href: "/owner/staff/register", label: "Add staff", ownerOnly: true },
      },
      {
        value: "add_inventory",
        label: "Add inventory / products",
        deflection: "Go to Inventory → Add Item to create a new product with stock, price, and photo.",
        deflectionLink: { href: "/owner/inventory/add", label: "Add inventory", ownerOnly: true },
      },
      {
        value: "apply_discount",
        label: "Apply a discount on a sale",
        deflection:
          "Discounts can be applied right from the sale screen once the discount permission toggle is enabled in Settings.",
      },
      {
        value: "generate_report",
        label: "Generate a report",
        deflection: "Go to Reports to create or view a report for any date range.",
        deflectionLink: { href: "/owner/report", label: "Go to Reports", ownerOnly: true },
      },
      { value: "other_howto", label: "Something else" },
    ],
  },
  staff_mgmt: {
    question: "What's this about?",
    options: [
      {
        value: "remove_staff",
        label: "Remove or deactivate a staff member",
        deflection: "Open the staff member's profile from the Staff page — you'll find that option there.",
        deflectionLink: { href: "/owner/staff", label: "Go to Staff", ownerOnly: true },
      },
      {
        value: "discount_toggle",
        label: "Staff discount permissions",
        deflection: "You can turn staff discount access on or off from Settings.",
        deflectionLink: { href: "/owner/settings", label: "Go to Settings", ownerOnly: true },
      },
      { value: "other_staff", label: "Something else" },
    ],
  },
  other: {
    question: "",
    options: [],
  },
};

export function labelForCategory(value: string) {
  return CATEGORY_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

export function labelForUrgency(value: string) {
  return URGENCY_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

export function labelForDetail(category: string, value: string) {
  const q = DETAIL_QUESTIONS[category as IntakeCategory];
  return q?.options.find((o) => o.value === value)?.label ?? value;
}
