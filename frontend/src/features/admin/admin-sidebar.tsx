'use client';

import { useTranslations } from 'next-intl';

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar';
import { useMessages } from '@/features/message/use-messages';
import { useLeavingLink } from '@/components/admin/leaving-link';
import { Link, usePathname } from '@/i18n/navigation';

import { AdminAccountMenu } from './admin-account-menu';
import { ADMIN_NAV_SECTIONS } from './admin-navigation';
import { useAdminIdentity } from './use-admin-identity';

export function AdminSidebar() {
  const t = useTranslations('admin');
  const tNav = useTranslations('admin.nav');
  // Already locale-stripped, so it compares against the hrefs as written.
  const pathname = usePathname();
  // Every entry here leaves whatever is open in the content column.
  const leaving = useLeavingLink();
  // The count the inbox already fetches; the sidebar reads the same cache
  // rather than asking again.
  const { unread } = useMessages();
  // Whose portfolio this is, which is a more useful thing for the sidebar to
  // say than the word "Admin" - and the same read the footer already makes.
  const { name } = useAdminIdentity();

  return (
    // Collapsible to a rail on desktop, and the vendored `Sheet` on mobile.
    // Editing a project is the one admin task that wants the whole width, and
    // giving that back is a click rather than a resize.
    <Sidebar
      collapsible="icon"
      /* On a narrow screen this is a dialog, and these two are the only words
         a screen reader has for what just opened. The vendored component
         names itself in English; this names it in the reader's language. */
      labels={{ title: tNav('label'), description: tNav('drawerDescription') }}
    >
      <SidebarHeader className="gap-0.5 px-4 py-4">
        {/* Both hidden in the rail: a 3 rem column cannot hold two lines of
            prose, and letting them wrap is what makes a collapsed sidebar
            look broken. */}
        <span className="truncate text-sm font-semibold group-data-[collapsible=icon]:hidden">
          {/* The owner's name once there is a profile, and the generic title
              until then - a fresh install has nobody to name yet. */}
          {name ? t('titleFor', { name }) : t('title')}
        </span>
        <span className="truncate text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
          {t('subtitle')}
        </span>
      </SidebarHeader>

      <SidebarContent>
        {/* The vendored sidebar is all divs, so the landmark is added here. */}
        <nav aria-label={tNav('label')}>
          {ADMIN_NAV_SECTIONS.map((section) => (
            <SidebarGroup key={section.key}>
              {/* A real heading for the group, not just a smaller font: the
                  sections are how the entries stop reading as one list. */}
              <SidebarGroupLabel>
                {tNav(`sections.${section.key}`)}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {section.items.map(({ key, href, icon: Icon }) => (
                    <SidebarMenuItem key={key}>
                      <SidebarMenuButton
                        asChild
                        isActive={pathname === href}
                        // The label is what the rail hides, so the rail is the
                        // one state that needs it back on hover and focus.
                        tooltip={tNav(key)}
                      >
                        <Link href={href} {...leaving(href)}>
                          <Icon />
                          <span>{tNav(key)}</span>
                        </Link>
                      </SidebarMenuButton>
                      {/* Unread messages are the one thing that changes without
                          the admin doing anything, so they are worth a badge. */}
                      {key === 'messages' && unread > 0 ? (
                        <SidebarMenuBadge>
                          <span className="sr-only">{tNav('unread')}</span>
                          {unread}
                        </SidebarMenuBadge>
                      ) : null}
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </nav>
      </SidebarContent>

      <SidebarFooter>
        <AdminAccountMenu />
      </SidebarFooter>

      {/* Drag the edge to collapse, for anyone who never finds the trigger. */}
      {/* The drag strip along the sidebar's edge. It is hidden from the
          accessibility tree - the header's trigger is the control that
          announces itself - so the only thing to translate is the native
          tooltip a mouse user sees. */}
      <SidebarRail title={t('toggleSidebar')} />
    </Sidebar>
  );
}
