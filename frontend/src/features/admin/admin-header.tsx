'use client';

import { useTranslations } from 'next-intl';

import { ThemeToggle } from '@/components/theme/theme-toggle';
import { Separator } from '@/components/ui/separator';
import { SidebarTrigger } from '@/components/ui/sidebar';

import { AdminBreadcrumb } from './admin-breadcrumb';
import { LanguageSwitcher } from '@/components/language-switcher';

/**
 * Navigation and place at the start; how the admin is displayed at the end -
 * language and theme, as the same control. The account lives in the sidebar
 * footer.
 */
export function AdminHeader() {
  const t = useTranslations('admin');

  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur supports-backdrop-filter:bg-background/80">
      {/* The vendored trigger labels itself in English; this one is translated. */}
      <SidebarTrigger aria-label={t('toggleSidebar')} />
      <Separator
        orientation="vertical"
        className="data-vertical:self-center h-4"
      />

      {/* `min-w-0` is what lets the breadcrumb shrink at all: a flex child's
          default minimum is its own content, so without it the trail pushes
          the controls off a narrow screen instead of giving way. */}
      <div className="min-w-0 flex-1">
        <AdminBreadcrumb />
      </div>

      {/* Logical, not left/right: the whole admin is built to survive a
          right-to-left locale being added. */}
      <div className="flex shrink-0 items-center gap-2">
        <LanguageSwitcher />
        <ThemeToggle />
      </div>
    </header>
  );
}
