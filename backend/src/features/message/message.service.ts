import { MESSAGES_PAGE_SIZE } from '@portfolio/shared';

import { ApiError } from '../../core/http/api-error.js';
import { logger } from '../../core/logging/logger.js';
import { ResponseCode } from '../../core/http/response-codes.js';
import {
  MessageModel,
  MESSAGE_SORT,
  type MessageDocument,
} from './message.model.js';
import { notifyOwnerOfMessage } from './message.notify.js';
import { sanitizeText } from './message.sanitize.js';
import type { MessageInput } from './message.validation.js';
import { toObjectId } from '../../core/database/object-id.js';

export type MessageResponse = {
  id: string;
  name: string;
  email: string;
  subject: string;
  body: string;
  read: boolean;
  /** When it was sent - an inbox is ordered and read by this. */
  receivedAt: string;
};

export function toMessageResponse(message: MessageDocument): MessageResponse {
  return {
    id: message._id.toString(),
    name: message.name,
    email: message.email,
    subject: message.subject,
    body: message.body,
    read: message.read,
    receivedAt: message.createdAt.toISOString(),
  };
}

/**
 * Stores a contact message, or pretends to: a filled honeypot is accepted and
 * discarded, so a bot cannot learn what gave it away. The text is sanitized of
 * control and invisible characters.
 */
export async function saveMessage(input: MessageInput): Promise<void> {
  if (input.website) {
    return;
  }

  const stored = {
    name: sanitizeText(input.name),
    email: input.email,
    subject: sanitizeText(input.subject),
    body: sanitizeText(input.body),
  };

  await MessageModel.create(stored);

  /**
   * After the write, unable to fail it, and not awaited: a slow or absent mail
   * transport must cost the visitor nothing. A notification in flight at
   * shutdown is lost; the message is already stored. The catch keeps any
   * rejection handled.
   */
  void notifyOwnerOfMessage({ ...input, ...stored }).catch((error: unknown) => {
    logger.error({ err: error }, 'Could not notify the owner of a message');
  });
}

export type MessagePage = {
  messages: MessageDocument[];
  /** Every message, not just this page - what the pager counts through. */
  total: number;
};

/**
 * One page of messages, newest first.
 *
 * The inbox is the only list in the application a stranger can add rows to, so
 * it is the only one that pages: every other list is as long as the owner chose
 * to make it. A page past the end is an empty page, not an error - it is what a
 * stale link produces after messages are deleted.
 */
export async function listMessages(page = 0): Promise<MessagePage> {
  const skip = page * MESSAGES_PAGE_SIZE;

  const [messages, total] = await Promise.all([
    MessageModel.find().sort(MESSAGE_SORT).skip(skip).limit(MESSAGES_PAGE_SIZE),
    MessageModel.countDocuments(),
  ]);

  return { messages, total };
}

export async function countUnreadMessages(): Promise<number> {
  return MessageModel.countDocuments({ read: false });
}

/**
 * The only mutation a message allows. What was sent is never edited - that
 * would make the record a lie - so this sets one flag and nothing else.
 */
export async function markMessageRead(
  id: string,
  read: boolean,
): Promise<MessageDocument> {
  const message = await MessageModel.findOneAndUpdate(
    { _id: toObjectId(id) },
    { $set: { read } },
    { returnDocument: 'after' },
  );

  if (!message) {
    throw new ApiError(ResponseCode.NOT_FOUND);
  }

  return message;
}

export async function removeMessage(id: string): Promise<void> {
  const deleted = await MessageModel.findOneAndDelete({ _id: toObjectId(id) });

  if (!deleted) {
    throw new ApiError(ResponseCode.NOT_FOUND);
  }
}
