'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useForm, type FieldErrors } from 'react-hook-form';
import { MIN_PASSWORD_LENGTH } from '@portfolio/shared';

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
  passwordFormSchema,
  type PasswordFormInput,
  type PasswordFormValues,
} from './account-schema';
import { useChangePassword } from './use-account';

const EMPTY: PasswordFormValues = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
};

/** Exactly what has an input on screen, so a message there is actually visible. */
function hasVisibleMessage(errors: FieldErrors<PasswordFormValues>): boolean {
  return (
    errors.currentPassword !== undefined ||
    errors.newPassword !== undefined ||
    errors.confirmPassword !== undefined
  );
}

/**
 * Changing the password, which until now meant re-running a script inside the
 * container.
 *
 * The current one is asked for because a stolen session cookie must not be
 * enough to lock the owner out - the server checks it, and this only collects
 * it.
 */
export function PasswordForm() {
  const t = useTranslations('admin.account');
  const tField = useTranslations('validation');
  const tResponse = useTranslations('responses');

  const change = useChangePassword();

  const [errorCode, setErrorCode] = useState<ResponseCode | null>(null);
  const toast = useToast();

  const form = useForm<PasswordFormValues, unknown, PasswordFormInput>({
    resolver: createFormResolver<PasswordFormValues, PasswordFormInput>(
      passwordFormSchema,
      tField,
    ),
    defaultValues: EMPTY,
  });

  function onSubmit(input: PasswordFormInput) {
    setErrorCode(null);

    change.mutate(input, {
      onSuccess: () => {
        // Said out loud, because the visible result of a successful change is
        // three boxes going empty - which on its own reads as a failure.
        toast({ title: t('passwordChanged'), tone: 'success' });
        // Nothing typed here should outlive the save, least of all the old
        // password: the form is emptied rather than left holding it.
        form.reset(EMPTY);
      },
      onError: (error) => {
        /**
         * A wrong current password answers `INVALID_CREDENTIALS`, exactly as
         * login does - it is the same claim being checked. It has no field
         * path, so it is put on the field it is about rather than left as a
         * banner over a form whose first box is the problem.
         */
        if (error instanceof ApiRequestError) {
          if (error.code === 'INVALID_CREDENTIALS') {
            form.setError('currentPassword', {
              type: 'INVALID_CREDENTIALS',
              message: tResponse('INVALID_CREDENTIALS'),
            });
          }

          if (error.code === 'VALIDATION_ERROR') {
            for (const [path, code] of Object.entries(
              toFieldErrors(error.details),
            )) {
              form.setError(toFieldPath<PasswordFormValues>(path), {
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
        id="current-password"
        label={t('currentPassword')}
        type="password"
        autoComplete="current-password"
        required
      />

      <TextField
        control={form.control}
        name="newPassword"
        id="new-password"
        label={t('newPassword')}
        description={t('passwordHint', { count: MIN_PASSWORD_LENGTH })}
        type="password"
        autoComplete="new-password"
        required
      />

      <TextField
        control={form.control}
        name="confirmPassword"
        id="confirm-password"
        label={t('confirmPassword')}
        type="password"
        autoComplete="new-password"
        required
      />

      <ErrorToast>{globalError ? globalError : null}</ErrorToast>

      <div>
        <Button type="submit" disabled={change.isPending}>
          {change.isPending ? (
            <>
              <Spinner aria-hidden />
              {t('changingPassword')}
            </>
          ) : (
            t('changePassword')
          )}
        </Button>
      </div>
    </form>
  );
}
