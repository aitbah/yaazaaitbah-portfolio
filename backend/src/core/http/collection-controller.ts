import type { Request, Response } from 'express';
import type { ZodType } from 'zod';

import { orderedIds } from '@portfolio/shared';

import { logger } from '../logging/logger.js';
import { sendSuccess } from './respond.js';
import { idOf } from './route-params.js';

type CollectionService<Row, Input> = {
  list: () => Promise<Row[]>;
  create: (input: Input) => Promise<Row>;
  update: (id: string, input: Input) => Promise<Row>;
  remove: (id: string) => Promise<void>;
  /** Only for a collection the owner orders by hand. */
  reorder?: (ids: string[]) => Promise<void>;
};

type CollectionControllerOptions<Row, Input> = {
  /** How the logs name one row: "Language", "Social link". */
  label: string;
  /** The response keys for the list and for one row. */
  envelope: { list: string; one: string };
  schema: ZodType<Input>;
  service: CollectionService<Row, Input>;
  toResponse: (row: Row) => unknown;
};

/**
 * The handlers of a plain collection: list, create, update, delete and, where
 * it has one, reorder. What differs between collections is passed in; a
 * feature with more to do than this keeps its own controller.
 */
export function collectionController<Row extends { id: string }, Input>({
  label,
  envelope,
  schema,
  service,
  toResponse,
}: CollectionControllerOptions<Row, Input>) {
  return {
    list: async (_req: Request, res: Response) => {
      const rows = await service.list();

      return sendSuccess(res, { [envelope.list]: rows.map(toResponse) });
    },

    create: async (req: Request, res: Response) => {
      const row = await service.create(schema.parse(req.body));

      logger.info({ userId: req.user?.id, id: row.id }, `${label} created`);

      return sendSuccess(res, { [envelope.one]: toResponse(row) });
    },

    update: async (req: Request, res: Response) => {
      const row = await service.update(idOf(req), schema.parse(req.body));

      logger.info({ userId: req.user?.id, id: row.id }, `${label} updated`);

      return sendSuccess(res, { [envelope.one]: toResponse(row) });
    },

    remove: async (req: Request, res: Response) => {
      await service.remove(idOf(req));

      logger.info({ userId: req.user?.id, id: idOf(req) }, `${label} deleted`);

      return sendSuccess(res);
    },

    reorder: async (req: Request, res: Response) => {
      const { ids } = orderedIds.parse(req.body);

      await service.reorder?.(ids);

      logger.info(
        { userId: req.user?.id, count: ids.length },
        `${label} order changed`,
      );

      return sendSuccess(res);
    },
  };
}
