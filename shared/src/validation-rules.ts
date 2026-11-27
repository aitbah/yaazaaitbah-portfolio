import { z } from 'zod';

/**
 * Zod validates without compiling in a browser: its JIT probe calls
 * `Function()`, which the admin's CSP blocks and reports on every page. The
 * server keeps the compiled path.
 */
if (typeof window !== 'undefined') {
  z.config({ jitless: true });
}

import { optionCode, type OptionListKey } from './option-lists.js';
import { SKILL_ICON_SLUGS } from './skill-icon-slugs.js';

/**
 * The validation rules both packages must agree on. They live here so there is
 * one definition rather than two that have to be kept in step.
 *
 * Each side still composes its own schema on top: the backend validates the
 * stored shape, the frontend additionally tolerates what a form produces.
 */

export const MAX_NAME_LENGTH = 80;
export const MAX_HEADLINE_LENGTH = 160;
export const MAX_BIO_LENGTH = 2000;

/** Must match the storage layer, which is asserted by a backend test. */
export const UPLOAD_PATH_PREFIX = '/uploads';
export const UPLOAD_IMAGE_EXTENSIONS = ['png', 'jpg', 'webp'] as const;

/**
 * The documents this application stores, which is one: a CV is a PDF.
 *
 * Kept apart from the image extensions rather than merged into one list,
 * because "which image is this" and "which file is this" are different
 * questions - merging them would make every endpoint that asks the first
 * accept a document by omission.
 */
export const UPLOAD_DOCUMENT_EXTENSIONS = ['pdf'] as const;

/**
 * The locale a row cannot exist without. A row's identity is its name in this
 * locale - unique indexes, sorts and conflict errors are keyed on it - and
 * every other locale falls back to it. Changing it needs an index and a data
 * migration.
 */
export const DEFAULT_LOCALE = 'en';

/**
 * A locale tag, loosely - enough to be a language and optional subtags, and
 * deliberately narrow enough to be a key MongoDB can store. A key holding `.`
 * or a leading `$` is rejected by the storage layer, and a request carrying one
 * would otherwise pass validation and then fail as an unexplained server error.
 */
const LOCALE_KEY = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;

/**
 * Locale-keyed text: the default locale is required and any other may be added
 * beside it without touching this schema (see DATABASE.md). A missing or blank
 * value reports on its own locale - `firstName.en`, `firstName.fr`.
 *
 * Additive on purpose. Requiring a translation before a row can be saved would
 * mean that adding a language invalidates every row already stored.
 */
export function localizedText(maxLength: number) {
  const text = z.string().trim().min(1).max(maxLength);

  return z
    .object({ [DEFAULT_LOCALE]: text })
    .catchall(text)
    .superRefine((value, ctx) => {
      if (Object.keys(value).every((locale) => LOCALE_KEY.test(locale))) {
        return;
      }

      // Reported on the field rather than on the offending key: a key with a
      // dot in it would produce an ambiguous path once joined.
      ctx.addIssue({
        code: 'invalid_key',
        origin: 'record',
        issues: [],
        input: value,
        message: 'Every key must be a locale',
      });
    });
}

/** A file this application stores, in the exact shape the storage layer emits. */
function managedPath(extensions: readonly string[]) {
  return new RegExp(
    `^${UPLOAD_PATH_PREFIX}/[a-z0-9-]+/[A-Za-z0-9-]+\\.(${extensions.join('|')})$`,
  );
}

const MANAGED_IMAGE_PATH = managedPath(UPLOAD_IMAGE_EXTENSIONS);
const MANAGED_DOCUMENT_PATH = managedPath(UPLOAD_DOCUMENT_EXTENSIONS);

function isSafeHttpUrl(value: string) {
  try {
    const { protocol } = new URL(value);

    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * One of our own upload paths, or an absolute http(s) URL. `z.url()` alone is
 * not enough here: it accepts `javascript:`, `data:` and `file:`, and this value
 * is rendered in a page.
 *
 * The issue is raised as an invalid URL format so it reaches the client as the
 * `INVALID_URL` code the shared mapper already produces.
 */
export const photoReference = z.string().check((ctx) => {
  const value = ctx.value;

  if (!MANAGED_IMAGE_PATH.test(value) && !isSafeHttpUrl(value)) {
    ctx.issues.push({
      code: 'invalid_format',
      format: 'url',
      input: value,
      message: 'Not an upload path or an http(s) URL',
    });
  }
});

/**
 * A document this application stores.
 *
 * Unlike a photo, never an external URL: a CV is served from our own uploads
 * with the headers that make it a download rather than a document the browser
 * renders, and a link to someone else's host would have neither.
 */
export const documentReference = z.string().check((ctx) => {
  if (!MANAGED_DOCUMENT_PATH.test(ctx.value)) {
    ctx.issues.push({
      code: 'invalid_format',
      format: 'url',
      input: ctx.value,
      message: 'Not a stored document path',
    });
  }
});

/**
 * A stored file per locale.
 *
 * A CV really differs by language, unlike a photograph, so it is keyed by
 * locale from the start - the project makes adding a language a matter of
 * content and configuration, never a schema change.
 */
export const localizedDocument = z
  .object({ en: documentReference })
  .catchall(documentReference);

export const MAX_LOCATION_TEXT_LENGTH = 120;

/**
 * Whether the owner is looking, as a code from the `availability-status` list:
 * a code can be badged, translated and filtered, a sentence cannot.
 */
export const availabilityStatus = optionCode;

/**
 * How to reach the person, and how much of it a stranger may see. Publication
 * is a stored flag that defaults to not published, and the API applies it,
 * never the client. The location is localized; the email is an identifier and
 * is not.
 */
export const contactDetails = z.object({
  email: z.email().optional(),
  emailPublic: z.boolean().default(false),
  location: localizedText(MAX_LOCATION_TEXT_LENGTH).optional(),
  locationPublic: z.boolean().default(false),
  availability: availabilityStatus.optional(),
  // The one detail with no flag: a status exists in order to be seen, and a
  // private "open to work" is the same thing as not saying it.
  availabilityPublic: z.boolean().default(true),
});

export type ContactDetails = z.infer<typeof contactDetails>;

/**
 * The shape the visibility rule needs, and nothing more.
 *
 * Generic in the location, because the two sides hold it differently: the
 * validated input requires the launch locale, and a response carries whatever
 * locales were stored. The rule is about the flags, so it should not care.
 */
export type ContactVisibility<TLocation> = {
  email?: string;
  emailPublic: boolean;
  location?: TLocation;
  locationPublic: boolean;
  availability?: string;
  availabilityPublic: boolean;
};

/**
 * What a stranger is allowed to read, given the flags.
 *
 * Shared rather than written in the service, so the contract is one function
 * both sides can point at - and so a test can state the rule once instead of
 * once per caller.
 */
export function publicContactDetails<TLocation>(
  contact: ContactVisibility<TLocation> | undefined,
): ContactVisibility<TLocation> | undefined {
  if (!contact) {
    return undefined;
  }

  const shown: ContactVisibility<TLocation> = {
    emailPublic: contact.emailPublic,
    locationPublic: contact.locationPublic,
    availabilityPublic: contact.availabilityPublic,
  };

  if (contact.emailPublic && contact.email) {
    shown.email = contact.email;
  }

  if (contact.locationPublic && contact.location) {
    shown.location = contact.location;
  }

  if (contact.availabilityPublic && contact.availability) {
    shown.availability = contact.availability;
  }

  return shown;
}

/**
 * What an image says, for anyone who cannot see it. Localized like every other
 * piece of prose, and **optional**: an empty alt is the correct answer for a
 * purely decorative image, and forcing a value only teaches people to type
 * "image" into the box.
 */
export const MAX_ALT_LENGTH = 200;

export const imageAlt = localizedText(MAX_ALT_LENGTH);

/**
 * How many images one project gallery holds. A cap rather than no limit: the
 * gallery is reordered as a whole list, and every entry is a file on disk.
 */
export const MAX_GALLERY_IMAGES = 12;

/** One image in a gallery: the file, what it shows, and where it sits. */
export const galleryImage = z.object({
  url: photoReference,
  alt: imageAlt.optional(),
});

export const gallery = z.array(galleryImage).max(MAX_GALLERY_IMAGES);

export const MAX_EXPERTISE_NAME_LENGTH = 60;

/**
 * A skill is a capability, a technology a language or framework, a tool
 * software you operate. One shape, one collection; the required `kind` keeps
 * them apart.
 */
export const EXPERTISE_KINDS = ['skill', 'technology', 'tool'] as const;

export type ExpertiseKind = (typeof EXPERTISE_KINDS)[number];

/**
 * The plural each kind is exposed under - the path segment and the key its
 * list arrives in.
 *
 * Spelled out rather than derived: appending an `s` gives "technologys", and a
 * URL is not the place to discover that.
 */
export const RESOURCE_BY_KIND = {
  skill: 'skills',
  technology: 'technologies',
  tool: 'tools',
} as const satisfies Record<ExpertiseKind, string>;

/**
 * Categories are per kind - a technology is never `collaboration` - so each
 * kind reads its own option list. Which list is decided here.
 */
export const OPTION_LIST_BY_KIND = {
  skill: 'skill-category',
  technology: 'technology-category',
  tool: 'tool-category',
} as const satisfies Record<ExpertiseKind, OptionListKey>;

/**
 * A string first, then the enum. `z.enum` alone reports an absent value, a
 * wrong one and `null` as the identical issue, so a form the admin has not
 * filled in would answer INVALID_VALUE where every other field answers
 * REQUIRED. Checking the type first separates "you did not choose" from
 * "that is not a kind".
 */
export const expertiseKind = z.string().pipe(z.enum(EXPERTISE_KINDS));

/**
 * A category, as far as the contract is concerned: the shape of a code.
 *
 * Deliberately no longer a rule per kind. Whether `database` is a category a
 * tool may hold is a question about rows in an option list, and only the
 * service can see both the kind and the lists at once - a schema compiled at
 * import time cannot. So the shape is checked here and the membership there.
 */
export const expertiseCategory = optionCode;

/**
 * Which kinds carry a brand logo.
 *
 * Technologies and tools are products with marks. A skill is not: there is no
 * `simple-icons` entry for "Data Analysis", and a picker that can never match
 * anything is worse than no picker. So the icon is absent from the skill shape
 * rather than merely hidden by the form.
 */
export const KIND_HAS_ICON: Record<ExpertiseKind, boolean> = {
  skill: false,
  technology: true,
  tool: true,
};

/**
 * Proficiency as a percentage. Whole numbers only: the difference between 71
 * and 71.4 is not something anyone can credibly claim.
 */
export const MIN_EXPERTISE_LEVEL = 0;
export const MAX_EXPERTISE_LEVEL = 100;

export const expertiseLevel = z
  .number()
  .int()
  .min(MIN_EXPERTISE_LEVEL)
  .max(MAX_EXPERTISE_LEVEL);

/**
 * A brand logo: a preset slug naming a vendored drawing, so no user-supplied
 * SVG is ever stored or served, or an uploaded image of our own for marks the
 * set lacks. A union, so both at once cannot be represented.
 */
export const expertiseIcon = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('preset'), value: z.enum(SKILL_ICON_SLUGS) }),
  z.object({ kind: z.literal('upload'), value: photoReference }),
]);

/**
 * The rule for a field a kind does not have.
 *
 * Sending a logo for a skill is a client bug, and saying so is more useful than
 * silently dropping it - `z.object` would strip the key without a word. The
 * mapper turns this into `NOT_ALLOWED`, which names the field it is about.
 */
export const notAllowed = z.never().optional();

/**
 * Display position, lowest first. Absent means "leave it at the back": the
 * admin sends a whole ordering through its own endpoint rather than a position
 * per row.
 */
export const expertiseOrder = z.number().int().min(0);

export const MAX_ROLE_LENGTH = 120;
export const MAX_ORGANISATION_LENGTH = 120;
export const MAX_LOCATION_LENGTH = 120;

/**
 * How a position was held.
 *
 * The set is the `employment-type` option list, managed in the admin. Codes
 * translated where they are rendered, the same arrangement as a category.
 */
export const employmentType = optionCode;

/**
 * The languages the picker offers, as BCP-47 subtags. Codes only:
 * `Intl.DisplayNames` renders each name in the reader's own locale. `zgh`
 * because Standard Moroccan Tamazight has no two-letter subtag.
 */
export const LANGUAGE_CODES = [
  'af',
  'am',
  'ar',
  'bg',
  'bn',
  'ca',
  'cs',
  'da',
  'de',
  'el',
  'en',
  'es',
  'et',
  'fa',
  'fi',
  'fr',
  'gu',
  'ha',
  'he',
  'hi',
  'hr',
  'hu',
  'id',
  'is',
  'it',
  'ja',
  'ko',
  'lt',
  'lv',
  'mr',
  'ms',
  'nl',
  'no',
  'pa',
  'pl',
  'pt',
  'ro',
  'ru',
  'sk',
  'sr',
  'sv',
  'sw',
  'ta',
  'te',
  'th',
  'tl',
  'tr',
  'uk',
  'ur',
  'vi',
  'yo',
  'zgh',
  'zh',
] as const;

export type LanguageCode = (typeof LANGUAGE_CODES)[number];

/** A string first, then the enum, for the reason `expertiseCategory` explains. */
export const languageCode = z.string().pipe(z.enum(LANGUAGE_CODES));

/**
 * How well, on the CEFR scale, plus `native`. The `language-level` option list;
 * unlike a language name, no runtime API can word "B2", so these carry labels.
 */
export const languageLevel = optionCode;

/** Display position, lowest first - as on an expertise row. */
export const languageOrder = expertiseOrder;

export const MAX_CREDENTIAL_NAME_LENGTH = 150;
export const MAX_ISSUER_LENGTH = 120;
export const MAX_CREDENTIAL_ID_LENGTH = 120;

/**
 * A certification and a course share one shape - issued by someone, on a date,
 * optionally verifiable - so they share a collection, told apart by `kind`.
 */
export const CREDENTIAL_KINDS = ['certification', 'course'] as const;

export type CredentialKind = (typeof CREDENTIAL_KINDS)[number];

/**
 * The plural each kind is exposed under - the path segment and the key its list
 * arrives in. Spelled out rather than derived, for the reason
 * `RESOURCE_BY_KIND` already is.
 */
export const RESOURCE_BY_CREDENTIAL_KIND = {
  certification: 'certifications',
  course: 'courses',
} as const satisfies Record<CredentialKind, string>;

/** A string first, then the enum, for the reason `expertiseCategory` explains. */
export const credentialKind = z.string().pipe(z.enum(CREDENTIAL_KINDS));

/**
 * When a credential was issued and when it expires. Not a period: no expiry
 * means it does not expire, and an expiry in the past is a true fact, not an
 * error. It only cannot precede the issue.
 */
export function checkValidity(
  value: { issuedAt: string; expiresAt?: string },
  ctx: { addIssue: (issue: z.core.$ZodRawIssue) => void },
): void {
  if (value.expiresAt !== undefined && value.expiresAt < value.issuedAt) {
    ctx.addIssue({
      code: 'custom',
      path: ['expiresAt'],
      input: value.expiresAt,
      // Comparing the strings is the whole point of storing months this way.
      message: 'An expiry cannot precede the issue',
      params: { code: 'BEFORE_ISSUE' },
    });
  }
}

export const MAX_INSTITUTION_LENGTH = 120;
export const MAX_QUALIFICATION_LENGTH = 120;
export const MAX_FIELD_OF_STUDY_LENGTH = 120;

/**
 * How someone studied, as a code a public page can badge and translate. Covers
 * vocational training and bootcamps, so `other` stays rare.
 */
export const educationLevel = optionCode;

const YEAR_MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * A month, `YYYY-MM`: the precision a CV has, sortable as text, and immune to
 * the timezone shift a `Date` would bring.
 */
export const yearMonth = z.string().check((ctx) => {
  if (!YEAR_MONTH.test(ctx.value)) {
    ctx.issues.push({
      code: 'invalid_format',
      format: 'month',
      input: ctx.value,
      message: 'Not a YYYY-MM month',
    });
  }
});

/** The shape of the three fields the rule below relates. */
type Period = {
  startDate: string;
  endDate?: string | undefined;
  current: boolean;
};

/**
 * The rule relating a period's fields: a current position has no end, and a
 * past one must say when it ended.
 */
export function checkPeriod(
  value: Period,
  ctx: { addIssue: (issue: z.core.$ZodRawIssue) => void },
): void {
  if (value.current && value.endDate !== undefined) {
    ctx.addIssue({
      code: 'custom',
      path: ['endDate'],
      input: value.endDate,
      message: 'A current position has no end date',
      params: { code: 'NOT_ALLOWED' },
    });

    return;
  }

  if (!value.current && value.endDate === undefined) {
    ctx.addIssue({
      code: 'custom',
      path: ['endDate'],
      input: value.endDate,
      message: 'A past position must say when it ended',
      params: { code: 'REQUIRED' },
    });

    return;
  }

  if (value.endDate !== undefined && value.endDate < value.startDate) {
    ctx.addIssue({
      code: 'custom',
      path: ['endDate'],
      input: value.endDate,
      // Comparing the strings is the whole point of storing months this way.
      message: 'The end cannot be before the start',
      params: { code: 'BEFORE_START' },
    });
  }
}

export const MAX_TITLE_LENGTH = 120;
export const MAX_DESCRIPTION_LENGTH = 2000;

/**
 * What a project says beyond what it is - why it was hard. All optional, and
 * shorter than the description on purpose.
 */
export const MAX_SLUG_LENGTH = 80;

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * A project's address, shaped like an option code. Never derived on save:
 * regenerating it from an edited title would break every saved link. Checked
 * explicitly rather than with `.regex()`, which reports `INVALID_REGEX`.
 */
export const slug = z
  .string()
  .trim()
  .min(1)
  .max(MAX_SLUG_LENGTH)
  .check((ctx) => {
    if (!SLUG.test(ctx.value)) {
      ctx.issues.push({
        code: 'invalid_format',
        format: 'slug',
        input: ctx.value,
        message: 'Not an address',
      });
    }
  });

/**
 * A title as a starting point for one, for the form to prefill.
 *
 * A suggestion rather than a rule: it can return something empty or absurd for
 * a title with no Latin letters, which is exactly why the field stays editable
 * and why nothing regenerates it later.
 */
export function slugFrom(title: string): string {
  return (
    title
      .normalize('NFKD')
      // Strip the accents the decomposition just separated out.
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, MAX_SLUG_LENGTH)
      .replace(/-+$/, '')
  );
}

export const MAX_PROJECT_ROLE_LENGTH = 120;
export const MAX_PROJECT_NARRATIVE_LENGTH = 800;

/**
 * A link to somewhere else - a repository, a running site. Unlike a photo it is
 * never one of our own upload paths, but it is rendered as an `href`, so the
 * protocol matters just as much: `z.url()` alone accepts `javascript:`,
 * `data:` and `file:`.
 */
export const externalUrl = z.string().check((ctx) => {
  if (!isSafeHttpUrl(ctx.value)) {
    ctx.issues.push({
      code: 'invalid_format',
      format: 'url',
      input: ctx.value,
      message: 'Not an http(s) URL',
    });
  }
});

const DOCUMENT_ID = /^[0-9a-fA-F]{24}$/;

/**
 * A reference to another document, shape-checked so a malformed one is a
 * validation error rather than a cast failure. Explicit rather than `.regex()`,
 * which reports `INVALID_REGEX`.
 */
export const documentId = z.string().check((ctx) => {
  if (!DOCUMENT_ID.test(ctx.value)) {
    ctx.issues.push({
      code: 'invalid_format',
      format: 'id',
      input: ctx.value,
      message: 'Not an identifier',
    });
  }
});

/** Display position, as on an expertise row. */
export const projectOrder = expertiseOrder;

/**
 * The platforms a link can point at, as codes translated on the frontend.
 * `dockerhub` and `devto` rather than `docker` and `dev`: Docker is also a tool
 * the portfolio can list.
 */
export const socialPlatform = optionCode;

/**
 * A whole ordering, as a list of identifiers in the order they should appear.
 * The list is sent complete rather than as a pair to swap, so two tabs cannot
 * interleave into an order neither asked for.
 */
export const orderedIds = z.object({ ids: z.array(documentId).min(1) });

/**
 * How many messages one page carries. The inbox is the only place a stranger
 * can add rows, so it is the only list whose size is not under the owner's
 * control - and the only one that pages.
 */
export const MESSAGES_PAGE_SIZE = 20;

/** Where a page starts. Offset rather than a cursor: an inbox is read from the
 * top, pages are few, and a cursor would buy nothing an offset does not. */
export const messagePage = z.coerce.number().int().min(0).default(0);

export const MAX_MESSAGE_NAME_LENGTH = 80;
export const MAX_MESSAGE_SUBJECT_LENGTH = 150;
export const MAX_MESSAGE_BODY_LENGTH = 5000;

/**
 * The contact form's fields, not localized. `website` is the honeypot,
 * deliberately unconstrained: refusing it would tell a bot what gave it away,
 * so the service accepts and discards it. A length cap keeps it from being a
 * large payload.
 */
export const messageRules = {
  name: z.string().trim().min(1).max(MAX_MESSAGE_NAME_LENGTH),
  email: z.email(),
  subject: z.string().trim().min(1).max(MAX_MESSAGE_SUBJECT_LENGTH),
  body: z.string().trim().min(1).max(MAX_MESSAGE_BODY_LENGTH),
  website: z.string().max(MAX_MESSAGE_SUBJECT_LENGTH).optional(),
};

/**
 * Login checks only that a password was sent. Enforcing the policy here would
 * answer a wrong password with VALIDATION_ERROR instead of INVALID_CREDENTIALS,
 * and leak the policy to anyone guessing.
 */
export const loginRules = {
  email: z.email(),
  password: z.string().min(1),
};

/**
 * What a new password must be: long enough, with no composition rules, which
 * push people towards `Password1!`. Shared so the form enforces the server's
 * minimum.
 */
export const MIN_PASSWORD_LENGTH = 12;
export const MAX_PASSWORD_LENGTH = 200;

export const newPassword = z
  .string()
  .min(MIN_PASSWORD_LENGTH)
  .max(MAX_PASSWORD_LENGTH);

/**
 * Changing a password takes the current one, so a stolen session cookie cannot
 * lock the owner out. It is checked for presence only; the hash decides whether
 * it is right.
 */
export const passwordChangeRules = {
  currentPassword: z.string().min(1),
  newPassword,
};

/**
 * Changing the sign-in address takes the current password, like a password
 * change. With no mail to confirm it, the form asks twice, and `npm run
 * admin:email` is the recovery path.
 */
export const emailChangeRules = {
  currentPassword: z.string().min(1),
  newEmail: z.email(),
};

/**
 * The address already stored is not a change: saving it would change nothing
 * and still end every session. A factory because the current address comes from
 * the session on one side and the database on the other.
 */
export function checkEmailChanged(currentEmail: string) {
  return (value: { newEmail: string }, ctx: z.RefinementCtx) => {
    if (value.newEmail === currentEmail) {
      ctx.addIssue({
        code: 'custom',
        path: ['newEmail'],
        params: { code: 'UNCHANGED' },
        message: 'The new address is the current one',
      });
    }
  };
}

/**
 * A change that changes nothing is not a change.
 *
 * Reported on the new password rather than as a banner, because that is the
 * field to fix. Compared as sent rather than against the stored hash: if the
 * current one is right and the new one equals it, this is the same fact and it
 * costs no verification to notice.
 */
export function checkPasswordChanged(
  value: { currentPassword: string; newPassword: string },
  ctx: z.RefinementCtx,
) {
  if (value.currentPassword === value.newPassword) {
    ctx.addIssue({
      code: 'custom',
      path: ['newPassword'],
      params: { code: 'UNCHANGED' },
      message: 'The new password is the current one',
    });
  }
}
