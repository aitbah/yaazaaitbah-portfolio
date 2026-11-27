'use client';

import { createContext, useContext } from 'react';

export type UnsavedChanges = {
  /** Whether the form on screen holds changes that have not been saved. */
  setEdited: (edited: boolean) => void;
  /** Leaves now, or after the reader says the changes can go. */
  confirmLeaving: (leave: () => void) => void;
};

/**
 * The default is deliberately permissive rather than a thrown error: the login
 * page has a form and no admin shell around it, and the public site has no
 * editor at all. Neither has anything to lose.
 */
export const UnsavedChangesContext = createContext<UnsavedChanges>({
  setEdited: () => undefined,
  confirmLeaving: (leave) => leave(),
});

/**
 * Asks whether leaving is allowed. Separate from the provider that answers, and
 * that separation is what it is for: the language switch is shared with the
 * public navbar, and a module holding both would ship the admin's confirmation
 * dialog to a page that can never open it.
 */
export function useUnsavedChanges(): UnsavedChanges {
  return useContext(UnsavedChangesContext);
}
