import type { ReactNode } from 'react';

import { FieldDescription, FieldLegend, FieldSet } from '@/components/ui/field';

type FormSectionProps = {
  /**
   * What the section is about. Omitted when the only thing in it already names
   * itself - a repeated label is worse than none.
   */
  title?: string;
  /**
   * One line that applies to the whole section. Two forms were rendering their
   * own paragraph here, at their own size, above their own first field.
   */
  description?: string;
  children: ReactNode;
};

/**
 * A group of fields as a real `fieldset` and `legend`, so it is announced. The
 * legend is in a quieter register than labels, and sections after the first are
 * ruled - on the section, since a `legend` shrinks to its text.
 */
export function FormSection({
  title,
  description,
  children,
}: FormSectionProps) {
  return (
    <FieldSet className="gap-4 not-first:border-t not-first:pt-6">
      {title ? (
        <FieldLegend
          variant="label"
          className="text-xs font-medium tracking-wide text-muted-foreground uppercase"
        >
          {title}
        </FieldLegend>
      ) : null}
      {description ? (
        <FieldDescription className="-mt-2">{description}</FieldDescription>
      ) : null}
      {children}
    </FieldSet>
  );
}
