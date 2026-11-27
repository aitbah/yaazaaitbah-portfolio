'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';

import { ErrorToast } from '@/components/error-toast';
import { TextField } from '@/components/form/text-field';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { useRouter } from '@/i18n/navigation';
import { ApiRequestError } from '@/lib/api-client';
import {
  toFieldCode,
  toFieldErrors,
  toResponseCode,
  type ResponseCode,
} from '@/lib/error-codes';
import { createFormResolver, toFieldPath } from '@/lib/form-resolver';

import { loginSchema, type LoginInput } from './login-schema';
import { useAuth, useLogin } from './use-auth';

export function LoginForm() {
  const t = useTranslations('admin.login');
  const tAdmin = useTranslations('admin');
  const tField = useTranslations('validation');
  const tRequestError = useTranslations('responses');
  const router = useRouter();
  const { user, isPending: isCheckingSession } = useAuth();
  const { mutate, isPending: isSubmitting } = useLogin();

  const [errorCode, setErrorCode] = useState<ResponseCode | null>(null);

  const form = useForm<LoginInput, unknown, LoginInput>({
    resolver: createFormResolver<LoginInput>(loginSchema, tField),
    defaultValues: { email: '', password: '' },
  });

  useEffect(() => {
    if (user) {
      router.replace('/admin');
    }
  }, [user, router]);

  function onSubmit(credentials: LoginInput) {
    setErrorCode(null);

    // The redirect is left to the effect above: a session means this page is
    // no longer the right one, however it was obtained.
    mutate(credentials, {
      onError: (error) => {
        // The backend answers with the same field codes at the same paths.
        if (
          error instanceof ApiRequestError &&
          error.code === 'VALIDATION_ERROR'
        ) {
          for (const [path, code] of Object.entries(
            toFieldErrors(error.details),
          )) {
            form.setError(toFieldPath<LoginInput>(path), {
              type: code,
              message: tField(toFieldCode(code)),
            });
          }
        }

        setErrorCode(toResponseCode(error));
      },
    });
  }

  const { errors } = form.formState;
  // A field already says what to fix; repeating it globally would only add noise.
  const globalError =
    errorCode !== null && !errors.email && !errors.password
      ? tRequestError(errorCode)
      : null;

  // Session still unknown: showing the form here would flash it and vanish.
  if (isCheckingSession || user) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner className="size-6" aria-label={tAdmin('checkingSession')} />
      </div>
    );
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>{t('subtitle')}</CardDescription>
      </CardHeader>

      <CardContent>
        <form
          onSubmit={(event) => void form.handleSubmit(onSubmit)(event)}
          className="flex flex-col gap-4"
          noValidate
        >
          <TextField
            control={form.control}
            name="email"
            id="email"
            label={t('email')}
            type="email"
            autoComplete="username"
            required
          />

          <TextField
            control={form.control}
            name="password"
            id="password"
            label={t('password')}
            type="password"
            autoComplete="current-password"
            required
          />

          <ErrorToast>{globalError ? globalError : null}</ErrorToast>

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Spinner aria-hidden />
                {t('submitting')}
              </>
            ) : (
              t('submit')
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
