import type { Locale } from 'next-intl';
import { getTranslations } from 'next-intl/server';

import { StoredImage } from '@/components/stored-image';
import type { Expertise } from '@/features/expertise/expertise-api';
import type { Project } from '@/features/project/project-api';
import { Link } from '@/i18n/navigation';
import { localizedValue } from '@/i18n/localized-value';

import { SectionHead } from './chapter';
import { ExpertiseMark } from './expertise-mark';
import { ProjectLinks, stackOf } from './project-body';
import type { Shot } from './project-gallery';

/** A project's images, cover first, each with its alt text in the reader's language. */
export function shotsOf(project: Project, locale: string): Shot[] {
  return [
    ...(project.imageUrl
      ? [
          {
            url: project.imageUrl,
            alt: localizedValue(project.imageAlt, locale),
          },
        ]
      : []),
    ...project.gallery.map((image) => ({
      url: image.url,
      alt: localizedValue(image.alt, locale),
    })),
  ];
}

/**
 * The work. Featured projects are cards that pin and stack as the next one
 * arrives (the motion; without it they simply follow one another): the cover
 * in parallax, the number in red, the title, what it is, the role, the stack,
 * and the way into the case on its own page. The other projects pass by in a
 * horizontal gallery, pinned on a wide screen, scrolled by hand on a phone.
 */
export async function WorkSection({
  projects,
  expertise,
  locale,
}: {
  projects: Project[];
  expertise: Expertise[];
  locale: Locale;
}) {
  const t = await getTranslations({ locale, namespace: 'home.work' });
  const ordered = [...projects].sort((a, b) => a.order - b.order);
  const featured = ordered.filter((project) => project.featured);
  const rest = ordered.filter((project) => !project.featured);
  const number = (project: Project) =>
    String(ordered.indexOf(project) + 1).padStart(2, '0');

  return (
    <section
      id="work"
      aria-labelledby="work-title"
      className="relative z-10 bg-site-bg px-[var(--site-pad)] pt-[clamp(96px,16vh,180px)] pb-[clamp(96px,16vh,180px)]"
    >
      <SectionHead index={2} id="work-title" title={t('title')} />

      {featured.length ? (
        <div data-stack className="grid gap-[clamp(20px,3vh,32px)]">
          {featured.map((project) => {
            const title = localizedValue(project.title, locale);
            const [cover] = shotsOf(project, locale);
            const stack = stackOf(project, expertise);
            const role = localizedValue(project.role, locale);

            return (
              <article
                key={project.id}
                id={`work-${project.slug}`}
                aria-labelledby={`case-${project.slug}`}
                data-card
                className="relative"
              >
                <div
                  data-card-body
                  className="grid origin-top gap-[clamp(20px,3vw,48px)] rounded-[28px] bg-site-raise p-[clamp(14px,2.2vw,32px)] md:min-h-[min(78svh,780px)] md:grid-cols-12"
                >
                  {cover ? (
                    <Link
                      href={`/projects/${project.slug}`}
                      tabIndex={-1}
                      aria-hidden
                      data-cursor="view"
                      className="relative block aspect-[16/10] overflow-hidden rounded-[20px] bg-site-faint md:col-span-7 md:aspect-auto"
                    >
                      <span
                        data-parallax
                        className="absolute inset-x-0 -top-[8%] block h-[116%]"
                      >
                        <StoredImage
                          src={cover.url}
                          alt=""
                          sizes="(max-width: 760px) 92vw, 56vw"
                          className="size-full"
                        />
                      </span>
                    </Link>
                  ) : null}
                  <div className="flex flex-col md:col-span-5 md:py-2">
                    <p
                      aria-hidden
                      className="site-display text-[clamp(2.75rem,2rem+2.5vw,5rem)] leading-none text-site-red italic"
                    >
                      {number(project)}
                    </p>
                    <h3
                      id={`case-${project.slug}`}
                      className="site-display mt-5 text-[clamp(2.25rem,1.4rem+2.8vw,4.75rem)]"
                    >
                      {title}
                    </h3>
                    <p className="mt-6 max-w-[46ch] text-site-body text-site-soft">
                      {localizedValue(project.description, locale)}
                    </p>
                    {role ? (
                      <p className="mt-5 max-w-[46ch] text-sm text-site-muted">
                        <span className="site-label me-2 text-site-fg">
                          {t('role')}
                        </span>
                        {role}
                      </p>
                    ) : null}
                    {stack.length ? (
                      <ul
                        aria-label={t('stack')}
                        className="mt-6 flex flex-wrap gap-1.5"
                      >
                        {stack.map((row) => (
                          <li
                            key={row.id}
                            className="inline-flex items-center gap-1.5 rounded-full bg-site-bg px-3 py-1.5 text-[0.8125rem] leading-none text-site-soft"
                          >
                            <ExpertiseMark icon={row.icon} className="size-3" />
                            {localizedValue(row.name, locale)}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    <div className="mt-auto flex flex-wrap items-center gap-x-6 gap-y-4 pt-10">
                      <Link
                        href={`/projects/${project.slug}`}
                        data-magnetic
                        className="group inline-flex items-center gap-3 rounded-full bg-site-fg px-5 py-3 text-sm font-semibold text-site-bg transition-[gap] duration-500 hover:gap-4 focus-visible:ring-2 focus-visible:ring-site-red focus-visible:ring-offset-4 focus-visible:ring-offset-site-raise focus-visible:outline-none"
                      >
                        {t('read')}
                        <span
                          aria-hidden
                          className="arrow-pass rtl:-scale-x-100"
                        >
                          →
                        </span>
                      </Link>
                      <ProjectLinks project={project} locale={locale} />
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}

      {rest.length ? (
        <div
          data-rail-section
          className="group/rail mt-[clamp(96px,16vh,180px)] data-[pinned]:flex data-[pinned]:h-svh data-[pinned]:flex-col data-[pinned]:justify-center"
        >
          <div className="mb-[clamp(24px,4vh,40px)] flex items-end justify-between gap-6">
            <h3 className="site-display text-[clamp(2.25rem,1.6rem+2.4vw,4.25rem)]">
              {featured.length ? t('more') : t('all')}
            </h3>
            <span
              aria-hidden
              className="site-label text-site-red [font-feature-settings:'tnum']"
            >
              {String(rest.length).padStart(2, '0')}
            </span>
          </div>
          {/*
            Scrolls sideways by hand, its snapping keeping the page margin;
            with the motion it pins and the page's scroll drives it
            (`data-pinned`), with a line for how far along it is.
          */}
          <div
            data-rail-view
            className="-mx-[var(--site-pad)] scroll-px-[var(--site-pad)] snap-x snap-mandatory overflow-x-auto overscroll-x-contain px-[var(--site-pad)] [scrollbar-width:none] group-data-[pinned]/rail:snap-none group-data-[pinned]/rail:overflow-hidden"
          >
            <ol data-rail className="flex w-max gap-[clamp(16px,2vw,28px)]">
              {rest.map((project) => {
                const [cover] = shotsOf(project, locale);
                const stack = stackOf(project, expertise)
                  .slice(0, 3)
                  .map((row) => localizedValue(row.name, locale));

                return (
                  <li
                    key={project.id}
                    data-rail-card
                    className="w-[min(78vw,30rem)] shrink-0 snap-start"
                  >
                    <Link
                      href={`/projects/${project.slug}`}
                      data-cursor="view"
                      className="group block outline-none"
                    >
                      <span className="relative block aspect-[4/3] overflow-hidden rounded-[20px] bg-site-raise">
                        {cover ? (
                          <StoredImage
                            src={cover.url}
                            alt=""
                            sizes="(max-width: 760px) 78vw, 30rem"
                            className="size-full transition-[scale] duration-[1200ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.05] group-focus-visible:scale-[1.05]"
                          />
                        ) : null}
                      </span>
                      <span className="mt-5 flex items-baseline gap-3">
                        <span
                          aria-hidden
                          className="site-label shrink-0 text-site-red"
                        >
                          {number(project)}
                        </span>
                        <span className="site-display link-line pb-1 text-[clamp(1.75rem,1.3rem+1.4vw,2.75rem)]">
                          {localizedValue(project.title, locale)}
                        </span>
                      </span>
                      {stack.length ? (
                        <span className="mt-2 block ps-9 text-sm text-site-muted">
                          {stack.join(' · ')}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ol>
          </div>
          <span
            aria-hidden
            className="mt-[clamp(24px,4vh,40px)] hidden h-0.5 overflow-hidden rounded-full bg-site-line group-data-[pinned]/rail:block"
          >
            <span
              data-rail-progress
              className="block h-full origin-left rounded-full bg-site-red rtl:origin-right"
            />
          </span>
        </div>
      ) : null}
    </section>
  );
}
