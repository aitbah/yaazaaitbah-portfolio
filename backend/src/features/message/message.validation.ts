import { z } from 'zod';

import { messageRules } from '@portfolio/shared';

/**
 * What the contact form may send. `website` is the honeypot: a real browser
 * never fills a hidden field, so anything in it came from something automated.
 */
export const messageSchema = z.object(messageRules);

export type MessageInput = z.infer<typeof messageSchema>;

/** The one thing an admin may change about a message. */
export const readSchema = z.object({ read: z.boolean() });
