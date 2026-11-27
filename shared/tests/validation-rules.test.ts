import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { toValidationDetails } from '../src/validation-details.js';
import {
  CREDENTIAL_KINDS,
  RESOURCE_BY_CREDENTIAL_KIND,
  checkValidity,
  contactDetails,
  documentId,
  externalUrl,
  localizedText,
  messageRules,
  socialPlatform,
  MAX_HEADLINE_LENGTH,
  MAX_MESSAGE_BODY_LENGTH,
  MAX_MESSAGE_NAME_LENGTH,
  MAX_MESSAGE_SUBJECT_LENGTH,
  photoReference,
  publicContactDetails,
  checkPeriod,
  checkEmailChanged,
  checkPasswordChanged,
  newPassword,
  emailChangeRules,
  passwordChangeRules,
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  expertiseCategory,
  expertiseLevel,
  expertiseOrder,
  yearMonth,
  EXPERTISE_KINDS,
  OPTION_LIST_BY_KIND,
} from '../src/validation-rules.js';

/**
 * Both packages compose their schemas on these rules, so the rules themselves
 * are tested here once rather than twice over through each composed schema.
 */
describe('photoReference', () => {
  it.each([
    '/uploads/profile/avatar-2b51d475.png',
    '/uploads/profile/a-1.jpg',
    '/uploads/profile/a-1.webp',
    'https://cdn.example.com/photo.png',
    'http://cdn.example.com/photo.png',
  ])('accepts %s', (value) => {
    expect(photoReference.safeParse(value).success).toBe(true);
  });

  // The whole reason this is not `z.url()`: that accepts all three, and the
  // value is rendered into a page.
  it.each([
    'javascript:alert(1)',
    'data:text/html,<script>',
    'file:///etc/passwd',
  ])('rejects %s', (value) => {
    expect(photoReference.safeParse(value).success).toBe(false);
  });

  it.each([
    '/uploads/profile/../../etc/passwd',
    '/uploads/profile/avatar.svg',
    '/uploads/avatar.png',
    '/elsewhere/profile/avatar.png',
  ])('rejects the non-upload path %s', (value) => {
    expect(photoReference.safeParse(value).success).toBe(false);
  });
});

describe('localizedText', () => {
  const schema = localizedText(MAX_HEADLINE_LENGTH);

  it('requires the launch locale', () => {
    expect(schema.safeParse({ ar: 'مرحبا' }).success).toBe(false);
  });

  // Adding a language must be data, not a schema change (see DATABASE.md).
  it('accepts any further locale without being told about it', () => {
    expect(schema.safeParse({ en: 'Developer', ar: 'مطور' }).success).toBe(
      true,
    );
  });

  it.each([{ en: '' }, { en: '   ' }])(
    'rejects the blank value %j',
    (value) => {
      expect(schema.safeParse(value).success).toBe(false);
    },
  );

  it('rejects a value past the maximum length', () => {
    expect(
      schema.safeParse({ en: 'x'.repeat(MAX_HEADLINE_LENGTH + 1) }).success,
    ).toBe(false);
  });

  it('reports on the offending locale rather than the object', () => {
    const result = schema.safeParse({ en: 'ok', ar: '' });
    if (result.success) throw new Error('expected validation to fail');

    expect(result.error.issues[0]?.path).toEqual(['ar']);
  });

  it('is a plain object schema, so a non-object is rejected', () => {
    expect(z.object({ v: schema }).safeParse({ v: 'plain' }).success).toBe(
      false,
    );
  });
});

describe('expertiseLevel', () => {
  it.each([0, 50, 100])('accepts the percentage %i', (value) => {
    expect(expertiseLevel.safeParse(value).success).toBe(true);
  });

  it.each([-1, 101])('rejects %i, which is not a percentage', (value) => {
    expect(expertiseLevel.safeParse(value).success).toBe(false);
  });

  // 71 against 71.4 is a precision nobody can credibly claim about a skill.
  it('rejects a fraction', () => {
    expect(expertiseLevel.safeParse(70.5).success).toBe(false);
  });

  it('rejects a numeric string, so a form must convert before validating', () => {
    expect(expertiseLevel.safeParse('50').success).toBe(false);
  });
});

describe('expertiseCategory', () => {
  it('accepts a code, which is all a contract can check', () => {
    expect(expertiseCategory.safeParse('frontend').success).toBe(true);
  });

  /**
   * Whether `frontend` is a category a *tool* may hold is a question about rows
   * in an option list, and the service answers it. What stays here is the shape.
   */
  it('rejects anything that is not a code', () => {
    expect(expertiseCategory.safeParse('Frontend').success).toBe(false);
    expect(expertiseCategory.safeParse('front end').success).toBe(false);
    expect(expertiseCategory.safeParse('front--end').success).toBe(false);
  });

  /**
   * Surrounding space is normalised away rather than refused. A code is
   * compared exactly against what rows store, so the useful answer to
   * `'frontend '` is the code it obviously means - never a second, invisibly
   * different option beside the first.
   */
  it('trims rather than refusing, so no code differs only by a space', () => {
    expect(expertiseCategory.parse('  frontend  ')).toBe('frontend');
  });
});

describe('expertiseOrder', () => {
  it('accepts zero, which is what every skill gets until a reorder UI exists', () => {
    expect(expertiseOrder.safeParse(0).success).toBe(true);
  });

  it('rejects a negative position', () => {
    expect(expertiseOrder.safeParse(-1).success).toBe(false);
  });
});

describe('expertiseCategory reports absence apart from a malformed value', () => {
  const wrapped = z.object({ category: expertiseCategory });

  // Every other field answers REQUIRED when it is missing; this must too.
  it('reports an absent category as a missing field', () => {
    const result = wrapped.safeParse({});
    if (result.success) throw new Error('expected validation to fail');

    expect(result.error.issues[0]?.code).toBe('invalid_type');
  });

  /**
   * The select holds `''` until something is chosen, and that must read as
   * "you did not choose" rather than "that is not a code" - which is what the
   * minimum of one buys, and why the form no longer preprocesses the blank away.
   */
  it('reports the blank a fresh select holds as a missing field', () => {
    const result = wrapped.safeParse({ category: '' });
    if (result.success) throw new Error('expected validation to fail');

    expect(result.error.issues[0]?.code).toBe('too_small');
  });

  it('reports a malformed code as a format error', () => {
    const result = wrapped.safeParse({ category: 'Not A Code' });
    if (result.success) throw new Error('expected validation to fail');

    expect(result.error.issues[0]?.code).toBe('invalid_format');
  });
});

describe('localizedText rejects keys the storage layer cannot hold', () => {
  const schema = localizedText(MAX_HEADLINE_LENGTH);

  it.each(['ar', 'pt-BR', 'zh-Hans'])('accepts the locale %s', (locale) => {
    expect(schema.safeParse({ en: 'X', [locale]: 'Y' }).success).toBe(true);
  });

  /**
   * A MongoDB map key cannot contain a dot or start with `$`. Without this the
   * request passed validation and failed later inside Mongoose, which the error
   * handler could only report as a 500 - a client error dressed as a server
   * fault.
   */
  it.each(['a.b', '$bad', '', 'Latin', 'e'])(
    'rejects the key %j, which storage would refuse',
    (locale) => {
      expect(schema.safeParse({ en: 'X', [locale]: 'Y' }).success).toBe(false);
    },
  );
});

describe('externalUrl', () => {
  it.each(['https://github.com/me/repo', 'http://example.com/a?b=c'])(
    'accepts %s',
    (value) => {
      expect(externalUrl.safeParse(value).success).toBe(true);
    },
  );

  // Rendered as an href, so the protocol matters exactly as much as it does
  // for a photo - and z.url() alone accepts all three.
  it.each([
    'javascript:alert(1)',
    'data:text/html,<script>',
    'file:///etc/passwd',
    '/uploads/project/cover-1.png',
    'not a url',
  ])('rejects %s', (value) => {
    expect(externalUrl.safeParse(value).success).toBe(false);
  });
});

describe('documentId', () => {
  it('accepts a 24-character hex identifier', () => {
    expect(documentId.safeParse('507f1f77bcf86cd799439011').success).toBe(true);
  });

  it.each(['', 'nope', '507f1f77bcf86cd79943901', '507f1f77bcf86cd799439011x'])(
    'rejects %j, so a malformed reference never reaches a cast',
    (value) => {
      expect(documentId.safeParse(value).success).toBe(false);
    },
  );
});

describe('socialPlatform', () => {
  it('accepts a code', () => {
    expect(socialPlatform.safeParse('github').success).toBe(true);
  });

  // Absence must read as REQUIRED, like every other unfilled field. Whether
  // `myspace` is a platform the owner offers is the service's question now.
  it('separates an absent platform from a malformed one', () => {
    const wrapped = z.object({ platform: socialPlatform });

    expect(wrapped.safeParse({}).error?.issues[0]?.code).toBe('invalid_type');
    expect(
      wrapped.safeParse({ platform: 'My Space' }).error?.issues[0]?.code,
    ).toBe('invalid_format');
  });
});

describe('messageRules', () => {
  const schema = z.object(messageRules);

  const VALID = {
    name: 'Someone',
    email: 'someone@example.com',
    subject: 'Hello',
    body: 'I would like to talk.',
  };

  it('accepts a filled-in form', () => {
    expect(schema.safeParse(VALID).success).toBe(true);
  });

  it.each(['name', 'email', 'subject', 'body'])('requires %s', (field) => {
    expect(schema.safeParse({ ...VALID, [field]: '' }).success).toBe(false);
  });

  it('requires a real email address', () => {
    expect(schema.safeParse({ ...VALID, email: 'nope' }).success).toBe(false);
  });

  it.each([
    ['name', MAX_MESSAGE_NAME_LENGTH],
    ['subject', MAX_MESSAGE_SUBJECT_LENGTH],
    ['body', MAX_MESSAGE_BODY_LENGTH],
  ])('caps the length of %s', (field, max) => {
    expect(
      schema.safeParse({ ...VALID, [field]: 'x'.repeat(max) }).success,
    ).toBe(true);
    expect(
      schema.safeParse({ ...VALID, [field]: 'x'.repeat(max + 1) }).success,
    ).toBe(false);
  });

  // A field only a machine fills in. Absent or empty is what a person sends.
  describe('the honeypot', () => {
    it.each([undefined, ''])(
      'accepts %j, which is what a browser sends',
      (website) => {
        expect(schema.safeParse({ ...VALID, website }).success).toBe(true);
      },
    );

    /**
     * Deliberately accepted: rejecting it here would answer 422 naming the
     * field, telling whatever sent it exactly what gave it away. The trap is
     * sprung in the service, which accepts the request and discards it.
     */
    it('accepts a filled one rather than naming the trap', () => {
      expect(
        schema.safeParse({ ...VALID, website: 'http://spam' }).success,
      ).toBe(true);
    });

    // It still cannot be a way to send a large payload.
    it('caps its length', () => {
      expect(
        schema.safeParse({ ...VALID, website: 'x'.repeat(151) }).success,
      ).toBe(false);
    });
  });

  // Whitespace is not content: a body of spaces is an empty body.
  it.each(['name', 'subject', 'body'])(
    'treats blank %s as missing',
    (field) => {
      expect(schema.safeParse({ ...VALID, [field]: '   ' }).success).toBe(
        false,
      );
    },
  );
});

/**
 * The split is only real if each kind reads its own list. Which categories a
 * list *holds* is the owner's to change, and no longer something a contract can
 * assert; which list a kind reads is not, and that is what stays here.
 */
describe('the category lists are per kind', () => {
  it('names a list for every kind', () => {
    for (const kind of EXPERTISE_KINDS) {
      expect(OPTION_LIST_BY_KIND[kind]).toBeTruthy();
    }
  });

  it('gives no two kinds the same list', () => {
    const lists = EXPERTISE_KINDS.map((kind) => OPTION_LIST_BY_KIND[kind]);

    expect(new Set(lists).size).toBe(EXPERTISE_KINDS.length);
  });
});

describe('yearMonth', () => {
  it.each(['2021-03', '1999-12', '2030-01'])('accepts %s', (month) => {
    expect(yearMonth.safeParse(month).success).toBe(true);
  });

  // The format is the contract: it is what makes sorting and comparing work
  // without parsing, and what a browser's month input produces.
  it.each(['2021-3', '2021-13', '2021-00', '2021', '2021-03-15', ''])(
    'rejects %s',
    (month) => {
      expect(yearMonth.safeParse(month).success).toBe(false);
    },
  );
});

/**
 * The rule that relates a period's three fields, applied by both packages so
 * the admin and any other client are held to the same one.
 */
describe('checkPeriod', () => {
  function issuesFor(value: {
    startDate: string;
    endDate?: string;
    current: boolean;
  }) {
    const issues: { path?: unknown; params?: unknown }[] = [];

    checkPeriod(value, {
      addIssue: (issue) => issues.push(issue),
    });

    return issues.map((issue) => ({
      path: (issue.path as string[]).join('.'),
      code: (issue.params as { code: string }).code,
    }));
  }

  it('accepts a past position with an end after its start', () => {
    expect(
      issuesFor({ startDate: '2021-03', endDate: '2023-06', current: false }),
    ).toEqual([]);
  });

  it('accepts a current position with no end', () => {
    expect(issuesFor({ startDate: '2023-07', current: true })).toEqual([]);
  });

  // An absent end date could mean "still there" or "not filled in"; `current`
  // is what makes those different answers rather than one ambiguity.
  it('refuses an end date on a current position', () => {
    expect(
      issuesFor({ startDate: '2023-07', endDate: '2024-01', current: true }),
    ).toEqual([{ path: 'endDate', code: 'NOT_ALLOWED' }]);
  });

  it('requires an end date on a past position', () => {
    expect(issuesFor({ startDate: '2021-03', current: false })).toEqual([
      { path: 'endDate', code: 'REQUIRED' },
    ]);
  });

  it('refuses an end before the start', () => {
    expect(
      issuesFor({ startDate: '2023-06', endDate: '2021-03', current: false }),
    ).toEqual([{ path: 'endDate', code: 'BEFORE_START' }]);
  });

  // One month is a position held for a month, not an error.
  it('accepts an end in the same month as the start', () => {
    expect(
      issuesFor({ startDate: '2022-05', endDate: '2022-05', current: false }),
    ).toEqual([]);
  });

  /**
   * Comparing the strings is the whole point of storing months this way: it is
   * chronological because it is lexicographic, with no parsing in between.
   */
  it('compares across a year boundary', () => {
    expect(
      issuesFor({ startDate: '2021-12', endDate: '2022-01', current: false }),
    ).toEqual([]);
    expect(
      issuesFor({ startDate: '2022-01', endDate: '2021-12', current: false }),
    ).toEqual([{ path: 'endDate', code: 'BEFORE_START' }]);
  });
});

/**
 * The visibility rule, stated once. Both sides compose on it, so the cases
 * belong here rather than repeated per caller - and the rule is the one thing
 * in the contract whose failure is a privacy failure rather than a bug.
 */
describe('publicContactDetails', () => {
  const full = {
    email: 'hello@example.com',
    emailPublic: false,
    location: { en: 'Casablanca' },
    locationPublic: true,
    availability: 'open-to-freelance' as const,
    availabilityPublic: true,
  };

  it('leaves out a value whose flag is off', () => {
    const shown = publicContactDetails(full)!;

    // Absent, not empty: a key that is present still says the field exists.
    expect('email' in shown).toBe(false);
    expect(shown.emailPublic).toBe(false);
  });

  it('keeps a value whose flag is on', () => {
    const shown = publicContactDetails(full)!;

    expect(shown.location).toEqual({ en: 'Casablanca' });
    expect(shown.availability).toBe('open-to-freelance');
  });

  it.each(['emailPublic', 'locationPublic', 'availabilityPublic'] as const)(
    'withholds everything once %s is off',
    (flag) => {
      const shown = publicContactDetails({
        ...full,
        emailPublic: true,
        [flag]: false,
      })!;

      const field = flag.replace('Public', '');

      expect(field in shown).toBe(false);
    },
  );

  it('keeps the flags themselves, which say nothing private', () => {
    const shown = publicContactDetails(full)!;

    expect(shown.locationPublic).toBe(true);
    expect(shown.availabilityPublic).toBe(true);
  });

  // A published flag over an empty value still has nothing to publish.
  it('has nothing to show for a value that was never set', () => {
    const shown = publicContactDetails({
      emailPublic: true,
      locationPublic: true,
      availabilityPublic: true,
    })!;

    expect(shown).toEqual({
      emailPublic: true,
      locationPublic: true,
      availabilityPublic: true,
    });
  });

  it('passes a profile with no contact block straight through', () => {
    expect(publicContactDetails(undefined)).toBeUndefined();
  });
});

describe('contactDetails', () => {
  it('defaults every flag to not published, except the status', () => {
    const parsed = contactDetails.parse({ email: 'hello@example.com' });

    // The one that matters: a detail must never become public by omission.
    expect(parsed.emailPublic).toBe(false);
    expect(parsed.locationPublic).toBe(false);
    // A status exists in order to be seen.
    expect(parsed.availabilityPublic).toBe(true);
  });

  it('refuses something that is not an address', () => {
    expect(contactDetails.safeParse({ email: 'not-an-address' }).success).toBe(
      false,
    );
  });

  it.each(['open-to-work', 'not-looking'])(
    'accepts %s as a status',
    (availability) => {
      expect(contactDetails.safeParse({ availability }).success).toBe(true);
    },
  );

  // Which statuses exist is the owner's; the shape of one is not.
  it('refuses a status that is not a code', () => {
    expect(contactDetails.safeParse({ availability: 'Maybe?' }).success).toBe(
      false,
    );
  });
});

/**
 * `${kind}s` gives the right plural for both kinds today, and gave
 * "technologys" for expertise - which is why the resource name is a table
 * rather than a derivation. What a test can hold is that the table is complete:
 * a kind with no entry is a resource with no path.
 */
describe('the credential resources', () => {
  it('names a resource for every kind', () => {
    for (const kind of CREDENTIAL_KINDS) {
      expect(RESOURCE_BY_CREDENTIAL_KIND[kind]).toBeTruthy();
    }

    expect(Object.keys(RESOURCE_BY_CREDENTIAL_KIND).sort()).toEqual(
      [...CREDENTIAL_KINDS].sort(),
    );
  });

  it('gives each kind a resource of its own', () => {
    const names = Object.values(RESOURCE_BY_CREDENTIAL_KIND);

    expect(new Set(names).size).toBe(names.length);
  });
});

/**
 * The rule that makes a credential a point in time rather than a period.
 *
 * What it does *not* refuse is the important half: an expired credential is a
 * true fact about someone's history, and a validator that rejected one would be
 * rejecting the truth.
 */
describe('checkValidity', () => {
  function codesFor(value: { issuedAt: string; expiresAt?: string }) {
    const issues: { path?: PropertyKey[]; params?: { code?: string } }[] = [];

    checkValidity(value, { addIssue: (issue) => issues.push(issue) });

    return issues.map((issue) => [issue.path?.[0], issue.params?.code]);
  }

  it('accepts a credential that has already expired', () => {
    expect(codesFor({ issuedAt: '2016-01', expiresAt: '2019-01' })).toEqual([]);
  });

  it('accepts a credential with no expiry at all', () => {
    expect(codesFor({ issuedAt: '2016-01' })).toEqual([]);
  });

  it('accepts an expiry in the same month as the issue', () => {
    expect(codesFor({ issuedAt: '2023-04', expiresAt: '2023-04' })).toEqual([]);
  });

  it('refuses an expiry that precedes the issue', () => {
    expect(codesFor({ issuedAt: '2023-04', expiresAt: '2022-01' })).toEqual([
      ['expiresAt', 'BEFORE_ISSUE'],
    ]);
  });
});

/**
 * A new password is the one place a policy applies. Login is deliberately not:
 * enforcing it there would answer a wrong password with the wrong code and tell
 * anyone guessing what the policy is.
 */
describe('newPassword', () => {
  it('accepts a passphrase at the minimum length', () => {
    expect(newPassword.safeParse('a'.repeat(MIN_PASSWORD_LENGTH)).success).toBe(
      true,
    );
  });

  it('rejects one a character short', () => {
    expect(
      newPassword.safeParse('a'.repeat(MIN_PASSWORD_LENGTH - 1)).success,
    ).toBe(false);
  });

  it('rejects one longer than the bound', () => {
    expect(
      newPassword.safeParse('a'.repeat(MAX_PASSWORD_LENGTH + 1)).success,
    ).toBe(false);
  });

  /**
   * Composition rules are deliberately absent: a long passphrase of one
   * character class is stronger than `Password1!`, and this must not refuse it.
   */
  it('accepts a long passphrase of plain words', () => {
    expect(newPassword.safeParse('correct horse battery staple').success).toBe(
      true,
    );
  });

  // Reported as TOO_SMALL rather than REQUIRED: the field has a value in it,
  // and "this is required" under a box you can see text in reads as a bug.
  it('reports a short password as too small, not as missing', () => {
    const wrapped = z.object({ newPassword });
    const result = wrapped.safeParse({ newPassword: 'short' });
    if (result.success) throw new Error('expected validation to fail');

    expect(toValidationDetails(result.error)).toEqual({
      newPassword: 'TOO_SMALL',
    });
  });
});

describe('emailChangeRules and checkEmailChanged', () => {
  const CURRENT = 'owner@example.test';
  const rule = z
    .object(emailChangeRules)
    .superRefine(checkEmailChanged(CURRENT));

  const CHANGED = {
    currentPassword: 'the-passphrase',
    newEmail: 'moved@example.test',
  };

  it('accepts an address that differs', () => {
    expect(rule.safeParse(CHANGED).success).toBe(true);
  });

  /**
   * A factory rather than a plain refinement, because what it compares against
   * is not in the request: the form knows the address from the session and the
   * server reads it from the database. Only the code is shared.
   */
  it('refuses the address already stored, on the new address', () => {
    const result = rule.safeParse({ ...CHANGED, newEmail: CURRENT });
    if (result.success) throw new Error('expected validation to fail');

    expect(toValidationDetails(result.error)).toEqual({
      newEmail: 'UNCHANGED',
    });
  });

  it('refuses something that is not an address', () => {
    const result = rule.safeParse({ ...CHANGED, newEmail: 'not-an-address' });
    if (result.success) throw new Error('expected validation to fail');

    expect(toValidationDetails(result.error)).toEqual({
      newEmail: 'INVALID_EMAIL',
    });
  });

  // Presence only, for the reason `passwordChangeRules` gives: it is verified
  // against the stored hash, so a wrong one is a wrong password.
  it('asks only that a current password was sent', () => {
    expect(rule.safeParse({ ...CHANGED, currentPassword: 'x' }).success).toBe(
      true,
    );
    expect(rule.safeParse({ ...CHANGED, currentPassword: '' }).success).toBe(
      false,
    );
  });
});

describe('checkPasswordChanged', () => {
  const rule = z.object(passwordChangeRules).superRefine(checkPasswordChanged);

  const CHANGED = {
    currentPassword: 'the-old-passphrase',
    newPassword: 'a-different-passphrase',
  };

  it('accepts a new password that differs', () => {
    expect(rule.safeParse(CHANGED).success).toBe(true);
  });

  it('refuses a change that changes nothing, on the new password', () => {
    const result = rule.safeParse({
      currentPassword: CHANGED.currentPassword,
      newPassword: CHANGED.currentPassword,
    });
    if (result.success) throw new Error('expected validation to fail');

    expect(toValidationDetails(result.error)).toEqual({
      newPassword: 'UNCHANGED',
    });
  });

  /**
   * The current one is checked for presence only. It is verified against the
   * stored hash, so a wrong one is a wrong password rather than a bad field -
   * the same reason login checks nothing about its shape.
   */
  it('asks only that a current password was sent', () => {
    expect(rule.safeParse({ ...CHANGED, currentPassword: 'x' }).success).toBe(
      true,
    );
    expect(rule.safeParse({ ...CHANGED, currentPassword: '' }).success).toBe(
      false,
    );
  });
});
