import { z } from 'zod';

import { loginRules } from '@portfolio/shared';

/**
 * The rules are shared with the backend byte-for-byte, so both sides produce the
 * same field codes. The password policy is deliberately absent - see
 * `loginRules` in the shared package.
 */
export const loginSchema = z.object(loginRules);

export type LoginInput = z.infer<typeof loginSchema>;
