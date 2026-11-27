import { CodeIcon, LightbulbIcon, WrenchIcon } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { RESOURCE_BY_KIND, type ExpertiseKind } from '@portfolio/shared';

/** Each kind's icon, in one table for the sidebar, the empty state and the page. */
export const KIND_ICONS: Record<ExpertiseKind, LucideIcon> = {
  skill: LightbulbIcon,
  technology: CodeIcon,
  tool: WrenchIcon,
};

/** The resource segment the reorder endpoint is mounted under. */
export function kindResource(kind: ExpertiseKind) {
  return RESOURCE_BY_KIND[kind];
}
