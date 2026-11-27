import { AwardIcon, BookOpenIcon } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { CredentialKind } from '@portfolio/shared';

/** Each kind's icon, in one table for the sidebar, the empty state and the page. */
export const CREDENTIAL_ICONS: Record<CredentialKind, LucideIcon> = {
  certification: AwardIcon,
  course: BookOpenIcon,
};
