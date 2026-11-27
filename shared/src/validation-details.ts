import type { ZodError, ZodIssue } from 'zod';

/** Maps a Zod issue to a client-facing code, never to translated text. */
function issueToCode(issue: ZodIssue): string {
  if (issue.code === 'invalid_type') {
    // A whole-number rule fails as a type error, but the value is present and
    // is a number - answering REQUIRED would put "this field is required"
    // under a box the admin can see a value in.
    if (issue.expected === 'int') {
      return 'INVALID_INTEGER';
    }

    // A field the shape does not have - a logo on a skill, say. "Required" is
    // the opposite of what happened, and stripping it silently would leave a
    // client bug undiagnosed.
    if (issue.expected === 'never') {
      return 'NOT_ALLOWED';
    }

    // Otherwise: Zod reports an absent key and a wrong type as the same issue,
    // and its public shape carries neither the received value nor its type -
    // only the human message does, and that is not a contract. Both answer
    // REQUIRED: a browser form sends strings, so in practice the value is
    // simply missing.
    return 'REQUIRED';
  }

  if (issue.code === 'invalid_format') {
    return `INVALID_${issue.format.toUpperCase()}`;
  }

  // A minimum of one means "required", not "too short" - it also keeps the
  // login form from hinting at any password policy.
  if (issue.code === 'too_small') {
    return Number(issue.minimum) === 1 ? 'REQUIRED' : 'TOO_SMALL';
  }

  /**
   * A cross-field rule states its own code, because there is nothing in the
   * issue for the mapper to infer one from: "the end cannot be before the
   * start" and "a current position has no end date" are both `custom`, and
   * `CUSTOM` would tell a client nothing.
   */
  if (issue.code === 'custom') {
    const named = (issue.params as { code?: unknown } | undefined)?.code;

    if (typeof named === 'string') {
      return named;
    }
  }

  return issue.code.toUpperCase();
}

/** `{ "email": "INVALID_EMAIL", "password": "REQUIRED" }` */
export function toValidationDetails(error: ZodError): Record<string, string> {
  const details: Record<string, string> = {};

  for (const issue of error.issues) {
    const field = issue.path.join('.') || '_root';
    // First issue per field wins - one code per field keeps the contract simple.
    details[field] ??= issueToCode(issue);
  }

  return details;
}
