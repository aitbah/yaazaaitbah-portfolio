import { z } from 'zod';

import {
  checkEmailChanged,
  checkPasswordChanged,
  emailChangeRules,
  passwordChangeRules,
} from '@portfolio/shared';

/**
 * The form's schema: the API's rules plus a confirmation it never sees. With no
 * email reset, a typo in a new password is a lockout until `admin:password` is
 * run, so it is typed twice.
 */
export const passwordFormSchema = z
  .object({ ...passwordChangeRules, confirmPassword: z.string().min(1) })
  .superRefine(checkPasswordChanged)
  .superRefine((value, ctx) => {
    if (value.newPassword !== value.confirmPassword) {
      ctx.addIssue({
        code: 'custom',
        path: ['confirmPassword'],
        params: { code: 'MISMATCH' },
        message: 'The two passwords do not match',
      });
    }
  });

export type PasswordFormValues = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

export type PasswordFormInput = z.infer<typeof passwordFormSchema>;

/**
 * The address form's schema, built per current address, which "unchanged" is
 * measured against (the server checks again). Typed twice: with no mail, a typo
 * is a lockout until `npm run admin:email`.
 */
export function emailFormSchema(currentEmail: string) {
  return z
    .object({ ...emailChangeRules, confirmEmail: z.string().min(1) })
    .superRefine(checkEmailChanged(currentEmail))
    .superRefine((value, ctx) => {
      if (value.newEmail !== value.confirmEmail) {
        ctx.addIssue({
          code: 'custom',
          path: ['confirmEmail'],
          params: { code: 'MISMATCH' },
          message: 'The two addresses do not match',
        });
      }
    });
}

export type EmailFormValues = {
  currentPassword: string;
  newEmail: string;
  confirmEmail: string;
};

export type EmailFormInput = z.infer<ReturnType<typeof emailFormSchema>>;
