import type { Request, Response } from 'express';

import { orderedIds } from '@portfolio/shared';

import { sendSuccess } from '../../core/http/respond.js';
import { logger } from '../../core/logging/logger.js';
import { receiveImage } from '../../core/storage/upload.middleware.js';
import {
  createProject,
  listProjects,
  reorderProjects as reorderProjectsService,
  removeProject,
  toProjectResponse,
  updateProject,
} from './project.service.js';
import { projectSchema } from './project.validation.js';
import { idOf } from '../../core/http/route-params.js';

export async function getProjects(_req: Request, res: Response) {
  const projects = await listProjects();

  return sendSuccess(res, { projects: projects.map(toProjectResponse) });
}

export async function postProject(req: Request, res: Response) {
  const input = projectSchema.parse(req.body);
  const project = await createProject(input);

  logger.info(
    { userId: req.user?.id, projectId: project.id },
    'Project created',
  );

  return sendSuccess(res, { project: toProjectResponse(project) });
}

export async function putProject(req: Request, res: Response) {
  const input = projectSchema.parse(req.body);
  const project = await updateProject(idOf(req), input);

  logger.info(
    { userId: req.user?.id, projectId: project.id },
    'Project updated',
  );

  return sendSuccess(res, { project: toProjectResponse(project) });
}

export async function deleteProject(req: Request, res: Response) {
  await removeProject(idOf(req));

  logger.info(
    { userId: req.user?.id, projectId: idOf(req) },
    'Project deleted',
  );

  return sendSuccess(res);
}

/**
 * Saved into a project only when the admin saves the form, so an upload that is
 * never saved leaves a file nothing points at - `uploads:prune` clears it.
 *
 * The cover and a gallery image are separate endpoints rather than one taking a
 * parameter: they answer under different field names, so a failure lands on the
 * control the admin was actually using.
 */
export async function uploadCover(req: Request, res: Response) {
  const imageUrl = await receiveImage(req, {
    category: 'project',
    name: 'cover',
    field: 'image',
  });

  logger.info({ userId: req.user?.id }, 'Project cover uploaded');

  return sendSuccess(res, { imageUrl });
}

export async function uploadGalleryImage(req: Request, res: Response) {
  const imageUrl = await receiveImage(req, {
    category: 'project',
    name: 'gallery',
    field: 'gallery',
  });

  logger.info({ userId: req.user?.id }, 'Project gallery image uploaded');

  return sendSuccess(res, { imageUrl });
}

export async function reorderProjects(req: Request, res: Response) {
  const { ids } = orderedIds.parse(req.body);

  await reorderProjectsService(ids);

  logger.info(
    { userId: req.user?.id, count: ids.length },
    'Project order changed',
  );

  return sendSuccess(res);
}
