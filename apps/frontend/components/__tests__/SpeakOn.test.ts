import { describe, expect, it } from "vitest";
import { resolveSpeakOnRequest } from "../../lib/speak-on-routing";

describe("Speak On request routing", () => {
  it("directs staff product creation to the owner without opening a form", () => {
    const result = resolveSpeakOnRequest("Please add a new product", "staff");
    expect(result.href).toBeUndefined();
    expect(result.reply).toContain("Only the owner can add");
  });

  it("opens the existing owner product form for owners", () => {
    const result = resolveSpeakOnRequest("add a product", "owner");
    expect(result.href).toBe("/owner/inventory/add");
  });

  it("blocks staff restocking and directs them to the owner", () => {
    const result = resolveSpeakOnRequest("restock this item", "staff");
    expect(result.href).toBeUndefined();
    expect(result.reply).toContain("Only the owner can add or restock");
  });

  it("routes shared expense, wastage, consignment and debt workflows by role", () => {
    expect(resolveSpeakOnRequest("log an expense", "staff").href).toBe("/staff/expenses");
    expect(resolveSpeakOnRequest("submit wastage", "owner").href).toBe("/owner/wastage");
    expect(resolveSpeakOnRequest("sign out consignment", "staff").href).toBe("/staff/consignment");
    expect(resolveSpeakOnRequest("record a debt payment", "owner").href).toBe("/owner/customers");
  });

  it("does not invent an action for an unsupported request", () => {
    const result = resolveSpeakOnRequest("change my subscription", "owner");
    expect(result.href).toBeUndefined();
    expect(result.reply).toContain("I can help you reach");
  });
});
