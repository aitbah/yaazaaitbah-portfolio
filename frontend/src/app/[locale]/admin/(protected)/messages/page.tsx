'use client';

import { useTranslations } from 'next-intl';

import { AsyncSection } from '@/components/admin/async-section';
import { PageHeader } from '@/components/admin/page-header';
import { MessageInbox } from '@/features/message/message-inbox';
import { useMessages } from '@/features/message/use-messages';

export default function MessagesPage() {
  const t = useTranslations('admin.messages');
  const inbox = useMessages();

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-8">
      <PageHeader
        title={t('title')}
        description={t('unreadCount', { count: inbox.unread })}
      />

      <AsyncSection
        isPending={inbox.isPending}
        error={inbox.error}
        loadingLabel={t('loading')}
      >
        <MessageInbox
          messages={inbox.messages}
          more={{
            total: inbox.total,
            pageSize: inbox.pageSize,
            hasMore: inbox.hasMore,
            loadMore: inbox.loadMore,
            isLoadingMore: inbox.isLoadingMore,
          }}
        />
      </AsyncSection>
    </div>
  );
}
