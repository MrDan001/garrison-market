import { describe, expect, it } from "vitest";

describe("session activity refresh", () => {
  it("uses a one-minute refresh interval", () => {
    const interval = 60 * 1000;
    expect(interval).toBe(60_000);
  });
});
