import { describe, expect, it } from "vitest";
import { fieldErrorsFromZod } from "@/lib/actions";
import { loginSchema, resetPasswordSchema, signupSchema } from "@/lib/validation/auth";
import { companyOnboardingSchema } from "@/lib/validation/company";

const errorsOf = (result: { success: boolean; error?: Parameters<typeof fieldErrorsFromZod>[0] }) =>
  result.success ? {} : fieldErrorsFromZod(result.error!);

describe("auth schemas", () => {
  it("normalises email and accepts valid login", () => {
    const result = loginSchema.safeParse({ email: "  Arta@Example.COM ", password: "x" });
    expect(result.success && result.data.email).toBe("arta@example.com");
  });

  it("reports i18n keys for invalid login", () => {
    expect(errorsOf(loginSchema.safeParse({ email: "nope", password: "" }))).toEqual({
      email: "validation.email",
      password: "validation.required",
    });
  });

  it("enforces password strength and confirmation on signup", () => {
    const base = { fullName: "Arta Krasniqi", email: "a@b.co" };
    expect(errorsOf(signupSchema.safeParse({ ...base, password: "short1", confirmPassword: "short1" })).password).toBe(
      "validation.passwordMin",
    );
    expect(
      errorsOf(signupSchema.safeParse({ ...base, password: "lettersonly", confirmPassword: "lettersonly" })).password,
    ).toBe("validation.passwordWeak");
    expect(
      errorsOf(signupSchema.safeParse({ ...base, password: "Secret123", confirmPassword: "Secret124" })).confirmPassword,
    ).toBe("validation.passwordsMismatch");
    expect(signupSchema.safeParse({ ...base, password: "Secret123", confirmPassword: "Secret123" }).success).toBe(true);
  });

  it("rejects passwords longer than bcrypt's 72-byte limit", () => {
    const long = `a1${"x".repeat(80)}`;
    expect(errorsOf(resetPasswordSchema.safeParse({ password: long, confirmPassword: long })).password).toBe(
      "validation.passwordMax",
    );
  });
});

describe("company onboarding schema", () => {
  it("accepts minimal input and drops empty optionals", () => {
    const result = companyOnboardingSchema.safeParse({ name: "  Alfa Tregti ", businessNumber: "", phone: "", planCode: "starter" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toMatchObject({ name: "Alfa Tregti", planCode: "starter" });
      expect(result.data.businessNumber).toBeUndefined();
      expect(result.data.phone).toBeUndefined();
    }
  });

  it("validates NUI digits, phone and plan", () => {
    const errors = errorsOf(
      companyOnboardingSchema.safeParse({ name: "A", businessNumber: "81-ABC", phone: "call me", planCode: "enterprise" }),
    );
    expect(errors).toEqual({
      name: "validation.companyNameMin",
      businessNumber: "validation.businessNumber",
      phone: "validation.phone",
      planCode: "validation.plan",
    });
  });

  it("strips spaces from the business number", () => {
    const result = companyOnboardingSchema.safeParse({ name: "Beta", businessNumber: "811 234 567", planCode: "business" });
    expect(result.success && result.data.businessNumber).toBe("811234567");
  });
});
