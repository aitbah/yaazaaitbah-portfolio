'use client';

import { ChevronsUpDownIcon, LogOutIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { Spinner } from '@/components/ui/spinner';
import { useLogout } from '@/features/auth/use-auth';
import { useLeavingLink } from '@/components/admin/leaving-link';
import { Link, useRouter } from '@/i18n/navigation';

import { StoredAvatar } from '@/components/admin/stored-avatar';

import { ADMIN_MENU_ITEMS } from './admin-navigation';
import { useAdminIdentity } from './use-admin-identity';

/**
 * Who is signed in: photo, name and address, or the address alone before a
 * profile exists. In the sidebar footer rather than the header, so sign-out is
 * not one misclick away mid-edit. Its links come from `ADMIN_MENU_ITEMS`.
 */
export function AdminAccountMenu() {
  const t = useTranslations('admin.signedIn');
  // The nav labels, so the menu and the breadcrumb call a page the same thing.
  const tNav = useTranslations('admin.nav');
  const router = useRouter();
  const leaving = useLeavingLink();
  const { isMobile } = useSidebar();
  const { name, email, photoUrl, initials } = useAdminIdentity();
  const { mutate: signOut, isPending } = useLogout();

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              // The address is the account's only guaranteed identifying
              // detail, so the trigger names it rather than announcing an
              // anonymous "user menu".
              aria-label={t('menu', { email })}
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <StoredAvatar
                url={photoUrl}
                alt=""
                initials={initials}
                width={32}
                className="size-8 rounded-lg"
                fallbackClassName="rounded-lg text-xs"
              />
              {/* Hidden by the rail, which is 3 rem wide and cannot hold two
                  lines of prose without wrapping them into a mess. */}
              <div className="grid flex-1 text-start text-sm leading-tight">
                <span className="truncate font-medium">{name || email}</span>
                {name ? (
                  <span className="truncate text-xs text-muted-foreground">
                    {email}
                  </span>
                ) : null}
              </div>
              <ChevronsUpDownIcon className="ms-auto size-4" aria-hidden />
            </SidebarMenuButton>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            // Above the trigger on desktop, where the footer is at the bottom
            // of the screen; beside it in the mobile sheet.
            side={isMobile ? 'bottom' : 'top'}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="flex flex-col gap-0.5 p-0 font-normal">
              <span className="flex items-center gap-2 px-1 py-1.5">
                <StoredAvatar
                  url={photoUrl}
                  alt=""
                  initials={initials}
                  width={32}
                  className="size-8 rounded-lg"
                  fallbackClassName="rounded-lg text-xs"
                />
                <span className="grid flex-1 text-start text-sm leading-tight">
                  <span className="truncate font-medium">{name || email}</span>
                  {name ? (
                    <span className="truncate text-xs text-muted-foreground">
                      {email}
                    </span>
                  ) : null}
                </span>
              </span>
            </DropdownMenuLabel>

            <DropdownMenuSeparator />

            {/* Driven by the same table the sidebar and the breadcrumb read,
                so a link here to a page that does not exist fails a test rather
                than a click. */}
            <DropdownMenuGroup>
              {ADMIN_MENU_ITEMS.map(({ key, href, icon: Icon }) => (
                <DropdownMenuItem key={key} asChild>
                  <Link href={href} {...leaving(href)}>
                    <Icon aria-hidden />
                    {tNav(key)}
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              variant="destructive"
              disabled={isPending}
              // The menu would close on select and take the pending state with
              // it, so the spinner would never be seen.
              onSelect={(event) => {
                event.preventDefault();
                signOut(undefined, {
                  onSuccess: () => {
                    router.replace('/admin/login');
                  },
                });
              }}
            >
              {isPending ? <Spinner aria-hidden /> : <LogOutIcon aria-hidden />}
              {isPending ? t('loggingOut') : t('logout')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
