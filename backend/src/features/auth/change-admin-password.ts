import { z } from 'zod';

import { newPassword, toValidationDetails } from '@portfolio/shared';

import {
  connectDatabase,
  disconnectDatabase,
} from '../../core/database/connection.js';
import { logger } from '../../core/logging/logger.js';
import { hashPassword } from './auth.service.js';
import { UserModel } from './user.model.js';

/**
 * The recovery path for a forgotten password.
 *
 *   docker compose exec -e ADMIN_EMAIL=you@example.com \
 *     -e ADMIN_PASSWORD=... backend npm run admin:password
 *
 * The same policy as the form applies, and every session is revoked.
 */
const argumentsSchema = z.object({
  email: z.email(),
  password: newPassword,
});

async function run() {
  const input = argumentsSchema.safeParse({
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
  });

  if (!input.success) {
    // Codes only - the submitted password is never logged.
    logger.error(
      { fields: toValidationDetails(input.error) },
      'ADMIN_EMAIL / ADMIN_PASSWORD invalid or missing',
    );
    process.exit(1);
  }

  await connectDatabase();

  try {
    const updated = await UserModel.findOneAndUpdate(
      { email: input.data.email },
      {
        $set: { passwordHash: await hashPassword(input.data.password) },
        $inc: { tokenVersion: 1 },
      },
      { returnDocument: 'after' },
    );

    if (!updated) {
      logger.error({ email: input.data.email }, 'No account with that address');
      process.exit(1);
    }

    logger.info(
      { userId: updated._id.toString(), email: updated.email },
      'Admin password changed; every session revoked',
    );
  } finally {
    await disconnectDatabase();
  }
}

run().catch((error: unknown) => {
  logger.fatal({ err: error }, 'Admin password change failed');
  process.exit(1);
});
