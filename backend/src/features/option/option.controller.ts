import type { Request, Response } from 'express';

import { optionList, orderedIds } from '@portfolio/shared';

import { sendSuccess } from '../../core/http/respond.js';
import { logger } from '../../core/logging/logger.js';
import {
  createOption,
  listOptions,
  removeOption,
  reorderOptions as reorderOptionsService,
  toOptionResponse,
  updateOption,
} from './option.service.js';
import {
  optionEditSchema,
  optionSchema,
  optionTarget,
} from './option.validation.js';
import { idOf } from '../../core/http/route-params.js';

/**
 * Every option, or one list's.
 *
 * The filter is a convenience for the screen that edits one list at a time. The
 * admin's *forms* ask for all of them at once: nine dropdowns on six screens
 * sharing one cached answer is fewer requests than one query per dropdown, and
 * the whole payload is smaller than a single photograph.
 */
export async function getOptions(req: Request, res: Response) {
  const requested = req.query.list;
  const list =
    requested === undefined ? undefined : optionList.parse(requested);
  const rows = await listOptions(list);

  return sendSuccess(res, { options: rows.map(toOptionResponse) });
}

export async function postOption(req: Request, res: Response) {
  const { list } = optionTarget.parse(req.body);
  const input = optionSchema(list).parse(req.body);
  const row = await createOption(list, input);

  logger.info(
    { userId: req.user?.id, list, code: input.code },
    'Option created',
  );

  return sendSuccess(res, { option: toOptionResponse(row) });
}

export async function putOption(req: Request, res: Response) {
  const { list } = optionTarget.parse(req.body);
  const input = optionEditSchema(list).parse(req.body);
  const row = await updateOption(list, idOf(req), input);

  logger.info({ userId: req.user?.id, id: row.id }, 'Option updated');

  return sendSuccess(res, { option: toOptionResponse(row) });
}

export async function deleteOption(req: Request, res: Response) {
  await removeOption(idOf(req));

  logger.info({ userId: req.user?.id, id: idOf(req) }, 'Option deleted');

  return sendSuccess(res);
}

export async function reorderOptions(req: Request, res: Response) {
  const { list } = optionTarget.parse(req.body);
  const { ids } = orderedIds.parse(req.body);

  await reorderOptionsService(list, ids);

  logger.info(
    { userId: req.user?.id, list, count: ids.length },
    'Option order changed',
  );

  return sendSuccess(res);
}
