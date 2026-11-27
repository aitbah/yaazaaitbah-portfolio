'use client';

import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import Lenis from 'lenis';

import { measureFigure, type FigureShape } from './figure';

gsap.registerPlugin(ScrollTrigger, SplitText, useGSAP);

const $ = <T extends Element = HTMLElement>(
  selector: string,
  root: ParentNode = document,
) => root.querySelector<T>(selector);
const $$ = <T extends Element = HTMLElement>(
  selector: string,
  root: ParentNode = document,
) => [...root.querySelectorAll<T>(selector)];

/** The page margin, as `--site-pad` resolves it. */
const sitePad = (vw: number) => Math.min(52, Math.max(16, vw * 0.032));

/** Wide enough for pins that only read on a large screen. */
const WIDE = '(min-width: 760px)';

/** The bar's height, which pinned cards keep clear of. */
const BAR = 88;

/**
 * The order pins are measured in, highest first: top to bottom. A trigger is
 * placed from the page as it stands when it is measured, so one below a pin
 * measured before the pin's room was added starts early by that room (the
 * timeline ran a screen ahead at laptop sizes, and was right only zoomed out,
 * where the rail is shorter). Every other trigger is measured after them all.
 */
const PIN_ORDER = { cards: 2, rail: 1 } as const;

/** A loaded image, or `null` if it never loads. */
function loaded(
  img: HTMLImageElement | null,
): Promise<HTMLImageElement | null> {
  if (!img) return Promise.resolve(null);
  if (img.complete && img.naturalWidth) return Promise.resolve(img);

  return new Promise((resolve) => {
    img.addEventListener('load', () => resolve(img), { once: true });
    img.addEventListener('error', () => resolve(null), { once: true });
  });
}

/** Resolves on the next frame: lets the page draw between two pieces of work. */
const nextFrame = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

/** The width an element's content takes, whatever its box does. */
function inkWidth(element: Element): number {
  const range = document.createRange();

  range.selectNodeContents(element);

  return range.getBoundingClientRect().width || 1;
}

/** The width a row of boxes takes, laid out: their transforms left aside. */
function rowWidth(element: Element): number {
  const parts = [...element.children] as HTMLElement[];
  const gap = parseFloat(getComputedStyle(element).columnGap) || 0;

  return (
    parts.reduce((sum, part) => sum + part.offsetWidth, 0) +
      gap * Math.max(0, parts.length - 1) || 1
  );
}

/**
 * Sets an element's font size so its content is `width` wide, within a cap.
 * Measured again at the size it lands on: the display face changes its
 * letters' widths with its optical size, so a width read at one size is not
 * the width at another (a phone's email ran past the screen).
 */
function fitWidth(
  element: HTMLElement,
  width: number,
  maxSize: number,
  measure: (element: Element) => number = inkWidth,
) {
  let size = 100;

  for (let pass = 0; pass < 4; pass += 1) {
    element.style.fontSize = `${size}px`;
    const next = Math.min((size * width) / measure(element), maxSize);

    if (Math.abs(next - size) < 0.25) break;
    size = next;
  }
  element.style.fontSize = `${Math.min(size, maxSize).toFixed(2)}px`;
}

/** How much a disc of this box must grow to cover the screen from its centre. */
function coverScale(box: DOMRect): number {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const cx = box.left + box.width / 2;
  const cy = box.top + box.height / 2;
  const far = Math.max(
    Math.hypot(cx, cy),
    Math.hypot(vw - cx, cy),
    Math.hypot(cx, vh - cy),
    Math.hypot(vw - cx, vh - cy),
  );

  return ((far * 2) / Math.max(1, box.width)) * 1.04;
}

/**
 * The home page's motion, in one place: GSAP and ScrollTrigger for the
 * choreography, SplitText for letters, words and lines, Lenis as the one
 * smooth-scroll engine. It reads the server-rendered page by its `data-`
 * attributes and adds nothing the page needs: without it every section is
 * complete. Under reduced motion nothing moves, and the opening is still
 * placed from the photograph.
 *
 * The choreography: the loading disc becomes the opening's disc; the opening
 * pins while its disc grows until red fills the screen, and About begins on
 * red; titles rise line by line; featured cards pin and stack; images drift;
 * the other projects pass sideways; the expertise runs in kinetic lines; the
 * timeline's red line draws as it is read; the footer's name closes up.
 */
export function HomeMotion() {
  useGSAP((_context, contextSafe) => {
    const root = document.documentElement;
    const reduce = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    const fine = window.matchMedia('(pointer: fine)').matches;
    const rtl = root.dir === 'rtl';
    const dir = rtl ? -1 : 1;
    // Letters cannot be split apart in Arabic, whose letters join; words can.
    const joined = root.lang === 'ar';
    // A recorder drives the scroll itself, frame by frame.
    const capture = new URLSearchParams(window.location.search).has('capture');
    const cleanups: (() => void)[] = [];
    const media = gsap.matchMedia();
    let cancelled = false;

    const section = $('[data-hero]');
    const stage = $('[data-hero-stage]');
    const firstEl = $('[data-hero-first]');
    const lastEl = $('[data-hero-last]');
    const figureEl = $('[data-hero-figure]');
    const discEl = $('[data-hero-disc]');
    const details = $$('[data-hero-details]');
    const bar = $('[data-site-bar]');

    // --- The cover ---
    // The inline script armed this document's cover and counts the load. A
    // client-side return to the page renders a new cover, which nothing
    // armed: it is held here, without a count, while the page composes.
    const cover = $('[data-site-loader]');
    const handle = window.__siteLoader;
    const fresh = Boolean(cover) && handle?.cover !== cover;

    if (fresh) root.setAttribute('data-loader', 'quick');
    // Not covered when the cover has already given way by itself: then what is
    // on screen stays, and nothing is hidden to be shown again.
    const covered = Boolean(cover) && (fresh || handle?.state !== 'done');
    // This document's cover, still counting: told each milestone as it is passed.
    const counting = covered && !fresh;

    if (counting) handle?.reach('running');

    cleanups.push(() => {
      if (fresh) root.removeAttribute('data-loader');
    });

    let lenis: Lenis | null = null;

    if (!reduce && !capture) {
      lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.95 });
      lenis.on('scroll', () => ScrollTrigger.update());
      const raf = (time: number) => lenis?.raf(time * 1000);

      gsap.ticker.add(raf);
      gsap.ticker.lagSmoothing(0);
      // Still while covered: the page opens where it was asked to.
      if (covered) lenis.stop();
      cleanups.push(() => {
        gsap.ticker.remove(raf);
        lenis?.destroy();
      });
    }

    // A jump the reader asked for: the bar stays in place while it travels.
    let steering = false;

    // In-page links travel through the smooth scroll rather than jumping.
    const onAnchor = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest<HTMLAnchorElement>(
        'a[href^="#"]',
      );

      if (!link || !lenis) return;
      const hash = link.getAttribute('href') ?? '';
      const target =
        hash === '#top' ? 0 : document.getElementById(hash.slice(1));

      if (target === null) return;
      event.preventDefault();
      steering = true;
      lenis.scrollTo(target, {
        duration: 1.6,
        onComplete: () => {
          steering = false;
        },
      });
    };

    document.addEventListener('click', onAnchor);
    cleanups.push(() => document.removeEventListener('click', onAnchor));

    // --- Splitting ---
    // The name in letters (words in Arabic), each in a mask: the way in moves
    // the letters inside their masks, the scroll moves the masks.
    const nameSplits = reduce
      ? []
      : [firstEl, lastEl]
          .filter((el): el is HTMLElement => Boolean(el))
          .map((el) =>
            SplitText.create(el, {
              type: joined ? 'words' : 'chars',
              mask: joined ? 'words' : 'chars',
              aria: 'none',
            }),
          );
    const nameParts = nameSplits.flatMap(
      (split) => (joined ? split.words : split.chars) as HTMLElement[],
    );
    const nameMasks = nameSplits.flatMap(
      (split) => split.masks as HTMLElement[],
    );
    const ring = $<SVGElement>('[data-hero-ring]');

    // --- Sizes that depend on the type ---
    const fitAll = () => {
      const vw = window.innerWidth;
      const width = vw - 2 * sitePad(vw);
      const mail = $('[data-mail]');

      if (mail) {
        // The underline is the link's second child; the address is its text.
        fitWidth(mail, width, Math.min(208, window.innerHeight * 0.2));
      }

      const signature = $('[data-signature]');

      // By its parts' own widths: the halves are offset while they close in,
      // and an offset is not width.
      if (signature)
        fitWidth(signature, width, window.innerHeight * 0.32, rowWidth);
    };

    // The ring of words fills its circle exactly: as many turns of its text
    // as fit, the rest shared out between the words.
    const fitRing = () => {
      const text = ring ? $<SVGTextElement>('text', ring) : null;
      const path = text ? $('textPath', text) : null;
      const once = ring?.getAttribute('data-ring-once') ?? '';

      if (!text || !path || !once) return;
      const circle = 2 * Math.PI * 44;

      text.style.wordSpacing = '0px';
      path.textContent = once;
      const turns = Math.max(
        1,
        Math.floor(circle / text.getComputedTextLength()),
      );

      path.textContent = once.repeat(turns);
      const words = once.trim().split(/\s+/).length * turns;

      text.style.wordSpacing = `${Math.max(0, (circle - text.getComputedTextLength()) / words).toFixed(3)}px`;
    };

    // --- The opening ---
    let shape: FigureShape | null = null;

    // The disc's height follows the head, and the figure moves so the head is
    // on the disc's centre line: both read from the photograph.
    const placeHero = () => {
      if (!stage || !shape) return;
      stage.style.setProperty(
        '--hero-head',
        Math.min(0.45, Math.max(0.12, shape.head.eye + 0.04)).toFixed(4),
      );
      if (figureEl)
        gsap.set(figureEl, { xPercent: (0.5 - shape.head.cx) * 100 * dir });
    };

    // Plays the opening's way in; set by `buildHero` when there is one to play.
    let introduce = () => {};

    const buildHero = () => {
      if (!stage || !section || reduce) return;
      const discBox = () =>
        (discEl?.parentElement ?? stage).getBoundingClientRect();

      // Held while the disc grows until red fills the screen. The portrait
      // sinks below the screen's edge - its straight foot never shows - the
      // name parts, and the next chapter begins on red.
      //
      // That chapter is red too, so it is drawn up beneath the opening; once
      // red covers the screen the opening drops behind it, and the biography
      // rises red on red with no screen of empty red to scroll through.
      const about = $('#about');

      const behind = (on: boolean) =>
        section.toggleAttribute('data-behind', on);

      // Held by `sticky`, not by a pin: the section gives the stage the room
      // to be held through, and the portrait and the disc stand fixed on the
      // screen's own foot (`hero.tsx`).
      section.setAttribute('data-staged', '');
      // As height, not padding: a sticky element travels only within its
      // parent's content.
      section.style.height = 'calc(100lvh + 85svh)';
      if (about) about.style.marginTop = '-25svh';
      cleanups.push(() => {
        section.removeAttribute('data-staged');
        section.removeAttribute('data-behind');
        section.style.height = '';
        if (about) about.style.marginTop = '';
      });

      // Fixed, they would stay on screen for good: once About has covered the
      // screen (or the opening has gone, with no About), they step out, and
      // back on the way up.
      const fixedLayers = [
        discEl?.parentElement,
        figureEl?.parentElement,
      ].filter((el): el is HTMLElement => Boolean(el));

      ScrollTrigger.create({
        trigger: about ?? section,
        start: about ? 'top top' : 'bottom top',
        onEnter: () => gsap.set(fixedLayers, { autoAlpha: 0 }),
        onLeaveBack: () => gsap.set(fixedLayers, { autoAlpha: 1 }),
      });
      cleanups.push(() => {
        gsap.set(fixedLayers, { clearProps: 'opacity,visibility' });
      });
      heroEnd = () => hero.scrollTrigger?.end ?? 80;
      const hero = gsap.timeline({
        scrollTrigger: {
          trigger: section,
          start: 'top top',
          // As long as the stage is held: the room the section gives it.
          end: () =>
            `+=${Math.max(1, section.offsetHeight - stage.offsetHeight)}`,
          scrub: 0.9,
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            bar?.toggleAttribute('data-hero-red', self.progress > 0.86);
            if (about) behind(self.progress > 0.88);
            markRed();
          },
        },
      });

      if (discEl)
        hero.to(
          discEl,
          {
            scale: () => coverScale(discBox()),
            ease: 'power2.in',
            duration: 0.8,
          },
          0,
        );
      if (figureEl)
        hero.to(
          figureEl,
          {
            // Solid all the way: it sinks below the screen's edge, never fades.
            yPercent: 104,
            ease: 'power2.in',
            duration: 0.7,
          },
          0.05,
        );
      // The name's letters scatter, each its own way (fixed by its place,
      // so the same each time), from the middle out.
      if (nameMasks.length)
        hero.to(
          nameMasks,
          {
            yPercent: (i: number) => -50 - ((i * 37) % 80),
            xPercent: (i: number) => (((i * 53) % 70) - 35) * dir,
            rotate: (i: number) => ((i * 29) % 60) - 30,
            autoAlpha: 0,
            ease: 'power2.in',
            duration: 0.5,
            stagger: { each: 0.012, from: 'center' },
          },
          0,
        );
      // The ring opens out and goes as the disc grows through it.
      if (ring)
        hero.to(
          ring,
          { scale: 1.7, autoAlpha: 0, ease: 'power1.in', duration: 0.45 },
          0,
        );
      hero.to(
        details,
        { autoAlpha: 0, y: 28, ease: 'power1.in', duration: 0.35 },
        0,
      );
      // A last stretch on red before the pin lets go.
      hero.to({}, { duration: 0.1 }, 0.8);

      // The pointer: the figure and the disc part slightly, for depth.
      if (fine && figureEl && discEl) {
        const figX = gsap.quickTo(figureEl, 'x', {
          duration: 1.1,
          ease: 'power3',
        });
        const discX = gsap.quickTo(discEl, 'x', {
          duration: 1.4,
          ease: 'power3',
        });
        const discY = gsap.quickTo(discEl, 'y', {
          duration: 1.4,
          ease: 'power3',
        });
        const onMove = contextSafe!((event: PointerEvent) => {
          const k = Math.max(0, 1 - (hero.scrollTrigger?.progress ?? 0) * 4);
          const nx = (event.clientX / window.innerWidth - 0.5) * 2;
          const ny = (event.clientY / window.innerHeight - 0.5) * 2;

          figX(nx * 10 * k);
          discX(-nx * 22 * k);
          discY(-ny * 14 * k);
        });
        const onLeave = contextSafe!(() => {
          figX(0);
          discX(0);
          discY(0);
        });

        stage.addEventListener('pointermove', onMove);
        stage.addEventListener('pointerleave', onLeave);
        cleanups.push(() => {
          stage.removeEventListener('pointermove', onMove);
          stage.removeEventListener('pointerleave', onLeave);
        });
      }

      // The letters near the pointer grow heavier, as if pressed: the
      // display face's weight is a range, not a step. Not in Arabic, whose
      // display face has two weights.
      if (fine && !joined && nameParts.length) {
        const weights = nameParts.map((part) =>
          gsap.quickTo(part, 'fontWeight', { duration: 0.7, ease: 'power3' }),
        );
        const onPress = (event: PointerEvent) => {
          nameParts.forEach((part, i) => {
            const box = part.getBoundingClientRect();
            const d = Math.hypot(
              event.clientX - (box.left + box.width / 2),
              event.clientY - (box.top + box.height / 2),
            );

            weights[i]!(400 + 380 * Math.max(0, 1 - d / 300));
          });
        };
        const onRelease = () => weights.forEach((weight) => void weight(400));

        stage.addEventListener('pointermove', onPress);
        stage.addEventListener('pointerleave', onRelease);
        cleanups.push(() => {
          stage.removeEventListener('pointermove', onPress);
          stage.removeEventListener('pointerleave', onRelease);
        });
      }

      // The ring turns slowly, and faster for a moment when the page moves;
      // it rests when the opening is out of sight.
      if (ring) {
        const spin = gsap.to(ring, {
          rotation: 360 * dir,
          duration: 48,
          ease: 'none',
          repeat: -1,
          transformOrigin: '50% 50%',
        });

        ScrollTrigger.create({
          trigger: section,
          start: 'top top',
          end: () => `+=${window.innerHeight * 1.2}`,
          onToggle: (self) => (self.isActive ? spin.play() : spin.pause()),
          onUpdate: (self) => {
            spin.timeScale(
              1 + Math.min(14, Math.abs(self.getVelocity()) / 120),
            );
            gsap.to(spin, {
              timeScale: 1,
              duration: 1.2,
              ease: 'power2.out',
              overwrite: true,
            });
          },
        });
      }

      // The way in, once the disc has landed: the portrait rises from below
      // the screen's edge, solid, in front of the disc; the name's letters
      // come up, then the
      // statement, the facts and the bar. Built paused, under the cover, and
      // played as the page opens; not at all once the page is showing, which
      // would hide it to show it again.
      //
      // It moves only what the scroll does not: the photograph inside the
      // figure, the letters inside the name, the parts inside the details,
      // and the bar's opacity (its stepping away is `y`). A tween sharing a
      // property with the scroll's timeline would hand it its hidden state as
      // the place to return to.
      if (cover && !covered) return;
      const intro = gsap.timeline({ paused: true });
      const photograph = figureEl ? $('img', figureEl) : null;

      introduce = () => {
        intro.play();
      };
      // From wholly below the edge, as the cover lifts away from the foot up.
      if (photograph)
        intro.from(
          photograph,
          { yPercent: 100, duration: 1.6, ease: 'expo.out' },
          0.5,
        );
      // The letters come up in a wave, each tipping upright as it lands.
      intro.from(
        nameParts,
        {
          yPercent: 120,
          rotate: 12 * dir,
          transformOrigin: rtl ? '100% 100%' : '0% 100%',
          duration: 1.3,
          ease: 'expo.out',
          stagger: 0.035,
        },
        0.55,
      );
      const ringText = ring ? $('text', ring) : null;

      if (ringText)
        intro.from(
          ringText,
          { autoAlpha: 0, duration: 1.4, ease: 'power2.out' },
          0.7,
        );
      intro.from(
        details.flatMap((part) => [...part.children]),
        { autoAlpha: 0, y: 24, duration: 1.1, ease: 'expo.out', stagger: 0.08 },
        0.95,
      );
      if (bar) intro.from(bar, { autoAlpha: 0, duration: 1 }, 1.05);
    };

    // Where the opening's pin lets go: the bar's scrim waits until then.
    let heroEnd = () => 80;

    // --- The bar, red over red ---
    const redZones = $$('[data-red-zone]');
    const markRed = () => {
      if (!bar) return;
      const line = bar.getBoundingClientRect().bottom / 2;
      const over =
        (bar.hasAttribute('data-hero-red') &&
          !!stage &&
          stage.getBoundingClientRect().bottom >= line) ||
        redZones.some((zone) => {
          const box = zone.getBoundingClientRect();

          return box.top <= line && box.bottom >= line;
        });

      bar.toggleAttribute('data-on-red', over);
    };

    // --- Everything below the opening ---

    const buildSections = () => {
      if (reduce) return;

      // The biography, lit word by word as each paragraph is read.
      for (const lead of $$('[data-lead]')) {
        const words = SplitText.create(lead, {
          type: 'words',
          wordsClass: 'word',
          aria: 'auto',
        }).words as HTMLElement[];
        let lit = 0;

        ScrollTrigger.create({
          trigger: lead,
          start: 'top 82%',
          end: 'bottom 48%',
          onUpdate: (self) => {
            const n = Math.round(self.progress * words.length);

            for (let i = Math.min(n, lit); i < Math.max(n, lit); i += 1)
              words[i]!.toggleAttribute('data-lit', n > lit);
            lit = n;
          },
        });
      }

      // Titles rise letter by letter (word by word in Arabic) as they come
      // into view, each tipping upright - tied to the scroll, so going back
      // up takes them down again.
      for (const title of $$('[data-lines]')) {
        const split = SplitText.create(title, {
          type: joined ? 'lines,words' : 'lines,chars',
          mask: 'lines',
          aria: 'auto',
        });

        gsap.fromTo(
          joined ? split.words : split.chars,
          {
            yPercent: 115,
            rotate: 8 * dir,
            transformOrigin: rtl ? '100% 100%' : '0% 100%',
          },
          {
            yPercent: 0,
            rotate: 0,
            ease: 'power3.out',
            stagger: 0.04,
            scrollTrigger: {
              trigger: title,
              start: 'top 94%',
              end: 'top 58%',
              scrub: 0.8,
            },
          },
        );
      }

      // Images drift within their frames as they pass.
      for (const layer of $$('[data-parallax]')) {
        gsap.fromTo(
          layer,
          { yPercent: -6 },
          {
            yPercent: 6,
            ease: 'none',
            scrollTrigger: {
              trigger: layer.parentElement,
              start: 'top bottom',
              end: 'bottom top',
              scrub: true,
            },
          },
        );
      }

      // An image revealed from its foot as it comes up the screen.
      for (const image of $$('[data-clip]')) {
        gsap.fromTo(
          image,
          { '--reveal': 0 },
          {
            '--reveal': 1,
            ease: 'power2.out',
            scrollTrigger: {
              trigger: image,
              start: 'top 95%',
              end: 'top 45%',
              scrub: 0.8,
            },
          },
        );
      }

      // The expertise's kinetic lines, each driven sideways by the scroll.
      const marquees = $('[data-marquees]');

      if (marquees) {
        for (const row of $$('[data-marquee]', marquees)) {
          // Each row holds its names twice, so half its width is a full turn;
          // right to left, the second copy lies to the left.
          const forward = Number(row.dataset.marquee) > 0;
          const turn = -50 * dir;

          gsap.fromTo(
            row,
            { xPercent: forward ? 0 : turn },
            {
              xPercent: forward ? turn : 0,
              ease: 'none',
              scrollTrigger: {
                trigger: marquees,
                start: 'top bottom',
                end: 'bottom top',
                scrub: 0.6,
              },
            },
          );
        }

        // They lean with the scroll's speed, and straighten when it stops.
        const leans = $$('[data-marquee]', marquees).map((row) =>
          gsap.quickTo(row, 'skewX', { duration: 0.6, ease: 'power3' }),
        );
        const straighten = gsap.delayedCall(0.18, () =>
          leans.forEach((lean) => void lean(0)),
        );

        ScrollTrigger.create({
          trigger: marquees,
          start: 'top bottom',
          end: 'bottom top',
          onUpdate: (self) => {
            const lean = gsap.utils.clamp(-9, 9, self.getVelocity() / -260);

            leans.forEach((set) => void set(lean));
            straighten.restart(true);
          },
        });
      }

      // The email arrives letter by letter as Contact comes up.
      const mail = $('[data-mail]');

      if (mail) {
        const letters = SplitText.create(mail, { type: 'chars', aria: 'auto' })
          .chars as HTMLElement[];

        gsap.fromTo(
          letters,
          { yPercent: 70, rotate: 10 * dir, autoAlpha: 0 },
          {
            yPercent: 0,
            rotate: 0,
            autoAlpha: 1,
            ease: 'power3.out',
            stagger: 0.03,
            scrollTrigger: {
              trigger: mail,
              start: 'top 94%',
              end: 'top 55%',
              scrub: 0.8,
            },
          },
        );
      }

      // The timeline's red line draws as it is read; each stop fills as the
      // line reaches it.
      const timeline = $('[data-timeline]');
      const line = $('[data-timeline-line]');

      if (timeline && line) {
        gsap.fromTo(
          line,
          { scaleY: 0 },
          {
            scaleY: 1,
            ease: 'none',
            scrollTrigger: {
              trigger: timeline,
              start: 'top 65%',
              end: 'bottom 65%',
              scrub: 0.4,
            },
          },
        );
        for (const stop of $$('[data-stop]', timeline)) {
          const mark = $('[data-stop-mark]', stop);

          ScrollTrigger.create({
            trigger: stop,
            start: 'top 65%',
            onToggle: (self) =>
              mark?.toggleAttribute('data-reached', self.isActive),
            end: () => `+=${document.documentElement.scrollHeight}`,
          });
        }
      }

      // A language's level fills mark by mark as it is read, and empties on
      // the way back up.
      for (const steps of $$('[data-steps]')) {
        const on = $$('[data-step="on"] > span', steps);

        if (!on.length) continue;
        gsap.fromTo(
          on,
          { scale: 0 },
          {
            scale: 1,
            ease: 'back.out(2.5)',
            stagger: 0.6,
            scrollTrigger: {
              trigger: steps,
              start: 'top 92%',
              end: 'top 60%',
              scrub: 0.5,
            },
          },
        );
      }

      // The footer's name closes up as it arrives.
      const signature = $('[data-signature]');

      if (signature) {
        gsap
          .timeline({
            scrollTrigger: {
              trigger: signature.closest('footer'),
              start: 'top bottom',
              end: 'bottom bottom',
              scrub: 0.8,
            },
          })
          .fromTo(
            $$('[data-sign-first]'),
            { xPercent: -30 * dir },
            { xPercent: 0, ease: 'power2.out' },
            0,
          )
          .fromTo(
            $$('[data-sign-last]'),
            { xPercent: 30 * dir },
            { xPercent: 0, ease: 'power2.out' },
            0,
          );
      }

      // The featured cards stack: a pin that only reads on a wide screen,
      // made and unmade as the width crosses the line.
      media.add(WIDE, () => {
        const cards = $$('[data-card]');
        const last = cards.at(-1);

        cards.forEach((card, i) => {
          card.style.zIndex = String(i + 1);
          const next = cards[i + 1];

          if (!next || !last) return;
          ScrollTrigger.create({
            trigger: card,
            start: `top top+=${BAR}`,
            endTrigger: last,
            end: `top top+=${BAR}`,
            pin: true,
            pinSpacing: false,
            refreshPriority: PIN_ORDER.cards,
          });
          gsap.to($('[data-card-body]', card), {
            scale: 0.9,
            autoAlpha: 0.35,
            ease: 'none',
            scrollTrigger: {
              trigger: next,
              start: 'top bottom',
              end: `top top+=${BAR}`,
              scrub: true,
            },
          });
        });

        return () => {
          for (const card of cards) card.style.zIndex = '';
        };
      });

      // The other projects pass sideways, on every width: the rail pins and
      // the scroll drives it, held still a moment at each end so the first
      // and last cards are read at rest. Each card settles in as it enters,
      // and a line under the rail says how far along it is. Without the
      // motion it scrolls sideways by hand.
      const rail = $('[data-rail]');
      const railSection = $('[data-rail-section]');
      const view = $('[data-rail-view]');

      if (rail && railSection && view) {
        const distance = () => Math.max(0, rail.scrollWidth - view.clientWidth);
        const progress = $('[data-rail-progress]', railSection);

        railSection.setAttribute('data-pinned', '');
        view.scrollLeft = 0;
        // Each card settles in over the first stretch of the screen it
        // enters: read from where it is, so it holds whatever the scrub does.
        const cards = $$('[data-rail-card]', rail);
        const settle = () => {
          const vw = window.innerWidth;

          for (const card of cards) {
            const box = card.getBoundingClientRect();
            const entered = rtl ? box.right : vw - box.left;
            // Settled once most of it is in: the last card ends against the
            // far edge and must end settled, on any width.
            const f = Math.min(
              1,
              Math.max(0, entered / Math.min(vw * 0.3, box.width * 0.8)),
            );

            gsap.set(card, {
              yPercent: 10 * (1 - f),
              rotate: 2.5 * dir * (1 - f),
              opacity: 0.45 + 0.55 * f,
            });
          }
        };
        const travel = gsap.timeline({
          defaults: { ease: 'none' },
          onUpdate: settle,
          scrollTrigger: {
            trigger: railSection,
            start: 'top top',
            // A little more scroll than travel, so the cards move a touch
            // slower than the page did.
            end: () => `+=${distance() * 1.15 + window.innerHeight * 0.3}`,
            pin: true,
            pinSpacing: true,
            anticipatePin: 1,
            refreshPriority: PIN_ORDER.rail,
            scrub: 0.6,
            invalidateOnRefresh: true,
          },
        });

        travel
          .to(
            rail,
            { x: () => (rtl ? distance() : -distance()), duration: 1 },
            0.12,
          )
          .to({}, { duration: 0.12 }, 1.12);
        if (progress)
          travel.fromTo(
            progress,
            { scaleX: 0 },
            { scaleX: 1, duration: 1 },
            0.12,
          );

        settle();
        ScrollTrigger.addEventListener('refresh', settle);
        cleanups.push(() => {
          ScrollTrigger.removeEventListener('refresh', settle);
          railSection.removeAttribute('data-pinned');
          gsap.set(cards, { clearProps: 'transform,opacity' });
        });
      }

      // The expertise's tiles come in one by one, tied to the scroll: each
      // rises and then fills its ring as it comes up the screen, the next in
      // its row a little further up than the one before (by its place in the
      // reading order), so a row arrives tile by tile - and going back up
      // takes them away again in turn. All at once, or in time rather than
      // with the scroll, were each tiring or felt detached.
      const tiles = $$('[data-tile]');
      // A tile's place in its row, and how many share the row: read on each
      // refresh, since the columns follow the width.
      const placeOf = (tile: HTMLElement) => {
        const row = $$('[data-tile]', tile.parentElement!)
          .filter((other) => other.offsetTop === tile.offsetTop)
          .sort((a, b) => (a.offsetLeft - b.offsetLeft) * dir);

        return { at: row.indexOf(tile), of: row.length };
      };
      // How far up the screen a row's last tile starts, past its first.
      const SPREAD = 26;

      for (const tile of tiles) {
        const offset = () => {
          const { at, of } = placeOf(tile);

          return of > 1 ? (at * SPREAD) / (of - 1) : 0;
        };

        gsap
          .timeline({
            scrollTrigger: {
              trigger: tile,
              start: () => `top ${(96 - offset()).toFixed(1)}%`,
              end: () => `top ${(78 - offset()).toFixed(1)}%`,
              scrub: 0.7,
              invalidateOnRefresh: true,
            },
          })
          .fromTo(
            tile,
            { autoAlpha: 0, y: 26 },
            { autoAlpha: 1, y: 0, ease: 'power2.out', duration: 0.6 },
            0,
          )
          .fromTo(
            tile,
            { '--fill': 0 },
            { '--fill': 1, ease: 'power1.inOut', duration: 0.6 },
            0.4,
          );
      }

      // Content comes in with the scroll - rising and clearing as it comes
      // up the screen, and going back down with it - rather than once. Its
      // positions are measured after the pins (`PIN_ORDER`).
      for (const element of $$('[data-reveal]')) {
        gsap.fromTo(
          element,
          { y: 64, autoAlpha: 0 },
          {
            y: 0,
            autoAlpha: 1,
            ease: 'power2.out',
            scrollTrigger: {
              trigger: element,
              start: 'top 98%',
              end: 'top 76%',
              scrub: 0.8,
            },
          },
        );
      }
    };

    // --- The bar, under any motion ---
    const buildBar = () => {
      // The bar: a scrim once the page has moved, red over red, and the
      // section in view marked.
      ScrollTrigger.create({
        start: () => heroEnd(),
        end: 'max',
        onToggle: (self) =>
          bar?.toggleAttribute('data-scrolled', self.isActive),
        onUpdate: markRed,
      });

      for (const link of $$<HTMLAnchorElement>('[data-nav]')) {
        const target = document.getElementById(link.dataset.nav ?? '');

        if (!target) continue;
        ScrollTrigger.create({
          trigger: target,
          start: 'top 50%',
          end: 'bottom 50%',
          onToggle: (self) =>
            self.isActive
              ? link.setAttribute('aria-current', 'true')
              : link.removeAttribute('aria-current'),
        });
      }
      // It steps away while reading down, past the first screen, and returns
      // on the way up - and stays while a jump the reader asked for travels,
      // while it holds the focus, and when the pointer reaches the top edge.
      if (bar && !reduce) {
        let away = false;
        const place = (next: boolean) => {
          if (next === away) return;
          away = next;
          gsap.to(bar, {
            // Its scrim reaches below it: that goes too.
            y: next ? -(bar.offsetHeight + 40) : 0,
            duration: next ? 0.45 : 0.7,
            ease: next ? 'power2.in' : 'expo.out',
            overwrite: 'auto',
          });
        };
        const onFocus = () => place(false);
        const onPointer = (event: PointerEvent) => {
          if (event.clientY < 72) place(false);
        };

        ScrollTrigger.create({
          start: () => window.innerHeight * 2,
          end: 'max',
          onUpdate: (self) =>
            place(
              self.direction === 1 &&
                !steering &&
                !bar.contains(document.activeElement),
            ),
          onLeaveBack: () => place(false),
        });
        bar.addEventListener('focusin', onFocus);
        if (fine) window.addEventListener('pointermove', onPointer);
        cleanups.push(() => {
          bar.removeEventListener('focusin', onFocus);
          window.removeEventListener('pointermove', onPointer);
        });
      }
    };

    // --- The companion ---
    // The Enter key in the corner: shown once the opening has let go, turned
    // a frame at a time as the page scrolls (a full turn every two screens or
    // so), tipped by the scroll's speed, and stepped away wherever it would
    // cover text, a control, an image or red. Under reduced motion it stands
    // still, on one frame, but still steps away.
    const buildCompanion = () => {
      const companion = $('[data-companion]');
      const key = companion ? $('[data-companion-key]', companion) : null;

      if (!companion || !key) return;
      const FRAMES = 36;
      const SIDE = 6;
      const frame = (n: number) => {
        const f = ((Math.round(n) % FRAMES) + FRAMES) % FRAMES;

        key.style.backgroundPosition = `${((f % SIDE) / (SIDE - 1)) * 100}% ${(Math.floor(f / SIDE) / (SIDE - 1)) * 100}%`;
      };
      // What it must never sit on.
      const COVERED =
        'a, button, input, textarea, select, label, p, h1, h2, h3, h4, li, dd, dt, img, svg, [data-card], [data-rail-card], [data-tiles], [data-red-zone], #contact';
      // Any element with words of its own, whatever it is.
      const holdsText = (element: Element) =>
        [...element.childNodes].some(
          (node) =>
            node.nodeType === Node.TEXT_NODE && node.textContent?.trim(),
        );
      const clear = () => {
        if (window.scrollY < heroEnd()) return false;
        const box = companion.getBoundingClientRect();

        return [
          [0.5, 0.5],
          [0.1, 0.1],
          [0.9, 0.1],
          [0.1, 0.9],
          [0.9, 0.9],
        ].every(([fx, fy]) =>
          document
            .elementsFromPoint(
              box.left + box.width * fx!,
              box.top + box.height * fy!,
            )
            .every(
              (element) =>
                companion.contains(element) ||
                !(element.matches(COVERED) || holdsText(element)),
            ),
        );
      };
      let away = true;
      const place = () => {
        const next = !clear();

        if (next === away) return;
        away = next;
        companion.toggleAttribute('data-away', away);
      };
      // Checked a few times a second while the page moves, and once it stops.
      let checking = 0;
      const check = () => {
        window.clearTimeout(checking);
        checking = window.setTimeout(place, 90);
      };

      companion.setAttribute('data-on', '');
      frame(reduce ? 4 : 0);
      const tilt = reduce
        ? null
        : gsap.quickTo(key, 'rotation', { duration: 0.6, ease: 'power3' });
      const settle = gsap.delayedCall(0.2, () => void tilt?.(0));

      ScrollTrigger.create({
        start: 0,
        end: 'max',
        onUpdate: (self) => {
          check();
          if (!tilt) return;
          frame((self.scroll() / (window.innerHeight * 2.2)) * FRAMES);
          void tilt(gsap.utils.clamp(-14, 14, self.getVelocity() / 260));
          settle.restart(true);
        },
      });
      window.addEventListener('resize', check);
      check();
      cleanups.push(() => {
        window.clearTimeout(checking);
        window.removeEventListener('resize', check);
        companion.removeAttribute('data-on');
        companion.setAttribute('data-away', '');
      });
    };

    // Where the address points, once the pins have made room: the browser
    // went there before they existed.
    const land = () => {
      let id = '';

      try {
        id = decodeURIComponent(window.location.hash.slice(1));
      } catch {
        return;
      }
      const target = id && id !== 'top' ? document.getElementById(id) : null;

      if (!target) return;
      const y = target.getBoundingClientRect().top + window.scrollY;

      if (lenis) lenis.scrollTo(y, { immediate: true, force: true });
      else window.scrollTo(0, y);
      ScrollTrigger.update();
    };

    // The cover opens: its red draws in to the opening's own disc and
    // becomes it, and the way in plays around it. A return inside the site,
    // reduced motion or a page without the disc in view: it fades.
    const reveal = () => {
      if (!cover || !covered) {
        introduce();

        return;
      }

      const parts = $$('[data-loader-ground], [data-loader-label]', cover);
      const finish = () => {
        if (fresh) root.removeAttribute('data-loader');
        else handle?.done();
        gsap.set([cover, ...parts], { clearProps: 'all' });
        lenis?.start();
      };
      const target = discEl?.getBoundingClientRect();
      const landsOnScreen =
        target && target.bottom > 0 && target.top < window.innerHeight;

      if (reduce || fresh || !target || !landsOnScreen) {
        gsap.to(cover, {
          autoAlpha: 0,
          duration: reduce ? 0.4 : 0.6,
          ease: 'power1.out',
          onComplete: finish,
        });
        if (!reduce) gsap.delayedCall(0.1, introduce);

        return;
      }

      // The red draws in to the opening's disc: a circle from past the
      // screen's farthest corner down to the disc's own, which lies beneath
      // it in the same red - so where it stops, the disc simply remains.
      const cx = target.left + target.width / 2;
      const cy = target.top + target.height / 2;
      const far =
        Math.hypot(
          Math.max(cx, window.innerWidth - cx),
          Math.max(cy, window.innerHeight - cy),
        ) + 2;
      const at = `${cx.toFixed(1)}px ${cy.toFixed(1)}px`;

      gsap
        .timeline({ onComplete: finish })
        .to(
          $$('[data-loader-label]', cover),
          {
            autoAlpha: 0,
            yPercent: -12,
            duration: 0.45,
            ease: 'power2.in',
            stagger: 0.04,
          },
          0,
        )
        .fromTo(
          cover,
          { clipPath: `circle(${far.toFixed(1)}px at ${at})` },
          {
            clipPath: `circle(${(target.width / 2).toFixed(1)}px at ${at})`,
            duration: 1.15,
            ease: 'expo.inOut',
          },
          0.3,
        )
        .add(introduce, 0.9);
    };

    // The portrait is read first: where its head is decides where the disc goes.
    const compose = async () => {
      // The name's face must be the one on screen before the page is laid
      // out; one that loads on demand (Arabic's) is asked for first.
      await Promise.all(
        [firstEl, lastEl]
          .filter((el): el is HTMLElement => Boolean(el))
          .map((el) =>
            document.fonts
              .load(
                `${getComputedStyle(el).fontStyle} 400 100px ${getComputedStyle(el).fontFamily}`,
                el.textContent ?? '',
              )
              .catch(() => []),
          ),
      );
      await document.fonts.ready;
      const img = await loaded(
        figureEl ? $<HTMLImageElement>('img', figureEl) : null,
      );

      if (cancelled) return;
      shape = img ? measureFigure(img) : null;
      if (counting) handle?.reach('measured');

      if (shape) {
        root.style.setProperty('--figure-aspect', String(shape.aspect));
        // A photograph with its own backdrop falls away at its edges.
        if (!shape.cut) figureEl?.classList.add('figure-soft');
      }

      // Built a part per frame, so the cover's count moves between them.
      const parts = [
        () => {
          placeHero();
          fitAll();
          fitRing();
        },
        buildHero,
        buildSections,
        buildBar,
        buildCompanion,
        () => {
          ScrollTrigger.addEventListener('refreshInit', fitAll);
          // Pins first, top to bottom, then everything else (`PIN_ORDER`).
          ScrollTrigger.sort();
          ScrollTrigger.refresh();
          land();
          markRed();
        },
      ];

      for (const part of parts) {
        await nextFrame();
        if (cancelled) return;
        contextSafe!(part)();
      }

      if (reduce) {
        window.addEventListener('resize', fitAll);
        cleanups.push(() => window.removeEventListener('resize', fitAll));
      }
    };

    // Composed, then opened - opened even if composing failed, so a fault
    // never leaves the cover up; the fault itself still surfaces.
    const start = async () => {
      try {
        await compose();
      } finally {
        if (!cancelled && covered && !fresh) await handle?.ready();
        if (!cancelled) contextSafe!(reveal)();
      }
    };

    void start();

    return () => {
      cancelled = true;
      media.revert();
      ScrollTrigger.removeEventListener('refreshInit', fitAll);
      for (const cleanup of cleanups) cleanup();
    };
  });

  return null;
}
