import {
  deleteTestAdmins,
  restoreDatabase,
  restoreUploads,
} from './admin-account';

/**
 * Each step is attempted independently. One failing restore must not skip the
 * others: a run that ends halfway through cleanup is exactly the case that
 * leaves rows behind in the developer's database, which is what snapshotting
 * exists to prevent.
 */
function attempt(cleanup: () => void) {
  try {
    cleanup();
  } catch {
    // Local database, disposable data: cleanup must not fail a green run.
  }
}

export default function globalTeardown() {
  if (process.env.E2E_ADMIN_READY !== 'true') {
    return;
  }

  const database = process.env.E2E_DATABASE_BACKUP;

  if (database) {
    attempt(() => restoreDatabase(database));
  }

  // After the rows, so what is deleted is what the run added rather than what
  // the restored rows happen not to reference.
  const uploads = process.env.E2E_UPLOADS_BACKUP;

  if (uploads !== undefined) {
    attempt(() => restoreUploads(uploads));
  }

  attempt(deleteTestAdmins);
}
