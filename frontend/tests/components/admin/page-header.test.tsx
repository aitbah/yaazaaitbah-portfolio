// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { PageHeader } from '../../../src/components/admin/page-header';

afterEach(cleanup);

describe('the admin page header', () => {
  it('makes the title the page heading', () => {
    render(<PageHeader title="Skills" />);

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      'Skills',
    );
  });

  it('renders a description only when there is one', () => {
    const { rerender } = render(<PageHeader title="Skills" />);

    expect(screen.queryByText('What you work with.')).toBeNull();

    rerender(<PageHeader title="Skills" description="What you work with." />);

    expect(screen.getByText('What you work with.')).toBeTruthy();
  });

  it('renders the action beside the title', () => {
    render(<PageHeader title="Skills" action={<button>Add a skill</button>} />);

    expect(screen.getByRole('button', { name: 'Add a skill' })).toBeTruthy();
  });

  // A header with no action must not leave an empty box holding space.
  it('renders nothing where an absent action would go', () => {
    const { container } = render(<PageHeader title="Skills" />);

    expect(container.querySelectorAll('div').length).toBe(2);
  });
});
