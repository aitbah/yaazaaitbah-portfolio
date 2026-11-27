// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import site from '../../messages/en/site.json';
import {
  ToastViewport as Viewport,
  useToast,
} from '../../src/components/ui/toast';

afterEach(cleanup);

/** The viewport under the translations it reads its labels from. */
function ToastViewport({ children }: { children: ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={site}>
      <Viewport>{children}</Viewport>
    </NextIntlClientProvider>
  );
}

function Raiser({
  title,
  description,
  tone,
}: {
  title: string;
  description?: string;
  tone?: 'success' | 'error' | 'info';
}) {
  const toast = useToast();

  return (
    <button type="button" onClick={() => toast({ title, description, tone })}>
      raise
    </button>
  );
}

describe('a notification', () => {
  it('is not on the page until something raises it', () => {
    render(
      <ToastViewport>
        <Raiser title="Saved" />
      </ToastViewport>,
    );

    expect(screen.queryByText('Saved')).toBeNull();
  });

  it('appears with its title and its detail when raised', async () => {
    render(
      <ToastViewport>
        <Raiser title="Message sent" description="I will reply within a day." />
      </ToastViewport>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'raise' }));

    expect(await screen.findByText('Message sent')).toBeDefined();
    expect(screen.getByText('I will reply within a day.')).toBeDefined();
  });

  /** Two raised together must both stand: a queue, not a replacement. */
  it('stacks rather than replacing', async () => {
    render(
      <ToastViewport>
        <Raiser title="First" />
      </ToastViewport>,
    );

    const raise = screen.getByRole('button', { name: 'raise' });
    fireEvent.click(raise);
    fireEvent.click(raise);

    await waitFor(() => {
      expect(screen.getAllByText('First')).toHaveLength(2);
    });
  });

  it('can be dismissed, and leaves nothing behind', async () => {
    render(
      <ToastViewport>
        <Raiser title="Dismiss me" tone="error" />
      </ToastViewport>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'raise' }));
    await screen.findByText('Dismiss me');

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    await waitFor(() => {
      expect(screen.queryByText('Dismiss me')).toBeNull();
    });
  });

  /**
   * The hook is useless outside the viewport, and a notification that silently
   * never appears is worse than a crash at the call site.
   */
  it('refuses to be used outside the viewport', () => {
    expect(() => render(<Raiser title="Nowhere" />)).toThrow(
      /must be used inside/i,
    );
  });
});
