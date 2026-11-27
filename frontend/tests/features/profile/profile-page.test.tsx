// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import admin from '../../../messages/en/admin.json';
import site from '../../../messages/en/site.json';
import responses from '../../../messages/en/responses.json';
import validation from '../../../messages/en/validation.json';
// The (protected) segment is what applies the session guard, and it is part of
// this path: moving the page out of that group breaks this import.
import ProfilePage from '../../../src/app/[locale]/admin/(protected)/profile/page';
import { optionsReply } from '../../support/options';
import { localizedLabel } from '../../support/localized-label';
import { ToastViewport } from '../../../src/components/ui/toast';

// The same subset the admin layout supplies.
const messages = { ...admin, ...site, ...validation, ...responses };

const PROFILE = {
  firstName: { en: 'Yaaza' },
  lastName: { en: 'Ait Bah' },
  headline: { en: 'Full-stack developer' },
  bio: { en: 'Building things for the web.' },
  photoUrl: 'https://cdn.example.com/me.jpg',
  updatedAt: '2026-08-30T10:00:00.000Z',
};

type Reply = { status: number; body: unknown };

const found = (profile: unknown): Reply => ({
  status: 200,
  body: { code: 'SUCCESS', details: { profile } },
});
const NOT_FOUND: Reply = {
  status: 404,
  body: { code: 'NOT_FOUND', details: {} },
};
const UNREADABLE: Reply = {
  status: 500,
  body: { code: 'SERVER_ERROR', details: {} },
};

/** Every PUT body, so a test can assert what actually went over the wire. */
let sent: string[] = [];

function stubApi({ get, put }: { get: Reply; put?: Reply }) {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      // Every screen with a dropdown reads the option lists, so every stub
      // has to answer for them - the labels come from there now.
      const options = optionsReply(String(url));

      if (options) {
        return Promise.resolve(options);
      }

      const isWrite = init?.method === 'PUT';

      if (isWrite && typeof init?.body === 'string') {
        sent.push(init.body);
      }

      const reply = isWrite ? (put ?? found(PROFILE)) : get;

      return Promise.resolve({
        ok: reply.status >= 200 && reply.status < 300,
        status: reply.status,
        json: () => Promise.resolve(reply.body),
      });
    }),
  );
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <NextIntlClientProvider locale="en" messages={messages}>
        <ToastViewport>
          <QueryClientProvider client={queryClient}>
            {children}
          </QueryClientProvider>
        </ToastViewport>
      </NextIntlClientProvider>
    );
  }

  return render(<ProfilePage />, { wrapper: Wrapper });
}

/** The form, opened from the read-only view the page now starts on. */
async function formOf(container: HTMLElement) {
  // The profile now opens read-only, so the form is behind an explicit action:
  // "Edit profile" over a saved one, "Create profile" over an empty page.
  fireEvent.click(
    await screen.findByRole('button', { name: /^(Edit|Create) profile$/ }),
  );

  return waitFor(() => {
    const form = container.querySelector('form');
    if (!form) throw new Error('form not rendered yet');
    return form;
  });
}

function input(label: string) {
  return screen.getByLabelText<HTMLInputElement>(label);
}

function type(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function fillRequired() {
  type(localizedLabel('First name'), 'Yaaza');
  type(localizedLabel('Last name'), 'Ait Bah');
  type(localizedLabel('Headline'), 'Full-stack developer');
}

/** JSON.parse is `any`; every body is read through this one narrowing. */
function sentBody(index = 0): Record<string, unknown> {
  const body = sent[index];
  if (!body) throw new Error(`no request was sent at ${index}`);

  return JSON.parse(body) as Record<string, unknown>;
}

beforeEach(() => {
  sent = [];
  stubApi({ get: found(PROFILE) });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('reading the profile', () => {
  it('fills the form with the stored profile', async () => {
    const { container } = renderPage();
    await formOf(container);

    expect(input(localizedLabel('First name')).value).toBe('Yaaza');
    expect(input(localizedLabel('Last name')).value).toBe('Ait Bah');
    expect(input(localizedLabel('Headline')).value).toBe(
      'Full-stack developer',
    );
    expect(input(localizedLabel('Bio')).value).toBe(
      'Building things for the web.',
    );
    expect(
      screen.getByAltText('Current profile photo').getAttribute('src'),
    ).toBe('https://cdn.example.com/me.jpg');
  });

  it('shows an accessible loading indicator while the read is in flight', () => {
    renderPage();

    expect(screen.getByLabelText('Loading the profile…')).toBeDefined();
  });

  // NOT_FOUND is an answer, not a failure: the page says there is nothing yet
  // and offers to make one, rather than showing an empty form as if it were
  // a profile.
  it('says nothing is saved yet and offers an empty form', async () => {
    stubApi({ get: NOT_FOUND });
    const { container } = renderPage();

    expect(await screen.findByText('No profile yet')).toBeDefined();
    expect(container.querySelector('form')).toBeNull();

    await formOf(container);

    expect(input(localizedLabel('First name')).value).toBe('');
  });

  // PUT replaces the whole document, so an empty form here would offer to
  // overwrite a profile that merely failed to load.
  it('shows the error instead of a form when the read fails unexpectedly', async () => {
    stubApi({ get: UNREADABLE });
    const { container } = renderPage();

    expect(await screen.findByRole('alert')).toBeDefined();
    expect(
      screen.getByText('Something went wrong. Please try again.'),
    ).toBeDefined();
    expect(container.querySelector('form')).toBeNull();
    expect(container.textContent).not.toContain('responses.');
  });
});

describe('client validation', () => {
  it('reports every empty required field in words, never a key path', async () => {
    stubApi({ get: NOT_FOUND });
    const { container } = renderPage();
    const form = await formOf(container);

    form.requestSubmit();

    await waitFor(() => {
      expect(container.querySelectorAll('[role="alert"]')).toHaveLength(3);
    });
    expect(screen.getAllByText('This field is required.')).toHaveLength(3);
    expect(container.textContent).not.toContain('validation.');
  });

  it('does not send anything while the form is invalid', async () => {
    stubApi({ get: NOT_FOUND });
    const { container } = renderPage();
    const form = await formOf(container);

    form.requestSubmit();

    await waitFor(() => {
      expect(
        container.querySelectorAll('[role="alert"]').length,
      ).toBeGreaterThan(0);
    });
    expect(sent).toHaveLength(0);
  });

  // The backend caps the headline at 160; TOO_BIG exists to say so.
  it('rejects a value longer than the backend allows', async () => {
    stubApi({ get: NOT_FOUND });
    const { container } = renderPage();
    const form = await formOf(container);

    fillRequired();
    type(localizedLabel('Headline'), 'x'.repeat(161));
    form.requestSubmit();

    expect(await screen.findByText('This value is too long.')).toBeDefined();
  });

  it('clears a field error once the value is corrected', async () => {
    stubApi({ get: NOT_FOUND });
    const { container } = renderPage();
    const form = await formOf(container);

    form.requestSubmit();
    await screen.findAllByText('This field is required.');

    fillRequired();
    form.requestSubmit();

    await waitFor(() => {
      expect(screen.queryByText('This field is required.')).toBeNull();
    });
  });
});

describe('saving', () => {
  it('creates the profile when none existed', async () => {
    stubApi({ get: NOT_FOUND });
    const { container } = renderPage();
    const form = await formOf(container);

    fillRequired();
    form.requestSubmit();

    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sentBody()).toEqual({
      firstName: { en: 'Yaaza' },
      lastName: { en: 'Ait Bah' },
      headline: { en: 'Full-stack developer' },
    });
  });

  // Blank optional fields are absent, not empty strings, which PUT then clears.
  it('omits the optional fields left blank', async () => {
    stubApi({ get: NOT_FOUND });
    const { container } = renderPage();
    const form = await formOf(container);

    fillRequired();
    form.requestSubmit();

    await waitFor(() => expect(sent).toHaveLength(1));
    expect(Object.keys(sentBody())).not.toContain('bio');
    expect(Object.keys(sentBody())).not.toContain('photoUrl');
  });

  it('updates an existing profile with the edited values', async () => {
    const { container } = renderPage();
    const form = await formOf(container);

    type(localizedLabel('Headline'), 'Backend engineer');
    form.requestSubmit();

    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sentBody().headline).toEqual({ en: 'Backend engineer' });
  });

  /**
   * The save is confirmed by the view coming back with the new values in it,
   * which is stronger than a notice: it shows what was actually stored.
   */
  it('returns to the read-only view once the save succeeds', async () => {
    const { container } = renderPage();
    const form = await formOf(container);

    type(localizedLabel('Headline'), 'Backend engineer');
    form.requestSubmit();

    await waitFor(() => expect(sent).toHaveLength(1));
    await waitFor(() => expect(container.querySelector('form')).toBeNull());

    expect(
      await screen.findByRole('button', { name: 'Edit profile' }),
    ).toBeDefined();
  });

  // Leaving the editor must not save: cancelling is how you undo a mistake.
  it('sends nothing when the editor is closed on cancel', async () => {
    const { container } = renderPage();
    await formOf(container);

    type(localizedLabel('Headline'), 'Something else');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(container.querySelector('form')).toBeNull());
    expect(sent).toEqual([]);
  });

  // The response is the stored truth: the server may normalize what was sent.
  it('refills the form from the saved profile the API returns', async () => {
    stubApi({
      get: found(PROFILE),
      put: found({ ...PROFILE, headline: { en: 'Normalized headline' } }),
    });
    const { container } = renderPage();
    const form = await formOf(container);

    type(localizedLabel('Headline'), '  Backend engineer  ');
    form.requestSubmit();

    await waitFor(() => expect(sent).toHaveLength(1));

    // Reopened, because the save closes the editor: the point is that what it
    // reopens with is the server's answer rather than what was typed.
    await formOf(container);

    expect(input(localizedLabel('Headline')).value).toBe('Normalized headline');
  });
});

// A locale the site does not offer still reaches the form: the API accepts any
// locale key, so a translation can be written through it directly. It has no
// input here and would vanish on save unless it is carried over, because PUT
// replaces the whole document.
//
// German rather than Arabic, which is what this said until Arabic was added.
// Nothing failed when it became a rendered locale - the tests simply stopped
// testing anything, which is the worse of the two outcomes. The locale has to
// be one `routing.locales` does not hold.
describe('locales this form never rendered', () => {
  const WITH_GERMAN = {
    ...PROFILE,
    firstName: { en: 'Yaaza', de: 'Jaza' },
    bio: { en: 'Building things for the web.', de: 'Baut Dinge fürs Web.' },
  };

  it('does not render an input for an unconfigured locale', async () => {
    stubApi({ get: found(WITH_GERMAN) });
    const { container } = renderPage();
    await formOf(container);

    expect(screen.queryByLabelText('First name (de)')).toBeNull();
    expect(input(localizedLabel('First name')).value).toBe('Yaaza');
  });

  it('carries the unrendered locale through a save untouched', async () => {
    stubApi({ get: found(WITH_GERMAN) });
    const { container } = renderPage();
    const form = await formOf(container);

    type(localizedLabel('First name'), 'Yaaza Updated');
    form.requestSubmit();

    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sentBody().firstName).toEqual({
      en: 'Yaaza Updated',
      de: 'Jaza',
    });
    expect(sentBody().bio).toEqual({
      en: 'Building things for the web.',
      de: 'Baut Dinge fürs Web.',
    });
  });

  // Clearing is deliberate, and a localized field cannot survive without its
  // launch locale anyway - the backend requires it.
  it('still lets an optional field be cleared outright', async () => {
    stubApi({ get: found(WITH_GERMAN) });
    const { container } = renderPage();
    const form = await formOf(container);

    type(localizedLabel('Bio'), '');
    form.requestSubmit();

    await waitFor(() => expect(sent).toHaveLength(1));
    expect(Object.keys(sentBody())).not.toContain('bio');
  });

  it('adds nothing when there was no stored profile', async () => {
    stubApi({ get: NOT_FOUND });
    const { container } = renderPage();
    const form = await formOf(container);

    fillRequired();
    form.requestSubmit();

    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sentBody().firstName).toEqual({ en: 'Yaaza' });
  });
});

describe('server errors', () => {
  it('lands each server field code on the field it belongs to', async () => {
    stubApi({
      get: found(PROFILE),
      put: {
        status: 422,
        body: {
          code: 'VALIDATION_ERROR',
          details: { 'firstName.en': 'REQUIRED', photoUrl: 'INVALID_URL' },
        },
      },
    });
    const { container } = renderPage();
    const form = await formOf(container);

    form.requestSubmit();

    await screen.findByText('This field is required.');
    expect(screen.getByText('Enter a valid URL.')).toBeDefined();

    // Associated, not merely present somewhere on the page.
    expect(
      input(localizedLabel('First name')).getAttribute('aria-describedby'),
    ).toBe('firstName-en-error');
    // By what the referenced element says, not by its id: the association is
    // the behaviour, the id is an implementation detail.
    const describedBy = screen
      .getByLabelText('Replace the photo')
      .getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy!)?.textContent).toBe(
      'Enter a valid URL.',
    );

    // The fields already say what to fix; the banner would only repeat it.
    expect(
      screen.queryByText('Please check the highlighted fields and try again.'),
    ).toBeNull();
  });

  it('explains a rejected save in words', async () => {
    stubApi({
      get: found(PROFILE),
      put: { status: 401, body: { code: 'UNAUTHENTICATED', details: {} } },
    });
    const { container } = renderPage();
    const form = await formOf(container);

    form.requestSubmit();

    expect(
      await screen.findByText(
        'Your session has expired. Please sign in again.',
      ),
    ).toBeDefined();
    expect(container.textContent).not.toContain('responses.');
  });
});

describe('accessibility', () => {
  it('labels every field and marks the invalid ones', async () => {
    stubApi({ get: NOT_FOUND });
    const { container } = renderPage();
    const form = await formOf(container);

    for (const label of ['First name', 'Last name', 'Headline', 'Bio']) {
      expect(screen.getByLabelText(localizedLabel(label))).toBeDefined();
    }

    form.requestSubmit();

    await waitFor(() => {
      expect(
        input(localizedLabel('First name')).getAttribute('aria-invalid'),
      ).toBe('true');
    });
    expect(input(localizedLabel('Bio')).getAttribute('aria-invalid')).toBe(
      'false',
    );
  });

  it('gives each field the control and attributes it needs', async () => {
    const { container } = renderPage();
    await formOf(container);

    // A 2000-character bio is not an <input>.
    expect(screen.getByLabelText(localizedLabel('Bio')).tagName).toBe(
      'TEXTAREA',
    );
    expect(input('Replace the photo').getAttribute('type')).toBe('file');

    // Required is an accessibility signal here; noValidate turns the browser off.
    expect(input(localizedLabel('First name')).required).toBe(true);
    expect(
      screen.getByLabelText(localizedLabel('Bio')).hasAttribute('required'),
    ).toBe(false);
  });

  it('points each invalid field at the message describing it', async () => {
    stubApi({ get: NOT_FOUND });
    const { container } = renderPage();
    const form = await formOf(container);

    form.requestSubmit();

    await waitFor(() => {
      const describedBy = input(localizedLabel('Headline')).getAttribute(
        'aria-describedby',
      );
      expect(describedBy).toBe('headline-en-error');
      expect(container.querySelector('#headline-en-error')).not.toBeNull();
    });
  });
});

/**
 * The contact block is the one part of the profile whose value and whose
 * visibility are two different answers, and the whole point is that the second
 * is never assumed.
 */
describe('contact details', () => {
  const WITH_CONTACT = {
    ...PROFILE,
    contact: {
      email: 'hello@example.com',
      emailPublic: false,
      location: { en: 'Casablanca, Morocco' },
      locationPublic: true,
      availability: 'open-to-freelance',
      availabilityPublic: true,
    },
  };

  it('says which details the site is allowed to show', async () => {
    stubApi({ get: found(WITH_CONTACT) });
    renderPage();

    // The read-only view is the only place that answers "did I turn that on?"
    // at a glance - on a saved form a stored address and a published one look
    // identical.
    expect(await screen.findByText('hello@example.com')).toBeDefined();
    expect(screen.getByText('Casablanca, Morocco')).toBeDefined();
    expect(screen.getByText('Open to freelance')).toBeDefined();

    // Scoped to each row: a badge read on its own says nothing about what it
    // is a badge for.
    expect(screen.getByRole('group', { name: 'Email' }).textContent).toContain(
      'Not shown',
    );
    expect(
      screen.getByRole('group', { name: 'Location' }).textContent,
    ).toContain('Shown on the site');
    expect(
      screen.getByRole('group', { name: 'Availability' }).textContent,
    ).toContain('Shown on the site');
  });

  it('fills the form with the stored details and their answers', async () => {
    stubApi({ get: found(WITH_CONTACT) });
    const { container } = renderPage();
    await formOf(container);

    expect(input('Email').value).toBe('hello@example.com');
    expect(input(localizedLabel('Location')).value).toBe('Casablanca, Morocco');
    expect(
      input('Show the email on the site').getAttribute('aria-checked'),
    ).toBe('false');
    expect(
      input('Show the location on the site').getAttribute('aria-checked'),
    ).toBe('true');
  });

  it('sends the address with its visibility answer', async () => {
    stubApi({ get: NOT_FOUND });
    const { container } = renderPage();
    const form = await formOf(container);

    fillRequired();
    type('Email', 'hello@example.com');
    form.requestSubmit();

    await waitFor(() => expect(sent).toHaveLength(1));

    const contact = sentBody().contact as Record<string, unknown>;

    expect(contact.email).toBe('hello@example.com');
    // Not published unless the admin says so - the default that matters.
    expect(contact.emailPublic).toBe(false);
  });

  it('publishes the address once the box is ticked', async () => {
    stubApi({ get: NOT_FOUND });
    const { container } = renderPage();
    const form = await formOf(container);

    fillRequired();
    type('Email', 'hello@example.com');
    fireEvent.click(screen.getByLabelText('Show the email on the site'));
    form.requestSubmit();

    await waitFor(() => expect(sent).toHaveLength(1));

    expect((sentBody().contact as Record<string, unknown>).emailPublic).toBe(
      true,
    );
  });

  /** Three flags about nothing are not a choice worth storing. */
  it('sends no contact block when nothing has been filled in', async () => {
    stubApi({ get: NOT_FOUND });
    const { container } = renderPage();
    const form = await formOf(container);

    fillRequired();
    form.requestSubmit();

    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sentBody()).not.toHaveProperty('contact');
  });

  it('reports an address that is not an address, on the field', async () => {
    stubApi({ get: NOT_FOUND });
    const { container } = renderPage();
    const form = await formOf(container);

    fillRequired();
    type('Email', 'not-an-address');
    form.requestSubmit();

    await waitFor(() => {
      expect(input('Email').getAttribute('aria-invalid')).toBe('true');
    });
    expect(sent).toHaveLength(0);
  });
});
