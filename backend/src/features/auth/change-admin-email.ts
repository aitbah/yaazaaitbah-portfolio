import { z } from 'zod';

import { toValidationDetails } from '@portfolio/shared';

import {
  connectDatabase,
  disconnectDatabase,
} from '../../core/database/connection.js';
import { logger } from '../../core/logging/logger.js';
import { UserModel } from './user.model.js';

/**
 * The recovery path for the sign-in address; with no mail to prove a new one, a
 * typo in the form is a lockout.
 *
 *   docker compose exec -e ADMIN_EMAIL=old@example.com \
 *     -e ADMIN_NEW_EMAIL=new@example.com backend npm run admin:email
 *
 * Shell access is the credential, so no password is asked. Every session is
 * revoked.
 */
const argumentsSchema = z.object({
  email: z.email(),
  newEmail: z.email(),
});

async function run() {
  const input = argumentsSchema.safeParse({
    email: process.env.ADMIN_EMAIL,
    newEmail: process.env.ADMIN_NEW_EMAIL,
  });

  if (!input.success) {
    logger.error(
      { fields: toValidationDetails(input.error) },
      'ADMIN_EMAIL / ADMIN_NEW_EMAIL invalid or missing',
    );
    process.exit(1);
  }

  await connectDatabase();

  try {
    const updated = await UserModel.findOneAndUpdate(
      { email: input.data.email },
      { $set: { email: input.data.newEmail }, $inc: { tokenVersion: 1 } },
      { returnDocument: 'after' },
    );

    if (!updated) {
      // Named rather than counted: the likeliest reason to be running this at
      // all is that the stored address is not the one being typed.
      logger.error({ email: input.data.email }, 'No account with that address');
      process.exit(1);
    }

    logger.info(
      { userId: updated._id.toString(), email: updated.email },
      'Admin address changed; every session revoked',
    );
  } finally {
    await disconnectDatabase();
  }
}

run().catch((error: unknown) => {
  logger.fatal({ err: error }, 'Admin address change failed');
  process.exit(1);
});
