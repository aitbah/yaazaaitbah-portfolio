'use client';

import gsap from 'gsap';
import { useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';

/** What the pointer is over, and so what the cursor becomes. */
export type CursorKind = 'none' | 'press' | 'text' | 'view';

const TEXT = 'input, textarea, select, [contenteditable="true"]';
const PRESS =
  'a[href], button:not(:disabled), [role="button"], label[for], summary';

/**
 * The cursor for an element: the native caret in a field, a label where the
 * page marks one (`data-cursor="view"` on an image that opens), a larger dot
 * over anything that can be pressed, the dot elsewhere.
 */
export function cursorKind(target: Element | null): CursorKind {
  if (!target) return 'none';
  if (target.closest(TEXT)) return 'text';
  if (target.closest('[data-cursor="view"]')) return 'view';
  if (target.closest(PRESS)) return 'press';

  return 'none';
}

/** The dot's diameter, in px, for each kind; 0 hides it. */
const DOT: Record<CursorKind, number> = {
  none: 9,
  press: 6,
  text: 0,
  view: 0,
};

/** The ring's diameter when it follows the pointer rather than a control. */
const RING = 36;

/** A control larger than this is not wrapped by the ring; it is circled. */
const WRAP = { width: 360, height: 120 };

/** How far a magnetic control leans toward the pointer, and at most, in px. */
const PULL = 0.3;
const REACH = 10;

/**
 * The public site's cursor, in its red: a dot that stretches along the way it
 * moves, and a ring that trails it - and, over a button, a link or a tab,
 * wraps the control in its own shape. Over an image that opens, a red disc
 * with a label. A press sends a pulse out from the ring. Controls marked
 * `data-magnetic` lean toward the pointer.
 *
 * Only for a mouse, and never under reduced motion: touch and pen keep the
 * system's own, and so does a field, an open dialog and the theme change
 * (`globals.css`). The native pointer is hidden only while this one is shown.
 */
export function SiteCursor() {
  const t = useTranslations('home.cursor');
  const dot = useRef<HTMLSpanElement>(null);
  const ring = useRef<HTMLSpanElement>(null);
  const disc = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

    if (
      !fine.matches ||
      reduce.matches ||
      !dot.current ||
      !ring.current ||
      !disc.current
    )
      return;

    const root = document.documentElement;
    const d = dot.current;
    const ink = d.firstElementChild as HTMLElement;
    const r = ring.current;
    const l = disc.current;
    let shown = false;
    let kind: CursorKind = 'none';
    let x = 0;
    let y = 0;
    let last = { x: 0, y: 0, t: 0 };
    let magnet: { el: HTMLElement; box: DOMRect } | null = null;
    // The control the ring is wrapped around, if any.
    let wrapped: HTMLElement | null = null;
    let frame = 0;

    gsap.set([d, r, l], { xPercent: -50, yPercent: -50, scale: 0 });
    const follow = {
      dx: gsap.quickTo(d, 'x', { duration: 0.12, ease: 'power3' }),
      dy: gsap.quickTo(d, 'y', { duration: 0.12, ease: 'power3' }),
      rx: gsap.quickTo(r, 'x', { duration: 0.45, ease: 'power3' }),
      ry: gsap.quickTo(r, 'y', { duration: 0.45, ease: 'power3' }),
      lx: gsap.quickTo(l, 'x', { duration: 0.4, ease: 'power3' }),
      ly: gsap.quickTo(l, 'y', { duration: 0.4, ease: 'power3' }),
      stretch: gsap.quickTo(ink, 'scaleX', { duration: 0.3, ease: 'power3' }),
      squash: gsap.quickTo(ink, 'scaleY', { duration: 0.3, ease: 'power3' }),
    };
    // The stretch fades when the pointer stops.
    const still = gsap.delayedCall(0.08, () => {
      void follow.stretch(1);
      void follow.squash(1);
    });

    // The ring around a control, in its shape and a little larger.
    const wrap = (el: HTMLElement) => {
      const box = el.getBoundingClientRect();
      const radius = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 6;

      // Its place by the follower, its shape by a tween: one owner each.
      void follow.rx(box.left + box.width / 2);
      void follow.ry(box.top + box.height / 2);
      gsap.to(r, {
        width: box.width + 14,
        height: box.height + 12,
        borderRadius: Math.min(radius + 6, (box.height + 12) / 2),
        opacity: 1,
        duration: 0.45,
        ease: 'expo.out',
        overwrite: 'auto',
      });
    };
    const unwrap = (size: number, opacity = 0.55) => {
      wrapped = null;
      gsap.to(r, {
        width: size,
        height: size,
        borderRadius: size / 2,
        opacity,
        duration: 0.45,
        ease: 'expo.out',
        overwrite: 'auto',
      });
      void follow.rx(x);
      void follow.ry(y);
    };

    const become = (next: CursorKind, target: Element | null) => {
      const control =
        next === 'press'
          ? (target?.closest<HTMLElement>(
              'a[href], button:not(:disabled), [role="button"], [role="tab"], label[for], summary',
            ) ?? null)
          : null;
      const box = control?.getBoundingClientRect();
      const fits =
        !!box && box.width <= WRAP.width && box.height <= WRAP.height;

      if (fits && control && control !== wrapped) {
        wrapped = control;
        wrap(control);
      } else if (!fits && (wrapped || next !== kind)) {
        unwrap(
          next === 'press' ? RING + 20 : RING,
          next === 'view' || next === 'text' ? 0 : 0.55,
        );
      }
      if (next === kind) return;
      kind = next;
      d.dataset.kind = next;
      gsap.to(ink, {
        width: DOT[next],
        height: DOT[next],
        duration: 0.5,
        ease: 'expo.out',
        overwrite: 'auto',
      });
      gsap.to(l, {
        scale: next === 'view' ? 1 : 0,
        duration: 0.55,
        ease: 'expo.out',
        overwrite: 'auto',
      });
    };

    const show = () => {
      shown = true;
      root.classList.add('cursor-on');
      gsap.set([d, r, l], { x, y });
      gsap.to([d, r], { scale: 1, duration: 0.4, ease: 'expo.out' });
    };

    const hide = () => {
      if (!shown) return;
      shown = false;
      root.classList.remove('cursor-on');
      gsap.to([d, r, l], { scale: 0, duration: 0.3, ease: 'power2.out' });
      // Back to the plain dot and ring, for when it shows again.
      gsap.set(ink, { width: DOT.none, height: DOT.none, delay: 0.3 });
      gsap.set(r, {
        width: RING,
        height: RING,
        borderRadius: RING / 2,
        delay: 0.3,
      });
      wrapped = null;
      kind = 'none';
      leave();
    };

    const leave = () => {
      if (!magnet) return;
      gsap.to(magnet.el, {
        x: 0,
        y: 0,
        duration: 0.8,
        ease: 'elastic.out(1, 0.45)',
        overwrite: 'auto',
      });
      magnet = null;
    };

    // What is under the pointer: on entering an element, and again when the
    // page scrolls beneath a pointer that has not moved.
    const look = (target: Element | null) => {
      become(cursorKind(target), target);
      const el = target?.closest<HTMLElement>('[data-magnetic]') ?? null;

      if (el !== magnet?.el) {
        leave();
        // Measured before it moves, so it leans from where it stands.
        if (el) magnet = { el, box: el.getBoundingClientRect() };
      }
    };

    // Over red, the cursor is ink: red on red would vanish. Red is a red
    // ground (a red chapter, a red button, the menu) or the opening's disc,
    // which takes no pointer and is read by its shape.
    const discEl = document.querySelector<HTMLElement>('[data-hero-disc]');
    let red = false;
    const tint = (target: Element | null) => {
      let next = Boolean(
        target?.closest('[data-red-zone], .bg-site-red, dialog.site-menu'),
      );

      // The disc counts only while it is shown: once the opening has gone it
      // is hidden but still scaled past the screen, and the cursor stayed ink
      // over everything after it - unseen on the dark theme.
      if (
        !next &&
        discEl &&
        discEl.parentElement &&
        getComputedStyle(discEl.parentElement).visibility !== 'hidden'
      ) {
        const box = discEl.getBoundingClientRect();

        next =
          box.width > 0 &&
          Math.hypot(
            x - (box.left + box.width / 2),
            y - (box.top + box.height / 2),
          ) <
            box.width / 2;
      }
      if (next === red) return;
      red = next;
      d.toggleAttribute('data-on-red', red);
      r.toggleAttribute('data-on-red', red);
    };

    // The window or the document can be a target too, and they are not elements.
    const element = (event: Event) =>
      event.target instanceof Element ? event.target : null;

    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') {
        hide();

        return;
      }
      x = event.clientX;
      y = event.clientY;
      tint(element(event));
      if (!shown) {
        show();
        look(element(event));
      }
      void follow.dx(x);
      void follow.dy(y);
      void follow.lx(x);
      void follow.ly(y);

      // Stretched along the way it moves, by how fast.
      const now = performance.now();
      const dt = Math.max(8, now - last.t);
      const vx = (x - last.x) / dt;
      const vy = (y - last.y) / dt;
      const speed = Math.hypot(vx, vy);

      last = { x, y, t: now };
      if (speed > 0.05) {
        gsap.set(ink, { rotation: (Math.atan2(vy, vx) * 180) / Math.PI });
        void follow.stretch(1 + Math.min(1.1, speed * 0.55));
        void follow.squash(1 - Math.min(0.4, speed * 0.2));
        still.restart(true);
      }

      if (wrapped) {
        // Wrapped, the ring leans a little toward the pointer.
        const box = wrapped.getBoundingClientRect();

        void follow.rx(
          box.left + box.width / 2 + (x - box.left - box.width / 2) * 0.12,
        );
        void follow.ry(
          box.top + box.height / 2 + (y - box.top - box.height / 2) * 0.12,
        );
      } else {
        void follow.rx(x);
        void follow.ry(y);
      }

      if (magnet) {
        const { box } = magnet;
        const lean = (offset: number) =>
          Math.max(-REACH, Math.min(REACH, offset * PULL));

        gsap.to(magnet.el, {
          x: lean(x - (box.left + box.width / 2)),
          y: lean(y - (box.top + box.height / 2)),
          duration: 0.5,
          ease: 'power3.out',
          overwrite: 'auto',
        });
      }
    };

    const onOver = (event: PointerEvent) => {
      if (event.pointerType === 'mouse' && shown) look(element(event));
    };

    const onScroll = () => {
      if (!shown || frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (magnet) magnet.box = magnet.el.getBoundingClientRect();
        const target = document.elementFromPoint(x, y);

        tint(target);

        // A wrapped control has moved with the page: follow it, or let go.
        if (wrapped) {
          const keep = wrapped;

          wrapped = null;
          look(target);
          if (wrapped === null && target && keep.contains(target)) {
            wrapped = keep;
            wrap(keep);
          }
        } else look(target);
      });
    };

    const onOut = (event: MouseEvent) => {
      if (!event.relatedTarget) hide();
    };

    const onDown = () => {
      if (!shown) return;
      gsap.to(d, { scale: 0.7, duration: 0.2, ease: 'power2.out' });
      // A pulse out from the ring.
      const pulse = r.cloneNode() as HTMLElement;

      pulse.removeAttribute('data-cursor-ring');
      r.after(pulse);
      gsap.fromTo(
        pulse,
        { scale: 1, opacity: 0.8 },
        {
          scale: 1.8,
          opacity: 0,
          duration: 0.6,
          ease: 'power2.out',
          onComplete: () => pulse.remove(),
        },
      );
    };

    const onUp = () => {
      if (shown) gsap.to(d, { scale: 1, duration: 0.45, ease: 'expo.out' });
    };

    const onHidden = () => {
      if (document.hidden) hide();
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerover', onOver, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('mouseout', onOut);
    window.addEventListener('pointerdown', onDown, { passive: true });
    window.addEventListener('pointerup', onUp, { passive: true });
    window.addEventListener('blur', hide);
    document.addEventListener('visibilitychange', onHidden);

    return () => {
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerover', onOver);
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('mouseout', onOut);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('blur', hide);
      document.removeEventListener('visibilitychange', onHidden);
      cancelAnimationFrame(frame);
      still.kill();
      root.classList.remove('cursor-on');
      gsap.killTweensOf([d, r, l, ink]);
      if (magnet) gsap.set(magnet.el, { x: 0, y: 0 });
    };
  }, []);

  return (
    <>
      {/* Their own layers at the top of the page. */}
      <span
        ref={ring}
        aria-hidden
        data-cursor-ring
        className="pointer-events-none fixed top-0 left-0 z-[89] hidden size-9 rounded-full border-[1.5px] border-site-red opacity-55 transition-[border-color] duration-300 data-[on-red]:border-site-on-red"
      />
      <span
        ref={dot}
        aria-hidden
        data-cursor-dot
        className="group/dot pointer-events-none fixed top-0 left-0 z-[90] hidden"
      >
        <span className="block size-[9px] rounded-full bg-site-red transition-[background-color] duration-300 group-data-[on-red]/dot:bg-site-on-red" />
      </span>
      <span
        ref={disc}
        aria-hidden
        data-cursor-disc
        className="site-label pointer-events-none fixed top-0 left-0 z-[91] hidden size-[88px] place-items-center rounded-full bg-site-red text-site-on-red shadow-[0_0_0_1.5px_var(--site-on-red)]"
      >
        {t('view')}
      </span>
    </>
  );
}
