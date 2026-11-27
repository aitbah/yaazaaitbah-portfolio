import type { MetadataRoute } from 'next';

import type { Project } from '@/features/project/project-api';
import { routing } from '@/i18n/routing';
import { readList } from '@/lib/server-api';
import { siteUrl } from '@/lib/site';

// Built per request, like the pages: at build there is no API to list projects.
export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const projects = await readList<Project>('/api/projects', 'projects');

  // One page per project, in every locale - the same content, the same slug,
  // each declaring the others as its alternates. A date only where one is
  // known: a `lastmod` that is always "now" teaches crawlers to ignore it.
  const pages: { path: string; lastModified?: string }[] = [
    { path: '' },
    ...projects.map((project) => ({
      path: `/projects/${project.slug}`,
      lastModified: project.updatedAt,
    })),
  ];

  return routing.locales.flatMap((locale) =>
    pages.map(({ path, lastModified }) => ({
      url: `${base}/${locale}${path}`,
      ...(lastModified ? { lastModified } : {}),
      // Every locale is an alternate of every other, so search engines serve
      // the right one. Adding a language extends this on its own.
      alternates: {
        languages: Object.fromEntries(
          routing.locales.map((alternate) => [
            alternate,
            `${base}/${alternate}${path}`,
          ]),
        ),
      },
    })),
  );
}
