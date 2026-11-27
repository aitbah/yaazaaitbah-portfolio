// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { useState, type ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import site from '../../messages/en/site.json';
import {
  resetShowMore,
  ShowMoreList,
  useShowMore,
} from '../../src/components/show-more';

function withMessages(children: ReactNode) {
  return (
    <NextIntlClientProvider locale="en" messages={site}>
      {children}
    </NextIntlClientProvider>
  );
}

const items = (count: number) =>
  Array.from({ length: count }, (_, i) => <li key={i}>Item {i + 1}</li>);

const shownItems = () =>
  screen.queryAllByRole('listitem').map((li) => li.textContent);

afterEach(() => {
  cleanup();
  resetShowMore();
});

describe('ShowMoreList', () => {
  it('shows everything, and no control, when the list fits in one step', () => {
    render(
      withMessages(
        <ShowMoreList id="test" step={3} noun="projects" items={items(3)} />,
      ),
    );

    expect(shownItems()).toEqual(['Item 1', 'Item 2', 'Item 3']);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByText(/Showing/)).toBeNull();
  });

  it('shows one step, then the next, then drops the button but keeps the count', () => {
    render(
      withMessages(
        <ShowMoreList id="test" step={3} noun="projects" items={items(7)} />,
      ),
    );

    expect(shownItems()).toHaveLength(3);
    expect(screen.getByText('Showing 3 of 7')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Show more projects' }));
    expect(shownItems()).toHaveLength(6);
    expect(screen.getByText('Showing 6 of 7')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Show more projects' }));
    expect(shownItems()).toHaveLength(7);
    expect(screen.getByText('Showing 7 of 7')).not.toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('announces the count politely', () => {
    render(
      withMessages(
        <ShowMoreList id="test" step={2} noun="skills" items={items(5)} />,
      ),
    );

    expect(screen.getByText('Showing 2 of 5').getAttribute('aria-live')).toBe(
      'polite',
    );
  });

  it('moves focus to the first newly shown item', () => {
    render(
      withMessages(
        <ShowMoreList id="test" step={2} noun="skills" items={items(5)} />,
      ),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Show more skills' }));

    expect(document.activeElement?.textContent).toBe('Item 3');
  });

  it('keeps how far it was opened across unmounting, and does not steal focus back', () => {
    function Page() {
      const [editing, setEditing] = useState(false);

      return (
        <>
          <button type="button" onClick={() => setEditing(!editing)}>
            Toggle editor
          </button>
          {editing ? (
            <p>Editor</p>
          ) : (
            <ShowMoreList id="rows" step={2} noun="skills" items={items(5)} />
          )}
        </>
      );
    }

    render(withMessages(<Page />));
    fireEvent.click(screen.getByRole('button', { name: 'Show more skills' }));
    expect(shownItems()).toHaveLength(4);

    const toggle = screen.getByRole('button', { name: 'Toggle editor' });
    fireEvent.click(toggle);
    expect(shownItems()).toHaveLength(0);

    toggle.focus();
    fireEvent.click(toggle);

    expect(shownItems()).toHaveLength(4);
    expect(document.activeElement).toBe(toggle);
  });

  it('never claims more than a list that shrank still has', () => {
    const { rerender } = render(
      withMessages(
        <ShowMoreList id="test" step={2} noun="skills" items={items(5)} />,
      ),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Show more skills' }));
    rerender(
      withMessages(
        <ShowMoreList id="test" step={2} noun="skills" items={items(3)} />,
      ),
    );

    expect(shownItems()).toHaveLength(3);
    expect(screen.getByText('Showing 3 of 3')).not.toBeNull();
  });
});

describe('useShowMore', () => {
  it('reveals the next step only when asked to show a row past the visible ones', () => {
    let state: ReturnType<typeof useShowMore> | undefined;

    function Probe() {
      state = useShowMore('probe', 10, 4);
      return null;
    }

    render(<Probe />);

    act(() => state!.reveal(3));
    expect(state!.visible).toBe(4);

    act(() => state!.reveal(4));
    expect(state!.visible).toBe(8);
  });

  it('shares one count between everything that names the same list', () => {
    const seen: number[] = [];

    function Reader() {
      seen.push(useShowMore('shared', 10, 4).visible);
      return null;
    }

    function Opener() {
      const state = useShowMore('shared', 10, 4);
      return (
        <button type="button" onClick={state.showMore}>
          open
        </button>
      );
    }

    render(
      <>
        <Reader />
        <Opener />
      </>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'open' }));

    expect(seen.at(-1)).toBe(8);
  });
});
