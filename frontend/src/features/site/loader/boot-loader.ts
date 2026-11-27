/**
 * What the cover is told by the server: what to wait for, and how long a stall
 * may last before it gives way.
 */
export type LoaderConfig = {
  /** The portrait, if the page has one: waited for, weighted as a heavy resource. */
  image: string | null;
  /** The text the opening sets, so the faces are loaded for its own glyphs. */
  sample: string;
  /** CSS variables naming the faces the opening uses, each with its weight. */
  fonts: [variable: string, descriptor: string][];
  /** The fastest the count may run from 0 to 100, in ms: it never leaps. */
  pace: number;
  /** How long progress may stand still before the cover gives way, in ms. */
  stall: number;
  /** The most the cover may ever hold, in ms. */
  max: number;
};

/** The motion's own milestones, in order, after the page's scripts have loaded. */
export type LoaderStep = 'running' | 'measured' | 'composed';

/** The cover's handle, left on `window` for the motion. */
export type SiteLoader = {
  /** The node the inline script armed; a different one is a later, client-side render. */
  cover: Element | null;
  /** `done` once the cover has gone, whether the motion lifted it or it gave way. */
  state: 'loading' | 'ready' | 'done';
  /** A milestone the motion has passed: its scripts run, the opening measured. */
  reach: (step: Exclude<LoaderStep, 'composed'>) => void;
  /** The page is composed: resolves once the count shows it. */
  ready: () => Promise<void>;
  /** The cover has gone: the page may scroll. */
  done: () => void;
};

declare global {
  interface Window {
    __siteLoader?: SiteLoader;
  }
}

/**
 * The first load's cover, armed before anything is painted. It runs as an
 * inline script - serialized from this function, so it may use nothing from
 * outside it - right after the cover's markup.
 *
 * - **Only with scripts.** The cover shows only once this has set
 *   `data-loader` on `<html>`, so a page read without scripts is untouched.
 * - **Real progress.** The page's own scripts, the faces the opening is set in,
 *   the portrait, then the motion's milestones: its scripts running, the
 *   opening measured, the opening composed.
 * - **A count that never leaps or stalls.** It moves toward what has loaded at
 *   no more than a step per frame, so a frame the page could not draw (while
 *   its scripts run) is resumed from, not jumped over. Between milestones it
 *   creeps into the work under way, slowing, and never claims it. Every load
 *   of the document counts; a return to the page inside the site does not
 *   (the motion covers that itself).
 * - **The motion opens the cover;** this only counts. If progress stands still
 *   for `stall`, or the cover has held for `max`, it gives way by itself and
 *   leaves the page as it was rendered.
 * - **Scrolling waits:** the wheel, touch and scroll keys are held while the
 *   cover is up, so the page does not open somewhere the reader never chose.
 *
 * It writes `data-loader` on `<html>`, and the count's two variables on the
 * cover alone: a variable set on `<html>` is inherited by the whole page, and
 * restyling the whole page every frame held up the very scripts it counts.
 * The cover is contained (`globals.css`), so a frame restyles only it.
 */
export function bootLoader(config: LoaderConfig): void {
  const root = document.documentElement;
  const now = () => performance.now();
  const started = now();
  const weights: Record<string, number> = {};
  const finished: Record<string, boolean> = {};
  let total = 0;
  let reached = 0;
  let changed = started;

  const add = (key: string, weight: number) => {
    if (key in weights) return;
    weights[key] = weight;
    total += weight;
  };
  const complete = (key: string) => {
    if (!(key in weights) || finished[key]) return;
    finished[key] = true;
    reached += weights[key] as number;
    changed = now();
  };

  // The scripts that will compose the page. Resource Timing names each one as
  // it finishes; without it, they count as loaded with the page.
  const scripts = document.querySelectorAll<HTMLScriptElement>(
    'script[src]:not([nomodule])',
  );

  for (let i = 0; i < scripts.length; i += 1) add(scripts[i]!.src, 1);

  let observer: PerformanceObserver | null = null;

  try {
    observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();

      for (let i = 0; i < entries.length; i += 1) complete(entries[i]!.name);
    });
    observer.observe({ type: 'resource', buffered: true });
  } catch {
    window.addEventListener('load', () => {
      for (let i = 0; i < scripts.length; i += 1) complete(scripts[i]!.src);
    });
  }

  // The faces the opening is set in, asked for by the glyphs it uses.
  const style = getComputedStyle(root);

  for (let i = 0; i < config.fonts.length; i += 1) {
    const [variable, descriptor] = config.fonts[i]!;
    const family = style.getPropertyValue(variable).trim();

    if (!family || !document.fonts) continue;
    const key = `font:${variable}:${descriptor}`;
    const settle = () => complete(key);

    add(key, 1);
    document.fonts
      .load(`${descriptor} ${family}`, config.sample || undefined)
      .then(settle, settle);
  }

  // The portrait weighs what several scripts do. The motion's milestones come
  // last, each in its turn: the scripts starting up and the page hydrating is
  // the longest of them.
  let image: HTMLImageElement | null = null;
  const steps: LoaderStep[] = ['running', 'measured', 'composed'];

  if (config.image) add('portrait', 4);
  add('running', 6);
  add('measured', 2);
  add('composed', 3);

  // The work under way: what has started and not finished. A milestone starts
  // when the one before it is reached; the first, once the scripts are in.
  const underway = () => {
    let share = 0;

    for (const key in weights) {
      if (finished[key]) continue;
      const at = steps.indexOf(key as LoaderStep);
      const before = at > 0 ? steps[at - 1]! : null;

      if (before && !finished[before]) continue;
      if (at === 0) {
        let loaded = true;

        for (let i = 0; i < scripts.length; i += 1)
          if (!finished[scripts[i]!.src]) loaded = false;
        if (!loaded) continue;
      }
      share += weights[key]!;
    }

    return total ? share / total : 0;
  };

  const keys: Record<string, boolean> = {
    ' ': true,
    PageDown: true,
    PageUp: true,
    ArrowDown: true,
    ArrowUp: true,
    Home: true,
    End: true,
  };
  const hold = (event: Event) => {
    if (event.type !== 'keydown' || keys[(event as KeyboardEvent).key])
      event.preventDefault();
  };
  const options = { passive: false, capture: true };

  window.addEventListener('wheel', hold, options);
  window.addEventListener('touchmove', hold, options);
  window.addEventListener('keydown', hold, options);

  let shown = 0;
  let last = started;
  let readyAt = 0;
  let settleReady: (() => void) | null = null;
  let readiness: Promise<void> | null = null;

  const release = () => {
    window.removeEventListener('wheel', hold, options);
    window.removeEventListener('touchmove', hold, options);
    window.removeEventListener('keydown', hold, options);
    observer?.disconnect();
  };

  // The cover's markup comes just before this script.
  const paint = document.querySelector<HTMLElement>('[data-site-loader]');
  const loader: SiteLoader = {
    cover: paint,
    state: 'loading',
    reach(step) {
      complete(step);
    },
    ready() {
      // Composed is past every milestone, even one a fault skipped.
      for (let i = 0; i < steps.length; i += 1) complete(steps[i]!);
      if (loader.state !== 'loading') return Promise.resolve();
      readiness ??= new Promise((resolve) => {
        settleReady = resolve;
      });

      return readiness;
    },
    done() {
      loader.state = 'done';
      release();
      root.removeAttribute('data-loader');
      paint?.style.removeProperty('--loader-p');
      paint?.style.removeProperty('--loader-n');
    },
  };

  // Ready, and the motion has the cover: it must open within a few seconds.
  const markReady = () => {
    loader.state = 'ready';
    readyAt = now();
  };

  window.__siteLoader = loader;
  root.setAttribute('data-loader', 'count');

  // Gives way: the cover fades and the page stays as it was rendered.
  const giveWay = () => {
    loader.state = 'done';
    release();
    root.setAttribute('data-loader', 'gone');
    window.setTimeout(() => {
      if (root.getAttribute('data-loader') === 'gone')
        root.removeAttribute('data-loader');
    }, 500);
  };

  const tick = (time: number) => {
    if (loader.state === 'done') return;

    if (config.image && !image) image = document.querySelector(config.image);
    if (image?.complete) complete('portrait');

    const target = total ? reached / total : 1;
    // A frame the page could not draw is not progress: the count resumes from
    // where it stood rather than leaping to where loading got to meanwhile.
    const step = Math.min(34, Math.max(0, time - last));
    const most = step / config.pace;

    last = time;
    if (shown < target) {
      // Toward what has loaded: eased, at no more than a step per frame, and
      // never so slowly that the last numbers drag once the page is ready.
      const eased = (target - shown) * (1 - Math.exp(-step / 140));

      shown = Math.min(
        target,
        shown + Math.min(most, Math.max(eased, most * 0.35)),
      );
    } else if (target < 1) {
      // Every milestone reached is shown: creep into the work under way,
      // slowing, never past it.
      const ceiling = Math.min(0.99, target + underway() * 0.9);

      if (ceiling > shown)
        shown += (ceiling - shown) * (1 - Math.exp(-step / 1400));
    }
    paint?.style.setProperty('--loader-p', shown.toFixed(4));
    paint?.style.setProperty('--loader-n', String(Math.floor(shown * 100)));

    if (shown >= 1 && settleReady) {
      const resolve = settleReady;

      settleReady = null;
      markReady();
      resolve();
    }

    // A stall is real work not arriving - not the count still running up to
    // what has arrived - or a ready page that nothing opens.
    if (
      loader.state === 'loading'
        ? reached < total &&
          (time - changed > config.stall || time - started > config.max)
        : time - readyAt > config.stall
    ) {
      giveWay();

      return;
    }

    requestAnimationFrame(tick);
  };

  requestAnimationFrame(tick);
}

/** The inline script: the function above, called with the server's config. */
export function loaderScript(config: LoaderConfig): string {
  return `(${bootLoader.toString()})(${JSON.stringify(config).replace(/</g, '\\u003c')});`;
}
