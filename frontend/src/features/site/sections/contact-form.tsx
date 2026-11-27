'use client';

import {
  MAX_MESSAGE_BODY_LENGTH,
  MAX_MESSAGE_NAME_LENGTH,
  MAX_MESSAGE_SUBJECT_LENGTH,
} from '@portfolio/shared';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useForm, useWatch, type UseFormRegisterReturn } from 'react-hook-form';

import { Spinner } from '@/components/ui/spinner';
import { sendMessage } from '@/features/message/message-api';
import {
  messageSchema,
  type MessageInput,
} from '@/features/message/message-schema';
import { ApiRequestError } from '@/lib/api-client';
import { toFieldErrors } from '@/lib/error-codes';
import { useErrorMessages } from '@/lib/error-messages';
import { createFormResolver, toFieldPath } from '@/lib/form-resolver';
import { cn } from '@/lib/utils';

const EMPTY: MessageInput = {
  name: '',
  email: '',
  subject: '',
  body: '',
  website: '',
};

/** The API's own limits: enforced on every field, counted on the message. */
const LIMITS = {
  name: MAX_MESSAGE_NAME_LENGTH,
  subject: MAX_MESSAGE_SUBJECT_LENGTH,
  body: MAX_MESSAGE_BODY_LENGTH,
} as const;

function Field({
  id,
  label,
  error,
  registered,
  value,
  limit,
  multiline = false,
  type = 'text',
  autoComplete,
  wide = false,
}: {
  id: string;
  label: string;
  error?: string;
  registered: UseFormRegisterReturn;
  value: string;
  limit?: number;
  multiline?: boolean;
  type?: 'text' | 'email';
  autoComplete?: string;
  wide?: boolean;
}) {
  const wiring = {
    ...registered,
    id,
    required: true,
    maxLength: limit,
    dir: 'auto',
    'aria-invalid': error ? true : undefined,
    'aria-describedby': error ? `${id}-error` : undefined,
    className:
      'w-full resize-y rounded-xl bg-site-raise px-4 py-3.5 text-base text-site-fg outline-none ring-1 ring-transparent transition-[box-shadow,background-color] duration-300 hover:ring-site-line-strong focus:bg-site-bg focus:ring-site-red aria-[invalid=true]:ring-site-red',
  };

  return (
    <div data-reveal className={cn('grid gap-2', wide && 'sm:col-span-2')}>
      <div className="flex items-baseline justify-between gap-4">
        <label htmlFor={id} className="site-label text-site-soft">
          {label}
        </label>
        {/* A long message is where a limit is felt; the short fields simply stop. */}
        {limit && multiline ? (
          <span aria-hidden className="text-xs text-site-muted tabular-nums">
            {value.length} / {limit}
          </span>
        ) : null}
      </div>
      {multiline ? (
        <textarea {...wiring} rows={6} />
      ) : (
        <input {...wiring} type={type} autoComplete={autoComplete} />
      )}
      {error ? (
        <p id={`${id}-error`} className="text-sm text-site-fg">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * The message form: validated by the rules the backend shares, field errors on
 * their fields, its outcome said in place. A honeypot catches what fills every
 * input.
 */
export function ContactForm() {
  const t = useTranslations('home.contact');
  const errorMessage = useErrorMessages();
  const [state, setState] = useState<'writing' | 'sending' | 'sent'>('writing');
  const [failure, setFailure] = useState<string | null>(null);
  const form = useForm<MessageInput, unknown, MessageInput>({
    resolver: createFormResolver<MessageInput>(
      messageSchema,
      errorMessage.field,
    ),
    defaultValues: EMPTY,
  });
  const { errors } = form.formState;
  const values = useWatch({ control: form.control });

  async function onSubmit(input: MessageInput) {
    setState('sending');
    setFailure(null);

    try {
      await sendMessage(input);
      form.reset(EMPTY);
      setState('sent');
    } catch (error) {
      if (
        error instanceof ApiRequestError &&
        error.code === 'VALIDATION_ERROR'
      ) {
        for (const [path, code] of Object.entries(
          toFieldErrors(error.details),
        )) {
          form.setError(toFieldPath<MessageInput>(path), {
            type: code,
            message: errorMessage.field(code),
          });
        }
      }

      setFailure(errorMessage.response(error));
      setState('writing');
    }
  }

  if (state === 'sent') {
    return (
      <div
        role="status"
        className="grid content-start justify-items-start gap-5"
      >
        <p className="text-site-lead">{t('sent')}</p>
        <button
          type="button"
          onClick={() => setState('writing')}
          className="link-line pb-0.5 text-sm font-medium"
        >
          {t('another')}
        </button>
      </div>
    );
  }

  const sending = state === 'sending';

  return (
    <form
      onSubmit={(event) => void form.handleSubmit(onSubmit)(event)}
      noValidate
      className="relative grid content-start gap-x-4 gap-y-6 sm:grid-cols-2"
    >
      <Field
        id="message-name"
        label={t('name')}
        error={errors.name?.message}
        registered={form.register('name')}
        value={values.name ?? ''}
        limit={LIMITS.name}
        autoComplete="name"
      />
      <Field
        id="message-email"
        label={t('senderEmail')}
        error={errors.email?.message}
        registered={form.register('email')}
        value={values.email ?? ''}
        type="email"
        autoComplete="email"
      />
      <Field
        id="message-subject"
        label={t('subject')}
        error={errors.subject?.message}
        registered={form.register('subject')}
        value={values.subject ?? ''}
        limit={LIMITS.subject}
        wide
      />
      <Field
        id="message-body"
        label={t('body')}
        error={errors.body?.message}
        registered={form.register('body')}
        value={values.body ?? ''}
        limit={LIMITS.body}
        multiline
        wide
      />

      {/* The honeypot: off-screen rather than hidden, so a script filling every input fills it. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -start-[9999px] size-px overflow-hidden"
      >
        <label htmlFor="message-website">{t('honeypot')}</label>
        <input
          {...form.register('website')}
          id="message-website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      <div
        data-reveal
        className="mt-2 flex flex-wrap items-center gap-6 sm:col-span-2"
      >
        <button
          type="submit"
          disabled={sending}
          data-magnetic
          className="group inline-flex items-center gap-4 rounded-full bg-site-red px-6.5 py-4.5 text-[15px] font-semibold text-site-on-red transition-[gap,opacity] duration-500 hover:gap-7 focus-visible:gap-7 focus-visible:ring-2 focus-visible:ring-site-red focus-visible:ring-offset-4 focus-visible:ring-offset-site-bg focus-visible:outline-none disabled:opacity-60"
        >
          {sending ? t('sending') : t('send')}
          {sending ? (
            <Spinner aria-hidden />
          ) : (
            <span aria-hidden className="arrow-pass rtl:-scale-x-100">
              →
            </span>
          )}
        </button>
        {failure ? (
          <p role="alert" className="text-[15px] text-site-fg">
            {failure}
          </p>
        ) : null}
      </div>
    </form>
  );
}
