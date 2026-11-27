'use client';

import { useTranslations } from 'next-intl';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { UnsavedChangesContext } from '@/components/unsaved-changes';

/**
 * Nothing leaves an edited form without asking: the sidebar, the menus, the
 * breadcrumb and the language switch all check. One dialog for the whole admin,
 * so the question is always worded the same.
 */
export function UnsavedChangesProvider({ children }: { children: ReactNode }) {
  const t = useTranslations('admin.unsavedChanges');
  const [edited, setEditedState] = useState(false);
  const [pending, setPending] = useState<(() => void) | null>(null);

  /**
   * Read by `confirmLeaving` at click time, so handlers made on an earlier
   * render still get the current answer. Written in an effect, as a render must
   * have no side effects.
   */
  const editedRef = useRef(edited);

  useEffect(() => {
    editedRef.current = edited;
  }, [edited]);

  const setEdited = useCallback((next: boolean) => setEditedState(next), []);

  const confirmLeaving = useCallback((leave: () => void) => {
    if (!editedRef.current) {
      leave();

      return;
    }

    // Stored, not called: `setState` runs a function argument as an updater.
    setPending(() => leave);
  }, []);

  /**
   * Closing the tab, the one exit we cannot draw over: the browser's own prompt
   * is the only mechanism, so the native confirmation is allowed here alone.
   */
  useEffect(() => {
    if (!edited) {
      return undefined;
    }

    const warn = (event: BeforeUnloadEvent) => event.preventDefault();

    window.addEventListener('beforeunload', warn);

    return () => window.removeEventListener('beforeunload', warn);
  }, [edited]);

  const value = useMemo(
    () => ({ setEdited, confirmLeaving }),
    [setEdited, confirmLeaving],
  );

  return (
    <UnsavedChangesContext.Provider value={value}>
      {children}

      <AlertDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPending(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('description')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            {/* Staying is the safe answer, so it is the one the dialog opens
                on and the one Escape gives you. */}
            <AlertDialogCancel>{t('stay')}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                const leave = pending;

                setPending(null);
                // Forgotten before leaving, or the guard fires again on the
                // page being navigated to.
                setEditedState(false);
                leave?.();
              }}
            >
              {t('leave')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </UnsavedChangesContext.Provider>
  );
}
