import { z } from 'zod';
import { messageRules } from '@portfolio/shared';

/**
 * What a visitor may send, by the same rules the backend enforces.
 *
 * Shared byte-for-byte rather than restated: a form that accepted what the API
 * refuses would fail after the reader had already written their message, and
 * one that refused what the API accepts would be a limit nobody could see.
 */
export const messageSchema = z.object(messageRules);

export type MessageInput = z.infer<typeof messageSchema>;
