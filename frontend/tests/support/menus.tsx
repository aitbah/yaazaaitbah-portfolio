import { fireEvent, screen, within } from '@testing-library/react';

/**
 * Driving the Radix menus and dialogs the admin lists are built from.
 *
 * Opened from the keyboard rather than by pointer: jsdom implements no
 * `PointerEvent`, so a synthesised `pointerdown` reaches Radix without the
 * `button` property it checks and the menu never opens. Radix opens on Enter
 * too, and that is the path a keyboard user takes anyway.
 */
export async function openRowMenu(name: string) {
  fireEvent.keyDown(screen.getByRole('button', { name }), { key: 'Enter' });

  return screen.findByRole('menu');
}

/** Choose an entry from the menu that is open. */
export async function chooseMenuItem(name: string) {
  fireEvent.click(await screen.findByRole('menuitem', { name }));
}

/** Answer the confirmation a destructive entry opens. */
export async function answerConfirmation(name: string) {
  const dialog = await screen.findByRole('alertdialog');

  // Scoped to the dialog: "Delete" also names the row entry that opened it.
  fireEvent.click(within(dialog).getByRole('button', { name }));
}

/** Open a row's menu and take its destructive entry, then confirm. */
export async function deleteRow(menu: string, labels = { delete: 'Delete' }) {
  await openRowMenu(menu);
  await chooseMenuItem(labels.delete);
  await answerConfirmation(labels.delete);
}
