// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';

import home from '../../../messages/en/home.json';
import { cursorKind, SiteCursor } from '../../../src/features/site/site-cursor';

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

/** Markup to point at, and the element a selector names in it. */
function at(html: string, selector: string) {
  document.body.innerHTML = html;

  return document.querySelector(selector);
}

describe('what the cursor becomes', () => {
  it('leaves a field its own caret', () => {
    expect(cursorKind(at('<input id="x">', '#x'))).toBe('text');
    expect(cursorKind(at('<textarea id="x"></textarea>', '#x'))).toBe('text');
  });

  it('grows over what can be pressed, from anywhere inside it', () => {
    expect(
      cursorKind(at('<a href="/x"><span id="x">Go</span></a>', '#x')),
    ).toBe('press');
    expect(cursorKind(at('<button id="x">Go</button>', '#x'))).toBe('press');
  });

  it('labels an image that opens, before anything else it is', () => {
    expect(
      cursorKind(
        at('<button data-cursor="view"><img id="x" alt=""></button>', '#x'),
      ),
    ).toBe('view');
  });

  it('stays a dot elsewhere, and over a control that cannot be used', () => {
    expect(cursorKind(at('<p id="x">Text</p>', '#x'))).toBe('none');
    expect(cursorKind(at('<button id="x" disabled>Go</button>', '#x'))).toBe(
      'none',
    );
    expect(cursorKind(null)).toBe('none');
  });
});

/** A pointer moving, as the browser reports it. */
function move(pointerType: string) {
  const event = new MouseEvent('pointermove', {
    clientX: 40,
    clientY: 40,
    bubbles: true,
  });

  Object.defineProperty(event, 'pointerType', { value: pointerType });
  window.dispatchEvent(event);
}

const mount = (fine: boolean, reduce = false) => {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('reduce') ? reduce : fine,
  }));

  return render(
    <NextIntlClientProvider locale="en" messages={home}>
      <SiteCursor />
    </NextIntlClientProvider>,
  );
};

describe('the cursor', () => {
  it('takes over from the system pointer for a mouse, and gives it back on leaving the window', () => {
    mount(true);

    move('mouse');
    expect(document.documentElement.classList.contains('cursor-on')).toBe(true);

    document.dispatchEvent(new MouseEvent('mouseout', { relatedTarget: null }));
    expect(document.documentElement.classList.contains('cursor-on')).toBe(
      false,
    );
  });

  it('steps aside for touch and a pen', () => {
    mount(true);

    move('mouse');
    move('touch');

    expect(document.documentElement.classList.contains('cursor-on')).toBe(
      false,
    );
  });

  it('is never shown without a fine pointer, or under reduced motion', () => {
    const { unmount } = mount(false);

    move('mouse');
    expect(document.documentElement.classList.contains('cursor-on')).toBe(
      false,
    );
    unmount();

    mount(true, true);
    move('mouse');
    expect(document.documentElement.classList.contains('cursor-on')).toBe(
      false,
    );
  });

  it('says what an image does, out of the accessibility tree', () => {
    const { container } = mount(true);
    const disc = container.querySelector('[data-cursor-disc]');

    expect(disc?.textContent).toBe(home.home.cursor.view);
    expect(disc?.getAttribute('aria-hidden')).toBe('true');
  });
});
