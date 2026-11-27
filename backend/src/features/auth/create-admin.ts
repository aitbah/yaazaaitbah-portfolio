import { toValidationDetails } from '@portfolio/shared';

import {
  connectDatabase,
  disconnectDatabase,
} from '../../core/database/connection.js';
import { logger } from '../../core/logging/logger.js';
import { createAdmin } from './auth.service.js';
import { adminCredentialsSchema } from './auth.validation.js';

/**
 * One-off creation of the initial admin - there is no registration endpoint.
 *
 *   docker compose exec -e ADMIN_EMAIL=you@example.com -e ADMIN_PASSWORD=... \
 *     backend npm run admin:create
 *
 * Passed inline so the credentials never land in .env.
 */
async function run() {
  const credentials = adminCredentialsSchema.safeParse({
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
  });

  if (!credentials.success) {
    // Codes only - the submitted password is never logged.
    logger.error(
      { fields: toValidationDetails(credentials.error) },
      'ADMIN_EMAIL / ADMIN_PASSWORD invalid or missing',
    );
    process.exit(1);
  }

  await connectDatabase();

  try {
    const admin = await createAdmin(credentials.data);
    logger.info(
      { userId: admin.id, email: admin.email },
      'Admin account created',
    );
  } finally {
    await disconnectDatabase();
  }
}

run().catch((error: unknown) => {
  logger.fatal({ err: error }, 'Admin creation failed');
  process.exit(1);
});
