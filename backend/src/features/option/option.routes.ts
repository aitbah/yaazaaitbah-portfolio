import { Router } from 'express';

import { requireAuth } from '../auth/auth.middleware.js';
import {
  deleteOption,
  getOptions,
  postOption,
  putOption,
  reorderOptions,
} from './option.controller.js';

export const optionRouter = Router();

/**
 * Public on purpose, like the content it labels: the portfolio's own pages show
 * an employment type and a language level, and a label is not a secret. Writing
 * is the owner's alone.
 */
optionRouter.get('/', getOptions);

// Before the ':id' routes, so 'reorder' is never read as an identifier.
optionRouter.put('/reorder', requireAuth, reorderOptions);

optionRouter.post('/', requireAuth, postOption);
optionRouter.put('/:id', requireAuth, putOption);
optionRouter.delete('/:id', requireAuth, deleteOption);
