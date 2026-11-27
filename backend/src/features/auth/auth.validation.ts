import { z } from 'zod';

import {
  checkPasswordChanged,
  emailChangeRules,
  loginRules,
  newPassword,
  passwordChangeRules,
} from '@portfolio/shared';

/** The rules themselves come from `@portfolio/shared`, so both sides agree. */
export const loginSchema = z.object(loginRules);

export type LoginInput = z.infer<typeof loginSchema>;

/**
 * Changing a password, which takes the current one too - see
 * `passwordChangeRules` for why the session alone is not enough.
 */
export const passwordChangeSchema = z
  .object(passwordChangeRules)
  .superRefine(checkPasswordChanged);

export type PasswordChangeInput = z.infer<typeof passwordChangeSchema>;

/**
 * Changing the address the account signs in with.
 *
 * No `superRefine` for "unchanged": the address it would be compared against is
 * not in the request. The service reads the stored one and reports the same
 * code from there.
 */
export const emailChangeSchema = z.object(emailChangeRules);

export type EmailChangeInput = z.infer<typeof emailChangeSchema>;

/**
 * Account creation, which is the other place a password is *set* rather than
 * checked - so it meets the same policy, from the same rule.
 */
export const adminCredentialsSchema = z.object({
  email: z.email(),
  password: newPassword,
});

export type AdminCredentials = z.infer<typeof adminCredentialsSchema>;
