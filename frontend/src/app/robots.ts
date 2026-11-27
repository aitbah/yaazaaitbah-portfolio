import type { MetadataRoute } from 'next';

import { siteUrl } from '@/lib/site';

/**
 * The admin area is not public-facing and its pages already send `noindex`;
 * excluding it here keeps crawlers from spending requests on it at all.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/*/admin', '/*/admin/'],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
