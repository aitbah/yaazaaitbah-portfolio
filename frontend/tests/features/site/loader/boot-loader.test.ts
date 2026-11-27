// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  bootLoader,
  loaderScript,
  type LoaderConfig,
} from '../../../../src/features/site/loader/boot-loader';

const CONFIG: LoaderConfig = {
  image: null,
  sample: 'Ada Lovelace',
  fonts: [],
  pace: 1000,
  stall: 8000,
  max: 25000,
};

const root = document.documentElement;
let now = 0;
let frames: FrameRequestCallback[] = [];

/** Moves the clock on by `ms`, one 16ms frame at a time. */
function run(ms: number) {
  for (let left = ms; left > 0; left -= 16) {
    now += Math.min(16, left);
    const due = frames;

    frames = [];
    for (const frame of due) frame(now);
  }
}

// The cover, which the count writes to - never `<html>`, whose variables the whole page inherits.
let cover: HTMLElement;
const progress = () => Number(cover.style.getPropertyValue('--loader-p'));
const count = () => cover.style.getPropertyValue('--loader-n');

/** A wheel turn, and whether the cover held it. */
function held() {
  const event = new Event('wheel', { cancelable: true });

  window.dispatchEvent(event);

  return event.defaultPrevented;
}

beforeEach(() => {
  now = 0;
  frames = [];
  vi.useFakeTimers({ toFake: ['setTimeout'] });
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  vi.stubGlobal('requestAnimationFrame', (frame: FrameRequestCallback) => {
    frames.push(frame);

    return frames.length;
  });
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
  // Node lends jsdom its own, which never sees the page's scripts: without
  // one, they count as loaded with the page.
  vi.stubGlobal('PerformanceObserver', undefined);
  cover = document.createElement('div');
  cover.setAttribute('data-site-loader', '');
  document.body.append(cover);
});

afterEach(() => {
  window.__siteLoader?.done();
  delete window.__siteLoader;
  root.removeAttribute('data-loader');
  cover.remove();
  document.head.querySelectorAll('script').forEach((script) => script.remove());
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('the first load’s cover', () => {
  it('covers the page from the start of every load, and counts it', () => {
    bootLoader(CONFIG);

    expect(root.getAttribute('data-loader')).toBe('count');
    expect(window.__siteLoader?.state).toBe('loading');
  });

  it('counts what has really loaded, milestone by milestone, and reaches 100 only once the page is composed', async () => {
    for (const name of ['app', 'page']) {
      const script = document.createElement('script');

      script.src = `/_next/static/chunks/${name}.js`;
      document.head.append(script);
    }
    bootLoader(CONFIG);
    const loader = window.__siteLoader!;

    // Two scripts, then the motion's milestones: running 6, measured 2, composed 3.
    const units = 2 + 6 + 2 + 3;

    window.dispatchEvent(new Event('load'));
    run(3000);
    expect(progress()).toBeGreaterThanOrEqual(2 / units);
    // It creeps into the scripts' running, but never claims it.
    expect(progress()).toBeLessThan(8 / units);

    loader.reach('running');
    run(1500);
    expect(progress()).toBeGreaterThanOrEqual(8 / units);
    expect(progress()).toBeLessThan(10 / units);

    loader.reach('measured');
    run(1500);
    expect(progress()).toBeGreaterThanOrEqual(10 / units);
    expect(progress()).toBeLessThan(1);

    let ready = false;

    void loader.ready().then(() => {
      ready = true;
    });
    run(1500);
    await Promise.resolve();

    expect(progress()).toBe(1);
    expect(count()).toBe('100');
    expect(ready).toBe(true);
  });

  it('names each script done as Resource Timing reports it', () => {
    let report: (list: { getEntries: () => { name: string }[] }) => void = () =>
      undefined;

    vi.stubGlobal(
      'PerformanceObserver',
      class {
        constructor(callback: typeof report) {
          report = callback;
        }
        observe() {}
        disconnect() {}
      },
    );
    const script = document.createElement('script');

    script.src = '/_next/static/chunks/app.js';
    document.head.append(script);
    bootLoader(CONFIG);

    run(4000);
    // One unit of twelve is loading: crept into, never claimed.
    expect(progress()).toBeLessThan(1 / 12);

    report({
      getEntries: () => [{ name: script.src }, { name: '/other.css' }],
    });
    run(1000);
    expect(progress()).toBeGreaterThanOrEqual(1 / 12);
  });

  it('never leaps: a frame the page could not draw is resumed from, not jumped over', () => {
    bootLoader(CONFIG);
    void window.__siteLoader!.ready();

    run(16);
    // The page is busy for two seconds and draws nothing; then it draws again.
    now += 2000;
    run(16);

    expect(progress()).toBeLessThanOrEqual(0.05);
  });

  it('never runs faster than its pace, and lands once the page is ready', async () => {
    bootLoader(CONFIG);
    let ready = false;

    void window.__siteLoader!.ready().then(() => {
      ready = true;
    });
    run(400);
    await Promise.resolve();
    expect(progress()).toBeLessThanOrEqual(0.4 + 0.02);
    expect(ready).toBe(false);

    run(1000);
    await Promise.resolve();
    expect(ready).toBe(true);
  });

  it('holds scrolling while it covers, and lets go once it has gone', () => {
    bootLoader(CONFIG);
    expect(held()).toBe(true);

    window.__siteLoader!.done();

    expect(held()).toBe(false);
    expect(root.hasAttribute('data-loader')).toBe(false);
    expect(cover.style.getPropertyValue('--loader-p')).toBe('');
    expect(root.style.getPropertyValue('--loader-p')).toBe('');
  });

  it('gives way by itself when progress stands still, leaving the page as rendered', () => {
    bootLoader({ ...CONFIG, stall: 1000 });

    run(1100);
    expect(root.getAttribute('data-loader')).toBe('gone');
    expect(window.__siteLoader?.state).toBe('done');
    expect(held()).toBe(false);

    vi.advanceTimersByTime(500);
    expect(root.hasAttribute('data-loader')).toBe(false);
  });

  it('gives way too if it is ready and nothing opens it', async () => {
    bootLoader({ ...CONFIG, stall: 1000 });
    void window.__siteLoader!.ready();

    run(1300);
    await Promise.resolve();
    expect(window.__siteLoader?.state).toBe('ready');

    run(1100);
    expect(root.getAttribute('data-loader')).toBe('gone');
  });

  it('waits for the portrait, weighed above a script', () => {
    const img = document.createElement('img');

    img.setAttribute('data-portrait', '');
    document.body.append(img);
    Object.defineProperty(img, 'complete', {
      value: false,
      configurable: true,
    });
    bootLoader({ ...CONFIG, image: '[data-portrait]' });

    run(2000);
    // The portrait (4 of 15) and the start-up (6) are under way: crept into,
    // never claimed - and nothing is counted as loaded yet.
    expect(progress()).toBeLessThan(10 / 15);
    expect(window.__siteLoader?.state).toBe('loading');

    Object.defineProperty(img, 'complete', { value: true });
    window.__siteLoader!.reach('running');
    run(2000);
    expect(progress()).toBeGreaterThanOrEqual(10 / 15);
    expect(progress()).toBeLessThan(1);
    img.remove();
  });
});

describe('the inline script', () => {
  it('runs on its own, from nothing but its text', () => {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval -- the browser runs the same text
    const script = new Function(loaderScript(CONFIG)) as () => void;

    script();

    expect(root.getAttribute('data-loader')).toBe('count');
    expect(window.__siteLoader?.cover).toBe(cover);
  });

  it('cannot be closed early by what it carries', () => {
    expect(loaderScript({ ...CONFIG, sample: '</script><b>' })).not.toContain(
      '</script>',
    );
  });
});
