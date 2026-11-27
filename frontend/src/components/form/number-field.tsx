'use client';

import {
  Controller,
  type Control,
  type FieldPathByValue,
  type FieldValues,
} from 'react-hook-form';

import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';

type NumberFieldProps<TValues extends FieldValues, TPayload> = {
  control: Control<TValues, unknown, TPayload>;
  /** Only a path that holds a number - the schema rejects numeric strings. */
  name: FieldPathByValue<TValues, number>;
  /** Separate from `name`, which may carry the dots of a nested path. */
  id: string;
  label: string;
  min?: number;
  max?: number;
  step?: number;
  /** Rendered after the input - a unit, or what the number means. */
  suffix?: string;
  required?: boolean;
};

/**
 * A number input that hands the form a number.
 *
 * An input's value is always a string, and the shared rules reject a numeric
 * string on purpose - the API takes numbers. `valueAsNumber` converts here, and
 * an empty input becomes NaN, which reports REQUIRED exactly like an absent
 * value rather than silently submitting zero.
 */
export function NumberField<TValues extends FieldValues, TPayload>({
  control,
  name,
  id,
  label,
  min,
  max,
  step,
  suffix,
  required,
}: NumberFieldProps<TValues, TPayload>) {
  const errorId = `${id}-error`;

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid || undefined}>
          <FieldLabel htmlFor={id}>{label}</FieldLabel>
          <div className="flex items-center gap-2">
            <Input
              {...field}
              id={id}
              type="number"
              inputMode="numeric"
              min={min}
              max={max}
              step={step}
              required={required}
              // NaN would render as the string "NaN"; an empty box is correct.
              value={Number.isNaN(field.value) ? '' : field.value}
              onChange={(event) => field.onChange(event.target.valueAsNumber)}
              aria-invalid={fieldState.invalid}
              aria-describedby={fieldState.error ? errorId : undefined}
            />
            {suffix ? (
              <span aria-hidden className="text-sm text-muted-foreground">
                {suffix}
              </span>
            ) : null}
          </div>
          <FieldError id={errorId} errors={[fieldState.error]} />
        </Field>
      )}
    />
  );
}
