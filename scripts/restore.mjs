import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import {
  ROOT,
  assertStackIsUp,
  backend,
  collectionCounts,
  compose,
  databaseName,
  mongo,
  uploadedFiles,
  UPLOADS_DIR,
} from "./lib/stack.mjs";

/**
 * Puts a backup back, and then checks that it did.
 *
 *   npm run restore -- backups/2026-09-07T12-00-00-000
 *
 * **This replaces everything.** The database is dropped and the uploads
 * directory is emptied before either is written, because a restore that leaves
 * a collection or a file behind is a half-restore - and a half-restore is
 * indistinguishable from a whole one until something reads the part that did
 * not come back.
 *
 * There is no "latest" and no default: the directory is the argument, and the
 * argument is the confirmation.
 *
 * The last thing it does is count what actually landed and compare it against
 * the manifest the backup wrote. `docs/PRODUCTION-DEPLOYMENT.md` says restores
 * must be tested rather than assumed - this makes every restore test itself,
 * rather than leaving that to a test that ran once.
 */

const ARCHIVE = "database.archive.gz";
const UPLOADS_ARCHIVE = "uploads.tar.gz";
const MANIFEST = "manifest.json";

function readManifest(directory) {
  const file = path.join(directory, MANIFEST);

  if (!existsSync(file)) {
    throw new Error(`${file} is missing - that is not a backup directory.`);
  }

  const manifest = JSON.parse(readFileSync(file, "utf8"));

  for (const name of [ARCHIVE, UPLOADS_ARCHIVE]) {
    if (!existsSync(path.join(directory, name))) {
      throw new Error(`${path.join(directory, name)} is missing.`);
    }
  }

  return manifest;
}

function restoreDatabase(archive, source) {
  const target = databaseName();
  const inside = "/tmp/portfolio-restore.gz";

  compose(["cp", archive, `mongo:${inside}`]);
  // Dropped whole rather than relying on `--drop`, which only drops what the
  // archive happens to contain: a collection created after the backup would
  // otherwise survive a restore that claims to have put this database back as
  // it was.
  mongo("db.dropDatabase()");
  compose([
    "exec",
    "-T",
    "mongo",
    "mongorestore",
    `--archive=${inside}`,
    "--gzip",
    "--quiet",
    // The archive carries the database name it was taken from. Mapping it
    // explicitly is what lets a backup be restored into a stack whose `.env`
    // names a different one - which is the whole point of having a portable
    // copy rather than a volume snapshot.
    `--nsFrom=${source}.*`,
    `--nsTo=${target}.*`,
  ]);
  compose(["exec", "-T", "mongo", "rm", "-f", inside]);
}

function restoreUploads(archive) {
  const inside = "/tmp/portfolio-uploads.tar.gz";

  compose(["cp", archive, `backend:${inside}`]);
  /**
   * Emptied rather than merged into: a file the backup does not have is a file
   * from after it, and leaving it behind would make the result neither state.
   *
   * The *contents*, never the directory. `uploads` is a volume mount point, so
   * `rm -rf uploads` fails with "Resource busy" after deleting everything
   * inside it - which is the worst of both, and is what the first version did.
   */
  backend([
    "sh",
    "-c",
    `mkdir -p ${UPLOADS_DIR} && find ${UPLOADS_DIR} -mindepth 1 -exec rm -rf {} +`,
  ]);
  backend(["tar", "-xzf", inside, "-C", "/app/backend"]);
  backend(["rm", "-f", inside]);
}

/** Every count that did not come back as the manifest said it would. */
function differences(manifest, counts, files) {
  const problems = [];
  const expected = manifest.database.collections;

  for (const name of Object.keys(expected)) {
    if ((counts[name] ?? 0) !== expected[name]) {
      problems.push(
        `${name}: expected ${expected[name]}, found ${counts[name] ?? 0}`,
      );
    }
  }

  // Both directions: a collection nothing in the backup accounts for means the
  // database was not actually replaced.
  for (const name of Object.keys(counts)) {
    if (!(name in expected)) {
      problems.push(`${name}: ${counts[name]} documents the backup never had`);
    }
  }

  if (files !== manifest.uploads.files) {
    problems.push(
      `uploaded files: expected ${manifest.uploads.files}, found ${files}`,
    );
  }

  return problems;
}

function run() {
  const given = process.argv[2];

  if (!given) {
    throw new Error(
      "Which backup? Pass the directory:\n  npm run restore -- backups/<timestamp>",
    );
  }

  assertStackIsUp();

  const directory = path.resolve(ROOT, given);
  const manifest = readManifest(directory);
  const current = collectionCounts();
  const currentDocuments = Object.values(current).reduce(
    (sum, n) => sum + n,
    0,
  );

  process.stdout.write(
    [
      `Restoring ${path.relative(ROOT, directory)} into "${databaseName()}".`,
      "",
      `  Replacing: ${currentDocuments} documents, ${uploadedFiles().length} uploaded files`,
      `  With:      ${manifest.database.documents} documents, ${manifest.uploads.files} uploaded files`,
      `  Taken:     ${manifest.createdAt}`,
      "",
    ].join("\n"),
  );

  restoreDatabase(path.join(directory, ARCHIVE), manifest.database.name);
  restoreUploads(path.join(directory, UPLOADS_ARCHIVE));

  const problems = differences(
    manifest,
    collectionCounts(),
    uploadedFiles().length,
  );

  if (problems.length > 0) {
    throw new Error(
      [
        "The restore did not match the backup:",
        ...problems.map((p) => `  ${p}`),
      ].join("\n"),
    );
  }

  process.stdout.write(
    `Restored and verified: every collection and every file matches the manifest.\n`,
  );
}

try {
  run();
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : error}\n`);
  process.exitCode = 1;
}
