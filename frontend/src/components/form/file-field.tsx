'use client';

import { FileTextIcon } from 'lucide-react';
import { type ChangeEvent, type ReactNode } from 'react';
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
import { ApiRequestError, assetUrl } from '@/lib/api-client';
import { toFieldErrors } from '@/lib/error-codes';
import { cn } from '@/lib/utils';

/** Mirrors what the endpoint parses; the server still decides from the bytes. */
const ACCEPTED = 'application/pdf';

/** Every string this renders, so no namespace is named inside the component. */
export type FileFieldLabels = {
  title: string;
  /**
   * The actions take a node rather than a string: a localized document says
   * which language it is for, and says it to a screen reader rather than
   * printing it on a button that already sits beside a language control.
   */
  choose: ReactNode;
  replace: ReactNode;
  remove: ReactNode;
  uploading: string;
  empty: string;
  /** Names the stored file, which is the only thing there is to show. */
  stored: string;
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

type FileFieldProps<TValues extends FieldValues, TPayload> = {
  control: Control<TValues, unknown, TPayload>;
  name: FieldPathByValue<TValues, string>;
  /** Separate from `name`, which may carry the dots of a nested path. */
  id: string;
  labels: FileFieldLabels;
  /**
   * Content at the end of the title's own row: a control that acts on this
   * field rather than on the form. The same slot `TextField` has, so a
   * localized document is arranged like a localized sentence.
   */
  aside?: ReactNode;
  upload: Upload;
  setError: UseFormSetError<TValues>;
  clearErrors: UseFormClearErrors<TValues>;
  /** The key the upload endpoint reports a rejected file under. */
  errorKey: string;
  translateField: (code: string) => string;
  translateResponse: (error: unknown) => string;
};

/**
 * A stored document, chosen rather than typed. No preview: rendering a PDF
 * would need a renderer we avoid. Uploaded on selection so a refusal shows at
 * once; saving the form makes it the stored file.
 */
export function FileField<TValues extends FieldValues, TPayload>({
  control,
  name,
  id,
  labels,
  aside,
  upload,
  setError,
  clearErrors,
  errorKey,
  translateField,
  translateResponse,
}: FileFieldProps<TValues, TPayload>) {
  const errorId = `${id}-error`;
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
      onSuccess: (reference) => field.onChange(reference),
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
      {aside ? (
        <div className="flex w-full items-center justify-between gap-3">
          <FieldTitle>{labels.title}</FieldTitle>
          {aside}
        </div>
      ) : (
        <FieldTitle>{labels.title}</FieldTitle>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2 text-sm">
          <FileTextIcon
            className={cn(
              'size-4 shrink-0',
              field.value ? 'text-foreground' : 'text-muted-foreground',
            )}
            aria-hidden
          />
          {field.value ? (
            /* Served as an attachment, so this downloads rather than opening a
               tab - which is what the reader wants from a CV anyway. */
            <a
              href={assetUrl(field.value)}
              className="truncate underline-offset-4 hover:underline"
              // A download from another origin in development; the header on
              // the response is what actually decides, not this attribute.
              download
            >
              {labels.stored}
            </a>
          ) : (
            <span className="text-muted-foreground">{labels.empty}</span>
          )}
        </div>

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

          {field.value ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={upload.isPending}
              onClick={() => {
                clearErrors(name);
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
