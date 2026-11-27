// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  useEditorKey,
  useRowEditor,
} from '../../../src/components/admin/use-editor';

type Row = { id: string; name: string };

const ARCHITECTURE: Row = {
  id: 'aaaaaaaaaaaaaaaaaaaaaaaa',
  name: 'Architecture',
};
const TESTING: Row = { id: 'bbbbbbbbbbbbbbbbbbbbbbbb', name: 'Testing' };

const ROWS: Row[] = [ARCHITECTURE, TESTING];

/** A list that opens an editor, which is every admin list in one component. */
function ListPage({ rows = ROWS }: { rows?: Row[] }) {
  const { editing, edit, close, closeWithoutHistory } = useRowEditor(rows);

  if (editing === null) {
    return (
      <div>
        <p>The list</p>
        <button type="button" onClick={() => edit(null)}>
          Add
        </button>
        {rows.map((row) => (
          <button key={row.id} type="button" onClick={() => edit(row)}>
            Edit {row.name}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div>
      <p>Editing {editing.row ? editing.row.name : 'a new row'}</p>
      <button type="button" onClick={close}>
        Cancel
      </button>
      <button type="button" onClick={closeWithoutHistory}>
        Withdraw
      </button>
    </div>
  );
}

/** The profile, whose editor is a toggle rather than a row. */
function TogglePage() {
  const { key, open, close } = useEditorKey();

  return key === null ? (
    <button type="button" onClick={() => open('profile')}>
      Edit profile
    </button>
  ) : (
    <button type="button" onClick={close}>
      Close
    </button>
  );
}

/**
 * Waits for the traversal rather than for a tick.
 *
 * jsdom runs a history traversal in a later task and fires `popstate` when it
 * lands, so a step that presses Back has to wait for that event - a flushed
 * microtask queue is sometimes enough and sometimes is not, which is a flaky
 * test rather than a fast one.
 */
async function travel(go: () => void) {
  await act(async () => {
    const landed = new Promise<void>((resolve) => {
      window.addEventListener('popstate', () => resolve(), { once: true });
    });

    go();
    await landed;
  });
}

const pressBack = () => travel(() => window.history.back());
const pressForward = () => travel(() => window.history.forward());

function start(at: string) {
  window.history.replaceState(null, '', at);
}

afterEach(cleanup);

describe('an editor that is a location', () => {
  it('shows the list until the address says otherwise', () => {
    start('/en/admin/skills');
    render(<ListPage />);

    expect(screen.getByText('The list')).toBeTruthy();
  });

  it('opens a new row, and says so in the address bar', () => {
    start('/en/admin/skills');
    render(<ListPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(screen.getByText('Editing a new row')).toBeTruthy();
    expect(window.location.search).toBe('?edit=new');
  });

  it('names the row it is editing', () => {
    start('/en/admin/skills');
    render(<ListPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Edit Architecture' }));

    expect(screen.getByText('Editing Architecture')).toBeTruthy();
    expect(window.location.search).toBe(`?edit=${ARCHITECTURE.id}`);
  });

  it('opens straight onto the row the address names', () => {
    start(`/en/admin/skills?edit=${TESTING.id}`);
    render(<ListPage />);

    expect(screen.getByText('Editing Testing')).toBeTruthy();
  });

  /** A link to something since deleted, which is a page nobody can act on. */
  it('shows the list when the address names a row that is not there', () => {
    start('/en/admin/skills?edit=cccccccccccccccccccccccc');
    render(<ListPage />);

    expect(screen.getByText('The list')).toBeTruthy();
  });

  it('keeps the rest of the address to itself', () => {
    start('/en/admin/skills?sort=name#top');
    render(<ListPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(window.location.search).toBe('?sort=name&edit=new');
    expect(window.location.hash).toBe('#top');
  });
});

/** The reported bug, as close as jsdom gets to a browser's Back button. */
describe('Back and Forward', () => {
  it('closes the editor and stays on the list', async () => {
    start('/en/admin/skills');
    render(<ListPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    await pressBack();

    expect(screen.getByText('The list')).toBeTruthy();
    expect(window.location.pathname).toBe('/en/admin/skills');
    expect(window.location.search).toBe('');
  });

  it('reopens it on Forward, on the same row', async () => {
    start('/en/admin/skills');
    render(<ListPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Edit Testing' }));
    await pressBack();
    expect(screen.getByText('The list')).toBeTruthy();

    await pressForward();
    expect(screen.getByText('Editing Testing')).toBeTruthy();
  });

  it('leaves the page behind the list reachable, and no sooner', async () => {
    start('/en/admin');
    window.history.pushState(null, '', '/en/admin/skills');
    render(<ListPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    // One Back is the editor...
    await pressBack();
    expect(window.location.pathname).toBe('/en/admin/skills');

    // ...and only the next one leaves, which is the entry that was missing.
    await pressBack();
    expect(window.location.pathname).toBe('/en/admin');
  });

  it('does the same for an editor that is a toggle', async () => {
    start('/en/admin/profile');
    render(<TogglePage />);

    fireEvent.click(screen.getByRole('button', { name: 'Edit profile' }));
    expect(window.location.search).toBe('?edit=profile');

    await pressBack();
    expect(screen.getByRole('button', { name: 'Edit profile' })).toBeTruthy();
    expect(window.location.search).toBe('');
  });
});

describe('closing it from the page rather than the reader', () => {
  it('leaves an entry behind when the reader cancels', async () => {
    start('/en/admin/skills');
    render(<ListPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    // Counted from here: a push drops whatever was ahead of it, so the length
    // before the editor opened is not a baseline for the length after.
    const opened = window.history.length;

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.getByText('The list')).toBeTruthy();
    expect(window.history.length).toBe(opened + 1);

    // So Back goes back into the editor, because opening it is what Back undoes.
    await pressBack();
    expect(screen.getByText('Editing a new row')).toBeTruthy();
  });

  /**
   * The options page closing an editor for a list it is no longer showing. Back
   * must not reopen an editor for a row that is not on screen any more.
   */
  it('leaves none when the page withdraws it', async () => {
    start('/en/admin/options');
    render(<ListPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    const opened = window.history.length;

    fireEvent.click(screen.getByRole('button', { name: 'Withdraw' }));

    expect(screen.getByText('The list')).toBeTruthy();
    expect(window.history.length).toBe(opened);

    await pressBack();
    expect(screen.getByText('The list')).toBeTruthy();
  });
});
