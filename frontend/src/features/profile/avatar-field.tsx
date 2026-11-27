'use client';

import { useTranslations } from 'next-intl';
import type { UseFormReturn } from 'react-hook-form';

import { ImageField } from '@/components/form/image-field';
import { useErrorMessages } from '@/lib/error-messages';

import type { ProfileFormValues, ProfileInput } from './profile-schema';
import { useUploadPhoto } from './use-profile';

type AvatarFieldProps = {
  form: UseFormReturn<ProfileFormValues, unknown, ProfileInput>;
};

/**
 * The profile's wiring of the shared image field: its wording, its endpoint,
 * and the key that endpoint reports a rejected file under.
 */
export function AvatarField({ form }: AvatarFieldProps) {
  const t = useTranslations('admin.profile.avatar');
  const errorMessage = useErrorMessages();
  const upload = useUploadPhoto();

  return (
    <ImageField
      control={form.control}
      name="photoUrl"
      id="photo-file"
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
      errorKey="photo"
      translateField={(code) => errorMessage.field(code)}
      translateResponse={(error) => errorMessage.response(error)}
    />
  );
}
