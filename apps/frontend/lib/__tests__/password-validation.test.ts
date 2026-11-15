import { describe, expect, it } from "vitest";
import { validatePassword } from "../password-validation";

describe("validatePassword", () => {
  it("requires a password", () => {
    expect(validatePassword(undefined).valid).toBe(false);
    expect(validatePassword("").valid).toBe(false);
  });

  it("requires at least eight characters", () => {
    expect(validatePassword("1234567").valid).toBe(false);
    expect(validatePassword("12345678")).toEqual({ valid: true });
  });

  it("rejects excessively long passwords", () => {
    expect(validatePassword("a".repeat(129)).valid).toBe(false);
    expect(validatePassword("a".repeat(128))).toEqual({ valid: true });
  });
});
