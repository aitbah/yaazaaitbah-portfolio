import type { UserRole } from './user.model.js';

/** What the rest of the app may see about the caller - never the password hash. */
export type AuthenticatedUser = {
  id: string;
  email: string;
  role: UserRole;
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}
