import { z } from "zod";

// Error messages are i18n keys under `validation.*`, translated by the form components.

const email = z
  .string()
  .trim()
  .min(1, "validation.required")
  .max(254, "validation.tooLong")
  .pipe(z.email("validation.email"))
  .transform((v) => v.toLowerCase());

export const passwordSchema = z
  .string()
  .min(8, "validation.passwordMin")
  .max(72, "validation.passwordMax")
  .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), "validation.passwordWeak");

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "validation.required").max(72, "validation.passwordMax"),
  next: z.string().optional(),
});

export const signupSchema = z
  .object({
    fullName: z.string().trim().min(2, "validation.nameMin").max(120, "validation.tooLong"),
    email,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "validation.passwordsMismatch",
  });

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "validation.passwordsMismatch",
  });

export type LoginInput = z.input<typeof loginSchema>;
export type SignupInput = z.input<typeof signupSchema>;
export type ForgotPasswordInput = z.input<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.input<typeof resetPasswordSchema>;
