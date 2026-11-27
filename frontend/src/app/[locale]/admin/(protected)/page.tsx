'use client';

import { useTranslations } from 'next-intl';

import { PageHeader } from '@/components/admin/page-header';
import { DashboardOverview } from '@/features/admin/dashboard-overview';

/** The dashboard's own content starts here; the shell provides everything else. */
export default function DashboardPage() {
  const t = useTranslations('admin.dashboard');

  return (
    <div className="flex w-full flex-col gap-8">
      <PageHeader title={t('title')} description={t('description')} />
      <DashboardOverview />
    </div>
  );
}
