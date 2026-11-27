import type { Request, RequestHandler, Response } from 'express';

import {
  orderedIds,
  KIND_HAS_ICON,
  RESOURCE_BY_KIND,
  type ExpertiseKind,
} from '@portfolio/shared';

import { sendSuccess } from '../../core/http/respond.js';
import { logger } from '../../core/logging/logger.js';
import { receiveImage } from '../../core/storage/upload.middleware.js';
import {
  createExpertise,
  listExpertise,
  removeExpertise,
  reorderExpertise,
  toExpertiseResponse,
  updateExpertise,
} from './expertise.service.js';
import { expertiseSchema } from './expertise.validation.js';
import { idOf } from '../../core/http/route-params.js';

/**
 * One set of handlers per kind, closed over it.
 *
 * The kind is fixed by the route rather than read from the body: `/api/tools`
 * can only ever create a tool, so there is no request that can name one kind
 * and land in another list.
 */
export function expertiseHandlers(kind: ExpertiseKind) {
  const schema = expertiseSchema(kind);
  // The plural the resource is mounted under, for the response envelope: a
  // caller reading `/api/tools` gets `{ tools: [...] }`, never `{ items: [] }`.
  const collection = RESOURCE_BY_KIND[kind];

  const get: RequestHandler = async (_req, res) => {
    const rows = await listExpertise(kind);

    sendSuccess(res, { [collection]: rows.map(toExpertiseResponse) });
  };

  const post: RequestHandler = async (req, res) => {
    const input = schema.parse(req.body);
    const row = await createExpertise(kind, input);

    logger.info(
      { userId: req.user?.id, kind, id: row.id },
      'Expertise created',
    );

    sendSuccess(res, { [kind]: toExpertiseResponse(row) });
  };

  const put: RequestHandler = async (req, res) => {
    const input = schema.parse(req.body);
    const row = await updateExpertise(kind, idOf(req), input);

    logger.info(
      { userId: req.user?.id, kind, id: row.id },
      'Expertise updated',
    );

    sendSuccess(res, { [kind]: toExpertiseResponse(row) });
  };

  const remove: RequestHandler = async (req, res) => {
    await removeExpertise(kind, idOf(req));

    logger.info(
      { userId: req.user?.id, kind, id: idOf(req) },
      'Expertise deleted',
    );

    sendSuccess(res);
  };

  const reorder: RequestHandler = async (req, res) => {
    const { ids } = orderedIds.parse(req.body);

    await reorderExpertise(kind, ids);

    logger.info(
      { userId: req.user?.id, kind, count: ids.length },
      'Expertise order changed',
    );

    sendSuccess(res);
  };

  return { get, post, put, remove, reorder };
}

/**
 * A custom raster logo, for marks the preset set lacks; SVG is refused as
 * everywhere else. Only mounted for the kinds that have a logo.
 */
export function uploadIcon(kind: ExpertiseKind): RequestHandler {
  if (!KIND_HAS_ICON[kind]) {
    throw new Error(`${kind} has no logo`);
  }

  return async (req: Request, res: Response) => {
    const iconUrl = await receiveImage(req, {
      category: 'expertise',
      name: 'icon',
      field: 'icon',
    });

    logger.info({ userId: req.user?.id, kind }, 'Expertise icon uploaded');

    sendSuccess(res, { iconUrl });
  };
}
