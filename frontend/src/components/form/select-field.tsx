'use client';

import {
  Controller,
  type Control,
  type FieldPathByValue,
  type FieldValues,
} from 'react-hook-form';

import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export type SelectOption = { value: string; label: string };

/** A named run of options, for a list too long to scan flat. */
export type SelectOptionGroup = {
  label: string;
  options: readonly SelectOption[];
};

type SelectFieldProps<TValues extends FieldValues, TPayload> = {
  control: Control<TValues, unknown, TPayload>;
  name: FieldPathByValue<TValues, string>;
  /** Separate from `name`, which may carry the dots of a nested path. */
  id: string;
  label: string;
  /** Shown while nothing is chosen, so an untouched field reads as empty. */
  placeholder: string;
  options: readonly SelectOption[] | readonly SelectOptionGroup[];
  required?: boolean;
};

function isGroup(
  option: SelectOption | SelectOptionGroup,
): option is SelectOptionGroup {
  return 'options' in option;
}

/**
 * One choice with its label and error, wired like `TextField`. The value is a
 * code, never translated text. Options may come in named groups, so a long list
 * can be scanned.
 */
export function SelectField<TValues extends FieldValues, TPayload>({
  control,
  name,
  id,
  label,
  placeholder,
  options,
  required,
}: SelectFieldProps<TValues, TPayload>) {
  const errorId = `${id}-error`;

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid || undefined}>
          <FieldLabel htmlFor={id}>{label}</FieldLabel>
          <Select
            value={field.value}
            onValueChange={field.onChange}
            // Radix renders a button, so blur has to be forwarded by hand for
            // the field to ever be touched.
            onOpenChange={(open) => {
              if (!open) field.onBlur();
            }}
          >
            <SelectTrigger
              id={id}
              ref={field.ref}
              aria-invalid={fieldState.invalid}
              aria-describedby={fieldState.error ? errorId : undefined}
              aria-required={required}
              className="w-full"
            >
              <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
              {options.map((option) =>
                isGroup(option) ? (
                  <SelectGroup key={option.label}>
                    <SelectLabel>{option.label}</SelectLabel>
                    {option.options.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ) : (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ),
              )}
            </SelectContent>
          </Select>
          <FieldError id={errorId} errors={[fieldState.error]} />
        </Field>
      )}
    />
  );
}
