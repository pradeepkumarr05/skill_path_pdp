import { z } from 'zod';

// Trim + lowercase email up front so validation, storage, and lookups are
// all consistent. z.string().email() rejects malformed addresses before
// they ever reach a database query or get echoed back in a response.
const email = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(254)
  .email('Enter a valid email address.');

// Deliberately does not require a specific character mix (composition
// rules push users toward predictable patterns). Length is the strongest
// practical signal, per NIST 800-63B guidance.
const password = z
  .string()
  .min(10, 'Password must be at least 10 characters.')
  .max(256, 'Password is too long.');

const fullName = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[\p{L}\p{M}' .-]+$/u, 'Name contains invalid characters.')
  .optional();

const otp = z
  .string()
  .trim()
  .regex(/^\d{6}$/, 'Enter the 6-digit code.');

export const registerSchema = z.object({
  email,
  password,
  fullName,
  rememberDevice: z.boolean().optional(),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Password is required.').max(256),
  rememberDevice: z.boolean().optional(),
});

export const forgotPasswordSchema = z.object({
  email,
});

export const resetPasswordSchema = z.object({
  email,
  otp,
  newPassword: password,
});

const pdfFileName = z
  .string()
  .trim()
  .max(260)
  .regex(/\.pdf$/i, 'Only PDF files are accepted.')
  .optional()
  .or(z.literal(''));

export const profileSetupSchema = z.object({
  name: z.string().trim().min(2, 'Enter your full name.').max(120),
  email,
  qualification: z.string().trim().min(2).max(80),
  domain: z.string().trim().min(2).max(100),
  interestedRoles: z.array(z.string().trim().min(1).max(100)).min(1, 'Select at least one role.').max(12),
  claimedSkills: z.array(z.string().trim().min(1).max(80)).max(30),
  resumeFileName: pdfFileName,
  transcriptFileName: pdfFileName,
});

/**
 * Runs a zod schema and returns a plain {success, data, error} shape so
 * route handlers don't need to know about zod's internals.
 */
export function validate(schema, payload) {
  const result = schema.safeParse(payload);
  if (!result.success) {
    const message = result.error.issues[0]?.message || 'Invalid input.';
    return { success: false, error: message };
  }
  return { success: true, data: result.data };
}
