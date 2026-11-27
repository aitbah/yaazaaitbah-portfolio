import { createHash } from 'node:crypto';

import { expect, test, type APIRequestContext } from '@playwright/test';

import homeAr from '../messages/ar/home.json';
import errors from '../messages/en/errors.json';
import homeEn from '../messages/en/home.json';
import { routing } from '../src/i18n/routing';
import { THEME_SCRIPT } from '../src/components/theme/theme';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';

type LocalizedText = Record<string, string>;
type PublicProfile = {
  firstName?: LocalizedText;
  lastName?: LocalizedText;
  headline?: LocalizedText;
};

test.describe('the public site', () => {
  test('serves the home page under its locale', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveURL(/\/en$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  });

  // The owner, the name either side, then every section that has content,
  // each under its own heading, with the bar to reach them and a footer.
  test('opens on the owner, and lays out every section', async ({
    page,
    request,
  }) => {
    const answer = await request.get(`${API_URL}/api/profile`);
    const { details } = (await answer.json()) as {
      details: { profile: PublicProfile };
    };
    const name = [details.profile.firstName?.en, details.profile.lastName?.en]
      .filter(Boolean)
      .join(' ');

    await page.goto('/en');

    await expect(page.getByRole('heading', { level: 1 })).toHaveAccessibleName(
      name,
    );
    await expect(page.getByRole('banner')).toBeVisible();
    await expect(
      page.getByRole('navigation', { name: homeEn.home.nav.label }),
    ).toBeVisible();
    for (const id of [
      'top',
      'about',
      'work',
      'expertise',
      'path',
      'record',
      'contact',
    ]) {
      await expect(page.locator(`section#${id}`)).toHaveCount(1);
    }
    await expect(page.getByRole('contentinfo')).toHaveCount(1);
  });

  test('reads right to left in Arabic', async ({ page }) => {
    await page.goto('/ar');

    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(
      page.getByRole('navigation', { name: homeAr.home.nav.label }),
    ).toBeVisible();
  });

  // Light or dark in one press, remembered; the spill is the browser's View
  // Transition, so what is asserted here is the outcome.
  test('switches the theme, and remembers it', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
    await page.goto('/en');

    await page.getByRole('button', { name: homeEn.home.theme.toDark }).click();

    await expect(page.locator('html')).toHaveClass(/\bdark\b/);
    await expect(
      page.getByRole('button', { name: homeEn.home.theme.toLight }),
    ).toBeVisible();
    expect(
      await page.evaluate(() => localStorage.getItem('portfolio-theme')),
    ).toBe('dark');
  });

  // Every load is covered until the opening is composed; the cover then opens
  // and leaves the page alone.
  test('opens the first load from a cover, once the page is composed', async ({
    page,
  }) => {
    await page.goto('/en');

    // Armed by its inline script before anything was painted…
    expect(await page.evaluate(() => Boolean(window.__siteLoader))).toBe(true);
    // …and gone once the page is composed, the page left alone.
    await expect(page.locator('[data-site-loader]')).toBeHidden({
      timeout: 15_000,
    });
    await expect(page.locator('html')).not.toHaveAttribute('data-loader');
    expect(await page.evaluate(() => window.__siteLoader?.state)).toBe('done');
  });

  // The bar has no room for the sections on a phone; the menu does.
  test('reaches a section from the menu on a phone', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();

    await page.goto('/en');
    await page.getByRole('button', { name: homeEn.home.nav.menu }).click();
    const menu = page.getByRole('dialog', { name: homeEn.home.nav.menu });

    await expect(menu).toBeVisible();
    await menu.getByRole('link', { name: homeEn.home.nav.contact }).click();

    await expect(menu).toBeHidden();
    await expect(page.locator('section#contact')).toBeInViewport();
    await context.close();
  });

  test('says what a message lacks before sending it', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/en#contact');

    await page.getByRole('button', { name: homeEn.home.contact.send }).click();

    await expect(page.getByLabel(homeEn.home.contact.name)).toHaveAttribute(
      'aria-invalid',
      'true',
    );
  });

  /**
   * SEO is in scope from the start; these are the tags that were missing.
   *
   * Asserted against **what the API says**, not against the translation files.
   * A portfolio's title is a person's name and its description is their own
   * headline - both editable in the admin - so pinning the static copy would
   * fail the day the owner changed their headline, which is not a regression.
   * `metadata.json` remains the fallback for an unreachable API. That path is
   * covered in `tests/lib/server-api.test.ts`, where the failure can actually
   * be produced - here the API is up by definition.
   */
  test('carries the metadata a crawler and a share card need', async ({
    page,
    request,
  }) => {
    const answer = await request.get(`${API_URL}/api/profile`);
    const { details } = (await answer.json()) as {
      details: { profile: PublicProfile };
    };
    const { profile } = details;

    const name = [profile.firstName?.en, profile.lastName?.en]
      .filter(Boolean)
      .join(' ');
    const headline = profile.headline?.en ?? '';

    expect(name, 'the seeded profile has a name to render').not.toBe('');
    expect(headline, 'the seeded profile has a headline to render').not.toBe(
      '',
    );

    await page.goto('/en');

    const meta = (key: string) =>
      page.locator(`meta[property="${key}"], meta[name="${key}"]`).first();

    await expect(page).toHaveTitle(name);
    await expect(meta('description')).toHaveAttribute('content', headline);
    await expect(meta('og:title')).toHaveAttribute('content', name);
    await expect(meta('og:description')).toHaveAttribute('content', headline);
    // `profile`, not `website`: this page is about a person.
    await expect(meta('og:type')).toHaveAttribute('content', 'profile');
    await expect(meta('og:url')).toHaveAttribute('content', `${SITE_URL}/en`);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      `${SITE_URL}/en`,
    );
  });

  /**
   * The markup that makes a search engine render a person rather than a link.
   *
   * Parsed rather than pattern-matched: structured data that does not parse is
   * ignored entirely, and a regex would pass on something no crawler accepts.
   */
  test('carries Person structured data built from the profile', async ({
    page,
    request,
  }) => {
    const answer = await request.get(`${API_URL}/api/profile`);
    const { details } = (await answer.json()) as {
      details: { profile: PublicProfile };
    };

    await page.goto('/en');

    const raw = await page
      .locator('script[type="application/ld+json"]')
      .first()
      .textContent();

    const person = JSON.parse(raw ?? '{}') as Record<string, unknown>;

    expect(person['@type']).toBe('Person');
    expect(person['@context']).toBe('https://schema.org');
    expect(person.name).toBe(
      [details.profile.firstName?.en, details.profile.lastName?.en]
        .filter(Boolean)
        .join(' '),
    );
    expect(person.url).toBe(`${SITE_URL}/en`);
    // Absolute, always: a crawler has no page to resolve a relative one against.
    if (typeof person.image === 'string') {
      expect(person.image.startsWith('http')).toBe(true);
    }
  });

  test('declares an alternate for every configured locale', async ({
    page,
  }) => {
    await page.goto('/en');

    await expect(
      page.locator('link[rel="alternate"][hreflang="en"]'),
    ).toHaveCount(1);
  });

  test('serves robots.txt pointing at the sitemap', async ({ request }) => {
    const response = await request.get('/robots.txt');

    expect(response.status()).toBe(200);
    const body = await response.text();
    // An absolute URL: a relative one is not valid in robots.txt.
    expect(body).toContain(`Sitemap: ${SITE_URL}/sitemap.xml`);
    // The admin area is not for crawlers.
    expect(body).toContain('Disallow: /*/admin');
  });

  test('serves a sitemap listing the public pages', async ({ request }) => {
    const response = await request.get('/sitemap.xml');

    expect(response.status()).toBe(200);
    const body = await response.text();
    expect(body).toContain('<urlset');

    // The full location, not a substring that almost anything would satisfy.
    for (const locale of routing.locales) {
      expect(body).toContain(`<loc>${SITE_URL}/${locale}</loc>`);
    }

    // The admin area must never be advertised.
    expect(body).not.toContain('/admin');
  });
});

/**
 * The backend has had helmet from the start; the frontend served nothing, so
 * the admin panel could be framed by any origin - a live clickjacking surface,
 * because the session cookie rides along inside a frame.
 *
 * Asserted on a real response rather than by reading the config: a header set
 * in `next.config.ts` that never reaches the wire is exactly the failure this
 * is for.
 */
test.describe('security headers', () => {
  const PAGES = ['/en', '/en/admin/login'];

  for (const path of PAGES) {
    test(`refuses to be framed at ${path}`, async ({ request }) => {
      const response = await request.get(path);
      const headers = response.headers();

      expect(headers['content-security-policy']).toContain(
        "frame-ancestors 'none'",
      );
      // The same rule for browsers that never implemented `frame-ancestors`.
      expect(headers['x-frame-options']).toBe('DENY');
    });
  }

  test('sets the rest of the baseline, and names no framework', async ({
    request,
  }) => {
    const headers = (await request.get('/en/admin/login')).headers();

    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(headers['permissions-policy']).toContain('camera=()');
    // Naming the framework and its version only helps someone matching a CVE.
    expect(headers['x-powered-by']).toBeUndefined();
  });
});

/**
 * The admin runs under a real script policy; the public site, for now, does not.
 *
 * The admin is where a session cookie is in scope and where text written by
 * anonymous strangers is rendered - the contact form fills the inbox. React
 * escaping is why that is safe today, and this is what keeps it safe on the day
 * something else is not.
 *
 * Asserted on a real response for the reason the baseline is: a policy that
 * never reaches the wire protects nothing, and a nonce that does not match the
 * scripts protects nothing while breaking everything.
 */
test.describe('the admin script policy', () => {
  test('carries a nonce, and no escape hatch for inline script', async ({
    request,
  }) => {
    const response = await request.get('/en/admin/login');
    const policy = response.headers()['content-security-policy'] ?? '';

    expect(policy).toMatch(/script-src [^;]*'nonce-[^']+'/);
    expect(policy).toContain("'strict-dynamic'");
    expect(policy).toContain("object-src 'none'");
    // The two that would quietly undo it.
    expect(policy).not.toContain("script-src 'unsafe-inline'");
    expect(policy).not.toMatch(/script-src [^;]*'unsafe-inline'/);
  });

  /**
   * The nonce in the header and the nonce on the scripts have to come from the
   * same request. Two requests carry two nonces and would agree only by
   * accident, so this reads both out of one response.
   */
  test('issues a nonce the page actually uses', async ({ request }) => {
    const response = await request.get('/en/admin/login');
    const policy = response.headers()['content-security-policy'] ?? '';
    const body = await response.text();

    const fromHeader = /'nonce-([^']+)'/.exec(policy)?.[1];
    const fromScript = /<script[^>]+nonce="([^"]+)"/.exec(body)?.[1];

    expect(fromHeader).toBeTruthy();
    expect(fromScript).toBe(fromHeader);
  });

  /**
   * The general form of a bug this suite watched go past.
   *
   * The theme is applied by an inline script, and an inline script without the
   * nonce does not run - and does not report that it did not. The admin loaded
   * perfectly, and the entire dark theme was simply never applied. Nothing in
   * the unit suite could see it: the policy is a header, and the script is a
   * string that only a browser decides whether to execute.
   */
  test('admits every inline script it renders', async ({ request }) => {
    const response = await request.get('/en/admin/login');
    const policy = response.headers()['content-security-policy'] ?? '';
    const body = await response.text();
    const inline = [
      ...body.matchAll(/<script(?![^>]*\ssrc=)([^>]*)>([\s\S]*?)<\/script>/g),
    ].map((match) => ({ attributes: match[1] ?? '', content: match[2] ?? '' }));

    expect(inline.length).toBeGreaterThan(0);

    // Each one carries the nonce, or is admitted by its hash - the theme
    // script, which the root layout renders without reading the nonce.
    for (const { attributes, content } of inline) {
      const hash = `'sha256-${createHash('sha256').update(content).digest('base64')}'`;

      expect(
        attributes.includes('nonce=') || policy.includes(hash),
        `an inline script neither nonced nor hashed: ${content.slice(0, 60)}`,
      ).toBe(true);
    }
  });

  /**
   * The theme script is admitted by its hash, and a hash that does not match
   * fails the way a missing nonce did: silently, with a light admin. So the
   * policy is checked for the hash of the script actually rendered.
   */
  test('admits the theme script by the hash of what is rendered', async ({
    request,
  }) => {
    const policy =
      (await request.get('/en/admin/login')).headers()[
        'content-security-policy'
      ] ?? '';
    const hash = `'sha256-${createHash('sha256').update(THEME_SCRIPT).digest('base64')}'`;

    expect(policy).toMatch(/script-src [^;]*'sha256-/);
    expect(policy).toContain(hash);
  });

  // A fresh nonce per response, or it is a constant with extra steps.
  test('issues a different nonce each time', async ({ request }) => {
    const first = (await request.get('/en/admin/login')).headers()[
      'content-security-policy'
    ];
    const second = (await request.get('/en/admin/login')).headers()[
      'content-security-policy'
    ];

    expect(first).not.toBe(second);
  });

  /**
   * The public site is deliberately outside this. Extending the policy there is
   * one line in the middleware on the day that site exists, and doing it before
   * then would be changing something nobody has looked at.
   */
  test('leaves the public route with only the baseline', async ({
    request,
  }) => {
    const policy =
      (await request.get('/en')).headers()['content-security-policy'] ?? '';

    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).not.toContain('script-src');
  });
});

test.describe('the admin area without a session', () => {
  test('redirects to the login page', async ({ page }) => {
    await page.goto('/en/admin');

    await expect(page).toHaveURL(/\/en\/admin\/login$/);
  });

  test('is kept out of search results', async ({ page }) => {
    await page.goto('/en/admin/login');

    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      'content',
      /noindex/,
    );
  });
});

/**
 * These assert what the visitor *sees*. An earlier check looked only at the
 * status code, which Next's built-in 404 page returns too - so it passed while
 * the site's own page was never rendering.
 */
test.describe('an address that does not exist', () => {
  const { notFoundTitle, notFoundDescription, home } = errors.errors;

  test("shows the site's own not-found page, not Next's", async ({ page }) => {
    const response = await page.goto('/en/no-such-page');

    expect(response?.status()).toBe(404);
    await expect(
      page.getByRole('heading', { name: notFoundTitle, exact: true }),
    ).toBeVisible();
    await expect(page.getByText(notFoundDescription)).toBeVisible();
    // Next's default page; its presence would mean the site's never rendered.
    await expect(page.locator('.next-error-h1')).toHaveCount(0);
  });

  test('offers a way back that actually works', async ({ page }) => {
    await page.goto('/en/no-such-page');
    await page.getByRole('link', { name: home, exact: true }).click();

    await expect(page).toHaveURL(/\/en$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  });

  test('reaches the same page from a path with no locale', async ({ page }) => {
    await page.goto('/no-such-page');

    await expect(page).toHaveURL(/\/en\/no-such-page$/);
    await expect(
      page.getByRole('heading', { name: notFoundTitle, exact: true }),
    ).toBeVisible();
  });

  // A catch-all that swallowed real routes would be worse than the bug it fixes.
  test('does not shadow the pages that do exist', async ({ page }) => {
    const homePage = await page.goto('/en');
    expect(homePage?.status()).toBe(200);
    await expect(page.locator('.next-error-h1')).toHaveCount(0);

    const loginPage = await page.goto('/en/admin/login');
    expect(loginPage?.status()).toBe(200);
    await expect(page.locator('.next-error-h1')).toHaveCount(0);
  });
});

/**
 * The theme, in the only place that can decide whether it works.
 *
 * The class goes on `<html>` from an inline script that runs before React does,
 * because the alternative is rendering light and flipping - a white flash on
 * every load for anyone who chose dark. Whether that script runs at all is a
 * decision made by the browser against a policy in a header. A unit test can
 * check the string; only this can check that it takes effect.
 */
/**
 * Dark mode on a page that does not exist - from the first frame.
 *
 * Next used to send these as its bare error shell, `<html id="__next_error__">`
 * with no stylesheet and no script, and build the page in the browser: a reader
 * who chose dark saw it turn dark only after a white frame. An address no route
 * matches now gets `global-not-found.tsx`, and a missing project is rewritten to
 * one by the proxy, so the page arrives as real HTML with the stylesheet and the
 * theme script - which is why dark is asserted at `DOMContentLoaded`, before the
 * framework, and not merely once the page has been built.
 */
test.describe('dark mode on a page that does not exist', () => {
  for (const path of [
    '/sfjsdfl',
    '/en/does-not-exist',
    '/en/.lsdjf;lsdjf',
    '/en/projects/does-not-exist',
  ]) {
    test(`arrives dark at ${path}`, async ({ page }) => {
      await page.goto('/en');
      await page.evaluate(() =>
        localStorage.setItem('portfolio-theme', 'dark'),
      );

      const response = await page.goto(path, {
        waitUntil: 'domcontentloaded',
      });

      expect(response?.status()).toBe(404);
      // Real HTML, not the shell: the stylesheet is in what was sent.
      const html = await response!.text();
      expect(html).not.toContain('__next_error__');
      expect(html).toMatch(/<link rel="stylesheet"/);

      // Dark before the framework has done anything.
      await expect(page.locator('html')).toHaveClass(/dark/);
      await expect(
        page.getByRole('heading', { name: errors.errors.notFoundTitle }),
      ).toBeVisible();
      await expect(page.locator('html')).toHaveAttribute(
        'style',
        /color-scheme:\s*dark/,
      );
      const background = await page.evaluate(
        () => getComputedStyle(document.body).backgroundColor,
      );
      expect(background).not.toMatch(/^(rgb\(255, 255, 255\)|lab\(100 0 0\))$/);
    });
  }
});

test.describe('the admin theme', () => {
  test('is applied before React, and not undone by it', async ({ page }) => {
    await page.goto('/en/admin/login');
    await page.evaluate(() => localStorage.setItem('portfolio-theme', 'dark'));

    await page.reload({ waitUntil: 'domcontentloaded' });

    // Before the framework: the document has it as soon as it is parsed.
    await expect(page.locator('html')).toHaveClass(/dark/);

    // And still has it once hydration has been over the same element.
    await page.waitForLoadState('networkidle');
    await expect(page.locator('html')).toHaveClass(/dark/);
    await expect(page.locator('html')).toHaveAttribute(
      'style',
      /color-scheme:\s*dark/,
    );
  });

  // Nothing is stored until the toggle is used, which is not the same as
  // choosing light: until then the operating system decides.
  test('leaves the page alone when nothing has been chosen', async ({
    page,
  }) => {
    await page.goto('/en/admin/login');

    await expect(page.locator('html')).not.toHaveClass(/dark/);
  });
});

test.describe('the public page without JavaScript', () => {
  // The page is rendered on the server; script only moves what is there.
  test('still shows every section', async ({ browser, request }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    const answer = await request.get(`${API_URL}/api/projects`);
    const { details } = (await answer.json()) as {
      details: { projects: { title: Record<string, string> }[] };
    };

    await page.goto('/en');

    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    for (const project of details.projects) {
      await expect(
        page.getByText(project.title.en ?? '', { exact: true }).first(),
      ).toBeAttached();
    }
    for (const id of ['about', 'work', 'path', 'record', 'contact']) {
      await page.locator(`section#${id}`).scrollIntoViewIfNeeded();
      await expect(page.locator(`section#${id}`)).toBeVisible();
    }
    await expect(page.locator('canvas')).toHaveCount(0);
    // The cover is armed by script: without it, there is nothing to lift.
    await expect(page.locator('[data-site-loader]')).toBeHidden();

    await context.close();
  });
});

test.describe('a project’s own page', () => {
  const firstProject = async (request: APIRequestContext) => {
    const answer = await request.get(`${API_URL}/api/projects`);
    const { details } = (await answer.json()) as {
      details: {
        projects: {
          slug: string;
          title: Record<string, string>;
          description: Record<string, string>;
        }[];
      };
    };

    return details.projects[0]!;
  };

  test('shows the project the admin holds, with a way back to the work', async ({
    page,
    request,
  }) => {
    const project = await firstProject(request);

    const response = await page.goto(`/en/projects/${project.slug}`);

    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle(project.title.en ?? '');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      project.title.en ?? '',
    );
    await expect(page.getByRole('article')).toContainText(
      project.description.en ?? '',
    );
    await expect(
      page.getByRole('link', { name: homeEn.home.work.back }),
    ).toHaveAttribute('href', '/en#work');
  });

  // Never a dead end: the page ends on the next project, the first after the last.
  test('ends on the next project, in the admin’s order', async ({
    page,
    request,
  }) => {
    const answer = await request.get(`${API_URL}/api/projects`);
    const { details } = (await answer.json()) as {
      details: {
        projects: {
          slug: string;
          order: number;
          title: Record<string, string>;
        }[];
      };
    };
    const ordered = [...details.projects].sort((a, b) => a.order - b.order);

    test.skip(ordered.length < 2, 'one project has no next');
    const [first, second] = ordered as [
      (typeof ordered)[number],
      (typeof ordered)[number],
    ];

    await page.goto(`/en/projects/${first.slug}`);

    await expect(
      page.getByRole('link', { name: second.title.en ?? '' }),
    ).toHaveAttribute('href', `/en/projects/${second.slug}`);
  });

  test('answers a slug that does not exist with the not-found page', async ({
    page,
  }) => {
    const response = await page.goto('/en/projects/no-such-project');

    expect(response?.status()).toBe(404);
    await expect(page.locator('.next-error-h1')).toHaveCount(0);
  });
});
