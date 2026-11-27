'use client';

import {
  Controller,
  type Control,
  type FieldPathByValue,
  type FieldValues,
} from 'react-hook-form';

import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Checkbox } from '@/components/ui/checkbox';

type CheckboxFieldProps<TValues extends FieldValues, TPayload> = {
  control: Control<TValues, unknown, TPayload>;
  name: FieldPathByValue<TValues, boolean>;
  /** Separate from `name`, which may carry the dots of a nested path. */
  id: string;
  label: string;
  /** Rendered under the label - what turning it on actually does. */
  description?: string;
};

/**
 * One checkbox with its label and its error, wired like the other fields.
 * Radix renders a button rather than an input, so the label is joined to it by
 * id and the change is forwarded by hand.
 */
export function CheckboxField<TValues extends FieldValues, TPayload>({
  control,
  name,
  id,
  label,
  description,
}: CheckboxFieldProps<TValues, TPayload>) {
  const errorId = `${id}-error`;

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field
          orientation="horizontal"
          data-invalid={fieldState.invalid || undefined}
        >
          <Checkbox
            id={id}
            ref={field.ref}
            checked={field.value}
            onCheckedChange={(checked) => field.onChange(checked === true)}
            onBlur={field.onBlur}
            aria-invalid={fieldState.invalid}
            aria-describedby={fieldState.error ? errorId : undefined}
          />
          <div className="flex flex-col gap-1">
            <FieldLabel htmlFor={id}>{label}</FieldLabel>
            {description ? (
              <span className="text-sm text-muted-foreground">
                {description}
              </span>
            ) : null}
            <FieldError id={errorId} errors={[fieldState.error]} />
          </div>
        </Field>
      )}
    />
  );
}
