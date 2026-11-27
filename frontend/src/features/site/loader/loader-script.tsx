'use client';

import { useSyncExternalStore } from 'react';

const noSubscription = () => () => {};

/**
 * The cover's inline script, for the server's HTML and its hydration only. A
 * script React creates in the browser never runs, and React warns about it,
 * so a later client-side render leaves it out; the motion covers that case
 * itself. The code arrives as a prop, built once on the server, so the
 * hydrated script is the one the server sent.
 */
export function LoaderScript({ code }: { code: string }) {
  const rendering = useSyncExternalStore(
    noSubscription,
    () => false,
    () => true,
  );

  return rendering ? (
    <script dangerouslySetInnerHTML={{ __html: code }} />
  ) : null;
}
