import { expect, test, type Locator, type Page } from '@playwright/test';

import adminArMessages from '../messages/ar/admin.json';
import { API_URL, credentials, STATE_PATH } from './admin-account';

/** The shipped Arabic strings, so an assertion cannot drift from them. */
const adminAr = adminArMessages.admin;

/**
 * These need the disposable account created in global setup, which needs the
 * stack running. Without it they skip loudly rather than fail: a missing Docker
 * is not a broken application.
 */
test.skip(
  () => process.env.E2E_ADMIN_READY !== 'true',
  'needs the running stack (docker compose up -d)',
);

async function signIn(page: Page) {
  const { email, password } = credentials();

  await page.goto('/en/admin/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/en\/admin$/);
}

/**
 * Edit and delete live behind a per-row menu, and deleting confirms in a real
 * dialog rather than `window.confirm` - so neither is a bare button any more,
 * and `page.once('dialog')` no longer has anything to accept.
 */
async function rowAction(
  page: Page,
  name: string,
  action: 'Edit' | 'Delete',
  // The menu names its row, which is unique for anything this file creates.
  // A `scope` is for the rows it does not name uniquely - a platform, say,
  // where the database may already hold another link to the same one.
  scope?: Locator,
) {
  await (scope ?? page)
    .getByRole('button', { name: `Actions for ${name}` })
    .click();
  await page.getByRole('menuitem', { name: action }).click();
}

/**
 * Opens a select and picks an option.
 *
 * Written out because the lists grew: a category is now one of eighteen and a
 * platform one of thirty, so the popover scrolls, and a click aimed at an
 * option while the list is still settling can land on nothing - leaving the
 * select open over a page whose other controls are then behind its overlay.
 * Waiting for the list, and then for it to close, is what makes the step mean
 * "chose that option" rather than "clicked near it".
 */
async function choose(page: Page, field: RegExp, option: string) {
  const combobox = page.getByRole('combobox', { name: field }).first();

  await combobox.click();
  await expect(page.getByRole('listbox')).toBeVisible();

  const item = page.getByRole('option', { name: option, exact: true });

  await item.scrollIntoViewIfNeeded();
  await item.click();

  await expect(page.getByRole('listbox')).toBeHidden();
}

async function deleteRow(page: Page, name: string, scope?: Locator) {
  await rowAction(page, name, 'Delete', scope);
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Delete' })
    .click();
}

/**
 * Waits until the fetched list on this page has actually arrived.
 *
 * Two waits, and the first one is the one that was missing. `goto` resolves
 * before React has mounted anything, so asking for `[aria-busy]` to be absent
 * passes *instantly* - the skeleton is not there yet, which reads exactly like
 * a list that has finished loading. Measured: at the first look the skeleton
 * count is 0 and the row count is 0.
 *
 * So: wait for either the skeleton or a row to be on screen - proof that React
 * has rendered *something* - and only then for the skeleton to go. A list that
 * is really empty still shows the skeleton first, so it settles here rather
 * than hanging.
 *
 * Measured against a deliberately delayed response: the old wait returned in
 * 479ms with the list still on its way; this one blocks until the rows exist.
 */
async function listHasSettled(page: Page) {
  // Scoped to the content landmark: `getByRole('listitem')` matches the
  // sidebar navigation's items too, and those are on screen from the first
  // paint - enough to make any list look loaded.
  const content = page.getByRole('main');
  const skeleton = content.locator('[aria-busy]');

  // `.first()` over the whole thing: during the swap both sides can match, and
  // `toBeVisible` on two elements is a strict-mode violation rather than a
  // wait.
  await expect(
    content.getByRole('listitem').first().or(skeleton).first(),
  ).toBeVisible();
  await expect(skeleton).toHaveCount(0);
}

/**
 * Deletes a row if it is there, so a run that failed halfway cannot block the
 * next one.
 *
 * Absence is only trustworthy once the list has arrived - see
 * `listHasSettled`. Without that, this skipped the delete on a slower machine
 * and left the caller asserting against a row that turned up a moment later.
 */
async function removeRow(page: Page, name: string) {
  await listHasSettled(page);

  const row = page.getByRole('listitem').filter({ hasText: name });

  if ((await row.count()) === 0) {
    return;
  }

  await deleteRow(page, name);
  await expect(row).toHaveCount(0);
}

/**
 * How a localized input is labelled once the site offers more than one
 * language: "Name" became "Name (English)" the day French shipped, and every
 * spec that reached for the bare label stopped finding it.
 *
 * A literal rather than an import: this suite is black-box, and what it asserts
 * is what the screen says in the language it is being read in.
 */
function inEnglish(label: string): string {
  return `${label} (English)`;
}

/**
 * The notifications on screen, one `li` each. A toast is read here rather than
 * by `getByText`: Radix also announces it through a hidden live region for a
 * moment, and the same words twice fail a strict locator.
 */
const notifications = (page: Page) =>
  page.getByRole('region', { name: /Notifications/ }).locator('li');

test.describe('signing in', () => {
  test('rejects an empty form before sending anything', async ({ page }) => {
    const attempts: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/api/auth/login')) {
        attempts.push(request.url());
      }
    });

    await page.goto('/en/admin/login');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.getByText('Enter a valid email address.')).toBeVisible();
    await expect(page.getByText('This field is required.')).toBeVisible();
    await expect(page).toHaveURL(/\/en\/admin\/login$/);

    // The point of client validation: nothing reached the server at all.
    expect(attempts).toEqual([]);
  });

  test('explains a wrong password in words and stays put', async ({ page }) => {
    await page.goto('/en/admin/login');
    // A real address, so the rejection is the password and not the account.
    await page.getByLabel('Email').fill(credentials().email);
    await page.getByLabel('Password').fill('not-the-password');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(
      notifications(page).filter({ hasText: 'Incorrect email or password.' }),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/en\/admin\/login$/);
  });

  test('signs in and lands on the dashboard with a real session', async ({
    page,
  }) => {
    await signIn(page);

    // Rendered from /api/auth/me, so it only appears if the cookie really works.
    await expect(
      page.getByRole('button', {
        name: `Account menu for ${credentials().email}`,
      }),
    ).toBeVisible();

    // And the session survives a reload, which a client-side redirect would not.
    await page.reload();
    await expect(page).toHaveURL(/\/en\/admin$/);
  });
});

test.describe('the admin shell', () => {
  test.use({ storageState: STATE_PATH });

  /**
   * Sign-out ends a session mid-edit, and the top-right corner of every screen
   * is where a misclick finds it. The header now carries the trigger and the
   * breadcrumb only.
   */
  test('keeps the account out of the header and in the sidebar footer', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/en/admin');

    const header = page.locator('header');
    await expect(header).toBeVisible();
    await expect(header).not.toContainText(credentials().email);

    const account = page.getByRole('button', {
      name: `Account menu for ${credentials().email}`,
    });
    await expect(account).toBeVisible();

    // Inside the sidebar, below every navigation link.
    const sidebarNav = page.getByRole('navigation', {
      name: 'Admin navigation',
    });
    const navBox = (await sidebarNav.boundingBox())!;
    const accountBox = (await account.boundingBox())!;

    expect(accountBox.y).toBeGreaterThan(navBox.y);
    expect(accountBox.x).toBeLessThan(navBox.x + navBox.width);

    await account.click();
    await expect(
      page.getByRole('menuitem', { name: 'Sign out' }),
    ).toBeVisible();
  });

  // The theme toggle lives here now that the public tree has no header.
  test('carries a theme toggle that changes the page', async ({ page }) => {
    await page.goto('/en/admin');

    const toggle = page.getByRole('radiogroup', { name: 'Theme' });

    await expect(page.locator('html')).not.toHaveClass(/dark/);
    await toggle.getByRole('radio', { name: 'Dark' }).click();
    await expect(page.locator('html')).toHaveClass(/dark/);
  });

  // A choice can be taken back: System forgets it, and the device decides
  // again - on this load and on the next.
  test('follows the device until a theme is chosen, and again after System', async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/en/admin');

    const toggle = page.getByRole('radiogroup', { name: 'Theme' });
    const html = page.locator('html');
    const system = toggle.getByRole('radio', { name: 'System' });

    await expect(html).toHaveClass(/dark/);
    await expect(system).toHaveAttribute('aria-checked', 'true');

    await toggle.getByRole('radio', { name: 'Light' }).click();
    await expect(html).not.toHaveClass(/dark/);

    await system.click();
    await expect(html).toHaveClass(/dark/);
    await expect(system).toHaveAttribute('aria-checked', 'true');
    expect(
      await page.evaluate(() => localStorage.getItem('portfolio-theme')),
    ).toBeNull();

    await page.reload();
    await expect(html).toHaveClass(/dark/);
    await expect(system).toHaveAttribute('aria-checked', 'true');
  });
});

test.describe('the technologies page', () => {
  test.use({ storageState: STATE_PATH });

  /**
   * Every row this file creates is named with the run's timestamp and removed
   * afterwards, so a failed run cannot leave a duplicate name behind and block
   * the next one - the unique index would refuse it.
   */
  test('creates a technology from the sidebar and keeps it across a reload', async ({
    page,
  }) => {
    const name = `E2E technology ${Date.now()}`;

    await page.goto('/en/admin');
    await page.getByRole('link', { name: 'Technologies' }).click();
    await expect(page).toHaveURL(/\/en\/admin\/technologies$/);

    await page.getByRole('button', { name: 'Add a technology' }).click();
    await page.getByLabel(inEnglish('Name')).fill(name);
    await page.getByLabel('Level').fill('45');
    await choose(page, /Category/, 'Backend');
    await page.getByRole('button', { name: 'Save' }).click();

    // A successful write says so; it used to close the form in silence.
    await expect(notifications(page)).toContainText('Added.');

    const row = page.getByRole('listitem').filter({ hasText: name });
    await expect(row).toBeVisible();
    // The label, not the stored code. Category and level are separate now -
    // the category is a badge, the level a figure beside it.
    await expect(row.getByText('Backend')).toBeVisible();
    await expect(row.getByText('45%')).toBeVisible();
    await expect(row).not.toContainText('backend');

    // A reload proves it reached the database, not just the client cache.
    await page.reload();
    await expect(
      page.getByRole('listitem').filter({ hasText: name }),
    ).toBeVisible();

    await removeRow(page, name);
  });

  test('refuses a duplicate name and keeps the form open', async ({ page }) => {
    const name = `E2E duplicate ${Date.now()}`;

    await page.goto('/en/admin/technologies');

    for (const attempt of [1, 2]) {
      await page.getByRole('button', { name: 'Add a technology' }).click();
      await page.getByLabel(inEnglish('Name')).fill(name);
      await page.getByLabel('Level').fill('50');
      await choose(page, /Category/, 'Other');
      await page.getByRole('button', { name: 'Save' }).click();

      if (attempt === 1) {
        await expect(
          page.getByRole('listitem').filter({ hasText: name }),
        ).toBeVisible();
      }
    }

    // The second save is refused by the unique index. The message lands on the
    // name - the field it is about - and the editor stays open with the value
    // still in it rather than closing as though it had worked.
    const nameField = page.getByLabel(inEnglish('Name'));
    await expect(nameField).toHaveAttribute('aria-invalid', 'true');
    const describedBy = await nameField.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    await expect(page.locator(`#${describedBy!}`)).toHaveText(
      'That name is already taken.',
    );
    await expect(nameField).toHaveValue(name);

    // The list is only rendered once the editor closes, so the "exactly one
    // was created" check belongs after cancelling, not before.
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(
      page.getByRole('listitem').filter({ hasText: name }),
    ).toHaveCount(1);

    await removeRow(page, name);
  });

  test('reports an empty required field on the field itself', async ({
    page,
  }) => {
    const writes: string[] = [];
    page.on('request', (request) => {
      if (
        request.method() === 'POST' &&
        request.url().includes('/api/technologies')
      ) {
        writes.push(request.url());
      }
    });

    await page.goto('/en/admin/technologies');
    await page.getByRole('button', { name: 'Add a technology' }).click();
    await page.getByRole('button', { name: 'Save' }).click();

    // The message must be attached to the field, not merely present somewhere.
    const name = page.getByLabel(inEnglish('Name'));
    await expect(name).toHaveAttribute('aria-invalid', 'true');
    const describedBy = await name.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    await expect(page.locator(`#${describedBy!}`)).toHaveText(
      'This field is required.',
    );

    expect(writes).toEqual([]);
  });
});

test.describe('reordering', () => {
  test.use({ storageState: STATE_PATH });

  const stamp = Date.now();
  /**
   * Prefixed so they sort above the seeded rows: every new row is created at
   * position 0, and the list falls back to alphabetical within a position, so
   * the assertion below is about *this* pair rather than about whatever the
   * database happens to hold.
   */
  const first = `AAA E2E order A ${stamp}`;
  const second = `AAA E2E order B ${stamp}`;

  async function addRow(page: Page, name: string) {
    await page.getByRole('button', { name: 'Add a technology' }).click();
    await page.getByLabel(inEnglish('Name')).fill(name);
    await page.getByLabel('Level').fill('50');
    await choose(page, /Category/, 'Other');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(
      page.getByRole('listitem').filter({ hasText: name }),
    ).toBeVisible();
  }

  /**
   * Order is stored, so a reload is the only thing that proves it was saved
   * rather than only shown.
   */
  test('moves a technology and keeps the new order across a reload', async ({
    page,
  }) => {
    await page.goto('/en/admin/technologies');
    await addRow(page, first);
    await addRow(page, second);

    // Scoped to the main region: the sidebar's nav entries are list items too,
    // so an unscoped `nth(0)` finds "Dashboard".
    const rows = page.getByRole('main').getByRole('listitem');

    // Alphabetical while every position is zero, so A is above B.
    await expect(rows.filter({ hasText: first })).toBeVisible();

    await page.getByRole('button', { name: `Move ${second} up` }).click();

    await expect(rows.nth(0)).toContainText(second);

    // A reload proves the order was saved, not only shown.
    await page.reload();
    await expect(
      page.getByRole('main').getByRole('listitem').nth(0),
    ).toContainText(second);

    await removeRow(page, first);
    await removeRow(page, second);
  });

  test('cannot move the first row up', async ({ page }) => {
    await page.goto('/en/admin/technologies');
    await addRow(page, first);

    await expect(
      page.getByRole('button', { name: `Move ${first} up` }),
    ).toBeDisabled();

    await removeRow(page, first);
  });
});

test.describe('the dashboard', () => {
  test.use({ storageState: STATE_PATH });

  const skillName = `E2E dashboard technology ${Date.now()}`;

  test('counts what exists and links to each section', async ({ page }) => {
    await page.goto('/en/admin/technologies');
    await page.getByRole('button', { name: 'Add a technology' }).click();
    await page.getByLabel(inEnglish('Name')).fill(skillName);
    await page.getByLabel('Level').fill('50');
    await choose(page, /Category/, 'Other');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(
      page.getByRole('listitem').filter({ hasText: skillName }),
    ).toBeVisible();

    await page.goto('/en/admin');

    // The card is found by its heading, so the count is read from the right one.
    // The whole tile is the link, named by what clicking it does.
    const expertise = page.getByRole('link', { name: 'Manage Expertise' });

    await expect(expertise).toBeVisible();
    // One tile for the three kinds, with the split spelled out beneath it.
    await expect(expertise).toContainText('technologies');

    await expertise.click();
    await expect(page).toHaveURL(/\/en\/admin\/skills$/);

    await page.goto('/en/admin/technologies');
    await deleteRow(page, skillName);
  });

  /**
   * Education, certifications, courses and languages were built after the
   * dashboard was, and for a while it did not mention them at all. They are one
   * panel rather than four more tiles: reference material, not the things that
   * change weekly.
   */
  test('accounts for the sections that are not tiles', async ({ page }) => {
    await page.goto('/en/admin');

    const background = page
      .locator('[data-slot="card"]')
      .filter({ hasText: 'Background' })
      .first();

    await expect(background).toBeVisible();

    // Named rather than counted: the seed decides the numbers, and a test that
    // pins them fails the day somebody adds a certificate.
    for (const name of [
      'Education',
      'Certifications',
      'Courses',
      'Languages',
    ]) {
      await expect(
        background.getByRole('link', { name: new RegExp(`^${name},`) }),
      ).toBeVisible();
    }

    await background.getByRole('link', { name: /^Languages,/ }).click();
    await expect(page).toHaveURL(/\/en\/admin\/languages$/);
  });

  /**
   * The counts say what exists; only their absence says what to do next.
   *
   * Written against a seed that filled everything but the resume, and phrased
   * as "that row has to be there". The seed fills the resume too now, so the
   * panel is legitimately empty on a fresh install - which is why the shape
   * asserted here is the branch rather than the row: whatever is outstanding,
   * every line of it leads to the page that resolves it, and nothing
   * outstanding says so in words.
   */
  test('lists what the site still needs', async ({ page }) => {
    await page.goto('/en/admin');

    const readiness = page
      .locator('[data-slot="card"]')
      .filter({ hasText: 'Site readiness' })
      .first();

    await expect(readiness).toBeVisible();

    // Whatever is outstanding, every row in the panel is a link to the page
    // that resolves it - an unlinked checklist is a list of complaints.
    const rows = readiness.getByRole('link');
    const count = await rows.count();

    if (count === 0) {
      await expect(readiness).toContainText('Everything the site needs');

      return;
    }

    await rows.first().click();
    await expect(page).toHaveURL(/\/en\/admin\//);
  });
});

test.describe('the projects page', () => {
  test.use({ storageState: STATE_PATH });

  /** Named with the run's timestamp, so a failed run cannot block the next. */
  const stamp = Date.now();
  const skillName = `E2E project skill ${stamp}`;
  const projectTitle = `E2E project ${stamp}`;

  async function addRow(page: Page, name: string) {
    await page.goto('/en/admin/technologies');
    await page.getByRole('button', { name: 'Add a technology' }).click();
    await page.getByLabel(inEnglish('Name')).fill(name);
    await page.getByLabel('Level').fill('50');
    await choose(page, /Category/, 'Other');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(
      page.getByRole('listitem').filter({ hasText: name }),
    ).toBeVisible();
  }

  test('creates a project linked to a skill, and keeps it across a reload', async ({
    page,
  }) => {
    await addRow(page, skillName);

    await page.goto('/en/admin');
    await page.getByRole('link', { name: 'Projects' }).click();
    await expect(page).toHaveURL(/\/en\/admin\/projects$/);

    await page.getByRole('button', { name: 'Add a project' }).click();
    await page
      .getByLabel(inEnglish('Title'), { exact: true })
      .fill(projectTitle);
    await page
      .getByLabel(inEnglish('Description'), { exact: true })
      .fill('Made by the end-to-end suite.');
    await page.getByRole('checkbox', { name: skillName }).click();
    await page.getByRole('checkbox', { name: 'Featured' }).click();
    await page.getByLabel('Repository URL').fill('https://github.com/me/repo');
    await page.getByRole('button', { name: 'Save project' }).click();

    const row = page.getByRole('listitem').filter({ hasText: projectTitle });
    await expect(row).toBeVisible();
    await expect(row).toContainText('Featured');
    await expect(row).toContainText('1 item');

    // A reload proves it reached the database, not just the client cache.
    await page.reload();
    await expect(
      page.getByRole('listitem').filter({ hasText: projectTitle }),
    ).toBeVisible();
  });

  /**
   * Cascading the removal would change what this project displays without the
   * admin seeing it happen.
   */
  test('refuses to delete a technology the project still uses', async ({
    page,
  }) => {
    await page.goto('/en/admin/technologies');

    const skillRow = page.getByRole('listitem').filter({ hasText: skillName });
    await expect(skillRow).toBeVisible();

    await deleteRow(page, skillName);

    // By its text, not by role: FieldError and Next's route announcer both
    // carry role="alert". The count comes from the API, so the admin learns
    // where to go rather than only that something conflicted.
    await expect(
      notifications(page).filter({
        hasText: '1 project still uses this. Unlink it there first.',
      }),
    ).toBeVisible();
    // Still there: the refusal is the point.
    await expect(skillRow).toBeVisible();
  });

  test('allows the skill to go once the project no longer uses it', async ({
    page,
  }) => {
    await page.goto('/en/admin/projects');
    await removeRow(page, projectTitle);

    await page.goto('/en/admin/technologies');
    await removeRow(page, skillName);

    await expect(
      page.getByRole('listitem').filter({ hasText: skillName }),
    ).toHaveCount(0);
  });

  test('reports an unsafe link on the field and saves nothing', async ({
    page,
  }) => {
    const writes: string[] = [];
    page.on('request', (request) => {
      if (
        request.method() === 'POST' &&
        request.url().endsWith('/api/projects')
      ) {
        writes.push(request.url());
      }
    });

    await page.goto('/en/admin/projects');
    await page.getByRole('button', { name: 'Add a project' }).click();
    await page
      .getByLabel(inEnglish('Title'), { exact: true })
      .fill(`${projectTitle} unsafe`);
    await page
      .getByLabel(inEnglish('Description'), { exact: true })
      .fill('Nope.');
    await page.getByLabel('Live URL').fill('javascript:alert(1)');
    await page.getByRole('button', { name: 'Save project' }).click();

    const live = page.getByLabel('Live URL');
    await expect(live).toHaveAttribute('aria-invalid', 'true');
    const describedBy = await live.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    await expect(page.locator(`#${describedBy!}`)).toHaveText(
      'Enter a valid URL.',
    );

    expect(writes).toEqual([]);
  });
});

test.describe('the social links page', () => {
  test.use({ storageState: STATE_PATH });

  const url = `https://github.com/e2e-${Date.now()}`;

  test('creates a link from the sidebar and keeps it across a reload', async ({
    page,
  }) => {
    await page.goto('/en/admin');
    await page.getByRole('link', { name: 'Social links' }).click();
    await expect(page).toHaveURL(/\/en\/admin\/social-links$/);

    await page.getByRole('button', { name: 'Add a link' }).click();
    await choose(page, /Platform/, 'GitHub');
    await page.getByLabel('URL').fill(url);
    await page.getByRole('button', { name: 'Save link' }).click();

    // A table row, not a list item: platform-and-URL is two facts per row,
    // the same two every time, which is what a table is for.
    const row = page.getByRole('row').filter({ hasText: url });
    await expect(row).toBeVisible();
    // The label, not the stored code.
    await expect(row).toContainText('GitHub');
    // And the brand mark beside it, drawn rather than merely named.
    await expect(row.getByRole('img', { name: 'GitHub' })).toBeVisible();

    await page.reload();
    await expect(page.getByRole('row').filter({ hasText: url })).toBeVisible();

    await deleteRow(page, 'GitHub', row);
    await expect(row).toHaveCount(0);
  });

  /**
   * A developer is found in more places than a general audience is, and thirty
   * flat options is a list you read rather than scan. The groups are what make
   * "where does a GitLab link go" answer itself.
   */
  test('offers the platforms grouped, code hosts included', async ({
    page,
  }) => {
    await page.goto('/en/admin/social-links');
    await page.getByRole('button', { name: 'Add a link' }).click();
    await page
      .getByRole('combobox', { name: /Platform/ })
      .first()
      .click();

    const listbox = page.getByRole('listbox');
    await expect(listbox).toBeVisible();

    await expect(
      listbox.getByRole('group', { name: 'Code hosting' }),
    ).toContainText('GitLab');
    await expect(
      listbox.getByRole('group', { name: 'Communities & writing' }),
    ).toContainText('Stack Overflow');

    await page.keyboard.press('Escape');
  });

  test('reports an unsafe URL on the field and saves nothing', async ({
    page,
  }) => {
    const writes: string[] = [];
    page.on('request', (request) => {
      if (
        request.method() === 'POST' &&
        request.url().endsWith('/api/social-links')
      ) {
        writes.push(request.url());
      }
    });

    await page.goto('/en/admin/social-links');
    await page.getByRole('button', { name: 'Add a link' }).click();
    await choose(page, /Platform/, 'Website');
    await page.getByLabel('URL').fill('javascript:alert(1)');
    await page.getByRole('button', { name: 'Save link' }).click();

    const field = page.getByLabel('URL');
    await expect(field).toHaveAttribute('aria-invalid', 'true');
    const describedBy = await field.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    await expect(page.locator(`#${describedBy!}`)).toHaveText(
      'Enter a valid URL.',
    );

    expect(writes).toEqual([]);
  });
});

test.describe('the contact endpoint and the inbox', () => {
  test.use({ storageState: STATE_PATH });

  const stamp = Date.now();
  const realSubject = `E2E real message ${stamp}`;
  const trappedSubject = `E2E trapped message ${stamp}`;

  function submission(subject: string, extra: Record<string, string> = {}) {
    return {
      name: 'End To End',
      email: 'e2e@example.test',
      subject,
      body: 'Sent by the end-to-end suite.',
      ...extra,
    };
  }

  /**
   * The endpoint directly rather than through the public form, which has its
   * own test in `public.spec.ts`. What this one is about is the other half -
   * that a submission reaches the inbox and arrives unread - and posting it
   * here is also how a real submission arrives once it leaves the browser.
   */
  test('accepts a message and shows it unread in the inbox', async ({
    page,
    request,
  }) => {
    const response = await request.post(`${API_URL}/api/messages`, {
      data: submission(realSubject),
    });

    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({ code: 'SUCCESS', details: {} });

    await page.goto('/en/admin');
    await page.getByRole('link', { name: 'Messages' }).click();
    await expect(page).toHaveURL(/\/en\/admin\/messages$/);

    // The list carries the subject, the sender and the unread mark; the
    // address belongs to the message itself, which the pane shows.
    const row = page.getByRole('listitem').filter({ hasText: realSubject });
    await expect(row).toBeVisible();
    await expect(row.getByText('Unread', { exact: true })).toBeVisible();

    await row.getByRole('button').click();
    await expect(page.getByText('e2e@example.test')).toBeVisible();
  });

  /**
   * The trap has to be invisible: a sender who filled the hidden field gets
   * the same answer as a real one, and nothing is stored.
   */
  test('answers a trapped submission identically but stores nothing', async ({
    page,
    request,
  }) => {
    const response = await request.post(`${API_URL}/api/messages`, {
      data: submission(trappedSubject, { website: 'http://spam.example' }),
    });

    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({ code: 'SUCCESS', details: {} });

    await page.goto('/en/admin/messages');
    await expect(page.getByText(realSubject)).toBeVisible();
    await expect(
      page.getByRole('listitem').filter({ hasText: trappedSubject }),
    ).toHaveCount(0);
  });

  /**
   * Both panes were capped at 32 rem, so on a tall screen the list stopped
   * mid-page with nothing under it and a long message was read through a short
   * window. They take the height the page has left and scroll inside it - which
   * also means the page itself must not scroll.
   */
  test('fills the screen rather than a fixed box in the middle of it', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/en/admin/messages');

    const list = page.getByRole('list', { name: 'Received messages' });
    await expect(list).toBeVisible();

    // The *scrolling region*, not the card around it: a card stretched by the
    // grid fills the height whether or not the thing inside it does, so
    // measuring the card would pass with the 32 rem cap still in place.
    const viewport = (await list
      .locator('xpath=ancestor::*[@data-slot="scroll-area-viewport"]')
      .first()
      .boundingBox())!;

    // Comfortably past the 32 rem it used to stop at, on a 900 px screen.
    expect(viewport.height).toBeGreaterThan(560);
    // And it ends near the bottom edge rather than mid-page.
    expect(900 - (viewport.y + viewport.height)).toBeLessThan(64);

    // Deliberately not "the document must not scroll": the shell's height is
    // `min-h-svh`, and under a viewport resized after launch Firefox reports
    // `svh` a scrollbar's width away from `innerHeight` - noise from the
    // harness, not from the page. Where the panes *end* is the claim, and it
    // is the one that fails when the cap comes back.

    // The reading pane is the half that held a long message, so it is measured
    // too rather than assumed to follow the list.
    await list.getByRole('listitem').first().getByRole('button').click();

    const reading = (await page
      .locator('[data-slot="scroll-area-viewport"]')
      .last()
      .boundingBox())!;

    expect(900 - (reading.y + reading.height)).toBeLessThan(64);
  });

  test('marks a message read, then deletes it', async ({ page }) => {
    await page.goto('/en/admin/messages');

    // Nothing is chosen at first, so the pane says what to do.
    await expect(page.getByText('Choose a message to read it')).toBeVisible();

    const row = page.getByRole('listitem').filter({ hasText: realSubject });
    await expect(row).toBeVisible();
    await row.getByRole('button').click();

    await page.getByRole('button', { name: 'Mark as read' }).click();
    // `exact` matters here: getByText does case-insensitive substring matching,
    // so a loose 'Unread' also matches the "Mark as unread" button that appears
    // once the message is read - and the assertion could never pass.
    await expect(row.getByText('Unread', { exact: true })).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: 'Mark as unread' }),
    ).toBeVisible();

    // It survives a reload, so it reached the database rather than the cache.
    await page.reload();
    await page
      .getByRole('listitem')
      .filter({ hasText: realSubject })
      .getByRole('button')
      .click();
    await expect(
      page.getByRole('button', { name: 'Mark as unread' }),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Delete' }).click();
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Delete' })
      .click();

    await expect(
      page.getByRole('listitem').filter({ hasText: realSubject }),
    ).toHaveCount(0);
    await expect(notifications(page)).toContainText('Deleted.');
  });
});

/**
 * The second locale, end to end.
 *
 * The project claimed multilingual readiness from the first commit, and the
 * claim was only ever checked by unit tests against mocked routing. This walks
 * a real browser through the French admin: the shell, the switcher, and a form
 * that has to grow an input per language.
 */
test.describe('the admin in French', () => {
  test.use({ storageState: STATE_PATH });

  test('renders the whole shell in French', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/fr/admin');

    // The page's own language, not just its words: `dir` and `lang` are what
    // every logical CSS property in the app resolves against.
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');

    await expect(
      page.getByRole('heading', { name: 'Tableau de bord', level: 1 }),
    ).toBeVisible();

    const nav = page.getByRole('navigation', {
      name: 'Navigation de l’administration',
    });

    for (const heading of ['Vue d’ensemble', 'Personnel', 'Qualifications']) {
      await expect(nav.getByText(heading, { exact: true })).toBeVisible();
    }

    await nav.getByRole('link', { name: 'Formation' }).click();
    await expect(page).toHaveURL(/\/fr\/admin\/education$/);
  });

  /**
   * A locale nobody can reach except by editing the URL is not shipped. The
   * switcher stays on the page it was used from - the language is a property of
   * how you read the site, not a reason to lose your place in it.
   *
   * It is in the header now. It used to be a radio group inside the account
   * menu, two clicks deep and one row above "Log out".
   */
  test('switches language from the header and stays on the page', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/en/admin/languages');

    await page
      .getByRole('radiogroup', { name: 'Interface language' })
      // Each language named in itself, because the person who needs the switch
      // is the one who cannot read what is currently on screen.
      .getByRole('radio', { name: 'français' })
      .click();

    await expect(page).toHaveURL(/\/fr\/admin\/languages$/);
    await expect(
      page.getByRole('heading', { name: 'Langues', level: 1 }),
    ).toBeVisible();
  });

  /**
   * The claim the whole architecture rests on: one entry in `routing.locales`
   * grows every localized field, and only the default locale is required - so
   * a row saved before French existed is still valid.
   *
   * It grows a *choice* rather than another input now. The language is named
   * and not spelled - "Nom (fr)" is a subtag on a screen - and it is in the
   * accessible name rather than printed beside a control that already shows it.
   */
  test('gives a localized field one input, and the other language a click away', async ({
    page,
  }) => {
    await page.goto('/fr/admin/skills');
    await page.getByRole('button', { name: 'Ajouter une compétence' }).click();

    const required = page.getByLabel('Nom (anglais)');

    await expect(required).toBeVisible();
    await expect(required).toHaveAttribute('required', '');
    // One field, not two boxes side by side.
    await expect(page.getByLabel('Nom (français)')).toHaveCount(0);

    await page
      .getByRole('radiogroup', { name: 'Langue du contenu' })
      .first()
      .getByRole('radio', { name: 'français' })
      .click();

    const optional = page.getByLabel('Nom (français)');

    await expect(optional).toBeVisible();
    await expect(optional).not.toHaveAttribute('required', '');
  });
});

/**
 * The third locale, and the first one that reads the other way.
 *
 * French proved the words could be swapped. Arabic is what proves the *layout*
 * can, and almost none of that is assertable without a browser: a class written
 * in logical properties and a class written in physical ones look identical in
 * the markup and land in different places on the screen. So these measure
 * boxes rather than read attributes wherever the claim is about position.
 */
test.describe('the admin in Arabic', () => {
  test.use({ storageState: STATE_PATH });

  const WIDE = { width: 1440, height: 900 };

  test('renders the whole shell in Arabic, right to left', async ({ page }) => {
    await page.setViewportSize(WIDE);
    await page.goto('/ar/admin');

    // `dir` is what every `ps-`, `me-` and `border-s` in the application
    // resolves against. Without it the words are Arabic on a layout still
    // running the other way, and nothing else here would notice.
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');

    await expect(
      page.getByRole('heading', { name: 'لوحة المعلومات', level: 1 }),
    ).toBeVisible();

    const nav = page.getByRole('navigation', { name: 'تنقل لوحة الإدارة' });

    for (const heading of ['نظرة عامة', 'البيانات الشخصية', 'المؤهلات']) {
      await expect(nav.getByText(heading, { exact: true })).toBeVisible();
    }

    await nav.getByRole('link', { name: 'التعليم' }).click();
    await expect(page).toHaveURL(/\/ar\/admin\/education$/);
  });

  /**
   * `<html dir>` is what CSS reads and it is only half of it: Radix reads the
   * direction from its own provider and nowhere else, so a page can be
   * correctly mirrored and still answer the arrow keys the wrong way round.
   *
   * Asserted on a control Radix writes `dir` onto itself, which is the only
   * visible evidence that the provider is above it.
   */
  test('tells the component library which way the page reads', async ({
    page,
  }) => {
    await page.setViewportSize(WIDE);
    await page.goto('/ar/admin');

    await expect(
      page.getByRole('radiogroup', { name: 'لغة الواجهة' }),
    ).toHaveAttribute('dir', 'rtl');

    await page.goto('/en/admin');

    await expect(
      page.getByRole('radiogroup', { name: 'Interface language' }),
    ).toHaveAttribute('dir', 'ltr');
  });

  /**
   * The narrow screen swaps the fixed panel for a sheet, which is a second
   * implementation of the same idea and was physical in the same way. It slid
   * in from the left of an Arabic page, over the start of every line of text.
   */
  test('opens the narrow-screen sidebar from the side the text starts on', async ({
    page,
  }) => {
    const NARROW = { width: 600, height: 900 };

    await page.setViewportSize(NARROW);
    await page.goto('/ar/admin');

    await page
      .getByRole('button', { name: 'إظهار قائمة التنقل أو إخفاؤها' })
      .click();

    const sheet = page.locator('[data-slot="sidebar"][data-mobile="true"]');

    await expect(sheet).toBeVisible();

    const box = await sheet.boundingBox();

    expect(box).not.toBeNull();
    expect(box!.x + box!.width).toBeGreaterThan(NARROW.width - 4);
  });

  /**
   * The one the vendored sidebar got wrong.
   *
   * Its fixed panel was placed with `left-0` while the flow around it honoured
   * the direction, so the Arabic admin put the gap on the right and the panel
   * on the left - a sidebar lying on top of its own content. The markup was
   * identical in both languages; only the pixels disagreed.
   */
  test('puts the sidebar where the text starts, and not on top of the page', async ({
    page,
  }) => {
    await page.setViewportSize(WIDE);

    async function boxes() {
      const sidebar = await page
        .locator('[data-slot="sidebar-container"]')
        .boundingBox();
      const content = await page.locator('main').first().boundingBox();

      expect(sidebar).not.toBeNull();
      expect(content).not.toBeNull();

      return { sidebar: sidebar!, content: content! };
    }

    await page.goto('/en/admin');
    const ltr = await boxes();

    // English: panel against the left edge, content to the right of it.
    expect(ltr.sidebar.x).toBeLessThan(4);
    expect(ltr.content.x).toBeGreaterThanOrEqual(
      ltr.sidebar.x + ltr.sidebar.width - 1,
    );

    await page.goto('/ar/admin');
    const rtl = await boxes();

    // Arabic: the same panel against the right edge, content to the left of it.
    expect(rtl.sidebar.x + rtl.sidebar.width).toBeGreaterThan(WIDE.width - 4);
    expect(rtl.content.x + rtl.content.width).toBeLessThanOrEqual(
      rtl.sidebar.x + 1,
    );
  });

  /**
   * Collapsed to a rail, every nav item explains itself in a tooltip, and the
   * tooltip is asked for a physical `side` that Radix does not mirror for a
   * right-to-left document - only `align` is direction-aware. So this looked
   * like the next thing to fix, and measuring said otherwise: the rail is
   * against the edge of the screen, there is no room on the side the prop
   * names, and the popper's collision handling flips it on its own. Naming the
   * side from the direction changed nothing and was taken back out.
   *
   * The test stayed, because the behaviour is worth holding even though the
   * prop turned out not to be: a tooltip that opens across the page instead of
   * into the margin covers what the reader is trying to read.
   */
  test('opens the collapsed rail’s tooltips into the margin, not across the page', async ({
    page,
  }) => {
    await page.setViewportSize(WIDE);
    await page.goto('/ar/admin');

    // The trigger collapses the sidebar to icons; the tooltips exist only then.
    await page
      .getByRole('button', { name: 'إظهار قائمة التنقل أو إخفاؤها' })
      .click();

    const rail = page.locator('[data-slot="sidebar-container"]');
    // By href rather than by name: collapsed to a rail, the label is clipped
    // to nothing, which is the whole reason the tooltip exists.
    const item = rail.locator(
      '[data-slot="sidebar-menu-button"][href$="/admin/projects"]',
    );

    // Focused rather than hovered. Radix opens the tooltip either way, and the
    // collapsed rail has an invisible group label lying across some of its
    // buttons - an upstream quirk that has nothing to do with direction and is
    // not this test's subject.
    await item.focus();

    const tip = page.getByRole('tooltip').first();

    await expect(tip).toBeVisible();

    const tipBox = await tip.boundingBox();
    const railBox = await rail.boundingBox();

    expect(tipBox).not.toBeNull();
    expect(railBox).not.toBeNull();

    // Arabic reads from the right, so the rail is on the right and the space
    // beside it is to its left.
    expect(tipBox!.x).toBeLessThan(railBox!.x);
  });

  /**
   * A mirrored layout's loudest symptom is a page that scrolls sideways: one
   * element still pinned to the left edge drags the document past the right
   * one. Cheap to assert, and it covers everything on the screen at once
   * rather than the pieces this file thought to name.
   */
  test('does not scroll sideways in any direction', async ({ page }) => {
    await page.setViewportSize(WIDE);

    for (const path of [
      '/ar/admin',
      '/ar/admin/projects',
      '/ar/admin/messages',
    ]) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      );

      expect(overflow, `${path} scrolls sideways`).toBeLessThanOrEqual(1);
    }
  });

  /**
   * A locale nobody can reach except by editing the URL is not shipped, and
   * the switcher is the only way in. Arabic is the third option on a control
   * that was built for two.
   */
  test('switches to Arabic from the header and stays on the page', async ({
    page,
  }) => {
    await page.setViewportSize(WIDE);
    await page.goto('/en/admin/languages');

    const switcher = page.getByRole('radiogroup', {
      name: 'Interface language',
    });

    await expect(switcher.getByRole('radio')).toHaveCount(3);

    // Named in itself - the person who needs the switch is the one who cannot
    // read what is on screen.
    await switcher.getByRole('radio', { name: 'العربية' }).click();

    await expect(page).toHaveURL(/\/ar\/admin\/languages$/);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(
      page.getByRole('heading', { name: 'اللغات', level: 1 }),
    ).toBeVisible();
  });

  /**
   * The claim the whole architecture rests on, now made a third time: one
   * entry in `routing.locales` grows every localized field, and only the
   * default locale is required - so every row saved before Arabic existed is
   * still valid.
   */
  test('grows an Arabic input on a localized field, and requires only English', async ({
    page,
  }) => {
    await page.goto('/ar/admin/skills');
    await page.getByRole('button', { name: 'إضافة مهارة' }).click();

    const required = page.getByLabel('الاسم (الإنجليزية)');

    await expect(required).toBeVisible();
    await expect(required).toHaveAttribute('required', '');
    await expect(page.getByLabel('الاسم (العربية)')).toHaveCount(0);

    await page
      .getByRole('radiogroup', { name: 'لغة المحتوى' })
      .first()
      .getByRole('radio', { name: 'العربية' })
      .click();

    const optional = page.getByLabel('الاسم (العربية)');

    await expect(optional).toBeVisible();
    await expect(optional).not.toHaveAttribute('required', '');
  });

  /**
   * Content is not the interface, and it does not take the interface's
   * direction.
   *
   * Everything the owner types is stored in whatever language they typed it
   * in, and only the default locale is ever required - so most rows are
   * English on an Arabic page and will stay that way until somebody translates
   * them. Inheriting `rtl` from the document does not merely misalign that
   * text: the bidirectional algorithm moves the neutral characters at the end
   * of the run to the other end, so an English sentence rendered here came out
   * with its full stop in front of the first word.
   *
   * `dir="auto"` on the elements that print stored text is the fix - the
   * browser reads the first strong character and directs that element by it.
   * Asserted on the computed direction rather than the attribute, because what
   * the attribute is worth is exactly what the browser resolves it to.
   */
  test('directs stored text by its own language, not the page’s', async ({
    page,
  }) => {
    await page.setViewportSize(WIDE);
    await page.goto('/ar/admin/certifications');

    // A certificate's name is never translated: it is the name on the award,
    // so it is Latin text on a right-to-left page by design.
    const untranslated = page.getByText('Front End Development Libraries');

    await expect(untranslated).toBeVisible();
    await expect(
      untranslated.evaluate((el) => getComputedStyle(el).direction),
    ).resolves.toBe('ltr');

    // And the Arabic beside it reads the other way, in the same card.
    const translated = page.getByText(/^قيد الإنجاز — لم تُنَل بعد/).first();

    await expect(translated).toBeVisible();
    await expect(
      translated.evaluate((el) => getComputedStyle(el).direction),
    ).resolves.toBe('rtl');

    // And the chrome around it still reads the other way, which is the half
    // that would break if this were fixed by turning the page around.
    await expect(
      page
        .getByRole('heading', { level: 1 })
        .evaluate((el) => getComputedStyle(el).direction),
    ).resolves.toBe('rtl');
  });

  /**
   * The chrome a screen reader hears and nobody sees.
   *
   * On a narrow screen the navigation is a dialog, and its accessible name and
   * description are the only words that say what just opened. The vendored
   * sidebar hard-codes both in English, so an Arabic page announced "Sidebar"
   * and "Displays the mobile sidebar" - text that passes every visual check
   * there is, because none of it is visible.
   *
   * Asserted through the accessible name rather than by reading the DOM: what
   * matters is what the accessibility tree resolves to, which is the thing the
   * defect was hiding from.
   */
  test('names the mobile navigation in Arabic too', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/ar/admin');

    await page
      .getByRole('button', { name: adminAr.nav.label })
      .or(page.getByRole('button', { name: adminAr.toggleSidebar }))
      .first()
      .click();

    const drawer = page.getByRole('dialog', { name: adminAr.nav.label });

    await expect(drawer).toBeVisible();
    await expect(drawer).toContainText(adminAr.nav.drawerDescription);
    // The two strings the vendored component would have used instead.
    await expect(drawer).not.toContainText('Sidebar');
    await expect(drawer).not.toContainText('Displays the mobile sidebar');
  });

  /**
   * Western digits, deliberately.
   *
   * `Intl` decides this, and current CLDR gives plain `ar` Latin digits while
   * `ar-EG` keeps Arabic-Indic ones. That is the right default here - the rows
   * beside these numbers carry Latin IDs, dates and version strings, and the
   * Maghreb writes its numerals this way - but it is a default rather than a
   * decision until something says so out loud.
   */
  test('writes its numbers in the digits the rest of the screen uses', async ({
    page,
  }) => {
    await page.setViewportSize(WIDE);
    await page.goto('/ar/admin');

    const readiness = page.getByText(/مكتمل$/).first();

    await expect(readiness).toBeVisible();
    await expect(readiness).toHaveText(/^[0-9]+ من [0-9]+ مكتمل$/);
  });

  /**
   * The fix from the last task, in the locale that did not exist when it was
   * made. An editor is a place, and the place survives being read backwards.
   */
  test('still closes the editor rather than leaving the page on Back', async ({
    page,
  }) => {
    await page.goto('/ar/admin/skills');
    await page.getByRole('button', { name: 'إضافة مهارة' }).click();

    await expect(page).toHaveURL(/\/ar\/admin\/skills\?edit=new$/);
    await expect(page.getByLabel('الاسم (الإنجليزية)')).toBeVisible();

    await page.goBack();

    await expect(page).toHaveURL(/\/ar\/admin\/skills$/);
    await expect(page.getByLabel('الاسم (الإنجليزية)')).toHaveCount(0);
    await expect(
      page.getByRole('heading', { name: 'المهارات', level: 1 }),
    ).toBeVisible();
  });
});

/**
 * Collapsed to a rail, the sidebar is icons only - and every one of them has to
 * still be a link.
 */
/**
 * A logo the vendored set did not carry.
 *
 * The owner added freeCodeCamp as a social platform and found no mark to give
 * it, because the generator's curated slug list had never named one. The set is
 * deliberately a subset - 3,400 icons for the thirty a portfolio uses is not a
 * dependency worth having - so "not there" is a normal outcome and adding one
 * is a line in `scripts/generate-skill-icons.mjs` plus a regeneration.
 *
 * Both halves are asserted, because they fail separately: a slug that is in the
 * data but not offered by the picker cannot be chosen, and one that is offered
 * but draws nothing is a blank square in a table.
 */
test.describe('the freeCodeCamp logo', () => {
  test.use({ storageState: STATE_PATH });

  test('is offered by the picker, under the name people search for', async ({
    page,
  }) => {
    await page.goto('/en/admin/technologies');
    await page.getByRole('button', { name: 'Add a technology' }).click();

    await page.getByLabel('Search logos').fill('freecodecamp');

    await expect(
      page.getByRole('button', { name: 'freeCodeCamp', exact: true }),
    ).toBeVisible();
  });

  /**
   * And drawn where it is used. The social-links table is the one place this
   * mark actually appears, and `platform-mark.tsx` falls back to a generic
   * glyph when a platform has no vendored logo - so a missing slug would show
   * as something plausible rather than as nothing.
   */
  test('is drawn beside the link that uses it', async ({ page }) => {
    await page.goto('/en/admin/social-links');

    const mark = page
      .getByRole('row', { name: /freeCodeCamp/i })
      .getByRole('img', { name: 'freeCodeCamp' });

    await expect(mark).toBeVisible();
    // The brand's own path, not the fallback: the fallback is a lucide icon
    // and carries no `viewBox` of the vendored set's shape.
    await expect(mark).toHaveAttribute('viewBox', '0 0 24 24');
  });
});

test.describe('the collapsed sidebar', () => {
  test.use({ storageState: STATE_PATH });

  /**
   * Found while measuring the Arabic layout, and true in every language.
   *
   * `SidebarGroupLabel` fades to `opacity-0` when the rail collapses and is
   * pulled up eight units *over the row above it*. An element at zero opacity
   * is still the topmost thing under the cursor, so the last item of every
   * group but the first was covered by an invisible heading: the icon was
   * there, the pointer reached the label instead, and nothing on screen
   * explained why the click did nothing.
   *
   * Driven with a real click rather than by reading classes, because what
   * broke was hit-testing and nothing else.
   */
  test('lets every icon in the rail be clicked', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/en/admin');

    await page
      .getByRole('button', { name: 'Toggle the navigation menu' })
      .click();

    const rail = page.locator('[data-slot="sidebar-container"]');

    // One from the top group, and one that sits directly under the next
    // group's heading - which is the pair that behaved differently.
    for (const [href, heading] of [
      ['/admin/messages', 'Messages'],
      ['/admin/projects', 'Projects'],
      ['/admin/options', 'Option lists'],
    ] as const) {
      await rail
        .locator(`[data-slot="sidebar-menu-button"][href$="${href}"]`)
        .click();

      await expect(page).toHaveURL(new RegExp(`/en${href}$`));
      await expect(
        page.getByRole('heading', { name: heading, level: 1 }),
      ).toBeVisible();
    }
  });
});

test.describe('the layout', () => {
  test.use({ storageState: STATE_PATH });

  /**
   * The claim this makes is narrow on purpose: a form laid out in columns must
   * actually put two fields on one line at a usable width, and must not do so
   * when there is no room. Anything finer than that is a matter of taste and
   * does not belong in an assertion.
   */
  /**
   * The shell is pinned to the viewport and the content column is what
   * scrolls. It was the other way round - the wrapper was `min-h-svh`, so the
   * whole document grew with the page and nothing inside could resolve "as
   * tall as the screen" against anything. The inbox looked right with eight
   * messages and pushed the document a thousand pixels past the fold with
   * twenty.
   */
  test('scrolls the content column rather than the document', async ({
    page,
  }) => {
    // Short enough that no page could fit, whatever the database holds: the
    // form's height depends on how many technologies exist to tick.
    await page.setViewportSize({ width: 1440, height: 400 });
    await page.goto('/en/admin/projects');
    await page.getByRole('button', { name: 'Add a project' }).click();
    await expect(page.getByLabel(inEnglish('Title'))).toBeVisible();

    const measured = await page.evaluate(() => {
      const main = document.querySelector('main.\\@container\\/admin-content')!;

      main.scrollTop = 10_000;

      return {
        documentOverflow:
          document.documentElement.scrollHeight - window.innerHeight,
        columnScrolls: main.scrollHeight > main.clientHeight,
        scrolledTo: main.scrollTop,
      };
    });

    expect(measured.columnScrolls).toBe(true);
    expect(measured.scrolledTo).toBeGreaterThan(0);
    expect(measured.documentOverflow).toBeLessThanOrEqual(1);

    // Which is what keeps the header where it is while the page moves.
    const header = (await page.locator('header').boundingBox())!;
    expect(header.y).toBeLessThanOrEqual(1);
  });

  /**
   * It was one column capped at 56 rem, which left half a wide screen empty
   * and made a five-role career four screens tall. The claim is narrow on
   * purpose: two cards share a row when there is room for two, and share none
   * when there is not.
   */
  test('lays the career out in two columns on a wide screen', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.goto('/en/admin/experience');

    // A second position, added for the check and removed after it, when the
    // content has only one: a layout of two columns needs two cards.
    const added = await page.evaluate(async (api) => {
      const list = await fetch(`${api}/api/experience`);
      const { details } = (await list.json()) as {
        details: { experience: unknown[] };
      };

      if (details.experience.length > 1) {
        return undefined;
      }

      const answer = await fetch(`${api}/api/experience`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: { en: `e2e-layout-${Date.now()}` },
          organisation: { en: 'E2E' },
          employmentType: 'full-time',
          startDate: '2020-01',
          endDate: '2020-06',
        }),
      });
      const body = (await answer.json()) as {
        details: { experience?: { id: string } };
      };

      return body.details.experience?.id;
    }, API_URL);

    await page.reload();

    // Scoped to the page: the sidebar's own entries are list items too.
    const cards = page.getByRole('main').getByRole('listitem');
    await expect(cards.nth(1)).toBeVisible();

    const first = (await cards.nth(0).boundingBox())!;
    const second = (await cards.nth(1).boundingBox())!;

    expect(second.y).toBe(first.y);
    // And the row spans the container rather than stopping at 56 rem.
    expect(second.x + second.width - first.x).toBeGreaterThan(1000);

    await page.setViewportSize({ width: 900, height: 900 });
    const narrowFirst = (await cards.nth(0).boundingBox())!;
    const narrowSecond = (await cards.nth(1).boundingBox())!;

    expect(narrowSecond.y).toBeGreaterThan(narrowFirst.y);

    if (added) {
      await page.evaluate(
        ({ api, id }) =>
          fetch(`${api}/api/experience/${id}`, {
            method: 'DELETE',
            credentials: 'include',
          }),
        { api: API_URL, id: added },
      );
    }
  });

  test('pairs short fields on a wide screen', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/en/admin/social-links');
    await page.getByRole('button', { name: 'Add a link' }).click();

    const platform = await page
      .getByRole('combobox', { name: /Platform/ })
      .boundingBox();
    const url = await page.getByLabel('URL').boundingBox();

    // Same line, side by side.
    expect(platform!.y).toBeCloseTo(url!.y, 0);
    expect(url!.x).toBeGreaterThan(platform!.x);
  });

  test('stacks them when there is no room', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/en/admin/social-links');
    await page.getByRole('button', { name: 'Add a link' }).click();

    const platform = await page
      .getByRole('combobox', { name: /Platform/ })
      .boundingBox();
    const url = await page.getByLabel('URL').boundingBox();

    expect(url!.y).toBeGreaterThan(platform!.y);
  });

  // A row whose buttons overflow its border is the failure this prevents.
  test('keeps list actions inside the row on a narrow screen', async ({
    page,
  }) => {
    const name = `E2E layout ${Date.now()}`;

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/en/admin/technologies');

    await page.getByRole('button', { name: 'Add a technology' }).click();
    await page.getByLabel(inEnglish('Name')).fill(name);
    await page.getByLabel('Level').fill('50');
    await choose(page, /Category/, 'Other');
    await page.getByRole('button', { name: 'Save' }).click();

    const row = page.getByRole('listitem').filter({ hasText: name });
    await expect(row).toBeVisible();

    const bounds = await row.boundingBox();
    const actions = await row
      .getByRole('button', { name: `Actions for ${name}` })
      .boundingBox();

    expect(actions!.x + actions!.width).toBeLessThanOrEqual(
      bounds!.x + bounds!.width + 1,
    );

    await deleteRow(page, name);
    await expect(row).toHaveCount(0);
  });

  /**
   * The rail is the point of a collapsible sidebar: the labels go, the links
   * stay. If collapsing hid the navigation itself it would only be a way to
   * lose it.
   */
  test('collapses the sidebar to a rail without losing the links', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/en/admin/skills');

    const nav = page.getByRole('navigation', { name: 'Admin navigation' });
    const skills = nav.getByRole('link', { name: 'Skills', exact: true });

    const wide = await skills.boundingBox();

    await page
      .getByRole('button', { name: 'Toggle the navigation menu' })
      .click();

    // Still there, and still a link - narrower, because the label is hidden.
    await expect(skills).toBeVisible();
    await expect
      .poll(async () => (await skills.boundingBox())!.width)
      .toBeLessThan(wide!.width);

    // Which is exactly why the header has to say where you are.
    await expect(
      page.getByRole('navigation', { name: 'breadcrumb' }),
    ).toContainText('Skills');

    await skills.click();
    await expect(page).toHaveURL(/\/en\/admin\/skills$/);
  });

  test('groups the sidebar and keeps every page reachable', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/en/admin');

    const nav = page.getByRole('navigation', { name: 'Admin navigation' });

    // Six groups, none larger than three. One group of eleven was still a list.
    for (const heading of [
      'Overview',
      'Personal',
      'Expertise',
      'Career',
      'Qualifications',
      'Inbox',
    ]) {
      await expect(nav.getByText(heading, { exact: true })).toBeVisible();
    }

    await nav.getByRole('link', { name: 'Projects' }).click();
    await expect(page).toHaveURL(/\/en\/admin\/projects$/);
  });

  /**
   * The navigation table is the only place a section is declared: the sidebar
   * renders it and the breadcrumb resolves against it. A page reachable by URL
   * but missing from the table is a page nobody finds.
   */
  test('lists every admin page in the sidebar', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/en/admin');

    const nav = page.getByRole('navigation', { name: 'Admin navigation' });

    // Polled: `evaluateAll` resolves the locator once, with no waiting of its
    // own, so a read taken before the shell has finished its session check
    // sees an empty list and passes or fails on timing rather than on content.
    await expect
      .poll(() =>
        nav
          .getByRole('link')
          .evaluateAll((links) =>
            links.map((link) => link.getAttribute('href')),
          ),
      )
      .toEqual(
        expect.arrayContaining([
          '/en/admin',
          '/en/admin/profile',
          '/en/admin/skills',
          '/en/admin/technologies',
          '/en/admin/tools',
          '/en/admin/experience',
          '/en/admin/education',
          '/en/admin/certifications',
          '/en/admin/courses',
          '/en/admin/languages',
          '/en/admin/projects',
          '/en/admin/social-links',
          '/en/admin/messages',
        ]),
      );
  });
});

/**
 * Placed before the profile suite deliberately: its last test signs out, and
 * signing out increments the user's token version - which invalidates the one
 * shared session cookie every later test relies on. A describe added after it
 * does not fail on its own assertions; it hangs on "Checking your session…".
 */
test.describe('images and branding', () => {
  test.use({ storageState: STATE_PATH });

  const stamp = Date.now();
  const skillName = `E2E branded technology ${stamp}`;
  const projectTitle = `E2E gallery project ${stamp}`;

  /** A real PNG, by signature: the API reads the bytes, not the filename. */
  const PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  );

  test.afterAll(async ({ browser }) => {
    const page = await browser.newPage({ storageState: STATE_PATH });

    await page.goto('/en/admin/projects');
    await removeRow(page, projectTitle);
    await page.goto('/en/admin/technologies');
    await removeRow(page, skillName);
    await page.close();
  });

  test('gives a technology a preset logo that survives a reload', async ({
    page,
  }) => {
    await page.goto('/en/admin/technologies');
    await page.getByRole('button', { name: 'Add a technology' }).click();
    await page.getByLabel(inEnglish('Name')).fill(skillName);
    await page.getByLabel('Level').fill('70');
    await choose(page, /Category/, 'Other');

    // Searched for by brand name, which is how anyone would actually find it.
    await page.getByLabel('Search logos').fill('laravel');
    await page.getByRole('button', { name: 'Laravel', exact: true }).click();
    await expect(page.getByText('Laravel logo')).toBeVisible();

    await page.getByRole('button', { name: 'Save' }).click();

    const row = page.getByRole('listitem').filter({ hasText: skillName });
    await expect(row).toBeVisible();

    // Drawn, not merely stored: the slug has to resolve to a real drawing, and
    // the accessible name is the brand rather than "image".
    await expect(row.getByRole('img', { name: skillName })).toBeVisible();

    await page.reload();
    await expect(
      page
        .getByRole('listitem')
        .filter({ hasText: skillName })
        .getByRole('img', { name: skillName }),
    ).toBeVisible();
  });

  test('adds gallery images to a project and keeps their order', async ({
    page,
  }) => {
    await page.goto('/en/admin/projects');
    await page.getByRole('button', { name: 'Add a project' }).click();
    await page
      .getByLabel(inEnglish('Title'), { exact: true })
      .fill(projectTitle);
    await page
      .getByLabel(inEnglish('Description'), { exact: true })
      .fill('Made by the end-to-end suite.');

    await page.getByLabel('Add images').setInputFiles([
      { name: 'one.png', mimeType: 'image/png', buffer: PNG },
      { name: 'two.png', mimeType: 'image/png', buffer: PNG },
    ]);

    // Uploaded on selection, so both entries exist before anything is saved.
    await expect(page.getByText('Image 1 of 2')).toBeVisible();
    await expect(page.getByText('Image 2 of 2')).toBeVisible();

    await page
      .getByLabel(inEnglish('Description of image 1'), { exact: true })
      .fill('The first screen');
    await page
      .getByLabel(inEnglish('Description of image 2'), { exact: true })
      .fill('The second screen');

    await page.getByRole('button', { name: 'Save project' }).click();

    const card = page.getByRole('listitem').filter({ hasText: projectTitle });
    await expect(card).toBeVisible();

    // This project has a gallery but no cover, and the card says so rather
    // than drawing an empty frame - the state a missing cover would otherwise
    // pass unnoticed in.
    await expect(card.getByText('No cover yet')).toBeVisible();

    // Reopened from the API, which is what proves the gallery was stored at
    // all - the form's own state would look identical either way.
    await rowAction(page, projectTitle, 'Edit');

    await expect(page.getByText('Image 1 of 2')).toBeVisible();
    await expect(
      page.getByLabel(inEnglish('Description of image 1'), { exact: true }),
    ).toHaveValue('The first screen');

    // Position in the list is the order, so moving one is the whole feature.
    await page.getByRole('button', { name: 'Move image 2 earlier' }).click();
    await expect(
      page.getByLabel(inEnglish('Description of image 1'), { exact: true }),
    ).toHaveValue('The second screen');

    await page.getByRole('button', { name: 'Save project' }).click();
    await expect(
      page.getByRole('listitem').filter({ hasText: projectTitle }),
    ).toBeVisible();

    await rowAction(page, projectTitle, 'Edit');

    // The new order survived the round trip, rather than only the list.
    await expect(
      page.getByLabel(inEnglish('Description of image 1'), { exact: true }),
    ).toHaveValue('The second screen');
  });
});

/**
 * The split, end to end. The unit tests prove each half; this proves the three
 * are really three - separate routes, separate lists, separate shapes - through
 * a real browser against a real database.
 */
test.describe('skills, technologies and tools', () => {
  test.use({ storageState: STATE_PATH });

  const stamp = Date.now();
  const skillName = `E2E capability ${stamp}`;

  test.afterAll(async ({ browser }) => {
    const page = await browser.newPage({ storageState: STATE_PATH });

    await page.goto('/en/admin/skills');
    const row = page.getByRole('listitem').filter({ hasText: skillName });

    if ((await row.count()) > 0) {
      await deleteRow(page, skillName);
    }

    await page.close();
  });

  test('reaches all three from the sidebar, each on its own page', async ({
    page,
  }) => {
    await page.goto('/en/admin');
    const nav = page.getByRole('navigation', { name: 'Admin navigation' });

    for (const [label, url] of [
      ['Skills', /\/en\/admin\/skills$/],
      ['Technologies', /\/en\/admin\/technologies$/],
      ['Tools', /\/en\/admin\/tools$/],
    ] as const) {
      await nav.getByRole('link', { name: label }).click();
      await expect(page).toHaveURL(url);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(label);
    }
  });

  /**
   * There is no brand mark for "Problem Solving", so a skill has no logo at
   * all - not a picker that can never match anything. The API refuses the
   * field too; this is the half the admin can see.
   */
  test('creates a skill, which has capabilities for categories and no logo', async ({
    page,
  }) => {
    await page.goto('/en/admin/skills');
    await page.getByRole('button', { name: 'Add a skill' }).click();

    await expect(page.getByLabel('Search logos')).toHaveCount(0);

    await page.getByLabel(inEnglish('Name')).fill(skillName);
    await page.getByLabel('Level').fill('85');
    await page
      .getByRole('combobox', { name: /Category/ })
      .first()
      .click();
    await expect(page.getByRole('listbox')).toBeVisible();

    // Its own category set: a capability, never `database` or `frontend`.
    await expect(
      page.getByRole('option', { name: 'Collaboration' }),
    ).toBeVisible();
    await expect(page.getByRole('option', { name: 'Database' })).toHaveCount(0);

    await page
      .getByRole('option', { name: 'Architecture', exact: true })
      .click();
    await expect(page.getByRole('listbox')).toBeHidden();
    await page.getByRole('button', { name: 'Save' }).click();

    const row = page.getByRole('listitem').filter({ hasText: skillName });
    await expect(row).toBeVisible();
    await expect(row).toContainText('Architecture');

    // It survives a reload, so it reached the database rather than the cache.
    await page.reload();
    await expect(
      page.getByRole('listitem').filter({ hasText: skillName }),
    ).toBeVisible();
  });

  // Three lists, not one filtered view: a skill must not appear under tools.
  test('keeps the lists apart', async ({ page }) => {
    await page.goto('/en/admin/tools');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tools');
    await expect(
      page.getByRole('listitem').filter({ hasText: skillName }),
    ).toHaveCount(0);

    await page.goto('/en/admin/technologies');
    await expect(
      page.getByRole('listitem').filter({ hasText: skillName }),
    ).toHaveCount(0);
  });

  // A project's stack is what it was built with, so a skill is never offered.
  test('never offers a skill as part of a project stack', async ({ page }) => {
    await page.goto('/en/admin/projects');
    await page.getByRole('button', { name: 'Add a project' }).click();

    const group = page.getByRole('group', { name: 'Built with' });

    await expect(group).toBeVisible();
    await expect(group.getByRole('checkbox', { name: skillName })).toHaveCount(
      0,
    );
  });
});

/**
 * The one section with no date to sort by, and therefore the first since the
 * expertise split to reorder. What a browser proves here is that the shared
 * machinery works for a sixth caller, and that a name nobody stored appears.
 */
test.describe('the languages page', () => {
  test.use({ storageState: STATE_PATH });

  test('names each language without storing a name', async ({ page }) => {
    await page.goto('/en/admin');
    await page.getByRole('link', { name: 'Languages' }).click();
    await expect(page).toHaveURL(/\/en\/admin\/languages$/);

    const rows = page.getByRole('main').getByRole('listitem');

    await expect(rows.first()).toBeVisible();

    // The seeded list leads with Arabic; each name is rendered from its code.
    await expect(page.getByText('Arabic', { exact: true })).toBeVisible();
    await expect(page.getByText('French', { exact: true })).toBeVisible();
  });

  /**
   * The reorder endpoint, the shared helper and the controls, end to end.
   *
   * A row is identified by the label of its own move button, which names it:
   * reading the row's text instead concatenates the name, the level and the
   * subtag into one string with nothing to split on.
   *
   * The order is restored afterwards so the run leaves the list as it found it.
   */
  test('moves a language and keeps the new order across a reload', async ({
    page,
  }) => {
    await page.goto('/en/admin/languages');

    const rows = page.getByRole('main').getByRole('listitem');
    await expect(rows.first()).toBeVisible();

    if ((await rows.count()) < 2) {
      test.skip(true, 'needs two languages to reorder');
    }

    const secondUp = rows.nth(1).getByRole('button', { name: /^Move .+ up$/ });
    const label = (await secondUp.getAttribute('aria-label'))!;

    await secondUp.click();

    // That very row is now the first one, named by the same button.
    await expect(
      rows.first().getByRole('button', { name: label, exact: true }),
    ).toBeVisible();

    // It survives a reload, so it reached the database rather than the cache.
    await page.reload();
    await expect(
      rows.first().getByRole('button', { name: label, exact: true }),
    ).toBeVisible();

    // Put it back, so the suite leaves the list as it found it.
    await rows
      .first()
      .getByRole('button', { name: /^Move .+ down$/ })
      .click();
    await expect(
      rows.nth(1).getByRole('button', { name: label, exact: true }),
    ).toBeVisible();
  });

  test('cannot move the first row up', async ({ page }) => {
    await page.goto('/en/admin/languages');

    const rows = page.getByRole('main').getByRole('listitem');
    await expect(rows.first()).toBeVisible();

    await expect(
      rows.first().getByRole('button', { name: /^Move .+ up$/ }),
    ).toBeDisabled();
    await expect(
      rows.last().getByRole('button', { name: /^Move .+ down$/ }),
    ).toBeDisabled();
  });
});

/**
 * Two resources from one component and one model, so what a browser has to
 * prove is that they stay apart - and that an expired credential is stored and
 * shown rather than refused, which is the decision this entity turns on.
 */
test.describe('certifications and courses', () => {
  test.use({ storageState: STATE_PATH });

  const stamp = Date.now();
  const certification = `E2E Certification ${stamp}`;
  const course = `E2E Course ${stamp}`;
  const issuer = `E2E Issuer ${stamp}`;

  async function removeIfPresent(page: Page, path: string, name: string) {
    await page.goto(path);
    const row = page.getByRole('listitem').filter({ hasText: name });

    if ((await row.count()) > 0) {
      await deleteRow(page, name);
    }
  }

  test.afterAll(async ({ browser }) => {
    const page = await browser.newPage({ storageState: STATE_PATH });

    await removeIfPresent(page, '/en/admin/certifications', certification);
    await removeIfPresent(page, '/en/admin/courses', course);

    await page.close();
  });

  test('keeps the two lists apart', async ({ page }) => {
    await page.goto('/en/admin');
    await page.getByRole('link', { name: 'Certifications' }).click();
    await expect(page).toHaveURL(/\/en\/admin\/certifications$/);

    await page.getByRole('button', { name: 'Add a certification' }).click();
    await page.getByLabel(inEnglish('Name')).fill(certification);
    await page.getByLabel(inEnglish('Issuer')).fill(issuer);
    await page.getByLabel('Issued', { exact: true }).fill('2024-04');
    await page.getByLabel('Expires').fill('2027-04');
    await page.getByRole('button', { name: 'Save' }).click();

    await expect(
      page.getByRole('listitem').filter({ hasText: certification }),
    ).toBeVisible();

    // The other list is a different resource, not a filtered view of this one.
    await page.getByRole('link', { name: 'Courses' }).click();
    await expect(page).toHaveURL(/\/en\/admin\/courses$/);
    await expect(
      page.getByRole('listitem').filter({ hasText: certification }),
    ).toHaveCount(0);

    await page.getByRole('button', { name: 'Add a course' }).click();
    await page.getByLabel(inEnglish('Name')).fill(course);
    await page.getByLabel(inEnglish('Issuer')).fill(issuer);
    await page.getByLabel('Issued', { exact: true }).fill('2024-02');
    await page.getByRole('button', { name: 'Save' }).click();

    const courseRow = page.getByRole('listitem').filter({ hasText: course });

    await expect(courseRow).toBeVisible();
    // No expiry means it does not expire - never that it is under way.
    await expect(courseRow).toContainText('does not expire');

    await page.goto('/en/admin/certifications');
    await expect(
      page.getByRole('listitem').filter({ hasText: course }),
    ).toHaveCount(0);
  });

  /**
   * The decision this entity turns on: an expired certification is a true fact
   * about someone's history, so it is stored and marked rather than refused.
   */
  test('stores an expired credential and says it has expired', async ({
    page,
  }) => {
    const expired = `${certification} expired`;

    await page.goto('/en/admin/certifications');
    await page.getByRole('button', { name: 'Add a certification' }).click();
    await page.getByLabel(inEnglish('Name')).fill(expired);
    await page.getByLabel(inEnglish('Issuer')).fill(issuer);
    await page.getByLabel('Issued', { exact: true }).fill('2016-01');
    await page.getByLabel('Expires').fill('2019-01');
    await page.getByRole('button', { name: 'Save' }).click();

    const row = page.getByRole('listitem').filter({ hasText: expired });

    await expect(row).toBeVisible();
    await expect(row).toContainText('Expired');

    // It survives a reload, so it reached the database rather than being
    // refused and shown from a stale cache.
    await page.reload();
    await expect(
      page.getByRole('listitem').filter({ hasText: expired }),
    ).toContainText('Expired');

    await deleteRow(page, expired);
  });

  test('refuses an expiry that precedes the issue, without asking the server', async ({
    page,
  }) => {
    const writes: string[] = [];
    page.on('request', (request) => {
      if (
        request.method() === 'POST' &&
        request.url().endsWith('/api/certifications')
      ) {
        writes.push(request.url());
      }
    });

    await page.goto('/en/admin/certifications');
    await page.getByRole('button', { name: 'Add a certification' }).click();
    await page.getByLabel(inEnglish('Name')).fill(`${certification} backwards`);
    await page.getByLabel(inEnglish('Issuer')).fill(issuer);
    await page.getByLabel('Issued', { exact: true }).fill('2024-04');
    await page.getByLabel('Expires').fill('2022-01');
    await page.getByRole('button', { name: 'Save' }).click();

    await expect(
      page.getByText('The expiry cannot be before the issue date.'),
    ).toBeVisible();
    expect(writes).toEqual([]);
  });
});

/**
 * Education is the second entity built on the shared period, and the point of
 * proving it through a browser is narrow: that the same `checkPeriod` reaches
 * the admin the same way, and that a page assembled from the shared pieces
 * actually works rather than merely compiling.
 */
test.describe('the education page', () => {
  test.use({ storageState: STATE_PATH });

  const stamp = Date.now();
  const qualification = `E2E BSc ${stamp}`;
  const institution = `E2E University ${stamp}`;

  test.afterAll(async ({ browser }) => {
    const page = await browser.newPage({ storageState: STATE_PATH });

    await page.goto('/en/admin/education');
    const row = page.getByRole('listitem').filter({ hasText: qualification });

    if ((await row.count()) > 0) {
      await deleteRow(page, qualification);
    }

    await page.close();
  });

  test('creates an entry from the sidebar and shows its period', async ({
    page,
  }) => {
    await page.goto('/en/admin');
    await page.getByRole('link', { name: 'Education' }).click();
    await expect(page).toHaveURL(/\/en\/admin\/education$/);

    await page.getByRole('button', { name: 'Add an entry' }).click();
    await page.getByLabel(inEnglish('Qualification')).fill(qualification);
    await page.getByLabel(inEnglish('Institution')).fill(institution);
    await choose(page, /Level/, "Bachelor's degree");
    await page.getByLabel('Started').fill('2015-09');
    await page.getByLabel('Ended').fill('2018-06');
    await page.getByRole('button', { name: 'Save entry' }).click();

    const row = page.getByRole('listitem').filter({ hasText: qualification });

    await expect(row).toBeVisible();
    // The months are rendered in UTC, so this is the same text everywhere.
    await expect(row).toContainText('Sep 2015');
    await expect(row).toContainText('Jun 2018');
    // The label, never the stored code.
    await expect(row).toContainText("Bachelor's degree");
    await expect(row).not.toContainText('bachelor');

    await page.reload();
    await expect(
      page.getByRole('listitem').filter({ hasText: qualification }),
    ).toBeVisible();
  });

  /** The dates are the order, so there is nothing to drag. */
  test('offers no reorder controls', async ({ page }) => {
    await page.goto('/en/admin/education');

    await expect(page.getByRole('button', { name: /Move .* up/ })).toHaveCount(
      0,
    );
    await expect(
      page.getByRole('button', { name: /Move .* down/ }),
    ).toHaveCount(0);
  });

  /**
   * The shared rule, reaching the admin before a request is made - the same
   * one a career uses, which is the whole reason it lives in `shared`.
   */
  test('refuses an end before the start without asking the server', async ({
    page,
  }) => {
    const writes: string[] = [];
    page.on('request', (request) => {
      if (
        request.method() === 'POST' &&
        request.url().endsWith('/api/education')
      ) {
        writes.push(request.url());
      }
    });

    await page.goto('/en/admin/education');
    await page.getByRole('button', { name: 'Add an entry' }).click();

    await page
      .getByLabel(inEnglish('Qualification'))
      .fill(`${qualification} bad`);
    await page.getByLabel(inEnglish('Institution')).fill(institution);
    await choose(page, /Level/, "Master's degree");
    await page.getByLabel('Started').fill('2018-06');
    await page.getByLabel('Ended').fill('2015-09');
    await page.getByRole('button', { name: 'Save entry' }).click();

    await expect(
      page.getByText('The end cannot be before the start.'),
    ).toBeVisible();
    expect(writes).toEqual([]);
  });

  test('clears and disables the end date for a course in progress', async ({
    page,
  }) => {
    await page.goto('/en/admin/education');
    await page.getByRole('button', { name: 'Add an entry' }).click();

    const end = page.getByLabel('Ended');

    await end.fill('2018-06');
    await page
      .getByRole('checkbox', { name: /I am still studying this/ })
      .check();

    await expect(end).toHaveValue('');
    await expect(end).toBeDisabled();
  });
});

/**
 * A career is the first list ordered by its own data rather than by a position
 * the admin drags. That, and the rules that relate the three date fields, are
 * what this proves through a real browser against a real database.
 */
test.describe('the experience page', () => {
  test.use({ storageState: STATE_PATH });

  const stamp = Date.now();
  const role = `E2E Engineer ${stamp}`;
  const organisation = `E2E Corp ${stamp}`;

  async function fillPosition(page: Page) {
    await page.getByLabel(inEnglish('Role')).fill(role);
    await page.getByLabel(inEnglish('Organisation')).fill(organisation);
    await choose(page, /Type/, 'Contract');
  }

  test.afterAll(async ({ browser }) => {
    const page = await browser.newPage({ storageState: STATE_PATH });

    await page.goto('/en/admin/experience');
    const row = page.getByRole('listitem').filter({ hasText: role });

    if ((await row.count()) > 0) {
      await deleteRow(page, role);
    }

    await page.close();
  });

  test('creates a position and shows its period', async ({ page }) => {
    await page.goto('/en/admin');
    await page.getByRole('link', { name: 'Experience' }).click();
    await expect(page).toHaveURL(/\/en\/admin\/experience$/);

    await page.getByRole('button', { name: 'Add a position' }).click();
    await fillPosition(page);
    await page.getByLabel('Started').fill('2021-03');
    await page.getByLabel('Ended').fill('2023-06');
    await page.getByRole('button', { name: 'Save position' }).click();

    const row = page.getByRole('listitem').filter({ hasText: role });
    await expect(row).toBeVisible();
    await expect(row).toContainText(organisation);
    await expect(row).toContainText('Contract');

    /**
     * The months are stored as `YYYY-MM` and rendered in UTC. Formatted in the
     * browser's own zone, midnight on the first shifts back a month for any
     * negative offset - "Mar 2021" would read as "Feb 2021".
     */
    await expect(row).toContainText('Mar 2021');
    await expect(row).toContainText('Jun 2023');

    // It survives a reload, so it reached the database rather than the cache.
    await page.reload();
    await expect(
      page.getByRole('listitem').filter({ hasText: role }),
    ).toContainText('Mar 2021');
  });

  // The dates are the order, so there is nothing to drag and no arrows to drag
  // it with - unlike every other admin list.
  test('offers no reorder controls', async ({ page }) => {
    await page.goto('/en/admin/experience');
    await expect(page.getByRole('listitem').first()).toBeVisible();

    await expect(
      page.getByRole('main').getByRole('button', { name: /^Move / }),
    ).toHaveCount(0);
  });

  /**
   * The rule that relates the three date fields is shared with the backend, so
   * the admin is told before a request is made - by the same rule the server
   * would have used.
   */
  test('refuses an end before the start without asking the server', async ({
    page,
  }) => {
    const writes: string[] = [];
    page.on('request', (request) => {
      if (
        request.method() === 'POST' &&
        request.url().endsWith('/api/experience')
      ) {
        writes.push(request.url());
      }
    });

    await page.goto('/en/admin/experience');
    await page.getByRole('button', { name: 'Add a position' }).click();
    await fillPosition(page);
    await page.getByLabel('Started').fill('2023-06');
    await page.getByLabel('Ended').fill('2021-03');
    await page.getByRole('button', { name: 'Save position' }).click();

    const endDate = page.getByLabel('Ended');
    await expect(endDate).toHaveAttribute('aria-invalid', 'true');
    await expect(
      page.getByText('The end cannot be before the start.'),
    ).toBeVisible();

    expect(writes).toEqual([]);
  });

  /**
   * An absent end date could mean "still there" or "not filled in". Ticking the
   * box says which, and clears the field so the form cannot show a
   * contradiction it is about to reject.
   */
  test('clears and disables the end date for a current position', async ({
    page,
  }) => {
    await page.goto('/en/admin/experience');
    await page.getByRole('button', { name: 'Add a position' }).click();

    await page.getByLabel('Ended').fill('2023-06');
    await page
      .getByRole('checkbox', { name: /I still hold this position/ })
      .click();

    await expect(page.getByLabel('Ended')).toHaveValue('');
    await expect(page.getByLabel('Ended')).toBeDisabled();
  });
});

/**
 * The one non-image file the application stores, end to end: uploaded through
 * the admin, kept across a reload, and served in a way a browser will not
 * render.
 */
test.describe('the resume', () => {
  test.use({ storageState: STATE_PATH });

  /** A real PDF, by signature: the API reads the bytes, not the filename. */
  const PDF = Buffer.from(
    '%PDF-1.7\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n',
  );

  /*
    Nothing to undo here, and the hook that used to try was wrong twice over.

    It removed the CV afterwards, which was restoring the state the seed left
    when the seed left this field empty. The seed fills it now - one document
    per locale - so removing it is not a restoration, it is a deletion.

    And it could not have worked anyway once there was more than one: it
    cleared the default locale alone, and `localizedDocument` requires `en`
    whenever the field is present at all. The save was refused, the editor
    stayed open, and the hook failed waiting for a page that had not closed.

    What these tests change is one field on a singleton the seeder owns, and
    `npm run db:seed` puts the placeholder back. That is a better restoration
    than any sequence of clicks, so this describe block does not attempt one.
  */

  test('uploads a PDF and keeps it across a reload', async ({ page }) => {
    await page.goto('/en/admin/profile');
    await page.getByRole('button', { name: /^(Edit|Create) profile$/ }).click();

    // One control, showing the language the form is on - not one per language.
    // The CV really differs between them, and the tabs beside it are how you
    // reach the other ones.
    //
    // Counted rather than asserted against the empty state, which is what this
    // said until the seed started filling the field: "no resume yet" appearing
    // once was only ever evidence of there being one control, and it stopped
    // being evidence of anything the moment there was a resume.
    await expect(
      page.getByLabel(/^(Choose a PDF|Replace the PDF) \(English\)$/),
    ).toHaveCount(1);
    await expect(
      page.getByLabel(/^(Choose a PDF|Replace the PDF) \(français\)$/),
    ).toHaveCount(0);

    // Whichever of the two the field is currently offering: "choose" before
    // there is a CV and "replace" after, and this test has to work either way
    // now that the seed ships one.
    await page
      .getByLabel(/^(Choose a PDF|Replace the PDF) \(English\)$/)
      .setInputFiles({
        name: 'cv.pdf',
        mimeType: 'application/pdf',
        buffer: PDF,
      });

    // Uploaded on selection, so a refused file is reported before saving - and
    // afterwards the control can only be offering to replace.
    await expect(page.getByLabel(inEnglish('Replace the PDF'))).toBeVisible();

    await page.getByRole('button', { name: 'Save profile' }).click();
    await expect(
      page.getByRole('button', { name: 'Edit profile' }),
    ).toBeVisible();

    await page.reload();
    await page.getByRole('button', { name: 'Edit profile' }).click();
    await expect(
      page.getByRole('link', { name: 'Resume (PDF)' }),
    ).toBeVisible();
  });

  /**
   * The bytes decide. A file named `.pdf` that is not one gets as far as the
   * signature check and no further.
   */
  test('refuses a file that is not a PDF, on the field', async ({ page }) => {
    await page.goto('/en/admin/profile');
    await page.getByRole('button', { name: /^(Edit|Create) profile$/ }).click();

    await page
      .getByLabel(/^(Choose a PDF|Replace the PDF) \(English\)$/)
      .setInputFiles({
        name: 'cv.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('this is not a PDF at all'),
      });

    await expect(page.getByText('Choose a PDF file.')).toBeVisible();
  });

  /**
   * The decision this feature turns on: a stored PDF is handed to the reader,
   * never rendered from our origin. Asserted on a real response, because a
   * header set in code that never reaches the wire is exactly the failure this
   * is for.
   */
  test('is served as a download, not a document', async ({ page, request }) => {
    await page.goto('/en/admin/profile');
    await page.getByRole('button', { name: 'Edit profile' }).click();

    const href = await page
      .getByRole('link', { name: 'Resume (PDF)' })
      .getAttribute('href');

    const response = await request.get(href!);
    const headers = response.headers();

    expect(response.status()).toBe(200);
    expect(headers['content-disposition']).toBe('attachment');
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['content-security-policy']).toContain('sandbox');
  });
});

/**
 * The contact details, and the decision that comes with them.
 *
 * The claim is one an admin cannot check by looking at the admin: what a
 * *stranger* receives. So it is saved through the UI and then read back with no
 * session at all, straight off the API.
 */
test.describe('the contact details', () => {
  test.use({ storageState: STATE_PATH });

  const stamp = Date.now();
  const email = `contact-${stamp}@example.test`;
  const city = `E2E City ${stamp}`;

  test('withholds an unpublished address from anyone without a session', async ({
    page,
    request,
  }) => {
    await page.goto('/en/admin/profile');
    await page.getByRole('button', { name: /^(Edit|Create) profile$/ }).click();

    await page.getByLabel('Email', { exact: true }).fill(email);
    await page.getByLabel(inEnglish('Location'), { exact: true }).fill(city);
    // Set, not toggled: the stored profile may already have either answer, and
    // a click would then mean the opposite of what this test is about.
    await page
      .getByRole('checkbox', { name: 'Show the location on the site' })
      .check();
    await page
      .getByRole('checkbox', { name: 'Show the email on the site' })
      .uncheck();

    await page.getByRole('button', { name: 'Save profile' }).click();
    await expect(
      page.getByRole('button', { name: 'Edit profile' }),
    ).toBeVisible();

    // The owner sees both, and sees which is which - scoped to the row,
    // because more than one detail can be unpublished at a time.
    await expect(page.getByText(email)).toBeVisible();
    await expect(page.getByRole('group', { name: 'Email' })).toContainText(
      'Not shown',
    );
    await expect(page.getByRole('group', { name: 'Location' })).toContainText(
      'Shown on the site',
    );

    // A stranger sees only what was published. Read off the API with no
    // cookie, because that is the request the public site will make.
    const anonymous = await request.get(`${API_URL}/api/profile`, {
      headers: { Cookie: '' },
    });
    const body = (await anonymous.json()) as {
      details: { profile: { contact?: Record<string, unknown> } };
    };
    const contact = body.details.profile.contact!;

    expect(anonymous.status()).toBe(200);
    // The English half only. The form renders an input per locale and resubmits
    // every one of them, so a seeded French location comes back too - correctly.
    // Deep equality here passed on a developer's machine for the worst possible
    // reason: earlier runs of this very test had already replaced the stored
    // location with an English-only one, so it was pinning its own side effect.
    expect(contact.location).toMatchObject({ en: city });
    // Absent, not empty: a key that is present still says the field exists.
    expect(contact).not.toHaveProperty('email');
    expect(JSON.stringify(body)).not.toContain(email);
  });

  test('publishes the address once the box is ticked', async ({
    page,
    request,
  }) => {
    await page.goto('/en/admin/profile');
    await page.getByRole('button', { name: 'Edit profile' }).click();

    // Written again rather than inherited from the test above. Playwright
    // restarts the worker after a failed test, which re-evaluates this file and
    // gives `email` a new stamp - so a failure up there used to surface here as
    // a second, meaningless failure looking for an address nobody had stored.
    await page.getByLabel('Email', { exact: true }).fill(email);
    await page
      .getByRole('checkbox', { name: 'Show the email on the site' })
      .check();
    await page.getByRole('button', { name: 'Save profile' }).click();
    await expect(
      page.getByRole('button', { name: 'Edit profile' }),
    ).toBeVisible();

    const anonymous = await request.get(`${API_URL}/api/profile`, {
      headers: { Cookie: '' },
    });

    expect(await anonymous.text()).toContain(email);
  });
});

/**
 * The option lists, end to end.
 *
 * This is the feature's whole claim: a code added here becomes choosable in the
 * form that uses it, without a deploy. Nothing below the browser can show that -
 * the label crosses the API, the cache and two screens on its way.
 *
 * Before the profile suite, for the reason `images and branding` gives above:
 * its last test signs out, which invalidates the one shared session every later
 * describe relies on.
 */
/**
 * Stored images are delivered at the size they are drawn.
 *
 * The measurement that justified this cannot live in a spec - it needs a
 * photograph the size this application permits, and the seeded files are small.
 * What a spec *can* hold is the mechanism, which is what silently regresses: a
 * bare `<img src>` creeping back, or a `sizes` nobody set.
 */
test.describe('image delivery', () => {
  test.use({ storageState: STATE_PATH });

  test('renders every stored image through the optimizer', async ({ page }) => {
    await page.goto('/en/admin/projects');
    await expect(
      page.getByRole('main').getByRole('listitem').first(),
    ).toBeVisible();

    const stored = page.locator('img[src*="/uploads/"]');

    // Not one bare reference: every upload goes through `/_next/image`, whose
    // `url` parameter carries the stored path rather than the `src`.
    await expect(stored).toHaveCount(0);
    await expect(page.locator('img[src*="_next/image"]').first()).toBeVisible();
  });

  /**
   * Without `sizes` the browser picks a candidate for the whole viewport, which
   * is the one way this optimization looks done and saves nothing - so its
   * absence is a failure rather than a warning.
   */
  test('tells the browser how wide each one is actually drawn', async ({
    page,
  }) => {
    await page.goto('/en/admin/projects');

    const covers = page.locator('img[src*="_next/image"][sizes]');

    await expect(covers.first()).toBeVisible();
    expect(await covers.first().getAttribute('sizes')).toBeTruthy();
  });

  /**
   * The rewrite is what makes uploads same-origin, and same-origin is what lets
   * the optimizer fetch them from inside the container. If it ever stops being
   * proxied, every image on every admin page fails at once.
   */
  test('serves uploads from this origin, proxied to the backend', async ({
    page,
  }) => {
    // The path the profile actually points at, rather than the seed's filename:
    // an owner who has uploaded their own photograph has no seed avatar left,
    // and the test would then be asserting a file nothing stores.
    const body = (await (
      await page.request.get(`${API_URL}/api/profile`)
    ).json()) as {
      details: { profile: { photoUrl?: string } };
    };
    const photoUrl = body.details.profile.photoUrl ?? '';

    expect(photoUrl).toMatch(/^\/uploads\//);

    const response = await page.request.get(photoUrl);

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('image/');
  });
});

test.describe('the options page', () => {
  test.use({ storageState: STATE_PATH });

  test('is reachable from the sidebar and opens on a list', async ({
    page,
  }) => {
    await page.goto('/en/admin');
    await page.getByRole('link', { name: 'Option lists' }).click();
    await expect(page).toHaveURL(/\/en\/admin\/options$/);

    // The seeded first list, with its label and the code rows actually hold.
    await expect(page.getByText('Open to work', { exact: true })).toBeVisible();
    await expect(page.getByText('open-to-work', { exact: true })).toBeVisible();
  });

  test('shows one list at a time', async ({ page }) => {
    await page.goto('/en/admin/options');
    await expect(page.getByText('Open to work', { exact: true })).toBeVisible();

    await choose(page, /List/, 'Employment types');

    await expect(page.getByText('Full-time', { exact: true })).toBeVisible();
    await expect(page.getByText('Open to work', { exact: true })).toBeHidden();
  });

  /**
   * The feature's whole claim, and the rule that protects it, in one pass.
   *
   * An employment type added here becomes choosable on the experience form; a
   * position that holds it then refuses to let it be deleted; and once the
   * position is gone the option can go too. Self-contained on purpose - asserting
   * that a *seeded* option is in use would depend on content the owner edits.
   */
  test('an option added here is usable, then protected, then removable', async ({
    page,
  }) => {
    const stamp = Date.now();
    const label = `E2E Secondment ${stamp}`;
    const role = `E2E Seconded ${stamp}`;

    await page.goto('/en/admin/options');
    await choose(page, /List/, 'Employment types');
    await page.getByRole('button', { name: 'Add an option' }).click();

    await page
      .getByLabel('Code', { exact: true })
      .fill(`e2e-secondment-${stamp}`);
    await page.getByLabel(inEnglish('Label')).fill(label);
    await page.getByRole('button', { name: 'Save option' }).click();
    await expect(page.getByText(label, { exact: true })).toBeVisible();

    // The other end of the wire: a form reading this list now offers it.
    await page.goto('/en/admin/experience');
    await page.getByRole('button', { name: 'Add a position' }).click();
    await page.getByLabel(inEnglish('Role')).fill(role);
    await page.getByLabel(inEnglish('Organisation')).fill(`E2E Corp ${stamp}`);
    await choose(page, /Type/, label);
    await page.getByLabel('Started').fill('2022-01');
    await page.getByLabel('Ended').fill('2022-12');
    await page.getByRole('button', { name: 'Save position' }).click();
    await expect(
      page.getByRole('listitem').filter({ hasText: role }),
    ).toBeVisible();

    // In use: the delete is refused rather than stranding that position.
    await page.goto('/en/admin/options');
    await choose(page, /List/, 'Employment types');
    await deleteRow(page, label);
    // Named rather than "some error appeared": the message has to say what is
    // actually wrong, and the generic conflict wording does not.
    await expect(
      notifications(page).filter({
        hasText: 'One entry still uses this option',
      }),
    ).toBeVisible();
    await expect(page.getByText(label, { exact: true })).toBeVisible();

    // Nothing points at it any more, so now it goes.
    await page.goto('/en/admin/experience');
    await deleteRow(page, role);

    await page.goto('/en/admin/options');
    await choose(page, /List/, 'Employment types');
    await deleteRow(page, label);
    await expect(page.getByText(label, { exact: true })).toBeHidden();
  });

  /**
   * Renaming relabels every row already holding the code - the useful half of
   * "a code is fixed and a name is not". Restored afterwards, so the run leaves
   * the lists as it found them.
   */
  test('renaming an option relabels the rows that hold it', async ({
    page,
  }) => {
    await page.goto('/en/admin/options');
    await choose(page, /List/, 'Language levels');
    await rowAction(page, 'Native', 'Edit');

    // The code is what the rows point at, so it is shown and not editable.
    await expect(page.getByLabel('Code', { exact: true })).toBeDisabled();
    await page.getByLabel(inEnglish('Label')).fill('Mother tongue');
    await page.getByRole('button', { name: 'Save option' }).click();
    await expect(
      page.getByText('Mother tongue', { exact: true }),
    ).toBeVisible();

    await page.goto('/en/admin/languages');
    await expect(page.getByText('Mother tongue').first()).toBeVisible();

    await page.goto('/en/admin/options');
    await choose(page, /List/, 'Language levels');
    await rowAction(page, 'Mother tongue', 'Edit');
    await page.getByLabel(inEnglish('Label')).fill('Native');
    await page.getByRole('button', { name: 'Save option' }).click();
    await expect(page.getByText('Native', { exact: true })).toBeVisible();
  });
});

/**
 * The account page, for the checks that change nothing.
 *
 * Anything that actually *changes* the password revokes every session, which
 * would strand the shared cookie every later describe uses - so that lives at
 * the very end of this file and signs itself in.
 */
test.describe('the account page', () => {
  test.use({ storageState: STATE_PATH });

  /**
   * Behind the account menu rather than in the sidebar: the sidebar is the
   * site's content, and this page is about the person signed in. So the route
   * to it is the same door they came in through.
   */
  test('is reachable from the account menu and names the account', async ({
    page,
  }) => {
    await page.goto('/en/admin');

    // Not in the sidebar at all - the nav is content sections only.
    const nav = page.getByRole('navigation', { name: 'Admin navigation' });
    await expect(nav.getByRole('link', { name: 'Account' })).toHaveCount(0);

    await page
      .getByRole('button', { name: `Account menu for ${credentials().email}` })
      .click();
    await page.getByRole('menuitem', { name: 'Account' }).click();
    await expect(page).toHaveURL(/\/en\/admin\/account$/);

    await expect(page.getByText(credentials().email).first()).toBeVisible();
  });

  /**
   * There is no password reset by email in this project, so a typo in a new
   * password locks the owner out until someone runs a script inside a
   * container. This check is the only thing standing between them and that,
   * and it must happen before anything is sent.
   */
  test('refuses a mismatched confirmation without asking the server', async ({
    page,
  }) => {
    const writes: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/api/auth/password')) {
        writes.push(request.url());
      }
    });

    await page.goto('/en/admin/account');
    await page
      .getByLabel('Current password', { exact: true })
      .fill('whatever-it-is');
    await page
      .getByLabel('New password', { exact: true })
      .fill('a-long-new-passphrase');
    await page
      .getByLabel('Repeat the new password')
      .fill('a-different-passphrase');
    await page.getByRole('button', { name: 'Change password' }).click();

    await expect(page.getByText('The two entries do not match.')).toBeVisible();
    expect(writes).toEqual([]);
  });

  /**
   * A stolen session cookie must not be enough to lock the owner out, which is
   * the whole reason the current password is asked for. Nothing changes here:
   * the server refuses before it writes.
   */
  test('refuses a wrong current password', async ({ page }) => {
    await page.goto('/en/admin/account');
    await page
      .getByLabel('Current password', { exact: true })
      .fill('not-the-current-one');
    await page
      .getByLabel('New password', { exact: true })
      .fill('a-long-new-passphrase');
    await page
      .getByLabel('Repeat the new password')
      .fill('a-long-new-passphrase');
    await page.getByRole('button', { name: 'Change password' }).click();

    await expect(page.getByText('Incorrect email or password.')).toBeVisible();
  });
});

/**
 * The theme and the language switch, which turned out to be entangled.
 *
 * `[locale]` sits above everything, so changing it re-rendered the root layout
 * on the client - and React then wrote `<html>`'s attributes from JSX carrying
 * no class, wiping the one the theme script had put there before the first
 * paint. Switching language turned a dark admin white, and the only clue was a
 * console warning about a script tag.
 *
 * Only a browser can see this: it is about what a real navigation does to a
 * real document.
 */
test.describe('the theme and the language switch', () => {
  test.use({ storageState: STATE_PATH });

  test('keeps the theme when the language changes', async ({ page }) => {
    await page.goto('/en/admin/projects');
    await page.evaluate(() => localStorage.setItem('portfolio-theme', 'dark'));
    await page.reload();
    await expect(page.locator('html')).toHaveClass(/dark/);

    await page
      .getByRole('radiogroup', { name: 'Interface language' })
      .getByRole('radio', { name: 'français' })
      .click();

    await expect(page).toHaveURL(/\/fr\/admin\/projects$/);
    await expect(page.locator('html')).toHaveClass(/dark/);
    await expect(page.locator('html')).toHaveAttribute(
      'style',
      /color-scheme:\s*dark/,
    );
  });

  // Both ways, so it is not one-directional luck.
  test('keeps it coming back the other way', async ({ page }) => {
    await page.goto('/fr/admin/projects');
    await page.evaluate(() => localStorage.setItem('portfolio-theme', 'dark'));
    await page.reload();

    await page
      .getByRole('radiogroup', { name: 'Langue de l’interface' })
      .getByRole('radio', { name: 'English' })
      .click();

    await expect(page).toHaveURL(/\/en\/admin\/projects$/);
    await expect(page.locator('html')).toHaveClass(/dark/);
  });
});

/**
 * The admin threw away unsaved work on any navigation, silently, and always
 * had. It stayed unnoticed while every way out was a deliberate act - a menu to
 * open, a sidebar to aim at - and became worth fixing the day a language switch
 * moved into the top-right corner of every screen.
 *
 * In a browser rather than in jsdom, because the claim is about what a real
 * navigation does to a real form.
 */
test.describe('leaving an edited form', () => {
  test.use({ storageState: STATE_PATH });

  const paragraph = 'Ten minutes of writing that has not been saved.';

  async function openTheProfileEditor(page: Page) {
    await page.goto('/en/admin/profile');
    await page.getByRole('button', { name: /^(Edit|Create) profile$/ }).click();
    await expect(page.getByLabel(inEnglish('Bio'))).toBeVisible();
  }

  function interfaceLanguage(page: Page) {
    return page
      .getByRole('radiogroup', { name: 'Interface language' })
      .getByRole('radio', { name: 'français' });
  }

  test('asks before the language switch discards it', async ({ page }) => {
    await openTheProfileEditor(page);
    await page.getByLabel(inEnglish('Bio')).fill(paragraph);

    await interfaceLanguage(page).click();

    await expect(page.getByRole('alertdialog')).toBeVisible();
    await expect(page).toHaveURL(/\/en\/admin\/profile\?edit=profile$/);
  });

  test('keeps the page and the text when told to keep editing', async ({
    page,
  }) => {
    await openTheProfileEditor(page);
    await page.getByLabel(inEnglish('Bio')).fill(paragraph);
    await interfaceLanguage(page).click();

    await page.getByRole('button', { name: 'Keep editing' }).click();

    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await expect(page).toHaveURL(/\/en\/admin\/profile\?edit=profile$/);
    await expect(page.getByLabel(inEnglish('Bio'))).toHaveValue(paragraph);
  });

  test('goes when told the changes can go', async ({ page }) => {
    await openTheProfileEditor(page);
    await page.getByLabel(inEnglish('Bio')).fill(paragraph);
    await interfaceLanguage(page).click();

    await page.getByRole('button', { name: 'Leave and lose them' }).click();

    await expect(page).toHaveURL(/\/fr\/admin\/profile\?edit=profile$/);
  });

  // The sidebar is the other way out, and it was losing work long before the
  // header had anything in it.
  test('asks before a sidebar link discards it', async ({ page }) => {
    await openTheProfileEditor(page);
    await page.getByLabel(inEnglish('Bio')).fill(paragraph);

    await page
      .getByRole('navigation', { name: 'Admin navigation' })
      .getByRole('link', { name: 'Skills' })
      .click();

    await expect(page.getByRole('alertdialog')).toBeVisible();
    await expect(page).toHaveURL(/\/en\/admin\/profile\?edit=profile$/);

    await page.getByRole('button', { name: 'Leave and lose them' }).click();
    await expect(page).toHaveURL(/\/en\/admin\/skills$/);
  });

  /**
   * The half that matters as much: a guard that asks when there is nothing to
   * lose is a guard people learn to click through.
   */
  test('says nothing when the form has not been touched', async ({ page }) => {
    await openTheProfileEditor(page);

    await interfaceLanguage(page).click();

    await expect(page).toHaveURL(/\/fr\/admin\/profile\?edit=profile$/);
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
  });

  test('says nothing about a page with no form on it', async ({ page }) => {
    await page.goto('/en/admin/skills');

    await page
      .getByRole('navigation', { name: 'Admin navigation' })
      .getByRole('link', { name: 'Tools' })
      .click();

    await expect(page).toHaveURL(/\/en\/admin\/tools$/);
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
  });
});

/**
 * The reported bug: Skills → Add, then Back, and you are on the Dashboard.
 *
 * The cause was that an editor was component state and not a location, so
 * opening one pushed nothing onto the history stack and Back had only the page
 * *before* the list to go to - the Dashboard when that is how you arrived, and
 * something else when it is not, which is the "sometimes" in the report.
 *
 * In a browser because there is no other way to press Back. jsdom has a history
 * object; it does not have the browser's.
 */
test.describe('the browser’s Back button', () => {
  test.use({ storageState: STATE_PATH });

  const rowName = `E2E history ${Date.now()}`;

  /** One row of its own, so nothing here depends on what the seed holds. */
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage({ storageState: STATE_PATH });

    await page.goto('/en/admin/skills');
    await page.getByRole('button', { name: 'Add a skill' }).click();
    await page.getByLabel(inEnglish('Name')).fill(rowName);
    await page.getByLabel('Level').fill('50');
    await choose(page, /Category/, 'Architecture');
    await page.getByRole('button', { name: 'Save' }).click();

    await expect(
      page.getByRole('listitem').filter({ hasText: rowName }),
    ).toBeVisible();
    await page.close();
  });

  test.afterAll(async ({ browser }) => {
    const page = await browser.newPage({ storageState: STATE_PATH });

    await page.goto('/en/admin/skills');
    await removeRow(page, rowName);
    await page.close();
  });

  /** What the list looks like when it is the list and not an editor. */
  function theList(page: Page) {
    return page.getByRole('button', { name: 'Add a skill' });
  }

  test('closes the editor and stays on the list, instead of leaving the page', async ({
    page,
  }) => {
    await page.goto('/en/admin');
    await page
      .getByRole('navigation', { name: 'Admin navigation' })
      .getByRole('link', { name: 'Skills' })
      .click();
    await expect(page).toHaveURL(/\/en\/admin\/skills$/);

    await theList(page).click();
    await expect(page).toHaveURL(/\/en\/admin\/skills\?edit=new$/);
    await expect(page.getByLabel(inEnglish('Name'))).toBeVisible();

    await page.goBack();

    // The list, on the same page - this is the whole report.
    await expect(page).toHaveURL(/\/en\/admin\/skills$/);
    await expect(theList(page)).toBeVisible();
    await expect(page.getByLabel(inEnglish('Name'))).toHaveCount(0);

    // And only the *next* Back leaves, which is the entry that was missing.
    await page.goBack();
    await expect(page).toHaveURL(/\/en\/admin$/);
  });

  test('reopens the editor on Forward', async ({ page }) => {
    await page.goto('/en/admin/skills');
    await theList(page).click();
    await expect(page.getByLabel(inEnglish('Name'))).toBeVisible();

    await page.goBack();
    await expect(theList(page)).toBeVisible();

    await page.goForward();
    await expect(page).toHaveURL(/\/en\/admin\/skills\?edit=new$/);
    await expect(page.getByLabel(inEnglish('Name'))).toBeVisible();
  });

  test('names the row it is editing, and comes back to that same row', async ({
    page,
  }) => {
    await page.goto('/en/admin/skills');
    await listHasSettled(page);
    await rowAction(page, rowName, 'Edit');

    await expect(page.getByLabel(inEnglish('Name'))).toHaveValue(rowName);
    await expect(page).toHaveURL(/\?edit=[a-f0-9]{24}$/);

    await page.goBack();
    await expect(page).toHaveURL(/\/en\/admin\/skills$/);
    await expect(theList(page)).toBeVisible();

    await page.goForward();
    await expect(page.getByLabel(inEnglish('Name'))).toHaveValue(rowName);
  });

  /**
   * The editor is somewhere now, so it survives the page being loaded again -
   * which is also what makes it a link somebody can be sent.
   */
  test('keeps the editor open across a reload', async ({ page }) => {
    await page.goto('/en/admin/skills');
    await listHasSettled(page);
    await rowAction(page, rowName, 'Edit');

    const url = page.url();

    await page.goto(url);
    await expect(page.getByLabel(inEnglish('Name'))).toHaveValue(rowName);
  });

  /**
   * Not a Back button, but the same claim: the address and the screen say the
   * same thing. Found by measuring rather than by reasoning - reading the
   * address bar directly survives Back, Forward and a reload, and then fails
   * here, because the router changes the URL without a `popstate` for anything
   * to hear.
   */
  test('closes the editor when the link to this very page is clicked', async ({
    page,
  }) => {
    await page.goto('/en/admin/skills');
    await theList(page).click();
    await expect(page).toHaveURL(/\?edit=new$/);

    await page
      .getByRole('navigation', { name: 'Admin navigation' })
      .getByRole('link', { name: 'Skills' })
      .click();

    await expect(page).toHaveURL(/\/en\/admin\/skills$/);
    await expect(theList(page)).toBeVisible();
    await expect(page.getByLabel(inEnglish('Name'))).toHaveCount(0);
  });

  /** A page file rather than the shared one, so this is not one page's fix. */
  test('does the same on a page with its own file', async ({ page }) => {
    await page.goto('/en/admin');
    await page
      .getByRole('navigation', { name: 'Admin navigation' })
      .getByRole('link', { name: 'Projects' })
      .click();

    await page.getByRole('button', { name: 'Add a project' }).click();
    await expect(page).toHaveURL(/\/en\/admin\/projects\?edit=new$/);

    await page.goBack();
    await expect(page).toHaveURL(/\/en\/admin\/projects$/);
    await expect(
      page.getByRole('button', { name: 'Add a project' }),
    ).toBeVisible();
  });

  /** And on the one editor that is a toggle rather than a row. */
  test('closes the profile editor without leaving the profile', async ({
    page,
  }) => {
    await page.goto('/en/admin/profile');
    await page.getByRole('button', { name: /^(Edit|Create) profile$/ }).click();
    await expect(page).toHaveURL(/\/en\/admin\/profile\?edit=profile$/);

    await page.goBack();
    await expect(page).toHaveURL(/\/en\/admin\/profile$/);
    await expect(
      page.getByRole('button', { name: /^(Edit|Create) profile$/ }),
    ).toBeVisible();
  });
});

/**
 * Every list shows a step at a time - checked here on the admin's projects,
 * made long enough by this test rather than assumed: the seed holds fewer
 * projects than one step.
 *
 * Created through the API from a signed-in admin page, the way the admin itself
 * writes, and deleted again afterwards so an interrupted run leaves nothing.
 *
 * **Before the profile page describe**, which signs the shared session out, and
 * the password and address describes, which revoke every session: placed after
 * any of them the cookie is already dead and every write here is refused with
 * a 401 - which a run of this describe alone never shows.
 */
test.describe('a long list', () => {
  test.use({ storageState: STATE_PATH });

  const stamp = Date.now();
  const created: string[] = [];

  async function topUpProjects(page: Page, atLeast: number) {
    await page.goto('/en/admin/projects');

    const existing = await page.evaluate(async (api) => {
      const answer = await fetch(`${api}/api/projects`);
      const body = (await answer.json()) as {
        details: { projects: unknown[] };
      };

      return body.details.projects.length;
    }, API_URL);

    for (let i = existing; i < atLeast; i++) {
      const id = await page.evaluate(
        async ({ api, n }) => {
          const answer = await fetch(`${api}/api/projects`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              slug: `e2e-long-list-${n}`,
              title: { en: `E2E long list ${n}` },
              description: { en: 'Made by the end-to-end suite.' },
            }),
          });
          const body = (await answer.json()) as {
            code: string;
            details: { project?: { id: string } };
          };

          return body.details.project?.id ?? `${answer.status} ${body.code}`;
        },
        { api: API_URL, n: `${stamp}-${i}` },
      );

      // An id, or the status and code that refused the write.
      expect(id).toMatch(/^[0-9a-f]{24}$/);
      created.push(id);
    }

    return Math.max(existing, atLeast);
  }

  test.afterAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: STATE_PATH });
    const page = await context.newPage();
    await page.goto('/en/admin/projects');

    for (const id of created) {
      await page.evaluate(
        ({ api, id }) =>
          fetch(`${api}/api/projects/${id}`, {
            method: 'DELETE',
            credentials: 'include',
          }),
        { api: API_URL, id },
      );
    }

    await context.close();
  });

  test('shows twelve projects in the admin, then the rest, with focus on what appeared', async ({
    page,
  }) => {
    const total = await topUpProjects(page, 13);
    await page.reload();

    // Inside `main`: the notifications region keeps a list of its own at the
    // end of the document.
    const cards = page
      .getByRole('main')
      .getByRole('list')
      .last()
      .locator(':scope > li');
    await expect(cards).toHaveCount(12);
    await expect(page.getByText(`Showing 12 of ${total}`)).toBeVisible();

    await page.getByRole('button', { name: 'Show more projects' }).click();

    await expect(cards).toHaveCount(Math.min(total, 24));
    // Focus lands on the thirteenth card, not on a button now below it.
    await expect(cards.nth(12)).toBeFocused();
  });

  test('keeps the admin list open across editing a project', async ({
    page,
  }) => {
    await topUpProjects(page, 13);
    await page.reload();

    await page.getByRole('button', { name: 'Show more projects' }).click();
    await expect(
      page.getByText(/^Showing 1[3-9]|^Showing [2-9]\d of/),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Add a project' }).click();
    await page.getByRole('button', { name: 'Cancel' }).click();

    await expect(
      page.getByText(/^Showing 1[3-9]|^Showing [2-9]\d of/),
    ).toBeVisible();
  });
});

test.describe('the profile page', () => {
  // Reuses the session global setup established, so these three tests spend no
  // login attempts at all. Signing in itself is covered above, through the UI.
  test.use({ storageState: STATE_PATH });

  test('is reachable from the sidebar and saves a change', async ({ page }) => {
    await page.goto('/en/admin');

    await page.getByRole('link', { name: 'Profile' }).click();
    await expect(page).toHaveURL(/\/en\/admin\/profile$/);

    // The page opens read-only; the form is behind an explicit action.
    await page.getByRole('button', { name: /^(Edit|Create) profile$/ }).click();

    const headline = `E2E headline ${Date.now()}`;
    await page.getByLabel(inEnglish('Headline')).fill(headline);
    await page.getByLabel(inEnglish('First name')).fill('Yaaza');
    await page.getByLabel(inEnglish('Last name')).fill('Ait Bah');
    await page.getByRole('button', { name: 'Save profile' }).click();

    // The save is confirmed by the view coming back carrying the new value,
    // which shows what was actually stored rather than only that a request
    // succeeded.
    await expect(
      page.getByRole('button', { name: 'Edit profile' }),
    ).toBeVisible();
    await expect(page.getByText(headline)).toBeVisible();

    // A reload proves it reached the database, not just the client cache.
    await page.reload();
    await expect(page.getByText(headline)).toBeVisible();
  });

  test('reports an invalid value on the field itself and saves nothing', async ({
    page,
  }) => {
    const writes: string[] = [];
    page.on('request', (request) => {
      if (
        request.method() === 'PUT' &&
        request.url().includes('/api/profile')
      ) {
        writes.push(request.url());
      }
    });

    await page.goto('/en/admin/profile');
    await page.getByRole('button', { name: /^(Edit|Create) profile$/ }).click();
    await page.getByLabel(inEnglish('First name')).fill('');
    await page.getByRole('button', { name: 'Save profile' }).click();

    // The message must be attached to the field, not merely present somewhere.
    const firstName = page.getByLabel(inEnglish('First name'));
    await expect(firstName).toHaveAttribute('aria-invalid', 'true');
    const describedBy = await firstName.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    await expect(page.locator(`#${describedBy!}`)).toHaveText(
      'This field is required.',
    );

    expect(writes).toEqual([]);
  });

  test('signs out, and the old cookie stops working', async ({ page }) => {
    await page.goto('/en/admin');
    await expect(page).toHaveURL(/\/en\/admin$/);

    const cookies = await page.context().cookies();
    const session = cookies.find((cookie) => cookie.name === 'session');
    expect(session).toBeDefined();

    // Behind the account menu now, rather than a permanent button in the
    // top-right of every screen.
    await page
      .getByRole('button', { name: `Account menu for ${credentials().email}` })
      .click();
    await page.getByRole('menuitem', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/en\/admin\/login$/);

    await page.goto('/en/admin');
    await expect(page).toHaveURL(/\/en\/admin\/login$/);

    // Tokens are stateless, so clearing the cookie proves nothing on its own.
    // Putting the very same one back must still be refused.
    await page.context().addCookies([session!]);
    // Absolute: baseURL points at the frontend, and the session lives on the API.
    const check = await page.request.get(`${API_URL}/api/auth/me`, {
      headers: { Cookie: `session=${session!.value}` },
    });
    expect(check.status()).toBe(401);
  });
});

/**
 * The logo and the gallery are the whole point of this feature, and both cross
 * every layer: a preset is a name resolved against a vendored drawing, and a
 * gallery image is a file uploaded before the form is saved. Neither is proved
 * by a unit test that stubs the API.
 */

/**
 * The password really changes, end to end - and changes back.
 *
 * Last in the file and signing itself in, because a password change revokes
 * every session: the shared cookie is already spent by here, and nothing after
 * this needs one. The password is restored before the test ends so the
 * disposable account stays usable for the teardown that deletes it.
 */
test.describe('changing the password', () => {
  const NEXT = 'an-entirely-different-passphrase';

  async function change(page: Page, from: string, to: string) {
    await page.goto('/en/admin/account');
    await page.getByLabel('Current password', { exact: true }).fill(from);
    await page.getByLabel('New password', { exact: true }).fill(to);
    await page.getByLabel('Repeat the new password').fill(to);
    await page.getByRole('button', { name: 'Change password' }).click();

    await expect(
      notifications(page).filter({
        hasText: 'Password changed. Every other device has been signed out.',
      }),
    ).toBeVisible();
  }

  /** Whether the API accepts these credentials, without touching the page. */
  async function canSignIn(page: Page, password: string) {
    const response = await page.request.post(`${API_URL}/api/auth/login`, {
      data: { email: credentials().email, password },
    });

    return response.status();
  }

  test('replaces the password and keeps this tab signed in', async ({
    page,
  }) => {
    const original = credentials().password;

    await signIn(page);
    await change(page, original, NEXT);

    // The tab that made the change is still in: the shell renders from
    // /api/auth/me, so this only appears if the re-issued cookie really works.
    await page.goto('/en/admin');
    await expect(
      page.getByRole('button', {
        name: `Account menu for ${credentials().email}`,
      }),
    ).toBeVisible();

    // And the change reached the database rather than only the screen.
    expect(await canSignIn(page, NEXT)).toBe(200);

    await change(page, NEXT, original);
    expect(await canSignIn(page, original)).toBe(200);
  });
});

/**
 * The other credential nothing could rotate. Last in the file, after the
 * password suite, because it changes the address every other spec signs in
 * with - and it changes it back.
 */
test.describe('changing the address', () => {
  const MOVED = 'moved-by-the-suite@example.test';

  async function change(page: Page, to: string) {
    await page.goto('/en/admin/account');
    await page
      .getByLabel('Your password, to confirm')
      .fill(credentials().password);
    await page.getByLabel('New email address').fill(to);
    await page.getByLabel('Repeat the new address').fill(to);
    await page.getByRole('button', { name: 'Change address' }).click();

    await expect(
      notifications(page).filter({
        hasText: 'Address changed. Sign in with the new one from now on.',
      }),
    ).toBeVisible();
  }

  /** Whether the API accepts this address, without touching the page. */
  async function canSignIn(page: Page, email: string) {
    const response = await page.request.post(`${API_URL}/api/auth/login`, {
      data: { email, password: credentials().password },
    });

    return response.status();
  }

  test('replaces the address and keeps this tab signed in', async ({
    page,
  }) => {
    const original = credentials().email;

    await signIn(page);
    await change(page, MOVED);

    // The shell renders from /api/auth/me, so the menu only carries the new
    // address if the re-issued cookie works *and* the cache was updated.
    await page.goto('/en/admin');
    await expect(
      page.getByRole('button', { name: `Account menu for ${MOVED}` }),
    ).toBeVisible();

    // And it reached the database rather than only the screen: the old address
    // is no longer an account, the new one is.
    expect(await canSignIn(page, MOVED)).toBe(200);
    expect(await canSignIn(page, original)).toBe(401);

    await page.goto('/en/admin/account');
    await page
      .getByLabel('Your password, to confirm')
      .fill(credentials().password);
    await page.getByLabel('New email address').fill(original);
    await page.getByLabel('Repeat the new address').fill(original);
    await page.getByRole('button', { name: 'Change address' }).click();
    await expect(
      notifications(page).filter({
        hasText: 'Address changed. Sign in with the new one from now on.',
      }),
    ).toBeVisible();

    expect(await canSignIn(page, original)).toBe(200);
  });
});
