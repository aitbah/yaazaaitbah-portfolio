import { mkdirSync, existsSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  ROOT,
  assertStackIsUp,
  backend,
  collectionCounts,
  compose,
  databaseName,
  uploadedFiles,
  UPLOADS_DIR,
} from "./lib/stack.mjs";

/**
 * Takes a copy of everything the owner has written.
 *
 *   npm run backup
 *
 * **Two volumes, not one.** `mongo-data` holds the content and `uploads-data`
 * holds the photographs it points at - and a database backup does not include
 * them. A restore from a database-only copy brings back a portfolio whose
 * images are all missing, which is worse than having no backup at all, because
 * it looks complete.
 *
 * Written to `backups/<timestamp>/`, which Git ignores: it is the owner's real
 * content, and `docs/SECURITY.md` is clear about what never enters the
 * repository.
 *
 * Scheduling this, rotating it and storing it off the machine are deployment
 * concerns and deliberately not here - see `docs/PRODUCTION-DEPLOYMENT.md`.
 * This is the half that makes the development database stop being the only copy.
 */

const ARCHIVE = "database.archive.gz";
const UPLOADS_ARCHIVE = "uploads.tar.gz";
const MANIFEST = "manifest.json";

/** A folder name that sorts chronologically and holds no colons. */
function stamp() {
  return new Date().toISOString().replace(/[:.]/g, "-").replace(/Z$/, "");
}

function dumpDatabase(destination) {
  const name = databaseName();
  const inside = "/tmp/portfolio-backup.gz";

  // Dumped to a file inside the container and copied out, rather than piped
  // through this process: an archive is binary and arbitrarily large, and
  // stdout is neither.
  compose([
    "exec",
    "-T",
    "mongo",
    "mongodump",
    `--db=${name}`,
    `--archive=${inside}`,
    "--gzip",
    "--quiet",
  ]);
  compose(["cp", `mongo:${inside}`, destination]);
  compose(["exec", "-T", "mongo", "rm", "-f", inside]);
}

function archiveUploads(destination) {
  const inside = "/tmp/portfolio-uploads.tar.gz";

  backend(["tar", "-czf", inside, "-C", "/app/backend", UPLOADS_DIR]);
  compose(["cp", `backend:${inside}`, destination]);
  backend(["rm", "-f", inside]);
}

function run() {
  assertStackIsUp();

  const counts = collectionCounts();
  const documents = Object.values(counts).reduce((sum, n) => sum + n, 0);
  const files = uploadedFiles();

  /**
   * An empty backup is the one failure that stays invisible until the day it
   * is needed, so it is refused rather than written. A really empty database
   * has nothing worth copying anyway.
   */
  if (documents === 0) {
    throw new Error(
      `The database "${databaseName()}" holds no documents - nothing to back up.`,
    );
  }

  const directory = path.join(ROOT, "backups", stamp());

  if (existsSync(directory)) {
    throw new Error(`${directory} already exists; refusing to overwrite it.`);
  }

  mkdirSync(directory, { recursive: true });

  const archive = path.join(directory, ARCHIVE);
  const uploads = path.join(directory, UPLOADS_ARCHIVE);

  dumpDatabase(archive);
  archiveUploads(uploads);

  const manifest = {
    createdAt: new Date().toISOString(),
    database: {
      name: databaseName(),
      documents,
      collections: counts,
      archiveBytes: statSync(archive).size,
    },
    uploads: {
      files: files.length,
      archiveBytes: statSync(uploads).size,
    },
  };

  writeFileSync(
    path.join(directory, MANIFEST),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );

  process.stdout.write(
    [
      `Backed up to ${path.relative(ROOT, directory)}`,
      `  ${documents} documents across ${Object.keys(counts).length} collections`,
      `  ${files.length} uploaded files`,
      "",
      "Restore it with:",
      `  npm run restore -- ${path.relative(ROOT, directory)}`,
      "",
    ].join("\n"),
  );
}

try {
  run();
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : error}\n`);
  process.exitCode = 1;
}
