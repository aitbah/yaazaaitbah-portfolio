'use client';

import {
  Controller,
  type Control,
  type FieldPathByValue,
  type FieldValues,
} from 'react-hook-form';

import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';

type MonthFieldProps<TValues extends FieldValues, TPayload> = {
  control: Control<TValues, unknown, TPayload>;
  /** Holds `YYYY-MM`, or the empty string while nothing is chosen. */
  name: FieldPathByValue<TValues, string>;
  /** Separate from `name`, which may carry the dots of a nested path. */
  id: string;
  label: string;
  required?: boolean;
  disabled?: boolean;
  /** Said under the input when the field is disabled for a reason. */
  description?: string;
};

/**
 * A month, `YYYY-MM`. `type="month"` produces exactly that string with no
 * timezone involved; browsers without the picker fall back to text, which the
 * shared rule validates.
 */
export function MonthField<TValues extends FieldValues, TPayload>({
  control,
  name,
  id,
  label,
  required,
  disabled,
  description,
}: MonthFieldProps<TValues, TPayload>) {
  const errorId = `${id}-error`;
  const descriptionId = `${id}-description`;

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid || undefined}>
          <FieldLabel htmlFor={id}>{label}</FieldLabel>
          <Input
            {...field}
            id={id}
            type="month"
            required={required}
            disabled={disabled}
            aria-invalid={fieldState.invalid}
            aria-describedby={
              fieldState.error
                ? errorId
                : description && disabled
                  ? descriptionId
                  : undefined
            }
          />
          {description && disabled ? (
            <p id={descriptionId} className="text-sm text-muted-foreground">
              {description}
            </p>
          ) : null}
          <FieldError id={errorId} errors={[fieldState.error]} />
        </Field>
      )}
    />
  );
}
