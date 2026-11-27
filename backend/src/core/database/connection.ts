import mongoose from 'mongoose';

import { env } from '../../config/env.js';
import { logger } from '../logging/logger.js';

// Registered at module scope: connecting twice in one process would otherwise
// attach a second copy of each listener and log everything twice.
mongoose.connection.on('error', (error) => {
  logger.error({ err: error }, 'MongoDB connection error');
});
mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB disconnected');
});

export async function connectDatabase() {
  // Fail fast instead of buffering commands against an unreachable database.
  await mongoose.connect(env.MONGO_URI, { serverSelectionTimeoutMS: 5_000 });

  logger.info({ database: mongoose.connection.name }, 'MongoDB connected');
}

/**
 * Whether the database is reachable *now*, rather than whether it once was.
 *
 * `bootstrap` connects before it listens, so any answer at all already proves
 * the connection succeeded at startup. This is about the other case: a
 * connection dropped hours later, where the process still accepts requests and
 * every one of them fails.
 */
export function isDatabaseConnected() {
  return mongoose.connection.readyState === mongoose.ConnectionStates.connected;
}

export async function disconnectDatabase() {
  await mongoose.disconnect();
}
