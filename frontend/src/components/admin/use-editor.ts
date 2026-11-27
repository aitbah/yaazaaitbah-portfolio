'use client';

import { useSearchParams } from 'next/navigation';

/** The one search parameter every admin editor opens itself with. */
export const EDITOR_PARAM = 'edit';

/** What the parameter holds for a row that does not exist yet. */
export const NEW_EDITOR_KEY = 'new';

function go(next: string | null, replace: boolean) {
  const url = new URL(window.location.href);

  if (next === null) {
    url.searchParams.delete(EDITOR_PARAM);
  } else {
    url.searchParams.set(EDITOR_PARAM, next);
  }

  const to = `${url.pathname}${url.search}${url.hash}`;

  if (replace) {
    window.history.replaceState(null, '', to);
  } else {
    window.history.pushState(null, '', to);
  }

  // Next syncs `useSearchParams` from the native history API, which is the
  // whole mechanism this needs: no event of our own, and nothing to keep in
  // step with a router navigation that changes the same parameter.
}

/**
 * Which editor is open, kept in the address bar so Back closes it and stays on
 * the list, Forward reopens it, and a reload keeps it.
 *
 * Changed with `history.pushState` rather than the router, which would ask the
 * server for nothing new; read with `useSearchParams`, which also sees changes
 * made through the router.
 *
 * Back does not ask before closing unsaved work: `popstate` cannot be cancelled
 * without faking history entries. Every deliberate exit and the tab still ask.
 */
export function useEditorKey(): {
  /** The open editor's key, or `null` when the list is showing. */
  key: string | null;
  open: (key: string) => void;
  close: () => void;
  /**
   * Closes without leaving a history entry, for a page closing an editor that
   * no longer applies rather than a reader closing one they opened.
   */
  closeWithoutHistory: () => void;
} {
  const key = useSearchParams().get(EDITOR_PARAM);

  return {
    key,
    open: (next) => go(next, false),
    close: () => go(null, false),
    closeWithoutHistory: () => go(null, true),
  };
}

/** Nothing open, creating a new row, or editing an existing one. */
export type RowEditing<T> = { row: T | null } | null;

/**
 * The same thing for the eight lists whose editor is about one row.
 *
 * The key is the row's id, so the page resolves it against what it has already
 * read rather than fetching a single row a second way. An id that is not in the
 * list - a link to something since deleted - shows the list, which is the
 * truthful answer and the one the reader can act on.
 */
export function useRowEditor<T extends { id: string }>(
  rows: readonly T[],
): {
  editing: RowEditing<T>;
  /** `null` opens an editor for a row that does not exist yet. */
  edit: (row: T | null) => void;
  close: () => void;
  closeWithoutHistory: () => void;
} {
  const { key, open, close, closeWithoutHistory } = useEditorKey();

  function editing(): RowEditing<T> {
    if (key === null) {
      return null;
    }

    if (key === NEW_EDITOR_KEY) {
      return { row: null };
    }

    const row = rows.find((candidate) => candidate.id === key);

    return row ? { row } : null;
  }

  return {
    editing: editing(),
    edit: (row) => open(row === null ? NEW_EDITOR_KEY : row.id),
    close,
    closeWithoutHistory,
  };
}
