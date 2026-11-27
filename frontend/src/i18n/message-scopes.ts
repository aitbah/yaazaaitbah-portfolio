import type { Messages } from 'next-intl';

/**
 * What each tree's provider sends to the client. A nested provider replaces its
 * parent's messages, so anything missing here renders as its own key path.
 */
export function pickAdminMessages(messages: Messages) {
  return {
    admin: messages.admin,
    // The theme control is shared chrome, not admin-only.
    site: messages.site,
    validation: messages.validation,
    responses: messages.responses,
    errors: messages.errors,
  };
}

/** Everything except admin, so the admin area is not disclosed publicly. */
export function pickPublicMessages(messages: Messages) {
  const { admin: _admin, ...rest } = messages;

  return rest;
}
