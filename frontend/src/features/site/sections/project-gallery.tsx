'use client';

import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';

import { StoredImage } from '@/components/stored-image';

export type Shot = { url: string; alt: string };

/**
 * A project's images: the cover, revealed from its foot (`clip-reveal`, driven by
 * the motion), and the rest as thumbnails. Each opens the viewer, a native modal
 * dialog - focus held inside, Escape closes, focus returns.
 */
export function ProjectGallery({
  title,
  shots,
  priority = false,
  open = false,
}: {
  title: string;
  shots: Shot[];
  priority?: boolean;
  /** Shown at once, without the reveal: for the project's own page. */
  open?: boolean;
}) {
  const t = useTranslations('home.work');
  const dialog = useRef<HTMLDialogElement>(null);
  const [at, setAt] = useState(0);

  const [cover, ...rest] = shots;

  if (!cover) {
    return null;
  }

  const shown = shots[at] ?? cover;
  const show = (index: number) => {
    setAt(index);
    dialog.current?.showModal();
  };
  const step = (by: number) =>
    setAt((index) => (index + by + shots.length) % shots.length);

  return (
    <div>
      <button
        type="button"
        data-clip={open ? undefined : ''}
        data-cursor="view"
        onClick={() => show(0)}
        aria-label={t('openImages', { title })}
        className="group clip-reveal relative block w-full cursor-zoom-in overflow-hidden rounded-[20px] bg-site-raise outline-none focus-visible:ring-2 focus-visible:ring-site-red focus-visible:ring-offset-4 focus-visible:ring-offset-site-bg"
      >
        <StoredImage
          src={cover.url}
          alt={cover.alt}
          sizes="(max-width: 760px) 100vw, 58vw"
          priority={priority}
          className="aspect-[3/2] transition-[scale] duration-[1200ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.03] group-focus-visible:scale-[1.03]"
        />
      </button>
      {rest.length ? (
        <div className="mt-3 flex flex-wrap gap-2.5" data-reveal>
          {rest.map((shot, index) => (
            <button
              key={shot.url}
              type="button"
              onClick={() => show(index + 1)}
              aria-label={t('openImage', { number: index + 2, alt: shot.alt })}
              data-cursor="view"
              className="group w-28 cursor-zoom-in overflow-hidden rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-site-red"
            >
              <StoredImage
                src={shot.url}
                alt=""
                sizes="112px"
                className="aspect-[16/10] transition-[scale] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.06] group-focus-visible:scale-[1.06]"
              />
            </button>
          ))}
        </div>
      ) : null}

      <dialog
        ref={dialog}
        aria-label={title}
        onClick={(event) =>
          event.target === dialog.current && dialog.current?.close()
        }
        onKeyDown={(event) => {
          if (event.key === 'ArrowLeft') step(-1);
          if (event.key === 'ArrowRight') step(1);
        }}
        className="m-0 h-svh max-h-none w-screen max-w-none bg-site-bg p-0 text-site-fg backdrop:bg-site-bg/80 open:grid open:grid-rows-[1fr_auto]"
      >
        <figure className="grid min-h-0 place-items-center gap-3 p-[var(--site-pad)]">
          <StoredImage
            src={shown.url}
            alt={shown.alt}
            sizes="100vw"
            fit="contain"
            className="size-full min-h-0"
          />
          <figcaption className="site-label text-site-muted">
            {shown.alt}
          </figcaption>
        </figure>
        <div className="site-label flex items-center justify-center gap-4 p-4">
          {shots.length > 1 ? (
            <button
              type="button"
              onClick={() => step(-1)}
              aria-label={t('previous')}
              className="rounded-full bg-site-raise px-4 py-2 transition-colors hover:bg-site-red hover:text-site-on-red focus-visible:bg-site-red focus-visible:text-site-on-red focus-visible:outline-none"
            >
              <span aria-hidden className="inline-block rtl:-scale-x-100">
                ←
              </span>
            </button>
          ) : null}
          <span>
            {String(at + 1).padStart(2, '0')} /{' '}
            {String(shots.length).padStart(2, '0')}
          </span>
          {shots.length > 1 ? (
            <button
              type="button"
              onClick={() => step(1)}
              aria-label={t('next')}
              className="rounded-full bg-site-raise px-4 py-2 transition-colors hover:bg-site-red hover:text-site-on-red focus-visible:bg-site-red focus-visible:text-site-on-red focus-visible:outline-none"
            >
              <span aria-hidden className="inline-block rtl:-scale-x-100">
                →
              </span>
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => dialog.current?.close()}
            className="rounded-full bg-site-raise px-4 py-2 transition-colors hover:bg-site-red hover:text-site-on-red focus-visible:bg-site-red focus-visible:text-site-on-red focus-visible:outline-none"
          >
            {t('close')}
          </button>
        </div>
      </dialog>
    </div>
  );
}
