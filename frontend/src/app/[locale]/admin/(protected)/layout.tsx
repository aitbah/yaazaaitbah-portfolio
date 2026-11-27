'use client';

import { useTranslations } from 'next-intl';
import { useEffect, type ReactNode } from 'react';

import { UnsavedChangesProvider } from '@/components/admin/unsaved-changes';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { Spinner } from '@/components/ui/spinner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AdminHeader } from '@/features/admin/admin-header';
import { AdminSidebar } from '@/features/admin/admin-sidebar';
import { useAuth } from '@/features/auth/use-auth';
import { useRouter } from '@/i18n/navigation';

// Second gate: proxy.ts checks the cookie exists, this checks it is still valid.
export default function ProtectedAdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const t = useTranslations('admin');
  const router = useRouter();
  const { user, isPending } = useAuth();

  useEffect(() => {
    if (!isPending && !user) {
      router.replace('/admin/login');
    }
  }, [isPending, user, router]);

  if (isPending || !user) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Spinner className="size-6" aria-label={t('checkingSession')} />
      </div>
    );
  }

  // The shell is the layout, so every admin page inherits it unchanged.
  return (
    // The vendored `Tooltip` has no provider of its own and `SidebarProvider`
    // does not add one, so the rail's labels need this above them.
    <TooltipProvider>
      {/* Above the shell, because the guard is between a form in the content
          column and the controls in the header and the sidebar that navigate
          away from it. */}
      <UnsavedChangesProvider>
        {/* A definite height, not a minimum: the vendored `min-h-svh` lets the
            shell grow, so nothing inside could fill the screen and scroll on its
            own. Pinning the frame makes the content column the scroll container
            and fixes the header in place. */}
        <SidebarProvider className="h-svh overflow-hidden">
          <AdminSidebar />
          <SidebarInset className="min-h-0">
            {/* Outside `main`: the header is a banner, and announcing it as part
            of the page's content makes every page start with the account
            menu. */}
            <AdminHeader />
            {/* The content column: the container every admin grid measures
                itself against (not the window, which differs once the sidebar
                opens), and the scroll container. `min-h-0` lets a page such as
                the inbox scroll inside its own panes. */}
            <main className="@container/admin-content flex w-full min-h-0 flex-1 flex-col gap-8 overflow-y-auto p-4 md:p-6 lg:p-8 xl:px-10">
              {children}
            </main>
          </SidebarInset>
        </SidebarProvider>
      </UnsavedChangesProvider>
    </TooltipProvider>
  );
}
