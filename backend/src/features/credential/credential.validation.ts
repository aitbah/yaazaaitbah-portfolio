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

/**
 * A credential; `PUT` replaces, so an omitted optional field is cleared. No
 * `kind` (the route sets it) and no `order` (the issue date is the order).
 */
const credentialFields = z.object({
  name: localizedText(MAX_CREDENTIAL_NAME_LENGTH),
  issuer: localizedText(MAX_ISSUER_LENGTH),
  issuedAt: yearMonth,
  /** Absent means it does not expire - not that it is still under way. */
  expiresAt: yearMonth.optional(),
  credentialId: z.string().trim().max(MAX_CREDENTIAL_ID_LENGTH).optional(),
  /**
   * The issuer's own page. A link rather than an upload: it is verifiable, it
   * stays current, and it costs no storage - and `externalUrl` is what keeps a
   * `javascript:` href out of an anchor.
   */
  credentialUrl: externalUrl.optional(),
  description: localizedText(MAX_DESCRIPTION_LENGTH).optional(),
});

/**
 * The plain object, for the replacement update: it needs the field list, and
 * refining wraps the object in something that no longer exposes one.
 */
export const credentialShape = credentialFields;

/**
 * An expiry in the past is **not** refused: an expired certification is a true
 * fact about someone's history. The only rule is that an expiry cannot precede
 * the issue, which is not a fact about anything.
 */
export const credentialSchema = credentialFields.superRefine(checkValidity);

export type CredentialInput = z.infer<typeof credentialSchema>;
