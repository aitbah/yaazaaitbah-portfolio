'use client';

import type { ReactNode } from 'react';
import { Direction } from 'radix-ui';

/**
 * Tells Radix which way the page reads. `<html dir>` covers CSS, but Radix
 * reads only this context - it decides which way arrow keys move focus and
 * where menus align. A client wrapper, since the locale layout is a server
 * component.
 */
export function DirectionProvider({
  direction,
  children,
}: {
  direction: 'ltr' | 'rtl';
  children: ReactNode;
}) {
  return (
    <Direction.DirectionProvider dir={direction}>
      {children}
    </Direction.DirectionProvider>
  );
}
