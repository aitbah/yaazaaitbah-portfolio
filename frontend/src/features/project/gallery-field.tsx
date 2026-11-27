'use client';

import { useTranslations } from 'next-intl';
import { type ChangeEvent } from 'react';
import { useFieldArray, type UseFormReturn } from 'react-hook-form';
import { MAX_GALLERY_IMAGES } from '@portfolio/shared';

import { useLocalizedFieldState } from '@/components/form/editing-locale';
import {
  LanguageTabs,
  useLocalizedLabel,
} from '@/components/form/field-language';
import { StoredImage } from '@/components/stored-image';
import { TextField } from '@/components/form/text-field';
import { Button, buttonVariants } from '@/components/ui/button';
import { Field, FieldError, FieldTitle } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { routing } from '@/i18n/routing';
import { ApiRequestError } from '@/lib/api-client';
import { toFieldErrors } from '@/lib/error-codes';
import { useErrorMessages } from '@/lib/error-messages';
import { toTextFieldPath } from '@/lib/form-resolver';
import { cn } from '@/lib/utils';

import type { ProjectFormValues, ProjectInput } from './project-schema';
import { useUploadGalleryImage } from './use-projects';

/** Mirrors what the endpoint parses; the server still decides from the bytes. */
const ACCEPTED = 'image/png,image/jpeg,image/webp';

const LOCALES = routing.locales;

type GalleryFieldProps = {
  form: UseFormReturn<ProjectFormValues, unknown, ProjectInput>;
};

/**
 * The screenshots beside a project's cover. Position in the list is the display
 * order, saved with the project. Each image uploads on selection; one abandoned
 * before saving is collected by `uploads:prune`.
 */
export function GalleryField({ form }: GalleryFieldProps) {
  const t = useTranslations('admin.projects.gallery');
  const errorMessage = useErrorMessages();

  const upload = useUploadGalleryImage();
  const { fields, append, remove, move } = useFieldArray({
    control: form.control,
    name: 'gallery',
  });

  const isFull = fields.length >= MAX_GALLERY_IMAGES;
  const error = form.formState.errors.gallery;

  /**
   * One upload at a time, awaiting each: `mutate` in a loop fires its callbacks
   * only for the last call, and the endpoint is rate limited.
   */
  async function add(event: ChangeEvent<HTMLInputElement>) {
    const files = [...(event.target.files ?? [])];
    // Cleared so choosing the same file twice still counts as a change.
    event.target.value = '';

    if (files.length === 0) {
      return;
    }

    form.clearErrors('gallery');

    // Only as many as there is room for, so the cap is enforced before the
    // upload rather than by the server refusing a save already composed.
    for (const file of files.slice(0, MAX_GALLERY_IMAGES - fields.length)) {
      try {
        const url = await upload.mutateAsync(file);

        append({
          url,
          alt: Object.fromEntries(LOCALES.map((locale) => [locale, ''])),
        });
      } catch (uploadError) {
        const code =
          uploadError instanceof ApiRequestError &&
          uploadError.code === 'VALIDATION_ERROR'
            ? toFieldErrors(uploadError.details).gallery
            : undefined;

        form.setError('gallery', {
          type: code ?? 'UPLOAD_FAILED',
          message: code
            ? errorMessage.field(code)
            : errorMessage.response(uploadError),
        });

        // One rejected file should not silently drop the rest of the selection.
        continue;
      }
    }
  }

  return (
    <Field>
      <FieldTitle>
        {t('title')}{' '}
        <span className="font-normal text-muted-foreground">
          {t('count', { count: fields.length, max: MAX_GALLERY_IMAGES })}
        </span>
      </FieldTitle>

      {fields.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('empty')}</p>
      ) : (
        <ul className="grid gap-3 @2xl/field-group:grid-cols-2">
          {fields.map((entry, index) => (
            <li
              key={entry.id}
              className="flex flex-col gap-3 rounded-lg border p-3"
            >
              <div className="flex items-start gap-3">
                {/* Twelve of these can be on screen at once, which is what
                    made this the heaviest image on any admin page: twelve
                    permitted uploads is roughly 19 MB delivered, and 87 kB
                    delivered at the size they are drawn. */}
                <StoredImage
                  src={entry.url}
                  alt={t('preview', { position: index + 1 })}
                  sizes="80px"
                  className="size-20 shrink-0 rounded-md border"
                />

                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <span className="text-sm text-muted-foreground">
                    {t('position', {
                      position: index + 1,
                      total: fields.length,
                    })}
                  </span>

                  <div className="flex flex-wrap gap-1">
                    {/* Buttons rather than drag and drop: the whole list is
                        submitted with the form, and a keyboard can reach a
                        button. Dragging would be neither. */}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={index === 0}
                      aria-label={t('moveUp', { position: index + 1 })}
                      onClick={() => move(index, index - 1)}
                    >
                      ↑
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={index === fields.length - 1}
                      aria-label={t('moveDown', { position: index + 1 })}
                      onClick={() => move(index, index + 1)}
                    >
                      ↓
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label={t('removeAt', { position: index + 1 })}
                      onClick={() => remove(index)}
                    >
                      {t('remove')}
                    </Button>
                  </div>
                </div>
              </div>

              {/* The description sits with the image it describes, so it is
                  written while looking at it. */}
              <GalleryAlt form={form} index={index} />
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input
          id="gallery-file"
          type="file"
          accept={ACCEPTED}
          multiple
          className="peer sr-only"
          onChange={(event) => void add(event)}
          disabled={upload.isPending || isFull}
        />
        {/* Hidden but focusable: the label carries the translated name, and the
            focus ring follows the input so keyboard use stays visible. */}
        <label
          htmlFor="gallery-file"
          className={cn(
            buttonVariants({ variant: 'outline', size: 'sm' }),
            'cursor-pointer peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring/50',
            (upload.isPending || isFull) && 'pointer-events-none opacity-50',
          )}
        >
          {upload.isPending ? (
            <>
              <Spinner aria-hidden />
              {t('uploading')}
            </>
          ) : (
            t('add')
          )}
        </label>

        {isFull ? (
          <span className="text-sm text-muted-foreground">
            {t('full', { max: MAX_GALLERY_IMAGES })}
          </span>
        ) : null}
      </div>

      {/* The array's own message - a failed upload, or too many images. A
          message on one entry is rendered by that entry's own field, so only
          the root is shown here. */}
      <FieldError errors={[error?.root ?? error]} />
    </Field>
  );
}

/**
 * One image's description, in the language the form is on.
 *
 * Its own component because it needs the form's editing language, and a hook
 * cannot be called inside the loop that renders the list. It is the same field
 * every other localized one is - a single input with the language beside it -
 * so a project with six screenshots does not grow twelve description boxes.
 */
function GalleryAlt({
  form,
  index,
}: {
  form: UseFormReturn<ProjectFormValues, unknown, ProjectInput>;
  index: number;
}) {
  const t = useTranslations('admin.projects.gallery');
  const localizedLabel = useLocalizedLabel();
  const name = `gallery.${index}.alt`;
  const { locale, setLocale, invalid } = useLocalizedFieldState(
    form.control,
    name,
  );

  // Named by the image it describes: "Description" alone is the project's own
  // field, the cover's, and every entry's.
  const label = t('alt', { position: index + 1 });

  return (
    <TextField
      key={locale}
      control={form.control}
      name={toTextFieldPath<ProjectFormValues>(`${name}.${locale}`)}
      id={`gallery-${index}-alt-${locale}`}
      label={localizedLabel(label, locale)}
      aside={
        LOCALES.length > 1 ? (
          <LanguageTabs
            value={locale}
            onValueChange={setLocale}
            invalid={invalid}
          />
        ) : undefined
      }
    />
  );
}
