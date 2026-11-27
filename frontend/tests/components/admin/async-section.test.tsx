// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import responses from '../../../messages/en/responses.json';
import { AsyncSection } from '../../../src/components/admin/async-section';
import { ApiRequestError } from '../../../src/lib/api-client';

function renderSection(props: {
  isPending: boolean;
  error: unknown;
  children?: ReactNode;
}) {
  return render(
    <NextIntlClientProvider locale="en" messages={responses}>
      <AsyncSection
        isPending={props.isPending}
        error={props.error}
        loadingLabel="Loading the skills…"
      >
        {props.children ?? <p>the list</p>}
      </AsyncSection>
    </NextIntlClientProvider>,
  );
}

afterEach(cleanup);

describe('while the read is in flight', () => {
  it('says what is loading rather than leaving the page blank', () => {
    renderSection({ isPending: true, error: null });

    expect(screen.getByLabelText('Loading the skills…')).toBeTruthy();
    expect(screen.queryByText('the list')).toBeNull();
  });
});

describe('when the read fails', () => {
  /**
   * The rule every admin page depends on: `PUT` replaces the whole document,
   * so a form filled from nothing overwrites a profile that merely failed to
   * load, and an editor over a failed list saves a duplicate name.
   */
  it('never renders the content over a failure', () => {
    renderSection({
      isPending: false,
      error: new ApiRequestError('SERVER_ERROR', {}),
    });

    expect(screen.queryByText('the list')).toBeNull();
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('explains the failure in words, never as a code', () => {
    renderSection({
      isPending: false,
      error: new ApiRequestError('SERVER_ERROR', {}),
    });

    const alert = screen.getByRole('alert');

    expect(alert.textContent).not.toContain('responses.');
    expect(alert.textContent?.length).toBeGreaterThan(0);
  });
});

describe('when the read succeeds', () => {
  it('renders the content and nothing else', () => {
    renderSection({ isPending: false, error: null });

    expect(screen.getByText('the list')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
