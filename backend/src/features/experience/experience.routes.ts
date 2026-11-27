import { Router } from 'express';

import { requireAuth } from '../auth/auth.middleware.js';
import { experienceController } from './experience.controller.js';

export const experienceRouter = Router();

// Public on purpose: the portfolio's own pages display the career.
experienceRouter.get('/', experienceController.list);

experienceRouter.post('/', requireAuth, experienceController.create);
experienceRouter.put('/:id', requireAuth, experienceController.update);
experienceRouter.delete('/:id', requireAuth, experienceController.remove);

// No reorder endpoint: the dates are the order. See `experience.model.ts`.
