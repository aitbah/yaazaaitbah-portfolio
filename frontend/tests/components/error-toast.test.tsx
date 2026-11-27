// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { StrictMode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import site from '../../messages/en/site.json';
import { ErrorToast } from '../../src/components/error-toast';
import { ToastViewport } from '../../src/components/ui/toast';

afterEach(cleanup);

function tree(message: string | null) {
  return (
    <StrictMode>
      <NextIntlClientProvider locale="en" messages={site}>
        <ToastViewport>
          <ErrorToast>{message}</ErrorToast>
        </ToastViewport>
      </NextIntlClientProvider>
    </StrictMode>
  );
}

describe('a failed action', () => {
  it('raises nothing while there is nothing to say', () => {
    render(tree(null));

    expect(screen.queryAllByText(/./)).toHaveLength(0);
  });

  // Strict mode runs the effect twice; one failure is still one toast.
  it('raises its message once', async () => {
    render(tree('The order could not be saved.'));

    expect(
      await screen.findAllByText('The order could not be saved.'),
    ).toHaveLength(1);
  });

  // A retry clears the message before failing again, and that is raised too.
  it('raises the same message again after it went away', async () => {
    const { rerender } = render(tree('Refused.'));
    await screen.findByText('Refused.');

    rerender(tree(null));
    rerender(tree('Refused.'));

    await waitFor(() =>
      expect(screen.getAllByText('Refused.')).toHaveLength(2),
    );
  });
});
