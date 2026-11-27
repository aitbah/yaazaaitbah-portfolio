'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useForm, type FieldErrors } from 'react-hook-form';
import type { CredentialKind } from '@portfolio/shared';

import { FieldRow } from '@/components/form/field-row';
import { FormActions } from '@/components/form/form-actions';
import { FormFields, FormLayout } from '@/components/form/form-layout';
import { FormSection } from '@/components/form/form-section';
import { LocalizedField } from '@/components/form/localized-field';
import { MonthField } from '@/components/form/month-field';
import { TextField } from '@/components/form/text-field';
import { ApiRequestError } from '@/lib/api-client';
import {
  toFieldCode,
  toFieldErrors,
  toResponseCode,
  type ResponseCode,
} from '@/lib/error-codes';
import { createFormResolver, toFieldPath } from '@/lib/form-resolver';

import type { Credential } from './credential-api';
import {
  credentialSchema,
  type CredentialFormValues,
  type CredentialInput,
} from './credential-schema';
import { useCreateCredential, useUpdateCredential } from './use-credentials';
import { LOCALES, keepUnrendered, localesOf } from '@/lib/localized-form';

/** The localized fields, which are not themselves rendered - one input per locale. */
const LOCALIZED = ['name', 'issuer', 'description'] as const;

/** Exactly what has an input on screen, so a message there is actually visible. */
function hasVisibleMessage(errors: FieldErrors<CredentialFormValues>): boolean {
  return (
    LOCALIZED.some((field) => {
      const value = errors[field] as Record<string, unknown> | undefined;

      return LOCALES.some((locale) => value?.[locale] !== undefined);
    }) ||
    errors.issuedAt !== undefined ||
    errors.expiresAt !== undefined ||
    errors.credentialId !== undefined ||
    errors.credentialUrl !== undefined
  );
}

function toFormValues(row: Credential | null): CredentialFormValues {
  return {
    name: localesOf(row?.name),
    issuer: localesOf(row?.issuer),
    issuedAt: row?.issuedAt ?? '',
    // The empty string, not undefined: a controlled input cannot hold undefined
    // without React reporting it as becoming uncontrolled.
    expiresAt: row?.expiresAt ?? '',
    credentialId: row?.credentialId ?? '',
    credentialUrl: row?.credentialUrl ?? '',
    description: localesOf(row?.description),
  };
}

/**
 * `PUT` replaces the document, so a locale the form did not render - one
 * written straight through the API, or left from a language since removed from
 * `routing.locales` - would be deleted by an ordinary save.
 */
function withUnrenderedLocales(
  input: CredentialInput,
  row: Credential | null,
): CredentialInput {
  if (!row) {
    return input;
  }

  return {
    ...input,
    name: keepUnrendered(row.name, input.name),
    issuer: keepUnrendered(row.issuer, input.issuer),
    // A field the admin cleared is left cleared: resurrecting it from its other
    // locales would fail validation anyway, since the launch locale is required.
    description: input.description
      ? keepUnrendered(row.description, input.description)
      : input.description,
  };
}

type CredentialFormProps = {
  kind: CredentialKind;
  /** `null` creates a new credential; a row edits that one. */
  row: Credential | null;
  onDone: () => void;
};

export function CredentialForm({ kind, row, onDone }: CredentialFormProps) {
  const t = useTranslations('admin.credentials');
  const tField = useTranslations('validation');
  const tResponse = useTranslations('responses');

  const create = useCreateCredential(kind);
  const update = useUpdateCredential(kind);
  const isPending = create.isPending || update.isPending;

  const [errorCode, setErrorCode] = useState<ResponseCode | null>(null);

  const form = useForm<CredentialFormValues, unknown, CredentialInput>({
    resolver: createFormResolver<CredentialFormValues, CredentialInput>(
      credentialSchema,
      tField,
    ),
    defaultValues: toFormValues(row),
  });

  function onSubmit(input: CredentialInput) {
    setErrorCode(null);

    const payload = withUnrenderedLocales(input, row);

    const onError = (error: unknown) => {
      // The backend answers with the same field codes at the same paths, so
      // they land on the very fields RHF already knows. CONFLICT counts too:
      // a duplicate names the field it is about.
      if (
        error instanceof ApiRequestError &&
        (error.code === 'VALIDATION_ERROR' || error.code === 'CONFLICT')
      ) {
        for (const [path, code] of Object.entries(
          toFieldErrors(error.details),
        )) {
          form.setError(toFieldPath<CredentialFormValues>(path), {
            type: code,
            message: tField(toFieldCode(code)),
          });
        }
      }

      setErrorCode(toResponseCode(error));
    };

    if (row) {
      update.mutate(
        { id: row.id, input: payload },
        { onSuccess: onDone, onError },
      );

      return;
    }

    create.mutate(payload, { onSuccess: onDone, onError });
  }

  // Read unconditionally: `formState` is a proxy that subscribes the component
  // to whatever it touches during render, and reading it behind a short-circuit
  // means the first render never subscribes.
  const { errors } = form.formState;
  const globalError =
    errorCode !== null && !hasVisibleMessage(errors)
      ? tResponse(errorCode)
      : null;

  return (
    <FormLayout
      onSubmit={(event) => void form.handleSubmit(onSubmit)(event)}
      isDirty={form.formState.isDirty}
    >
      <FormFields>
        <FormSection title={t('groups.what')}>
          {/* The credential and who awarded it are one fact in two halves. */}
          <FieldRow>
            <LocalizedField
              control={form.control}
              name="name"
              required
              label={t('fields.name')}
            />
            <LocalizedField
              control={form.control}
              name="issuer"
              required
              label={t('fields.issuer')}
            />
          </FieldRow>
        </FormSection>

        {/*
          No "still valid" checkbox, and deliberately: unlike a period, an
          absent expiry means "does not expire" rather than "under way", so
          there is no second state for a box to name.
        */}
        <FormSection title={t('groups.validity')} description={t('expiryHint')}>
          <FieldRow>
            <MonthField
              control={form.control}
              name="issuedAt"
              id="credential-issued"
              label={t('fields.issuedAt')}
              required
            />
            <MonthField
              control={form.control}
              name="expiresAt"
              id="credential-expires"
              label={t('fields.expiresAt')}
            />
          </FieldRow>
        </FormSection>

        <FormSection title={t('groups.proof')}>
          <FieldRow>
            <TextField
              control={form.control}
              name="credentialId"
              id="credential-id"
              label={t('fields.credentialId')}
            />
            <TextField
              control={form.control}
              name="credentialUrl"
              id="credential-url"
              label={t('fields.credentialUrl')}
              type="url"
            />
          </FieldRow>
        </FormSection>

        <FormSection title={t('groups.detail')}>
          <LocalizedField
            control={form.control}
            name="description"
            label={t('fields.description')}
            multiline
          />
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
