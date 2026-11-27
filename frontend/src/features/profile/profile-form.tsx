'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { CheckboxField } from '@/components/form/checkbox-field';
import { LocalizedField } from '@/components/form/localized-field';
import { SelectField } from '@/components/form/select-field';
import { TextField } from '@/components/form/text-field';
import { FieldRow } from '@/components/form/field-row';
import { FormSection } from '@/components/form/form-section';
import { FormActions } from '@/components/form/form-actions';
import { FormFields, FormLayout } from '@/components/form/form-layout';
import { useOptionChoices } from '@/features/option/use-options';
import { ApiRequestError } from '@/lib/api-client';
import {
  toFieldCode,
  toFieldErrors,
  toResponseCode,
  type ResponseCode,
} from '@/lib/error-codes';
import { createFormResolver, toFieldPath } from '@/lib/form-resolver';

import { AvatarField } from './avatar-field';
import { ResumeField } from './resume-field';
import type { Profile } from './profile-api';
import {
  profileSchema,
  type ProfileFormValues,
  type ProfileInput,
} from './profile-schema';
import { useSaveProfile } from './use-profile';
import { keepUnrendered, localesOf } from '@/lib/localized-form';

function toFormValues(profile: Profile | null): ProfileFormValues {
  return {
    firstName: localesOf(profile?.firstName),
    lastName: localesOf(profile?.lastName),
    headline: localesOf(profile?.headline),
    bio: localesOf(profile?.bio),
    photoUrl: profile?.photoUrl ?? '',
    photoAlt: localesOf(profile?.photoAlt),
    resume: localesOf(profile?.resume),
    contact: {
      email: profile?.contact?.email ?? '',
      // The stored answer, or "not published" for a profile that has none -
      // the same default the contract and the database both take, because a
      // detail must never become public by omission.
      emailPublic: profile?.contact?.emailPublic ?? false,
      location: localesOf(profile?.contact?.location),
      locationPublic: profile?.contact?.locationPublic ?? false,
      availability: profile?.contact?.availability ?? '',
      // A status exists in order to be seen, so this one starts on.
      availabilityPublic: profile?.contact?.availabilityPublic ?? true,
    },
  };
}

/** The fields with an input on screen, so a message there is actually visible. */
const RENDERED_FIELDS = [
  'firstName',
  'lastName',
  'headline',
  'bio',
  'photoUrl',
  'photoAlt',
  'resume',
  'contact',
] as const;

/**
 * PUT replaces, so locales the form did not render are carried over rather than
 * deleted. A field the admin cleared stays cleared.
 */
function withUnrenderedLocales(
  input: ProfileInput,
  profile: Profile | null,
): ProfileInput {
  if (!profile) {
    return input;
  }

  return {
    ...input,
    firstName: keepUnrendered(profile.firstName, input.firstName),
    lastName: keepUnrendered(profile.lastName, input.lastName),
    headline: keepUnrendered(profile.headline, input.headline),
    bio: input.bio ? keepUnrendered(profile.bio, input.bio) : input.bio,
    photoAlt: input.photoAlt
      ? keepUnrendered(profile.photoAlt, input.photoAlt)
      : input.photoAlt,
    contact: input.contact
      ? {
          ...input.contact,
          location: input.contact.location
            ? keepUnrendered(profile.contact?.location, input.contact.location)
            : input.contact.location,
        }
      : input.contact,
  };
}

type ProfileFormProps = {
  /** `null` when nothing has been saved yet; the form is then empty. */
  profile: Profile | null;
  /** Back to the read-only view, which is where a save becomes visible. */
  onDone: () => void;
};

export function ProfileForm({ profile, onDone }: ProfileFormProps) {
  const t = useTranslations('admin.profile');
  const availabilities = useOptionChoices('availability-status');
  const tField = useTranslations('validation');
  const tResponse = useTranslations('responses');
  const { mutate, isPending } = useSaveProfile();

  const [errorCode, setErrorCode] = useState<ResponseCode | null>(null);

  const form = useForm<ProfileFormValues, unknown, ProfileInput>({
    resolver: createFormResolver<ProfileFormValues, ProfileInput>(
      profileSchema,
      tField,
    ),
    defaultValues: toFormValues(profile),
  });

  function onSubmit(input: ProfileInput) {
    setErrorCode(null);

    mutate(withUnrenderedLocales(input, profile), {
      onSuccess: (updated) => {
        // Reset from the response before leaving, so the form is clean if it is
        // reopened and never warns about changes that were in fact saved.
        form.reset(toFormValues(updated));
        onDone();
      },
      onError: (error) => {
        // The backend answers with the same field codes at the same paths, so
        // they land on the very fields RHF already knows.
        if (
          error instanceof ApiRequestError &&
          error.code === 'VALIDATION_ERROR'
        ) {
          for (const [path, code] of Object.entries(
            toFieldErrors(error.details),
          )) {
            form.setError(toFieldPath<ProfileFormValues>(path), {
              type: code,
              message: tField(toFieldCode(code)),
            });
          }
        }

        setErrorCode(toResponseCode(error));
      },
    });
  }

  // A field already says what to fix; repeating it globally would only add
  // noise. A code naming something this form does not render still shows,
  // rather than leaving the admin with nothing.
  const { errors } = form.formState;
  const globalError =
    errorCode !== null && !RENDERED_FIELDS.some((field) => field in errors)
      ? tResponse(errorCode)
      : null;

  return (
    <FormLayout
      onSubmit={(event) => void form.handleSubmit(onSubmit)(event)}
      isDirty={form.formState.isDirty}
    >
      <FormFields>
        <FormSection title={t('groups.identity')}>
          {/* The two names are short and always filled in together, so they
              share a row rather than each taking a full one. */}
          <FieldRow>
            <LocalizedField
              control={form.control}
              name="firstName"
              required
              label={t('fields.firstName')}
            />
            <LocalizedField
              control={form.control}
              name="lastName"
              required
              label={t('fields.lastName')}
            />
          </FieldRow>
        </FormSection>

        {/* The photograph beside its own alt text, so the description is
            written while looking at what it describes rather than in a separate
            accessibility section nobody fills in. An empty alt is the correct
            answer for a decorative image, which is what the hint says. */}
        <FormSection title={t('groups.images')} description={t('altHint')}>
          <FieldRow>
            <AvatarField form={form} />
            <LocalizedField
              control={form.control}
              name="photoAlt"
              label={t('fields.photoAlt')}
            />
          </FieldRow>
        </FormSection>

        {/* Its own section rather than beside the images: a CV is a document
            people take away, not a picture the page shows. */}
        <FormSection title={t('groups.resume')} description={t('resume.hint')}>
          <ResumeField form={form} />
        </FormSection>

        <FormSection title={t('groups.presentation')}>
          {/* Both run to sentence or paragraph length, so both keep a full
              row - pairing them would only make each too narrow to read. */}
          <LocalizedField
            control={form.control}
            name="headline"
            required
            label={t('fields.headline')}
          />
          <LocalizedField
            control={form.control}
            name="bio"
            label={t('fields.bio')}
            multiline
          />
        </FormSection>

        {/*
          Every detail sits beside the answer to "may a stranger see this?",
          rather than in a settings section of its own. Separating them is how
          an address gets published by someone who only meant to store it: the
          decision belongs next to the value it is about.
        */}
        <FormSection
          title={t('groups.contact')}
          description={t('contact.hint')}
        >
          <FieldRow>
            <TextField
              control={form.control}
              name="contact.email"
              id="contact-email"
              label={t('fields.email')}
              type="email"
              autoComplete="email"
            />
            <CheckboxField
              control={form.control}
              name="contact.emailPublic"
              id="contact-email-public"
              label={t('fields.emailPublic')}
              description={t('contact.emailPublicHint')}
            />
          </FieldRow>

          <FieldRow>
            <LocalizedField
              control={form.control}
              name="contact.location"
              label={t('fields.location')}
            />
            <CheckboxField
              control={form.control}
              name="contact.locationPublic"
              id="contact-location-public"
              label={t('fields.locationPublic')}
              description={t('contact.locationPublicHint')}
            />
          </FieldRow>

          <FieldRow>
            <SelectField
              control={form.control}
              name="contact.availability"
              id="contact-availability"
              label={t('fields.availability')}
              placeholder={t('contact.chooseAvailability')}
              options={availabilities}
            />
            <CheckboxField
              control={form.control}
              name="contact.availabilityPublic"
              id="contact-availability-public"
              label={t('fields.availabilityPublic')}
              description={t('contact.availabilityPublicHint')}
            />
          </FieldRow>
        </FormSection>
      </FormFields>

      <FormActions
        submitLabel={t('submit')}
        submittingLabel={t('submitting')}
        isPending={isPending}
        cancelLabel={t('cancel')}
        onCancel={onDone}
        error={globalError}
      />
    </FormLayout>
  );
}
