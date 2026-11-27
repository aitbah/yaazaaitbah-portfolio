// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';

import home from '../../../../messages/en/home.json';
import responses from '../../../../messages/en/responses.json';
import validation from '../../../../messages/en/validation.json';
import { ContactForm } from '../../../../src/features/site/sections/contact-form';

const messages = { ...home, ...validation, ...responses };
const form = home.home.contact;

let posted: unknown[] = [];

function stubApi(status: number, body: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn((_url: string, init?: RequestInit) => {
      posted.push(JSON.parse(init?.body as string));

      return Promise.resolve({
        ok: status >= 200 && status < 300,
        status,
        json: () => Promise.resolve(body),
      });
    }),
  );
}

function renderForm() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ContactForm />
    </NextIntlClientProvider>,
  );
}

function write(values: Record<string, string>) {
  for (const [label, value] of Object.entries(values)) {
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  }
}

const filled = {
  [form.name]: 'Amina',
  [form.senderEmail]: 'amina@example.test',
  [form.subject]: 'A project',
  [form.body]: 'Could we talk about a site for my studio?',
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  posted = [];
});

describe('the message form', () => {
  it('names its fields, holds them to the API’s limits, counts the message, and hides the honeypot', () => {
    renderForm();

    for (const label of [
      form.name,
      form.senderEmail,
      form.subject,
      form.body,
    ]) {
      expect(screen.getByLabelText(label)).toBeDefined();
    }

    // Every field stops at its limit; the long one says how far it has gone.
    expect(screen.getByLabelText<HTMLInputElement>(form.name).maxLength).toBe(
      80,
    );
    write({ [form.body]: 'Hello' });
    expect(screen.getByText('5 / 5000')).toBeDefined();

    const honeypot = document.getElementById('message-website')!;

    expect(honeypot.tabIndex).toBe(-1);
    expect(honeypot.closest('[aria-hidden]')).not.toBeNull();
  });

  it('says on each field what is missing, and posts nothing', async () => {
    stubApi(200, { code: 'SUCCESS', details: {} });
    renderForm();

    fireEvent.click(screen.getByRole('button', { name: form.send }));

    await waitFor(() => {
      expect(
        screen.getByLabelText(form.name).getAttribute('aria-invalid'),
      ).toBe('true');
    });

    const email = screen.getByLabelText(form.senderEmail);

    expect(email.getAttribute('aria-invalid')).toBe('true');
    expect(
      document.getElementById(email.getAttribute('aria-describedby')!)
        ?.textContent,
    ).toBe(validation.validation.INVALID_EMAIL);
    expect(posted).toHaveLength(0);
  });

  it('sends the message, says so, and starts a new one', async () => {
    stubApi(200, { code: 'SUCCESS', details: {} });
    renderForm();

    write(filled);
    fireEvent.click(screen.getByRole('button', { name: form.send }));

    expect((await screen.findByRole('status')).textContent).toContain(
      form.sent,
    );
    expect(posted).toEqual([
      {
        name: 'Amina',
        email: 'amina@example.test',
        subject: 'A project',
        body: 'Could we talk about a site for my studio?',
        website: '',
      },
    ]);

    fireEvent.click(screen.getByRole('button', { name: form.another }));
    expect(screen.getByLabelText<HTMLInputElement>(form.name).value).toBe('');
  });

  it('puts the API’s field errors on their fields', async () => {
    stubApi(422, {
      code: 'VALIDATION_ERROR',
      details: { email: 'INVALID_EMAIL' },
    });
    renderForm();

    write(filled);
    fireEvent.click(screen.getByRole('button', { name: form.send }));

    await waitFor(() => {
      expect(
        screen.getByLabelText(form.senderEmail).getAttribute('aria-invalid'),
      ).toBe('true');
    });
    expect(screen.getByRole('alert')).toBeDefined();
  });

  it('says why a message was turned away, and keeps what was written', async () => {
    stubApi(429, { code: 'TOO_MANY_REQUESTS', details: {} });
    renderForm();

    write(filled);
    fireEvent.click(screen.getByRole('button', { name: form.send }));

    expect((await screen.findByRole('alert')).textContent).toBe(
      responses.responses.TOO_MANY_REQUESTS,
    );
    expect(screen.getByLabelText<HTMLTextAreaElement>(form.body).value).toBe(
      filled[form.body],
    );
  });
});
