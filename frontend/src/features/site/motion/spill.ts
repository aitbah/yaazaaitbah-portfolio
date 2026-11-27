/**
 * The theme change. The new theme grows from the switch that was pressed, as
 * a circle, until it covers the page - both ways, going dark and going light.
 *
 * The new theme is a View Transition snapshot clipped to that circle; the
 * script holds the transition open while it grows, then ends it. Without View
 * Transitions, or with reduced motion, the theme simply changes.
 */

/** The radius that covers a `vw` × `vh` viewport from (`x`, `y`): its farthest corner, and a little more. */
export function coverRadius(x: number, y: number, vw: number, vh: number) {
  return Math.hypot(Math.max(x, vw - x), Math.max(y, vh - y)) + 4;
}

/** Eases in and out, symmetrically. */
export const ease = (p: number) =>
  p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2;

/** How long the circle takes to cover the page, in ms. */
const DURATION = 900;

/**
 * Runs `apply` inside a View Transition whose new snapshot is clipped to a
 * circle growing from (`x`, `y`). Resolves when done.
 */
export async function spillTheme(
  apply: () => void,
  origin: { x: number; y: number },
): Promise<void> {
  const root = document.documentElement;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!document.startViewTransition || reduce) {
    apply();
    return;
  }

  const { x, y } = origin;
  const max = coverRadius(x, y, window.innerWidth, window.innerHeight);
  const set = (r: number) =>
    root.style.setProperty(
      '--spill-clip',
      `circle(${Math.max(0, r).toFixed(1)}px at ${x.toFixed(1)}px ${y.toFixed(1)}px)`,
    );

  set(0);
  root.classList.add('spill-in');

  try {
    const transition = document.startViewTransition(apply);

    await transition.ready;
    await new Promise<void>((resolve) => {
      const start = performance.now();
      const frame = () => {
        const p = Math.min(1, (performance.now() - start) / DURATION);

        set(ease(p) * max);
        if (p < 1) requestAnimationFrame(frame);
        else resolve();
      };

      requestAnimationFrame(frame);
    });
    // The circle now covers the page: end the transition on this frame.
    transition.skipTransition();
    await transition.finished.catch(() => undefined);
  } catch {
    apply();
  } finally {
    root.classList.remove('spill-in');
    root.style.removeProperty('--spill-clip');
  }
}
