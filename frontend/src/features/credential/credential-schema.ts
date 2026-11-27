import { z } from 'zod';

import {
  checkValidity,
  externalUrl,
  localizedText,
  yearMonth,
  MAX_CREDENTIAL_ID_LENGTH,
  MAX_CREDENTIAL_NAME_LENGTH,
  MAX_DESCRIPTION_LENGTH,
  MAX_ISSUER_LENGTH,
} from '@portfolio/shared';
import { filledLocales, optionalLocalized } from '@/lib/localized-schema';

/** A blank text input is absent, so PUT clears what was stored. */
function optionalText(rule: z.ZodType<string>) {
  return z.preprocess(
    (value) => (typeof value === 'string' ? value.trim() || undefined : value),
    rule.optional(),
  );
}

/**
 * The form's schema. Every rule comes from the shared package, including
 * `checkValidity` - so the admin is told about an expiry that precedes its
 * issue before a request is made, by the rule the server would have used.
 *
 * An expiry in the past is **not** an error here either: an expired credential
 * is a true fact, and the list marks it rather than the form refusing it.
 */
export const credentialSchema = z
  .object({
    name: z.preprocess(
      filledLocales,
      localizedText(MAX_CREDENTIAL_NAME_LENGTH),
    ),
    issuer: z.preprocess(filledLocales, localizedText(MAX_ISSUER_LENGTH)),
    issuedAt: yearMonth,
    /**
     * The input holds '' when empty, which is not a month; absent is what the
     * API means by "does not expire".
     */
    expiresAt: z.preprocess(
      (value) => (value === '' ? undefined : value),
      yearMonth.optional(),
    ),
    credentialId: optionalText(z.string().max(MAX_CREDENTIAL_ID_LENGTH)),
    credentialUrl: optionalText(externalUrl),
    description: optionalLocalized(MAX_DESCRIPTION_LENGTH),
  })
  .superRefine(checkValidity);

/** What the API is sent. */
export type CredentialInput = z.infer<typeof credentialSchema>;

export type LocalizedValues = Record<string, string>;

/**
 * What the form holds. Declared rather than inferred, because preprocessing
 * types the schema's own input as `unknown`.
 */
export type CredentialFormValues = {
  name: LocalizedValues;
  issuer: LocalizedValues;
  issuedAt: string;
  expiresAt: string;
  credentialId: string;
  credentialUrl: string;
  description: LocalizedValues;
};
