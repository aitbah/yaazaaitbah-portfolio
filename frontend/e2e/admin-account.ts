import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * A disposable admin, created through the same one-off script a human would use
 * and deleted afterwards. Credentials are generated per run, passed inline, and
 * never written into the repository.
 */
/**
 * Playwright compiles these to CommonJS, so `import.meta` is unavailable, and
 * the working directory depends on where the run was started. Walking up to the
 * compose file is true in either module system and from anywhere.
 */
function repositoryRoot(): string {
  let current = process.cwd();

  while (!existsSync(path.join(current, 'docker-compose.yml'))) {
    const parent = path.dirname(current);

    if (parent === current) {
      throw new Error('could not find the repository root');
    }

    current = parent;
  }

  return current;
}

const ROOT = repositoryRoot();

export const STATE_DIR = path.join(ROOT, 'frontend', 'e2e', '.auth');
export const STATE_PATH = path.join(STATE_DIR, 'signed-in.json');

export function ensureStateDir() {
  mkdirSync(STATE_DIR, { recursive: true });
}

export const API_URL = process.env.E2E_API_URL ?? 'http://localhost:5000';

/**
 * Generated once, in global setup, and passed to the workers through the
 * environment they inherit. This module is imported by the setup process *and*
 * by every worker, so generating them at module scope would give each process
 * different credentials - and the account only exists with one of them.
 */
export function credentials() {
  const email = process.env.E2E_ADMIN_EMAIL;
  const password = process.env.E2E_ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error('E2E admin credentials are missing from the environment');
  }

  return { email, password };
}

function compose(args: string[]) {
  return execFileSync('docker', ['compose', ...args], {
    cwd: ROOT,
    stdio: 'pipe',
    encoding: 'utf8',
  });
}

/**
 * The login limiter allows ten attempts per fifteen minutes and keeps them in
 * memory. A suite that signs in even a few times therefore stops working when
 * it is run repeatedly - which is exactly what a suite is for. Restarting the
 * backend clears the counters, and costs a few seconds against the alternative
 * of a suite that only runs three times an hour.
 */
export function resetRateLimits() {
  compose(['restart', 'backend']);
}

/** One line of mongosh against the development database. */
function mongo(script: string): string {
  return compose([
    'exec',
    '-T',
    'mongo',
    'mongosh',
    'portfolio',
    '--quiet',
    '--eval',
    script,
  ]);
}

/**
 * The prefix every disposable account's address carries.
 *
 * Generated here and nowhere else, which is what makes deleting by prefix safe:
 * no address a human would create can collide with it.
 */
const ADMIN_PREFIX = 'e2e-';

export async function waitForApi(timeoutMs = 60_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  for (;;) {
    try {
      await fetch(`${API_URL}/api/profile`);

      return;
    } catch {
      if (Date.now() > deadline) {
        throw new Error(`the API did not come back at ${API_URL}`);
      }

      await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
  }
}

export function createTestAdmin() {
  const email = `${ADMIN_PREFIX}${Date.now()}@example.test`;
  const password = `${randomBytes(18).toString('base64url')}Aa1!`;

  compose([
    'exec',
    '-T',
    '-e',
    `ADMIN_EMAIL=${email}`,
    '-e',
    `ADMIN_PASSWORD=${password}`,
    'backend',
    'npm',
    'run',
    'admin:create',
  ]);

  process.env.E2E_ADMIN_EMAIL = email;
  process.env.E2E_ADMIN_PASSWORD = password;
}

/**
 * Every disposable account, not only this run's.
 *
 * Deleting one address left a row behind for every run that died before its
 * teardown, and there were two of them in the development database when this
 * was written.
 */
export function deleteTestAdmins() {
  mongo(
    `db.users.deleteMany({ email: { $regex: ${JSON.stringify(`^${ADMIN_PREFIX}`)} } })`,
  );
}

/**
 * The whole database, minus the accounts, captured before the run and written
 * back after it.
 *
 * Deliberately not through the API: restoring needs a session, and the login
 * limiter can refuse one after a few runs. A teardown that quietly fails to
 * restore is worse than no teardown at all.
 *
 * **Every collection, rather than a list of them.** The list was the bug. It
 * named `skills`, which the expertise split had already emptied and abandoned,
 * so every run snapshotted a dead collection and restored it over itself while
 * everything the suite created in `expertise` survived untouched - and
 * `experiences`, added by a later task, was never in the list at all. Naming no
 * collection is what stops the next entity from repeating it.
 *
 * Users are excluded on purpose: they carry password hashes, an environment
 * variable is a poor place to put those, and the accounts are swept by prefix.
 */
export function snapshotDatabase(): string {
  return mongo(`EJSON.stringify(
     Object.fromEntries(
       db.getCollectionNames()
         .filter((name) => name !== 'users')
         .map((name) => [name, db[name].find({}).toArray()]),
     ),
   )`).trim();
}

export function restoreDatabase(snapshot: string): void {
  mongo(`const kept = EJSON.parse(${JSON.stringify(snapshot)});

     // A collection the run created from nothing is emptied, not dropped:
     // leaving it would let the next run snapshot the residue and then
     // faithfully restore it, and dropping it would make one wrong snapshot
     // destroy a collection rather than clear one. An empty collection nothing
     // reads is not residue.
     for (const name of db.getCollectionNames()) {
       if (name !== 'users' && !(name in kept)) {
         db[name].deleteMany({});
       }
     }

     for (const name of Object.keys(kept)) {
       db[name].deleteMany({});

       if (kept[name].length) {
         db[name].insertMany(kept[name]);
       }
     }`);
}

/**
 * Where the backend keeps what it stores, relative to its working directory.
 * The files live in a named volume, so they outlive the container the way the
 * database outlives its own.
 */
const UPLOADS_DIR = 'uploads';

/** One command inside the backend container. */
function backend(args: string[]): string {
  return compose(['exec', '-T', 'backend', ...args]);
}

/**
 * The stored files, listed before the run and swept back to that list after it.
 *
 * Restoring the database is only half of it. A spec that uploads a gallery
 * image writes two things - a row and a file - and putting the row back leaves
 * the file behind with nothing pointing at it. Sixty-three had collected that
 * way when this was written, two per run, going back as far as the volume did.
 *
 * Names rather than contents: a file this application stores is never rewritten
 * in place, so a name that was there before the run is the same bytes after it.
 */
export function snapshotUploads(): string {
  // Through a shell, so a directory that does not exist yet is an empty list
  // rather than a failed setup.
  return backend([
    'sh',
    '-c',
    `find ${UPLOADS_DIR} -type f 2>/dev/null || true`,
  ]).trim();
}

/**
 * Deletes what the run added, and nothing else.
 *
 * Not "everything unreferenced": that is `uploads:prune`, it answers a
 * different question, and it would take whatever a developer had uploaded in
 * another window while the suite ran.
 */
export function restoreUploads(snapshot: string): void {
  const before = new Set(snapshot.split('\n').filter(Boolean));
  const added = snapshotUploads()
    .split('\n')
    .filter((file) => file.length > 0 && !before.has(file));

  if (added.length === 0) {
    return;
  }

  // The paths are arguments, not text inside the script: nothing in a filename
  // can be read as shell syntax.
  backend(['sh', '-c', 'rm -f -- "$@"', 'sh', ...added]);
}

/** A signed-in browser state, so the suite spends one login instead of five. */
export async function saveSignedInState(path: string): Promise<void> {
  const response = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials()),
  });

  const header = response.headers.get('set-cookie') ?? '';
  const value = /session=([^;]+)/.exec(header)?.[1];

  if (!value) {
    throw new Error('could not obtain a session cookie for the E2E state');
  }

  const state = {
    cookies: [
      {
        name: 'session',
        value,
        domain: 'localhost',
        path: '/',
        expires: -1,
        httpOnly: true,
        secure: true,
        sameSite: 'Lax' as const,
      },
    ],
    origins: [],
  };

  await writeFile(path, JSON.stringify(state));
}

/** Where the browser reaches the frontend - the same default the config uses. */
const FRONTEND_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

/**
 * Every admin page, requested once before any test runs.
 *
 * CI serves the frontend with `next dev`, which compiles a route the first time
 * anything asks for it. A test that reaches a page with `goto` waits as long as
 * that takes; a test that reaches it by clicking a sidebar link waits five
 * seconds for the URL, because a client-side navigation only commits once the
 * page has arrived. The options page compiled in 5.3 s on one CI run and its
 * test failed on the URL, with nothing wrong in the application - a timing that
 * belongs to the dev server being charged to whichever test happened to arrive
 * first.
 *
 * Read from the route folders rather than listed, for the reason
 * `snapshotDatabase` names no collection: a list is what the next page is
 * missing from.
 *
 * Best effort. A page that fails to load here will fail its own test with a
 * message about the page, which is a better report than a setup that skips
 * the whole suite.
 */
export async function warmAdminRoutes(statePath: string): Promise<void> {
  const state = JSON.parse(await readFile(statePath, 'utf8')) as {
    cookies: { name: string; value: string }[];
  };
  const cookie = state.cookies
    .map(({ name, value }) => `${name}=${value}`)
    .join('; ');

  const pages = path.join(
    ROOT,
    'frontend',
    'src',
    'app',
    '[locale]',
    'admin',
    '(protected)',
  );
  const segments = [
    '',
    ...readdirSync(pages, { withFileTypes: true })
      .filter(
        (entry) =>
          entry.isDirectory() &&
          existsSync(path.join(pages, entry.name, 'page.tsx')),
      )
      .map((entry) => `/${entry.name}`),
  ];

  // One at a time: the dev server compiles one route at a time anyway, and a
  // burst of sixteen only queues behind itself.
  for (const segment of segments) {
    try {
      await fetch(`${FRONTEND_URL}/en/admin${segment}`, {
        headers: { cookie },
        redirect: 'manual',
      });
    } catch {
      // See above: the page's own test is the place to report it.
    }
  }
}
