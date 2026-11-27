'use client';

import type { ReactNode } from 'react';
import {
  Controller,
  type Control,
  type FieldPathByValue,
  type FieldValues,
} from 'react-hook-form';

import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

type TextFieldProps<TValues extends FieldValues, TPayload> = {
  control: Control<TValues, unknown, TPayload>;
  /** Only a path that holds text - never a whole localized field. */
  name: FieldPathByValue<TValues, string>;
  /** Separate from `name`, which may carry the dots of a nested path. */
  id: string;
  /**
   * Usually a string. A node where part of the name is for assistive tech only -
   * a localized field says which language it holds without printing it beside
   * a control that already shows it.
   */
  label: ReactNode;
  /**
   * Content at the end of the label's own row: a control that acts on this
   * field rather than on the form. Above the input rather than beside it, so
   * the field keeps its full width and the pairing survives a narrow screen.
   */
  aside?: ReactNode;
  type?: 'text' | 'email' | 'password' | 'url';
  autoComplete?: string;
  /** Renders a Textarea instead, for which `type` does not apply. */
  multiline?: boolean;
  required?: boolean;
  /**
   * A hint under the input, announced with it rather than merely drawn beside
   * it - "this cannot be changed later" is not information a screen reader
   * should have to go looking for.
   */
  description?: string;
  /** For a value that is real but not editable, such as a code rows point at. */
  disabled?: boolean;
  /** Shown while empty; `" "` lets CSS tell an empty field from a filled one. */
  placeholder?: string;
};

/**
 * One input with its label and its error. shadcn's Field styles the parts but
 * wires none of them together, so the id and the aria attributes are joined up
 * here - once, rather than in every form.
 */
export function TextField<TValues extends FieldValues, TPayload>({
  control,
  name,
  id,
  label,
  aside,
  type,
  autoComplete,
  multiline,
  required,
  description,
  disabled,
  placeholder,
}: TextFieldProps<TValues, TPayload>) {
  const errorId = `${id}-error`;
  const descriptionId = `${id}-description`;

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const describedBy = [
          description ? descriptionId : undefined,
          fieldState.error ? errorId : undefined,
        ].filter(Boolean);

        const wiring = {
          ...field,
          id,
          required,
          disabled,
          placeholder,
          'aria-invalid': fieldState.invalid,
          'aria-describedby':
            describedBy.length > 0 ? describedBy.join(' ') : undefined,
        };

        return (
          <Field data-invalid={fieldState.invalid || undefined}>
            {aside ? (
              <div className="flex w-full items-center justify-between gap-3">
                <FieldLabel htmlFor={id}>{label}</FieldLabel>
                {aside}
              </div>
            ) : (
              <FieldLabel htmlFor={id}>{label}</FieldLabel>
            )}
            {multiline ? (
              <Textarea {...wiring} />
            ) : (
              <Input {...wiring} type={type} autoComplete={autoComplete} />
            )}
            {description ? (
              <FieldDescription id={descriptionId}>
                {description}
              </FieldDescription>
            ) : null}
            <FieldError id={errorId} errors={[fieldState.error]} />
          </Field>
        );
      }}
    />
  );
}
