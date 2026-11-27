'use client';

import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';

/**
 * Without this, a render error anywhere in the locale tree falls through to
 * Next's default page: untranslated, unstyled, and identical for every failure.
 */
export default function LocaleError({ reset }: { reset: () => void }) {
  const t = useTranslations('errors');

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-2xl font-semibold">{t('title')}</h1>
      <p className="max-w-prose text-sm text-muted-foreground">
        {t('description')}
      </p>
      <Button onClick={reset}>{t('retry')}</Button>
    </div>
  );
}
