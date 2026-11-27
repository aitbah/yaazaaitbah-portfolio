'use client';

import { useTranslations } from 'next-intl';
import type { UseFormReturn } from 'react-hook-form';

import { useLocalizedFieldState } from '@/components/form/editing-locale';
import {
  LanguageTabs,
  useLocalizedLabel,
} from '@/components/form/field-language';
import { FileField } from '@/components/form/file-field';
import { routing } from '@/i18n/routing';
import { useErrorMessages } from '@/lib/error-messages';
import { toTextFieldPath } from '@/lib/form-resolver';

import type { ProfileFormValues, ProfileInput } from './profile-schema';
import { useUploadResume } from './use-profile';

const LOCALES = routing.locales;

type ResumeFieldProps = {
  form: UseFormReturn<ProfileFormValues, unknown, ProfileInput>;
};

/**
 * The CV, one per locale, since a CV differs by language. It follows the form's
 * editing language, so the wrong document cannot be uploaded beside another
 * language's text.
 */
export function ResumeField({ form }: ResumeFieldProps) {
  const t = useTranslations('admin.profile.resume');
  const errorMessage = useErrorMessages();
  const localizedLabel = useLocalizedLabel();
  const { locale, setLocale, invalid } = useLocalizedFieldState(
    form.control,
    'resume',
  );

  // The CV is the field where uploading the wrong language's file is a silent
  // mistake, so the actions say which language they are for - in the name,
  // like every other localized label, not printed beside the tabs.
  const perLocale = (label: string) => localizedLabel(label, locale);
  const upload = useUploadResume();

  return (
    <FileField
      // A different file now, not the same one renamed.
      key={locale}
      control={form.control}
      name={toTextFieldPath<ProfileFormValues>(`resume.${locale}`)}
      id={`resume-file-${locale}`}
      labels={{
        title: t('title'),
        choose: perLocale(t('choose')),
        replace: perLocale(t('replace')),
        remove: perLocale(t('remove')),
        uploading: t('uploading'),
        empty: t('empty'),
        stored: t('stored'),
      }}
      aside={
        LOCALES.length > 1 ? (
          <LanguageTabs
            value={locale}
            onValueChange={setLocale}
            invalid={invalid}
          />
        ) : undefined
      }
      upload={upload}
      setError={form.setError}
      clearErrors={form.clearErrors}
      errorKey="resume"
      translateField={(code) => errorMessage.field(code)}
      translateResponse={(error) => errorMessage.response(error)}
    />
  );
}
