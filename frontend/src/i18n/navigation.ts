import { createNavigation } from 'next-intl/navigation';

import { routing } from './routing';

// Locale-aware replacements for next/navigation; add names as pages need them.
export const { Link, usePathname, useRouter } = createNavigation(routing);
