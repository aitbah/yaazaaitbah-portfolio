'use client';

import { useState, type ChangeEvent } from 'react';
import {
  useController,
  type Control,
  type FieldPathByValue,
  type FieldValues,
  type UseFormClearErrors,
  type UseFormSetError,
} from 'react-hook-form';

import { Button, buttonVariants } from '@/components/ui/button';
import { Field, FieldError, FieldTitle } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { StoredImage } from '@/components/stored-image';
import { ApiRequestError } from '@/lib/api-client';
import { toFieldErrors } from '@/lib/error-codes';
import { cn } from '@/lib/utils';

/** Mirrors what the endpoints parse; the server still decides from the bytes. */
const ACCEPTED = 'image/png,image/jpeg,image/webp';

/** Every string this renders, so no namespace is named inside the component. */
export type ImageFieldLabels = {
  title: string;
  choose: string;
  replace: string;
  remove: string;
  uploading: string;
  preview: string;
  empty: string;
  unavailable: string;
};

type Upload = {
  mutate: (
    file: File,
    handlers: {
      onSuccess: (reference: string) => void;
      onError: (error: unknown) => void;
    },
  ) => void;
  isPending: boolean;
};

type ImageFieldProps<TValues extends FieldValues, TPayload> = {
  control: Control<TValues, unknown, TPayload>;
  name: FieldPathByValue<TValues, string>;
  /** Separate from `name`, which may carry the dots of a nested path. */
  id: string;
  labels: ImageFieldLabels;
  upload: Upload;
  setError: UseFormSetError<TValues>;
  clearErrors: UseFormClearErrors<TValues>;
  /** The key the upload endpoint reports a rejected file under. */
  errorKey: string;
  /**
   * The shape the image is published at.
   *
   * A wide hero shown in a square thumbnail is a preview of something the site
   * will never render - the admin cannot see the crop they are choosing.
   */
  shape?: 'square' | 'wide';
  translateField: (code: string) => string;
  translateResponse: (error: unknown) => string;
};

/**
 * An image, chosen rather than typed; uploaded on selection so a refusal shows
 * at once, and stored only when the form is saved. Shared by the profile photo
 * and the project cover; what differs arrives as props.
 */
export function ImageField<TValues extends FieldValues, TPayload>({
  control,
  name,
  id,
  labels,
  upload,
  setError,
  clearErrors,
  errorKey,
  shape = 'square',
  translateField,
  translateResponse,
}: ImageFieldProps<TValues, TPayload>) {
  const errorId = `${id}-error`;
  // Same height either way, so a form mixing the two keeps its rhythm.
  const frame = shape === 'wide' ? 'h-20 w-36' : 'size-20';

  // A stored reference can outlive its file - a volume swapped, a manual
  // delete. Rendering a broken image is worse than showing nothing.
  const [unreachable, setUnreachable] = useState(false);
  const { field, fieldState } = useController({ control, name });

  function select(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Cleared so choosing the same file twice still counts as a change.
    event.target.value = '';

    if (!file) {
      return;
    }

    clearErrors(name);

    upload.mutate(file, {
      onSuccess: (reference) => {
        setUnreachable(false);
        field.onChange(reference);
      },
      onError: (error) => {
        const code =
          error instanceof ApiRequestError && error.code === 'VALIDATION_ERROR'
            ? toFieldErrors(error.details)[errorKey]
            : undefined;

        setError(name, {
          type: code ?? 'UPLOAD_FAILED',
          // A rejected file explains itself; anything else is a request failure.
          message: code ? translateField(code) : translateResponse(error),
        });
      },
    });
  }

  return (
    <Field data-invalid={fieldState.invalid || undefined}>
      <FieldTitle>{labels.title}</FieldTitle>

      <div className="flex flex-wrap items-center gap-4">
        {field.value && !unreachable ? (
          <StoredImage
            src={field.value}
            alt={labels.preview}
            // A fixed preview frame, so one width rather than a breakpoint list.
            sizes="160px"
            className={cn(frame, 'rounded-md border')}
            onError={() => {
              setUnreachable(true);
            }}
          />
        ) : (
          <div
            className={cn(
              frame,
              'flex items-center justify-center rounded-md border border-dashed p-2 text-center text-xs text-muted-foreground',
            )}
            aria-hidden
          >
            {/* "No image" would be a lie when a reference is stored but its
                file cannot be fetched. */}
            {unreachable ? labels.unavailable : labels.empty}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {/* Hidden but focusable: the label carries the translated name, and
              the focus ring follows the input so keyboard use stays visible. */}
          <input
            id={id}
            type="file"
            accept={ACCEPTED}
            className="peer sr-only"
            aria-invalid={fieldState.invalid}
            aria-describedby={fieldState.error ? errorId : undefined}
            onChange={select}
            disabled={upload.isPending}
          />
          <label
            htmlFor={id}
            className={cn(
              buttonVariants({ variant: 'outline', size: 'sm' }),
              'cursor-pointer peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring/50',
              upload.isPending && 'pointer-events-none opacity-50',
            )}
          >
            {upload.isPending ? (
              <>
                <Spinner aria-hidden />
                {labels.uploading}
              </>
            ) : field.value ? (
              labels.replace
            ) : (
              labels.choose
            )}
          </label>

          {/* Offered whenever a reference is stored, including one whose file
              has gone: that is exactly when it needs clearing. */}
          {field.value ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={upload.isPending}
              onClick={() => {
                clearErrors(name);
                setUnreachable(false);
                // Cleared here, deleted when the form is actually saved.
                field.onChange('');
              }}
            >
              {labels.remove}
            </Button>
          ) : null}
        </div>
      </div>

      <FieldError id={errorId} errors={[fieldState.error]} />
    </Field>
  );
}
