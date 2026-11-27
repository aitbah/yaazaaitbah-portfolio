'use client';

import { useTranslations } from 'next-intl';
import type { UseFormReturn } from 'react-hook-form';

import { ImageField } from '@/components/form/image-field';
import { useErrorMessages } from '@/lib/error-messages';

import type { ProjectFormValues, ProjectInput } from './project-schema';
import { useUploadCover } from './use-projects';

type CoverFieldProps = {
  form: UseFormReturn<ProjectFormValues, unknown, ProjectInput>;
};

/**
 * The project's wiring of the shared image field. It differs from the profile's
 * only in wording, endpoint, and the key that endpoint reports a rejected file
 * under - which is exactly what the shared component takes as props.
 */
export function CoverField({ form }: CoverFieldProps) {
  const t = useTranslations('admin.projects.cover');
  const errorMessage = useErrorMessages();
  const upload = useUploadCover();

  return (
    <ImageField
      control={form.control}
      name="imageUrl"
      id="cover-file"
      labels={{
        title: t('title'),
        choose: t('choose'),
        replace: t('replace'),
        remove: t('remove'),
        uploading: t('uploading'),
        preview: t('preview'),
        empty: t('empty'),
        unavailable: t('unavailable'),
      }}
      upload={upload}
      setError={form.setError}
      clearErrors={form.clearErrors}
      errorKey="image"
      // A cover is shown wide, so it is previewed wide.
      shape="wide"
      translateField={(code) => errorMessage.field(code)}
      translateResponse={(error) => errorMessage.response(error)}
    />
  );
}
