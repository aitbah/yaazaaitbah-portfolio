'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useForm, type FieldErrors } from 'react-hook-form';

import { ErrorToast } from '@/components/error-toast';
import { TextField } from '@/components/form/text-field';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/components/ui/toast';
import { ApiRequestError } from '@/lib/api-client';
import {
  toFieldCode,
  toFieldErrors,
  toResponseCode,
  type ResponseCode,
} from '@/lib/error-codes';
import { createFormResolver, toFieldPath } from '@/lib/form-resolver';

import {
  emailFormSchema,
  type EmailFormInput,
  type EmailFormValues,
} from './account-schema';
import { useChangeEmail } from './use-account';

const EMPTY: EmailFormValues = {
  currentPassword: '',
  newEmail: '',
  confirmEmail: '',
};

/** Exactly what has an input on screen, so a message there is actually visible. */
function hasVisibleMessage(errors: FieldErrors<EmailFormValues>): boolean {
  return (
    errors.currentPassword !== undefined ||
    errors.newEmail !== undefined ||
    errors.confirmEmail !== undefined
  );
}

type EmailFormProps = {
  /** The address being replaced, which is what "unchanged" is measured against. */
  currentEmail: string;
};

/**
 * Changing the address the account signs in with.
 *
 * The current password is asked for because a stolen session cookie must not be
 * enough to take the account's identity - the server checks it, and this only
 * collects it. Every other session ends when it succeeds; this one does not.
 */
export function EmailForm({ currentEmail }: EmailFormProps) {
  const t = useTranslations('admin.account');
  const tField = useTranslations('validation');
  const tResponse = useTranslations('responses');

  const change = useChangeEmail();

  const [errorCode, setErrorCode] = useState<ResponseCode | null>(null);
  const toast = useToast();

  const form = useForm<EmailFormValues, unknown, EmailFormInput>({
    resolver: createFormResolver<EmailFormValues, EmailFormInput>(
      emailFormSchema(currentEmail),
      tField,
    ),
    defaultValues: EMPTY,
  });

  function onSubmit(input: EmailFormInput) {
    setErrorCode(null);

    change.mutate(input, {
      onSuccess: () => {
        toast({ title: t('emailChanged'), tone: 'success' });
        // The password does not outlive the save, and the address is now shown
        // above the form rather than left sitting in it.
        form.reset(EMPTY);
      },
      onError: (error) => {
        if (error instanceof ApiRequestError) {
          /**
           * A wrong current password answers `INVALID_CREDENTIALS`, exactly as
           * login does. It carries no field path, so it goes on the field it is
           * about rather than becoming a banner over a form whose first box is
           * the problem.
           */
          if (error.code === 'INVALID_CREDENTIALS') {
            form.setError('currentPassword', {
              type: 'INVALID_CREDENTIALS',
              message: tResponse('INVALID_CREDENTIALS'),
            });
          }

          // CONFLICT counts here as well as VALIDATION_ERROR: a second account
          // holding the address names the field it is about.
          if (error.code === 'VALIDATION_ERROR' || error.code === 'CONFLICT') {
            for (const [path, code] of Object.entries(
              toFieldErrors(error.details),
            )) {
              form.setError(toFieldPath<EmailFormValues>(path), {
                type: code,
                message: tField(toFieldCode(code)),
              });
            }
          }
        }

        setErrorCode(toResponseCode(error));
      },
    });
  }

  // Read unconditionally: `formState` is a proxy that subscribes the component
  // to whatever it touches during render.
  const { errors } = form.formState;
  const globalError =
    errorCode !== null && !hasVisibleMessage(errors)
      ? tResponse(errorCode)
      : null;

  return (
    <form
      onSubmit={(event) => void form.handleSubmit(onSubmit)(event)}
      className="flex max-w-md flex-col gap-4"
      noValidate
    >
      <TextField
        control={form.control}
        name="currentPassword"
        id="email-current-password"
        // Not "Current password", which the password card below already uses.
        // Two controls with one name is a screen reader with nothing to
        // distinguish them by - see the accessibility rules.
        label={t('confirmWithPassword')}
        type="password"
        autoComplete="current-password"
        required
      />

      <TextField
        control={form.control}
        name="newEmail"
        id="new-email"
        label={t('newEmail')}
        description={t('emailHint')}
        type="email"
        autoComplete="email"
        required
      />

      <TextField
        control={form.control}
        name="confirmEmail"
        id="confirm-email"
        label={t('confirmEmail')}
        type="email"
        autoComplete="email"
        required
      />

      <ErrorToast>{globalError ? globalError : null}</ErrorToast>

      <div>
        <Button type="submit" disabled={change.isPending}>
          {change.isPending ? (
            <>
              <Spinner aria-hidden />
              {t('changingEmail')}
            </>
          ) : (
            t('changeEmail')
          )}
        </Button>
      </div>
    </form>
  );
}
