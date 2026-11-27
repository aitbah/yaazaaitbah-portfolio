import mongoose from 'mongoose';

/**
 * Connects the suite to a real MongoDB - the one `docker compose up` already
 * provides - and reports whether it got one.
 *
 * On a developer's machine an absent database skips the suite rather than
 * failing it: `npm test` must stay runnable with nothing started. In CI it
 * throws instead, because CI supplies a database on purpose and a suite that
 * quietly skipped there would turn the guarantee back into a hope.
 */
export async function connectOrSkip(label: string, uri: string) {
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 2_000 });

    return true;
  } catch (cause) {
    if (process.env.CI === 'true') {
      throw new Error(
        `[${label}] no MongoDB at ${uri}, and CI is supposed to provide one.`,
        { cause },
      );
    }

    // Loud on purpose: a silently skipped suite is worse than none.
    process.stdout.write(
      `\n[${label}] SKIPPED - no MongoDB at ${uri}. Run "docker compose up -d".\n`,
    );

    return false;
  }
}
