'use client';

import { useLayoutEffect, useSyncExternalStore } from 'react';

import { applyTheme, resolvedTheme, THEME_SCRIPT } from './theme';

const noSubscription = () => () => {};

/**
 * The theme, applied by an inline script before the first paint. React will not
 * create a `<script>` on the client, so this renders it for the server's HTML
 * and hydration only; after that the class is already on `<html>` and
 * `useTheme` keeps it right.
 */
export function ThemeScript() {
  /**
   * And applied again when this mounts in the browser, for pages built entirely
   * there - such as a not-found page sent as Next's error shell.
   */
  useLayoutEffect(() => {
    applyTheme(resolvedTheme());
  }, []);

  const rendering = useSyncExternalStore(
    noSubscription,
    // In the browser, once hydrated or when mounted by a navigation.
    () => false,
    // On the server, and during hydration of what the server sent.
    () => true,
  );

  if (!rendering) {
    return null;
  }

  return (
    // No nonce: the admin's CSP admits this script by its hash (`proxy.ts`).
    <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
  );
}
