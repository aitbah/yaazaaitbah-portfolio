'use client';

import { useEffect, type ComponentProps, type ReactNode } from 'react';

import { useUnsavedChanges } from '@/components/unsaved-changes';
import { EditingLocaleProvider } from '@/components/form/editing-locale';
import { FieldGroup } from '@/components/ui/field';
import { cn } from '@/lib/utils';

/**
 * The `form` every admin form uses. It spends width on columns (`FieldRow`)
 * rather than longer inputs; `noValidate` because the resolver renders the
 * messages; and it provides the editing language.
 *
 * `isDirty` is required, so no form can forget the unsaved-changes guard.
 */
export function FormLayout({
  children,
  className,
  isDirty,
  ...props
}: ComponentProps<'form'> & {
  children: ReactNode;
  /**
   * `form.formState.isDirty`. Compared against what was loaded, so typing a
   * word and deleting it again is correctly not a change - and it covers the
   * controls that are not native inputs, which watching the DOM would not.
   */
  isDirty: boolean;
}) {
  const { setEdited } = useUnsavedChanges();

  // Cleared on the way out as well as on every change: an editor that closes
  // has nothing left to lose, and a flag left set would guard the next page.
  useEffect(() => {
    setEdited(isDirty);

    return () => setEdited(false);
  }, [isDirty, setEdited]);

  return (
    <EditingLocaleProvider>
      <form
        noValidate
        className={cn('flex w-full flex-col gap-6', className)}
        {...props}
      >
        {children}
      </form>
    </EditingLocaleProvider>
  );
}

/**
 * The form's sections at the one spacing every form uses - `gap-2` in a field,
 * `gap-4` between fields, `gap-8` between sections. Also the container
 * `FieldRow` measures against.
 */
export function FormFields({ children }: { children: ReactNode }) {
  return <FieldGroup className="gap-8">{children}</FieldGroup>;
}
