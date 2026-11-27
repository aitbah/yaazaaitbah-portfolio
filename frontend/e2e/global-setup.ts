import {
  createTestAdmin,
  deleteTestAdmins,
  ensureStateDir,
  resetRateLimits,
  saveSignedInState,
  snapshotDatabase,
  snapshotUploads,
  STATE_PATH,
  waitForApi,
  warmAdminRoutes,
} from './admin-account';

/**
 * Authenticated flows need an account, and there is no registration endpoint.
 * The database is captured whole because the specs edit real rows - the profile
 * because `PUT` replaces the only document there is, and expertise, projects,
 * experience, links and messages because the specs create and delete them.
 *
 * The uploads volume is captured too, because a spec that uploads an image
 * writes a file as well as a row and only one of the two is a database.
 *
 * If the stack is not running, the flows that need a session skip rather than
 * fail: a missing Docker is not a broken application.
 */
export default async function globalSetup() {
  try {
    // Clears the in-memory login counters, so the suite can be run repeatedly
    // instead of exhausting the limiter after a few passes.
    resetRateLimits();
    await waitForApi();

    // Before the snapshot, and before this run's own account exists: anything
    // an earlier run left behind is residue, and taking it into the snapshot
    // would restore it faithfully at the end.
    deleteTestAdmins();

    createTestAdmin();
    process.env.E2E_DATABASE_BACKUP = snapshotDatabase();
    // The other half of the same promise: the specs upload real files, and the
    // database restore cannot put those back or take them away.
    process.env.E2E_UPLOADS_BACKUP = snapshotUploads();

    // One login here rather than one per test: the limiter allows ten in
    // fifteen minutes, and a suite that spends five cannot run twice.
    ensureStateDir();
    await saveSignedInState(STATE_PATH);

    // Every admin page compiled before the first test, so no test pays for a
    // cold `next dev` route inside a five-second expectation.
    await warmAdminRoutes(STATE_PATH);

    process.env.E2E_ADMIN_READY = 'true';
  } catch {
    process.env.E2E_ADMIN_READY = 'false';
  }
}
