import { ArrowLeftIcon } from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { LanguageSwitcher } from '@/components/language-switcher';
import { absoluteImage } from '@/features/profile/public-profile';
import {
  ProjectBody,
  ProjectLinks,
} from '@/features/site/sections/project-body';
import { MarkSprite } from '@/features/site/mark-sprite';
import { ProjectGallery } from '@/features/site/sections/project-gallery';
import { shotsOf } from '@/features/site/sections/work-section';
import { readSiteContent } from '@/features/site/site-content';
import { SiteThemeSwitch } from '@/features/site/site-theme-switch';
import { resolveLocale } from '@/i18n/locale-params';
import { localizedValue } from '@/i18n/localized-value';
import { monthLabel } from '@/i18n/month';
import { Link } from '@/i18n/navigation';
import { localeAlternates, openGraphLocale, siteUrl } from '@/lib/site';

async function findProject(slug: string) {
  const { projects } = await readSiteContent();

  return projects.find((row) => row.slug === slug);
}

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/projects/[slug]'>): Promise<Metadata> {
  const { slug } = await params;
  const locale = await resolveLocale(params);
  const project = await findProject(slug);

  if (!project) {
    return {};
  }

  const title = localizedValue(project.title, locale);
  const description = localizedValue(project.description, locale);
  const image = absoluteImage(project.imageUrl);
  const path = `/projects/${slug}`;

  return {
    metadataBase: new URL(siteUrl()),
    title,
    description,
    alternates: {
      canonical: `/${locale}${path}`,
      languages: Object.fromEntries(
        Object.entries(localeAlternates()).map(([code, href]) => [
          code,
          `${href}${path}`,
        ]),
      ),
    },
    openGraph: {
      type: 'article',
      title,
      description,
      url: `/${locale}${path}`,
      locale: openGraphLocale(locale),
      ...(image ? { images: [image] } : {}),
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title,
      description,
      ...(image ? { images: [image] } : {}),
    },
  };
}

/**
 * A project on a page of its own, in the home page's design: for a link shared
 * or followed from the index, and for search engines. Its way back leads to the
 * work, and it ends on the next project in the admin's order, so it is never a
 * dead end.
 */
export default async function ProjectPage({
  params,
}: PageProps<'/[locale]/projects/[slug]'>) {
  const { slug } = await params;
  const locale = await resolveLocale(params);
  const project = await findProject(slug);

  if (!project) {
    notFound();
  }

  const t = await getTranslations({ locale, namespace: 'home.work' });
  const { projects, technologies, tools } = await readSiteContent();
  const ordered = [...projects].sort((a, b) => a.order - b.order);
  const at = ordered.findIndex((row) => row.id === project.id);
  const next =
    ordered.length > 1 ? ordered[(at + 1) % ordered.length] : undefined;
  const number = (index: number) => String(index + 1).padStart(2, '0');
  const title = localizedValue(project.title, locale);

  return (
    <>
      <header className="flex h-14 items-center justify-between gap-4 px-[var(--site-pad)] md:h-16">
        <Link
          href="/#work"
          className="group link-line inline-flex items-center gap-2 pb-0.5 text-sm font-medium text-site-fg"
        >
          <ArrowLeftIcon
            aria-hidden
            className="size-4 transition-[translate] duration-500 group-hover:-translate-x-1 rtl:-scale-x-100 rtl:group-hover:translate-x-1"
          />
          {t('back')}
        </Link>
        <div className="flex items-center gap-5">
          <LanguageSwitcher appearance="site" />
          <SiteThemeSwitch />
        </div>
      </header>
      <main id="main">
        <article
          aria-labelledby="project-title"
          className="px-[var(--site-pad)] pb-[clamp(80px,14vh,160px)]"
        >
          <div className="site-label grid grid-cols-[auto_1fr] gap-4 pt-[clamp(24px,5vh,56px)] text-site-muted">
            <span className="text-site-red">
              {number(at)} / {String(ordered.length).padStart(2, '0')}
            </span>
            <span className="text-end">
              {project.featured ? `${t('featured')} · ` : ''}
              {t('updated', {
                date: monthLabel(project.updatedAt.slice(0, 7), locale),
              })}
            </span>
          </div>

          <h1
            id="project-title"
            className="site-display my-[clamp(28px,6vh,72px)] text-site-title"
          >
            {title}
          </h1>

          <div className="grid grid-cols-1 gap-x-[clamp(16px,2vw,32px)] gap-y-10 md:grid-cols-12">
            <div className="md:col-span-7">
              <div className="md:sticky md:top-6">
                <ProjectGallery
                  title={title}
                  shots={shotsOf(project, locale)}
                  priority
                  open
                />
              </div>
            </div>
            <div className="grid content-start gap-8 md:col-span-4 md:col-start-9">
              <ProjectLinks project={project} locale={locale} />
              <ProjectBody
                project={project}
                expertise={[...technologies, ...tools]}
                locale={locale}
              />
            </div>
          </div>

          {next ? (
            <Link
              href={`/projects/${next.slug}`}
              className="group mt-[clamp(96px,18vh,200px)] block outline-none"
            >
              <span className="site-label flex justify-between gap-4 text-site-muted">
                <span className="text-site-red">{t('nextProject')}</span>
                <span>
                  {number(ordered.indexOf(next))} /{' '}
                  {String(ordered.length).padStart(2, '0')}
                </span>
              </span>
              <span className="mt-[clamp(20px,4vh,48px)] flex items-end justify-between gap-6">
                <span className="site-display text-[clamp(3rem,8vw,9rem)] italic transition-[translate] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-x-[0.08em] group-focus-visible:underline rtl:group-hover:-translate-x-[0.08em]">
                  {localizedValue(next.title, locale)}
                </span>
                <span
                  aria-hidden
                  className="arrow-pass site-display shrink-0 pb-[0.06em] text-[clamp(2rem,6vw,6rem)] leading-[0.8] text-site-red rtl:-scale-x-100"
                >
                  →
                </span>
              </span>
            </Link>
          ) : null}
        </article>
      </main>
      <MarkSprite
        slugs={[...technologies, ...tools].map((row) =>
          row.icon?.kind === 'preset' ? row.icon.value : undefined,
        )}
      />
    </>
  );
}
