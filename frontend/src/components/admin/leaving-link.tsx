'use client';

import type { MouseEvent } from 'react';

import { useUnsavedChanges } from '@/components/unsaved-changes';
import { useRouter } from '@/i18n/navigation';

type Href = Parameters<ReturnType<typeof useRouter>['push']>[0];

/**
 * What a link has to do when the page behind it holds unsaved work.
 *
 * Returned as props to spread rather than as a `<Link>` wrapper: the sidebar's
 * links are already inside `SidebarMenuButton asChild`, and slotting one more
 * component between them is a ref to forward and a class to pass through for
 * no gain. The call sites keep their own markup and gain one attribute.
 */
export function useLeavingLink(): (href: Href) => {
  onClick: (event: MouseEvent<HTMLAnchorElement>) => void;
} {
  const { confirmLeaving } = useUnsavedChanges();
  const router = useRouter();

  return (href) => ({
    onClick: (event) => {
      // A modified click opens a new tab or window and leaves this one exactly
      // where it is, so there is nothing to lose and nothing to ask about.
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      event.preventDefault();
      confirmLeaving(() => router.push(href));
    },
  });
}
