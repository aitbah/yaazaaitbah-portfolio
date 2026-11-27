import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

/**
 * Talking to the running stack from the host.
 *
 * These commands live outside the containers on purpose: `mongodump` is in the
 * `mongo` image and the uploads are in the `backend` one, so the only place
 * that can reach both is the machine running compose. `db:seed` and
 * `db:options` are the opposite - they are application code and run inside.
 */

/** True from anywhere, in either module system: walk up to the compose file. */
export function repositoryRoot() {
  let current = process.cwd();

  while (!existsSync(path.join(current, "docker-compose.yml"))) {
    const parent = path.dirname(current);

    if (parent === current) {
      throw new Error("Could not find the repository root.");
    }

    current = parent;
  }

  return current;
}

export const ROOT = repositoryRoot();

/**
 * One compose command, with the repository root as the working directory so it
 * finds the same project whichever folder this was started from.
 *
 * `execFileSync` rather than a shell: every argument is passed as an argument,
 * so nothing in a path or a filename can be read as syntax.
 */
export function compose(args, options = {}) {
  return execFileSync("docker", ["compose", ...args], {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
    ...options,
  });
}

/**
 * The database the stack is pointed at, read from `.env` rather than assumed.
 *
 * A backup that silently dumped a differently-named database would be empty,
 * and an empty backup is the one failure that is invisible until the day it
 * matters.
 */
export function databaseName() {
  const envPath = path.join(ROOT, ".env");

  if (!existsSync(envPath)) {
    throw new Error("No .env - copy .env.example and fill it in first.");
  }

  const uri = /^MONGO_URI=(.*)$/m.exec(readFileSync(envPath, "utf8"))?.[1];

  if (!uri) {
    throw new Error("MONGO_URI is not set in .env.");
  }

  // The path segment, without any query string: `mongodb://mongo:27017/name`.
  const name = new URL(uri).pathname.replace(/^\//, "").split("?")[0];

  if (!name) {
    throw new Error(`MONGO_URI names no database: ${uri}`);
  }

  return name;
}

/** One mongosh expression against that database, as text. */
export function mongo(script) {
  return compose([
    "exec",
    "-T",
    "mongo",
    "mongosh",
    databaseName(),
    "--quiet",
    "--eval",
    script,
  ]);
}

/**
 * A document count per collection.
 *
 * Every collection the database has, rather than a list of them - the same
 * reason the end-to-end snapshot names none: a list is a thing that goes stale
 * the day an entity is added, and a backup missing a collection nobody thought
 * of is the failure this is meant to prevent.
 */
export function collectionCounts() {
  const json = mongo(
    `JSON.stringify(Object.fromEntries(
       db.getCollectionNames().sort().map((name) => [name, db[name].countDocuments()]),
     ))`,
  ).trim();

  return JSON.parse(json);
}

/** Where the backend keeps what it stores, inside its container. */
export const UPLOADS_DIR = "uploads";

/** One command inside the backend container. */
export function backend(args, options = {}) {
  return compose(["exec", "-T", "backend", ...args], options);
}

/**
 * Every file the uploads volume holds, by path.
 *
 * Nothing is swallowed here, and the first version of it swallowed twice. It
 * ended in `2>/dev/null || true` so that a volume with no directory yet read as
 * empty - and when `find` turned out to have no `-printf` in the backend's musl
 * image, that same `|| true` reported twenty-one files as zero. A backup
 * silently recording nothing is the exact failure this tool exists to prevent,
 * so the absent directory is asked about by name and every other error is
 * allowed to fail loudly.
 */
export function uploadedFiles() {
  const present =
    backend([
      "sh",
      "-c",
      `[ -d ${UPLOADS_DIR} ] && echo yes || echo no`,
    ]).trim() === "yes";

  if (!present) {
    return [];
  }

  return backend(["find", UPLOADS_DIR, "-type", "f"])
    .trim()
    .split("\n")
    .filter(Boolean);
}

export function assertStackIsUp() {
  try {
    mongo('db.adminCommand("ping")');
  } catch {
    throw new Error(
      'The stack is not answering. Run "docker compose up -d" first.',
    );
  }
}
