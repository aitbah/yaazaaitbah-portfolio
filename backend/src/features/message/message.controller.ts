import type { Request, Response } from 'express';

import { messagePage, MESSAGES_PAGE_SIZE } from '@portfolio/shared';

import { sendSuccess } from '../../core/http/respond.js';
import { logger } from '../../core/logging/logger.js';
import {
  countUnreadMessages,
  listMessages,
  markMessageRead,
  removeMessage,
  saveMessage,
  toMessageResponse,
} from './message.service.js';
import { messageSchema, readSchema } from './message.validation.js';
import { idOf } from '../../core/http/route-params.js';

/**
 * The only public write in the application.
 *
 * It answers the same way whether the message was stored or silently dropped
 * as automated: a sender learns that their message was accepted, and nothing
 * more. Nothing about what was stored is echoed back, so the endpoint cannot be
 * used to check what the validation accepts.
 */
export async function postMessage(req: Request, res: Response) {
  const input = messageSchema.parse(req.body);

  await saveMessage(input);

  // Deliberately no identifiers and no content: the sender does not need them,
  // and logging the body would put a stranger's words in the log file.
  logger.info(
    { subjectLength: input.subject.length },
    'Contact message received',
  );

  return sendSuccess(res);
}

export async function getMessages(req: Request, res: Response) {
  // A page number that is not a number is page zero, not an error: it comes
  // from a URL, and an inbox should open rather than refuse.
  const page = messagePage.catch(0).parse(req.query.page);

  const { messages, total } = await listMessages(page);

  return sendSuccess(res, {
    messages: messages.map(toMessageResponse),
    unread: await countUnreadMessages(),
    page,
    pageSize: MESSAGES_PAGE_SIZE,
    total,
  });
}

export async function patchMessageRead(req: Request, res: Response) {
  const { read } = readSchema.parse(req.body);
  const message = await markMessageRead(idOf(req), read);

  logger.info(
    { userId: req.user?.id, messageId: message.id },
    'Message read state changed',
  );

  return sendSuccess(res, { message: toMessageResponse(message) });
}

export async function deleteMessage(req: Request, res: Response) {
  await removeMessage(idOf(req));

  logger.info(
    { userId: req.user?.id, messageId: idOf(req) },
    'Message deleted',
  );

  return sendSuccess(res);
}
