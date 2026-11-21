import { describe, expect, it } from "vitest";
import { getSafeRedirectPath, isGuestOnlyPath, isPublicPath } from "@/lib/auth/routes";

describe("getSafeRedirectPath", () => {
  it.each([
    ["/products?page=2", "/products?page=2"],
    ["/dashboard#top", "/dashboard#top"],
    ["/a/../b", "/b"],
  ])("keeps same-origin path %s", (input, expected) => {
    expect(getSafeRedirectPath(input)).toBe(expected);
  });

  it.each([
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "javascript:alert(1)",
    "dashboard",
    "/\u0000x",
    "",
    null,
    undefined,
  ])("rejects unsafe value %s", (input) => {
    expect(getSafeRedirectPath(input as string | null | undefined)).toBe("/dashboard");
  });

  it("uses the provided fallback", () => {
    expect(getSafeRedirectPath("//x", "/onboarding")).toBe("/onboarding");
  });
});

describe("route classification", () => {
  it("treats auth pages as public and app pages as protected", () => {
    for (const p of ["/", "/login", "/signup", "/forgot-password", "/reset-password", "/auth/confirm"]) {
      expect(isPublicPath(p)).toBe(true);
    }
    for (const p of ["/dashboard", "/onboarding", "/products/1", "/loginx", "/authority"]) {
      expect(isPublicPath(p)).toBe(false);
    }
  });

  it("only sends signed-in users away from guest pages", () => {
    expect(isGuestOnlyPath("/login")).toBe(true);
    expect(isGuestOnlyPath("/reset-password")).toBe(false);
    expect(isGuestOnlyPath("/auth/confirm")).toBe(false);
  });
});
