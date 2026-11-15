/**
 * Garrison Speak On — voice-operation capability policy.
 *
 * This is a UI/orchestration policy only. Every operation MUST still call
 * the existing server action, which remains the authoritative permission,
 * subscription, store-scope and validation boundary.
 *
 * Keep this deliberately limited to the current owner/staff roles. A future
 * manager role must be designed and approved separately; do not infer it here.
 */

export type SpeakOnRole = "owner" | "staff";

export type SpeakOnOperation =
  | "inventory.product.create"
  | "inventory.product.update"
  | "inventory.product.remove"
  | "inventory.stock.add"
  | "sales.standard.create"
  | "sales.scale.create"
  | "sales.merged.create"
  | "expenses.create"
  | "debts.payment.record"
  | "wastage.submit"
  | "wastage.approve"
  | "wastage.decline"
  | "consignment.sign-out"
  | "consignment.settle"
  | "consignment.owner-reconcile";

const OWNER_ONLY: ReadonlySet<SpeakOnOperation> = new Set([
  "inventory.product.create",
  "inventory.product.update",
  "inventory.product.remove",
  "inventory.stock.add",
  "wastage.approve",
  "wastage.decline",
  "consignment.owner-reconcile",
]);

const OWNER_AND_STAFF: ReadonlySet<SpeakOnOperation> = new Set([
  "sales.standard.create",
  "sales.scale.create",
  "sales.merged.create",
  "expenses.create",
  "debts.payment.record",
  "wastage.submit",
  "consignment.sign-out",
  "consignment.settle",
]);

export type SpeakOnPermission = {
  allowed: boolean;
  reason?: string;
  nextStep?: string;
};

/**
 * Resolve the current role's permission before presenting a confirmation.
 * This does not replace server-side authorization; the server action must
 * independently reject unauthorized requests.
 */
export function getSpeakOnPermission(
  role: SpeakOnRole,
  operation: SpeakOnOperation,
): SpeakOnPermission {
  if (OWNER_ONLY.has(operation)) {
    return role === "owner"
      ? { allowed: true }
      : {
          allowed: false,
          reason:
            operation === "inventory.product.create"
              ? "Only the owner can add a new product."
              : operation === "inventory.stock.add"
                ? "Only the owner can add or restock inventory."
                : "This action is reserved for the owner.",
          nextStep:
            operation === "inventory.product.create"
              ? "Please ask the owner to add this product."
              : operation === "inventory.stock.add"
                ? "Please ask the owner to add the stock."
                : "Please ask the owner to complete this action.",
        };
  }

  if (OWNER_AND_STAFF.has(operation)) return { allowed: true };

  // Fail closed for any newly introduced operation until its permission is
  // explicitly classified above.
  return {
    allowed: false,
    reason: "This Speak On operation has not been enabled for your role.",
  };
}
