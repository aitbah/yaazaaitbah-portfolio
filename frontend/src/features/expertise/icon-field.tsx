'use client';

import { useTranslations } from 'next-intl';
import { type ChangeEvent } from 'react';
import { useController, type UseFormReturn } from 'react-hook-form';
import type { ExpertiseKind } from '@portfolio/shared';

import { BrandPicker, brandTitle } from '@/components/admin/brand-picker';
import { Button, buttonVariants } from '@/components/ui/button';
import { Field, FieldError, FieldTitle } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { ApiRequestError } from '@/lib/api-client';
import { toFieldErrors } from '@/lib/error-codes';
import { useErrorMessages } from '@/lib/error-messages';
import { cn } from '@/lib/utils';

import { ExpertiseIcon } from './expertise-icon';
import type { ExpertiseFormValues, ExpertiseInput } from './expertise-schema';
import { useUploadExpertiseIcon } from './use-expertise';

/** Mirrors what the endpoint parses; the server still decides from the bytes. */
const ACCEPTED = 'image/png,image/jpeg,image/webp';

type IconFieldProps = {
  kind: ExpertiseKind;
  form: UseFormReturn<ExpertiseFormValues, unknown, ExpertiseInput>;
};

/**
 * A technology's or tool's logo: a vendored brand mark by name (so no SVG is
 * ever uploaded), or an uploaded image for marks the set lacks, such as those
 * removed upstream after trademark requests.
 */
export function IconField({ kind, form }: IconFieldProps) {
  const t = useTranslations('admin.expertise.icon');
  const errorMessage = useErrorMessages();

  const upload = useUploadExpertiseIcon(kind);
  const { field, fieldState } = useController({
    control: form.control,
    name: 'icon',
  });

  const chosen = field.value;

  function chooseUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Cleared so choosing the same file twice still counts as a change.
    event.target.value = '';

    if (!file) {
      return;
    }

    form.clearErrors('icon');

    upload.mutate(file, {
      onSuccess: (reference) => {
        field.onChange({ kind: 'upload', value: reference });
      },
      onError: (error) => {
        const code =
          error instanceof ApiRequestError && error.code === 'VALIDATION_ERROR'
            ? toFieldErrors(error.details).icon
            : undefined;

        form.setError('icon', {
          type: code ?? 'UPLOAD_FAILED',
          message: code
            ? errorMessage.field(code)
            : errorMessage.response(error),
        });
      },
    });
  }

  return (
    <Field data-invalid={fieldState.invalid || undefined}>
      <FieldTitle>{t('title')}</FieldTitle>

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex size-16 shrink-0 items-center justify-center rounded-md border bg-muted/40 p-3">
          {chosen ? (
            <ExpertiseIcon
              icon={chosen}
              name={t('chosen')}
              className="size-full"
              brandColor
            />
          ) : (
            <span className="text-center text-[10px] text-muted-foreground">
              {t('none')}
            </span>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-sm font-medium">
            {chosen
              ? chosen.kind === 'preset'
                ? t('presetChosen', {
                    name: brandTitle(chosen.value) ?? chosen.value,
                  })
                : t('uploadChosen')
              : t('none')}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <input
              id="expertise-icon-file"
              type="file"
              accept={ACCEPTED}
              className="peer sr-only"
              onChange={chooseUpload}
              disabled={upload.isPending}
            />
            {/* Hidden but focusable: the label carries the translated name, and
                the focus ring follows the input so keyboard use stays visible. */}
            <label
              htmlFor="expertise-icon-file"
              className={cn(
                buttonVariants({ variant: 'outline', size: 'sm' }),
                'cursor-pointer peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring/50',
                upload.isPending && 'pointer-events-none opacity-50',
              )}
            >
              {upload.isPending ? (
                <>
                  <Spinner aria-hidden />
                  {t('uploading')}
                </>
              ) : (
                t('upload')
              )}
            </label>

            {chosen ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  form.clearErrors('icon');
                  // Cleared here; the file is deleted when the form is saved.
                  field.onChange(null);
                }}
              >
                {t('clear')}
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <BrandPicker
        value={chosen?.kind === 'preset' ? chosen.value : null}
        onChange={(slug) => {
          form.clearErrors('icon');
          field.onChange({ kind: 'preset', value: slug });
        }}
      />

      <FieldError errors={[fieldState.error]} />
    </Field>
  );
}
