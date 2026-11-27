// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import admin from '../../../messages/en/admin.json';
import { useLeavingLink } from '../../../src/components/admin/leaving-link';
import { UnsavedChangesProvider } from '../../../src/components/admin/unsaved-changes';
import { useUnsavedChanges } from '../../../src/components/unsaved-changes';
import { FormLayout } from '../../../src/components/form/form-layout';
import { Link } from '../../../src/i18n/navigation';

const router = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock('@/i18n/navigation', () => ({
  Link: (props: AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props} />,
  useRouter: () => router,
}));

/** Anything that navigates: the language switch, a link, the breadcrumb. */
function WayOut({ onLeave }: { onLeave: () => void }) {
  const { confirmLeaving } = useUnsavedChanges();

  return (
    <button type="button" onClick={() => confirmLeaving(onLeave)}>
      Go somewhere
    </button>
  );
}

function GuardedLink() {
  const leaving = useLeavingLink();

  return (
    <Link href="/admin/skills" {...leaving('/admin/skills')}>
      Skills
    </Link>
  );
}

function renderShell({
  isDirty,
  onLeave = vi.fn(),
  withForm = true,
}: {
  isDirty: boolean;
  onLeave?: () => void;
  withForm?: boolean;
}) {
  function Tree({ children }: { children: ReactNode }) {
    return (
      <NextIntlClientProvider locale="en" messages={admin}>
        {children}
      </NextIntlClientProvider>
    );
  }

  const result = render(
    <UnsavedChangesProvider>
      {withForm ? (
        <FormLayout isDirty={isDirty} onSubmit={() => undefined}>
          <input aria-label="Something" />
        </FormLayout>
      ) : null}
      <WayOut onLeave={onLeave} />
      <GuardedLink />
    </UnsavedChangesProvider>,
    { wrapper: Tree },
  );

  return { ...result, onLeave };
}

const dialog = () => screen.queryByRole('alertdialog');

function unloadIsBlocked() {
  const event = new Event('beforeunload', { cancelable: true });

  window.dispatchEvent(event);

  return event.defaultPrevented;
}

afterEach(() => {
  cleanup();
  router.push.mockClear();
});

describe('leaving a form with unsaved changes', () => {
  it('asks before leaving', async () => {
    const { onLeave } = renderShell({ isDirty: true });

    fireEvent.click(screen.getByRole('button', { name: 'Go somewhere' }));

    await waitFor(() => expect(dialog()).not.toBeNull());
    expect(onLeave).not.toHaveBeenCalled();
  });

  it('does nothing but close when told to keep editing', async () => {
    const { onLeave } = renderShell({ isDirty: true });
    fireEvent.click(screen.getByRole('button', { name: 'Go somewhere' }));
    await waitFor(() => expect(dialog()).not.toBeNull());

    fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }));

    await waitFor(() => expect(dialog()).toBeNull());
    expect(onLeave).not.toHaveBeenCalled();
  });

  it('leaves once, when told the changes can go', async () => {
    const { onLeave } = renderShell({ isDirty: true });
    fireEvent.click(screen.getByRole('button', { name: 'Go somewhere' }));
    await waitFor(() => expect(dialog()).not.toBeNull());

    fireEvent.click(
      screen.getByRole('button', { name: 'Leave and lose them' }),
    );

    await waitFor(() => expect(onLeave).toHaveBeenCalledTimes(1));
  });

  /**
   * The half that matters as much. A guard that asks when there is nothing to
   * lose is one people learn to click through without reading.
   */
  it('says nothing about a form that has not been touched', () => {
    const { onLeave } = renderShell({ isDirty: false });

    fireEvent.click(screen.getByRole('button', { name: 'Go somewhere' }));

    expect(onLeave).toHaveBeenCalledTimes(1);
    expect(dialog()).toBeNull();
  });

  it('says nothing on a page with no form on it', () => {
    const { onLeave } = renderShell({ isDirty: false, withForm: false });

    fireEvent.click(screen.getByRole('button', { name: 'Go somewhere' }));

    expect(onLeave).toHaveBeenCalledTimes(1);
  });

  // An editor that closes has nothing left to lose, and a flag left set would
  // guard the next page instead.
  it('forgets the changes when the form goes away', () => {
    const { rerender, onLeave } = renderShell({ isDirty: true });

    rerender(
      <UnsavedChangesProvider>
        <WayOut onLeave={onLeave} />
        <GuardedLink />
      </UnsavedChangesProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Go somewhere' }));

    expect(onLeave).toHaveBeenCalledTimes(1);
  });
});

/**
 * The tab is the one exit the application cannot draw over, so it is the one
 * place the browser's own prompt is the mechanism rather than a dialog.
 */
describe('closing the tab', () => {
  it('is interrupted while a form holds unsaved changes', () => {
    renderShell({ isDirty: true });

    expect(unloadIsBlocked()).toBe(true);
  });

  it('is not interrupted otherwise', () => {
    renderShell({ isDirty: false });

    expect(unloadIsBlocked()).toBe(false);
  });
});

describe('a link out of an edited form', () => {
  it('navigates itself, so it can ask first', async () => {
    renderShell({ isDirty: true });

    fireEvent.click(screen.getByRole('link', { name: 'Skills' }));

    await waitFor(() => expect(dialog()).not.toBeNull());
    expect(router.push).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole('button', { name: 'Leave and lose them' }),
    );

    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith('/admin/skills'),
    );
  });

  /**
   * A middle-click or a ⌘-click opens another tab and leaves this one exactly
   * where it is. There is nothing to lose, and intercepting it would break the
   * one gesture that was already safe.
   */
  it('leaves a modified click to the browser', () => {
    renderShell({ isDirty: true });

    fireEvent.click(screen.getByRole('link', { name: 'Skills' }), {
      ctrlKey: true,
    });

    expect(dialog()).toBeNull();
    expect(router.push).not.toHaveBeenCalled();
  });
});
