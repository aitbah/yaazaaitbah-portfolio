import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { createTranslator } from 'next-intl';
import { describe, expect, it } from 'vitest';
import {
  CREDENTIAL_KINDS,
  EXPERTISE_KINDS,
  OPTION_LISTS,
} from '@portfolio/shared';

import admin from '../../messages/en/admin.json';
import errors from '../../messages/en/errors.json';
import metadata from '../../messages/en/metadata.json';
import responses from '../../messages/en/responses.json';
import site from '../../messages/en/site.json';
import validation from '../../messages/en/validation.json';
import home from '../../messages/en/home.json';
import {
  pickAdminMessages,
  pickPublicMessages,
} from '../../src/i18n/message-scopes';
import { routing } from '../../src/i18n/routing';

const NAMESPACES = [
  'metadata',
  'admin',
  'validation',
  'responses',
  'errors',
] as const;

/**
 * Loaded from disk per locale rather than imported, because the point is to
 * resolve the same keys in every language the site offers.
 *
 * The English objects are still imported above, and are what the assertions are
 * *derived* from - the shape is one file's job to define and every other
 * locale's job to match, which `locale-parity.test.ts` enforces.
 */
function messagesFor(locale: string): Record<string, unknown> {
  return Object.assign(
    {},
    ...NAMESPACES.map(
      (namespace) =>
        JSON.parse(
          readFileSync(
            join(
              import.meta.dirname,
              '..',
              '..',
              'messages',
              locale,
              `${namespace}.json`,
            ),
            'utf8',
          ),
        ) as Record<string, unknown>,
    ),
  ) as Record<string, unknown>;
}

// Built through the same functions the layouts use, so dropping a namespace
// there fails here instead of reaching the screen as a key path.
const ALL_MESSAGES = {
  ...metadata,
  ...site,
  ...home,
  ...admin,
  ...validation,
  ...responses,
  ...errors,
};
const PUBLIC_MESSAGES = pickPublicMessages(ALL_MESSAGES);
const ADMIN_MESSAGES = pickAdminMessages(ALL_MESSAGES);

/** The admin messages of each configured locale, for the contract's codes. */
const ADMIN_BY_LOCALE = routing.locales.map(
  (locale) =>
    [
      locale,
      // The loader is typed against the message shape; read from disk it is a
      // plain object, and `locale-parity.test.ts` is what proves the shapes
      // match.
      pickAdminMessages(messagesFor(locale) as typeof ALL_MESSAGES),
    ] as const,
);

// Values for every placeholder used in the message files; extras are ignored.
const ICU_VALUES = {
  email: 'admin@example.com',
  label: 'First name',
  locale: 'en',
  date: 'today',
};

function expectResolved(
  messages: Record<string, unknown>,
  namespace: string,
  key: string,
) {
  const t = createTranslator({
    locale: 'en',
    messages,
    namespace: namespace as 'validation',
    onError: () => {},
  }) as unknown as (key: string, values?: Record<string, unknown>) => string;

  const text = t(key, ICU_VALUES);

  // next-intl falls back to the key path when a message is missing.
  expect(text).not.toBe(`${namespace}.${key}`);
  expect(text.length).toBeGreaterThan(0);
}

describe('the admin provider carries every namespace the admin tree renders', () => {
  it('resolves every field validation code', () => {
    for (const key of Object.keys(validation.validation)) {
      expectResolved(ADMIN_MESSAGES, 'validation', key);
    }
  });

  it('resolves every backend response code', () => {
    for (const key of Object.keys(responses.responses)) {
      expectResolved(ADMIN_MESSAGES, 'responses', key);
    }
  });

  // Derived from the file, so a key added there is covered without editing this.
  it('resolves every navigation entry', () => {
    const nav: Record<string, unknown> = admin.admin.nav;

    for (const [key, value] of Object.entries(nav)) {
      // `sections` is a group of labels rather than one; it has its own test.
      if (typeof value === 'string') {
        expectResolved(ADMIN_MESSAGES, 'admin.nav', key);
      }
    }
  });

  it('resolves every navigation section label', () => {
    for (const key of Object.keys(admin.admin.nav.sections)) {
      expectResolved(ADMIN_MESSAGES, 'admin.nav.sections', key);
    }
  });

  it('resolves the profile copy', () => {
    const profile: Record<string, unknown> = admin.admin.profile;

    for (const [key, value] of Object.entries(profile)) {
      if (typeof value === 'string') {
        expectResolved(ADMIN_MESSAGES, 'admin.profile', key);
      }
    }

    for (const key of Object.keys(admin.admin.profile.fields)) {
      expectResolved(ADMIN_MESSAGES, 'admin.profile.fields', key);
    }
  });

  // The error boundary renders inside both trees, so both providers must carry
  // its copy or a failure would show raw key paths.
  it('resolves the error boundary copy', () => {
    for (const key of Object.keys(errors.errors)) {
      expectResolved(ADMIN_MESSAGES, 'errors', key);
    }
  });

  it('resolves the admin copy', () => {
    expectResolved(ADMIN_MESSAGES, 'admin.login', 'title');
    expectResolved(ADMIN_MESSAGES, 'admin.signedIn', 'label');
    expectResolved(ADMIN_MESSAGES, 'admin.signedIn', 'logout');
    expectResolved(ADMIN_MESSAGES, 'admin', 'checkingSession');
  });
});

/**
 * What is left of a guard that used to cover 122 codes.
 *
 * Every one of those was a code in the contract paired with a message key, and
 * this file checked that none had been added without its label. They are rows
 * now: their labels are content, and "every code has a label in both locales"
 * moved to `shared/tests/option-seed.test.ts`, where the rows are.
 *
 * What still belongs here is what is still a message: the *name of each list*,
 * which is part of the screen rather than part of the content, and the
 * per-kind namespaces that make one component serve two pages.
 */
describe.each(ADMIN_BY_LOCALE)(
  'every list has a %s name',
  (_locale, ADMIN_MESSAGES) => {
    it.each(OPTION_LISTS)('names the %s list', (list) => {
      expectResolved(ADMIN_MESSAGES, 'admin.options.lists', list);
    });

    /**
     * A kind is a namespace rather than a label: both credential pages are one
     * component, and everything that differs between them - the heading, the
     * empty state, the word for the button - is read from here by the kind the
     * route sets. A missing kind is a whole page of key paths, not one word.
     */
    it.each(CREDENTIAL_KINDS)('names the %s page', (kind) => {
      for (const key of Object.keys(
        admin.admin.credentials.kinds.certification,
      )) {
        expectResolved(ADMIN_MESSAGES, `admin.credentials.kinds.${kind}`, key);
      }
    });

    it.each(EXPERTISE_KINDS)('names the %s page', (kind) => {
      for (const key of Object.keys(admin.admin.expertise.kinds.skill)) {
        expectResolved(ADMIN_MESSAGES, `admin.expertise.kinds.${kind}`, key);
      }
    });
  },
);

describe('the public provider', () => {
  it('resolves the error boundary copy', () => {
    for (const key of Object.keys(errors.errors)) {
      expectResolved(PUBLIC_MESSAGES, 'errors', key);
    }
  });

  it('resolves the page metadata', () => {
    expectResolved(PUBLIC_MESSAGES, 'metadata', 'title');
    expectResolved(PUBLIC_MESSAGES, 'metadata', 'description');
  });

  it('withholds admin copy from public pages', () => {
    expect(Object.keys(PUBLIC_MESSAGES)).not.toContain('admin');
  });
});
