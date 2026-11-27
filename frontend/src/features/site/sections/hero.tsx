import Image from 'next/image';

import { assetUrl, isStoredUpload } from '@/lib/api-client';

/**
 * The opening. A red disc stands behind the owner's head; the owner stands
 * before it, the photograph whole, its foot on the screen's lower edge; the
 * name is set large beside them, the second half in italic. The headline is a
 * statement with two actions; where the owner is and whether they are
 * available sit opposite.
 *
 * Laid out by CSS alone: the disc and the figure share a centre line
 * (`--hero-x`), the disc's height follows the head (`--hero-head`), and the
 * motion refines both once it has read the photograph. It also grows the disc
 * until red fills the screen and the next chapter begins on red. Each moving
 * part sits inside a wrapper that places it, so no transform is shared.
 *
 * The stage is as tall as the screen shows (`dvh`). With the motion it is
 * held in place by `sticky` (`data-staged`, the section giving it the room to
 * be held through) and stands as tall as the screen can grow (`lvh`); the
 * portrait and the disc are then fixed to the screen's own foot, which the
 * browser keeps at the visible edge as a phone's toolbar slides in and out -
 * so no band of page ever shows beneath the portrait. (A height measured and
 * kept, as a pin keeps it, fell behind the toolbar on a real phone.)
 */
export function Hero({
  firstName,
  lastName,
  headline,
  photo,
  facts,
  actions,
}: {
  firstName: string;
  lastName: string;
  headline: string;
  photo?: { url: string; alt: string };
  /** `open`: the availability marker, filled when open to work, hollow when not. */
  facts: { label: string; value: string; open?: boolean }[];
  /** The way to the work, when there is any, and the way to write. */
  actions: { work?: string; contact: string };
}) {
  const name = [firstName, lastName].filter(Boolean).join(' ');
  // The headline and where the owner is, around and around the disc's rim:
  // repeated about as often as fits (the motion measures it and fills the
  // circle exactly, by the space between words, which never pulls Arabic's
  // joined letters apart).
  const ringOnce = [headline, facts[0]?.value]
    .filter(Boolean)
    .map((part) => `${part} · `)
    .join('');
  const ring = ringOnce
    ? ringOnce.repeat(Math.max(1, Math.round(96 / ringOnce.length))).trim()
    : '';

  return (
    <section
      id="top"
      aria-labelledby="hero-name"
      data-hero
      className="group/hero relative z-20 data-[behind]:z-[5]"
    >
      <div
        data-hero-stage
        className="relative isolate h-svh supports-[height:100dvh]:h-dvh overflow-hidden bg-site-bg group-data-[staged]/hero:sticky group-data-[staged]/hero:top-0 group-data-[staged]/hero:h-lvh [--figure-h:min(84svh,118vw)] [--hero-head:0.3] [--hero-x:64%] max-md:[--figure-h:min(46svh,110vw)] max-md:[@media(max-height:780px)]:[--figure-h:min(40svh,110vw)] max-md:[--hero-x:50%]"
      >
        {/* The disc, centred behind the head: placed from the stage's foot, as the portrait is. */}
        <div
          aria-hidden
          className="pointer-events-none absolute group-data-[staged]/hero:fixed start-[var(--hero-x)] bottom-[calc(var(--figure-h)*(1-var(--hero-head)))] -z-10 size-[min(64svh,48vw)] -translate-x-1/2 translate-y-1/2 max-md:size-[calc(var(--figure-h)*0.66)] rtl:translate-x-1/2"
        >
          <div data-hero-disc className="size-full rounded-full bg-site-red" />
          {ring ? (
            // A ring of words inside the disc's rim, in ink on the red, turned
            // by the motion.
            <svg
              data-hero-ring
              data-ring-once={ringOnce}
              aria-hidden
              viewBox="0 0 100 100"
              className="absolute inset-0 size-full overflow-visible text-site-on-red/70"
            >
              <defs>
                <path
                  id="hero-ring-path"
                  d="M50 50m-44 0a44 44 0 1 1 88 0a44 44 0 1 1 -88 0"
                />
              </defs>
              {/* The path runs one way in every language; Arabic words still read right to left along it. */}
              <text
                direction="ltr"
                className="fill-current font-sans text-[3.3px] font-semibold tracking-[0.16em] uppercase [[lang=ar]_&]:text-[4px] [[lang=ar]_&]:tracking-normal"
              >
                <textPath href="#hero-ring-path">{ring}</textPath>
              </text>
            </svg>
          ) : null}
        </div>

        <h1
          id="hero-name"
          aria-label={name}
          data-hero-name
          className="site-display pointer-events-none absolute start-[var(--site-pad)] top-[max(5.5rem,16svh)] z-10 text-site-hero text-site-fg max-md:top-[4.75rem]"
        >
          <span data-hero-first aria-hidden className="block">
            {firstName}
          </span>
          <span
            data-hero-last
            aria-hidden
            className="block ps-[0.6em] italic max-md:ps-0"
          >
            {lastName}
          </span>
        </h1>

        {photo ? (
          <div className="pointer-events-none absolute group-data-[staged]/hero:fixed start-[var(--hero-x)] bottom-0 z-20 h-[var(--figure-h)] -translate-x-1/2 rtl:translate-x-1/2">
            <div
              data-hero-figure
              className="relative h-full aspect-[var(--figure-aspect,2/3)]"
            >
              <Image
                src={assetUrl(photo.url)}
                alt={photo.alt}
                fill
                priority
                unoptimized={!isStoredUpload(photo.url)}
                sizes="(max-width: 760px) 90vw, 60vh"
                className="object-contain object-bottom select-none"
              />
            </div>
          </div>
        ) : null}

        <div
          data-hero-details
          className="pointer-events-none absolute inset-x-[var(--site-pad)] bottom-[clamp(24px,5vh,48px)] z-30 flex items-end justify-between gap-8 max-md:top-[calc(4.75rem+2*var(--text-site-hero)*var(--display-leading,0.86)+24px)] max-md:bottom-auto max-md:flex-col max-md:items-start max-md:gap-5"
        >
          <div className="pointer-events-auto grid max-w-[21rem] gap-5 max-md:max-w-none max-md:gap-4">
            {headline ? (
              <p className="text-[clamp(1.125rem,0.95rem+0.6vw,1.5rem)] leading-snug font-medium text-balance text-site-fg">
                {headline}
              </p>
            ) : null}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              {actions.work ? (
                <a
                  href="#work"
                  data-magnetic
                  className="group inline-flex items-center gap-3 rounded-full bg-site-red px-5 py-3 text-sm font-semibold text-site-on-red transition-[gap] duration-500 hover:gap-4 focus-visible:ring-2 focus-visible:ring-site-red focus-visible:ring-offset-4 focus-visible:ring-offset-site-bg focus-visible:outline-none"
                >
                  {actions.work}
                  <span aria-hidden className="arrow-pass [--ax:0] [--ay:1]">
                    ↓
                  </span>
                </a>
              ) : null}
              <a
                href="#contact"
                className="group link-line pb-0.5 text-sm font-medium text-site-fg"
              >
                {actions.contact}{' '}
                <span aria-hidden className="arrow-pass rtl:-scale-x-100">
                  →
                </span>
              </a>
            </div>
          </div>
          {facts.length ? (
            <dl className="pointer-events-auto grid gap-3 text-sm max-md:grid-flow-col max-md:gap-6 md:text-end">
              {facts.map((fact) => (
                <div key={fact.label} className="grid gap-0.5">
                  <dt className="site-label text-site-muted">{fact.label}</dt>
                  <dd className="inline-flex items-center gap-2 font-medium text-site-fg md:justify-end">
                    {fact.open === undefined ? null : (
                      <i
                        aria-hidden
                        className={`size-2 shrink-0 rounded-full border border-site-red ${fact.open ? 'bg-site-red' : ''}`}
                      />
                    )}
                    {fact.value}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
      </div>
    </section>
  );
}
