import { describe, expect, it } from "vitest";
import { getSpeakOnPermission, type SpeakOnOperation } from "../speak-on/permissions";

describe("Garrison Speak On role permissions", () => {
  it("allows owners to use owner-only inventory operations", () => {
    const ownerOnly: SpeakOnOperation[] = [
      "inventory.product.create",
      "inventory.product.update",
      "inventory.product.remove",
      "inventory.stock.add",
    ];

    for (const operation of ownerOnly) {
      expect(getSpeakOnPermission("owner", operation).allowed).toBe(true);
    }
  });

  it("declines staff requests to add products or stock with a clear owner handoff", () => {
    const product = getSpeakOnPermission("staff", "inventory.product.create");
    const stock = getSpeakOnPermission("staff", "inventory.stock.add");

    expect(product.allowed).toBe(false);
    expect(product.nextStep).toMatch(/ask the owner to add this product/i);
    expect(stock.allowed).toBe(false);
    expect(stock.nextStep).toMatch(/ask the owner to add the stock/i);
  });

  it("allows both current roles to perform shared business operations", () => {
    const shared: SpeakOnOperation[] = [
      "sales.standard.create",
      "sales.scale.create",
      "sales.merged.create",
      "expenses.create",
      "debts.payment.record",
      "wastage.submit",
      "consignment.sign-out",
      "consignment.settle",
    ];

    for (const role of ["owner", "staff"] as const) {
      for (const operation of shared) {
        expect(getSpeakOnPermission(role, operation).allowed).toBe(true);
      }
    }
  });

  it("keeps wastage approval and owner reconciliation owner-only", () => {
    for (const operation of [
      "wastage.approve",
      "wastage.decline",
      "consignment.owner-reconcile",
    ] as const) {
      expect(getSpeakOnPermission("staff", operation).allowed).toBe(false);
      expect(getSpeakOnPermission("owner", operation).allowed).toBe(true);
    }
  });

  it("fails closed for unclassified operations", () => {
    expect(
      getSpeakOnPermission("staff", "not-a-real-operation" as SpeakOnOperation).allowed,
    ).toBe(false);
  });
});
