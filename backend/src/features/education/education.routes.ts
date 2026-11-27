import { Router } from 'express';

import { requireAuth } from '../auth/auth.middleware.js';
import { educationController } from './education.controller.js';

export const educationRouter = Router();

// Public on purpose: the portfolio's own pages display it.
educationRouter.get('/', educationController.list);

educationRouter.post('/', requireAuth, educationController.create);
educationRouter.put('/:id', requireAuth, educationController.update);
educationRouter.delete('/:id', requireAuth, educationController.remove);

// No reorder endpoint: the dates are the order. See `education.model.ts`.
