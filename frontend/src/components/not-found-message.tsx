import { getTranslations } from 'next-intl/server';

import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';

/**
 * What a missing page says, wherever it is caught: inside the public site's
 * layout, and at the root for anything above it.
 */
export async function NotFoundMessage() {
  const t = await getTranslations('errors');

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <h1 className="text-2xl font-semibold">{t('notFoundTitle')}</h1>
      <p className="max-w-prose text-sm text-muted-foreground">
        {t('notFoundDescription')}
      </p>
      <Button asChild>
        <Link href="/">{t('home')}</Link>
      </Button>
    </div>
  );
}
