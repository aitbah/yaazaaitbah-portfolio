'use client';

import { useTranslations } from 'next-intl';

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { useLeavingLink } from '@/components/admin/leaving-link';
import { Link, usePathname } from '@/i18n/navigation';

import { findNavItem } from './admin-navigation';

/**
 * Where you are, resolved against the sidebar's table; a route with no entry
 * shows the root alone. It never wraps: below `sm` it shows the current page
 * only, and `truncate` catches a long label.
 */
export function AdminBreadcrumb() {
  const tNav = useTranslations('admin.nav');
  const pathname = usePathname();
  const leaving = useLeavingLink();

  const current = findNavItem(pathname);
  const isRoot = current?.href === '/admin';

  return (
    <Breadcrumb className="min-w-0">
      <BreadcrumbList className="flex-nowrap">
        <BreadcrumbItem
          className={isRoot ? undefined : 'hidden sm:inline-flex'}
        >
          {/* The dashboard's own nav label, not the application's title: the
              sidebar now carries the owner's name at the top, and repeating
              it here would say the same thing twice on every page. */}
          {isRoot ? (
            <BreadcrumbPage>{tNav('dashboard')}</BreadcrumbPage>
          ) : (
            <BreadcrumbLink asChild>
              <Link href="/admin" {...leaving('/admin')}>
                {tNav('dashboard')}
              </Link>
            </BreadcrumbLink>
          )}
        </BreadcrumbItem>

        {current && !isRoot ? (
          <>
            <BreadcrumbSeparator className="hidden sm:block" />
            <BreadcrumbItem className="min-w-0">
              <BreadcrumbPage className="truncate">
                {tNav(current.key)}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </>
        ) : null}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
