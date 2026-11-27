'use client';

import { useEffect, useRef } from 'react';

import { useToast } from '@/components/ui/toast';

/**
 * The outcome of an action that failed, raised as an error toast - where
 * `ErrorText` is for content that could not be shown in its place.
 *
 * Takes the message the caller may or may not have, like `ErrorText`, and
 * raises it once each time it appears: a failure repeated after a retry comes
 * back through `null`, so it is raised again. Renders nothing.
 */
export function ErrorToast({ children }: { children?: string | null }) {
  const toast = useToast();
  const raised = useRef<string | null>(null);

  useEffect(() => {
    if (!children) {
      raised.current = null;

      return;
    }

    // Strict mode runs an effect twice; the ref outlives that, so one failure
    // is one toast.
    if (raised.current === children) {
      return;
    }

    raised.current = children;
    toast({ title: children, tone: 'error' });
  }, [children, toast]);

  return null;
}
