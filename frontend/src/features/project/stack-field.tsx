'use client';

import { Controller, type Control, type FieldValues } from 'react-hook-form';
import { EXPERTISE_KINDS, type ExpertiseKind } from '@portfolio/shared';

import { Field, FieldError, FieldTitle } from '@/components/ui/field';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { toFieldPath } from '@/lib/form-resolver';

import type { Expertise } from '@/features/expertise/expertise-api';

type StackFieldProps<TValues extends FieldValues, TPayload> = {
  control: Control<TValues, unknown, TPayload>;
  id: string;
  title: string;
  empty: string;
  /** Technologies and tools, in one list. */
  options: Expertise[];
  /** The launch locale is the one every row is required to have. */
  nameOf: (row: Expertise) => string;
  /** The heading for each kind's group - "Technologies", "Tools". */
  groupLabel: (kind: ExpertiseKind) => string;
};

/**
 * What a project was built with: technologies and tools, grouped by kind, as
 * checkboxes of existing rows - so a project can only reference something that
 * exists. The API refuses the wrong kind too.
 */
export function StackField<TValues extends FieldValues, TPayload>({
  control,
  id,
  title,
  empty,
  options,
  nameOf,
  groupLabel,
}: StackFieldProps<TValues, TPayload>) {
  const errorId = `${id}-error`;

  // In the declared order, so the groups do not reshuffle as rows are added.
  const groups = EXPERTISE_KINDS.map((kind) => ({
    kind,
    rows: options.filter((row) => row.kind === kind),
  })).filter((group) => group.rows.length > 0);

  return (
    <Controller
      control={control}
      name={toFieldPath<TValues>('stack')}
      render={({ field, fieldState }) => {
        const chosen = (field.value as string[] | undefined) ?? [];

        return (
          <Field data-invalid={fieldState.invalid || undefined}>
            <FieldTitle>{title}</FieldTitle>

            {groups.length === 0 ? (
              <p className="text-sm text-muted-foreground">{empty}</p>
            ) : (
              <div
                role="group"
                aria-label={title}
                aria-describedby={fieldState.error ? errorId : undefined}
                className="flex flex-col gap-4"
              >
                {groups.map(({ kind, rows }) => (
                  <div key={kind} className="flex flex-col gap-2">
                    {/* Not the section legend's register: uppercase and
                        tracked is what a `FormSection` legend looks like, and
                        a group *inside* one field reading identically to the
                        heading above it flattens the hierarchy it belongs to. */}
                    <span className="text-xs font-medium text-muted-foreground">
                      {groupLabel(kind)}
                    </span>
                    <div className="flex flex-wrap gap-x-6 gap-y-3">
                      {rows.map((row) => {
                        const checkboxId = `${id}-${row.id}`;

                        return (
                          <div key={row.id} className="flex items-center gap-2">
                            <Checkbox
                              id={checkboxId}
                              checked={chosen.includes(row.id)}
                              onCheckedChange={(checked) => {
                                field.onChange(
                                  checked === true
                                    ? [...chosen, row.id]
                                    : chosen.filter((it) => it !== row.id),
                                );
                              }}
                            />
                            <Label htmlFor={checkboxId} className="font-normal">
                              {nameOf(row)}
                            </Label>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <FieldError id={errorId} errors={[fieldState.error]} />
          </Field>
        );
      }}
    />
  );
}
