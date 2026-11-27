import type { Types } from 'mongoose';

import { localizedPath } from '../../core/database/localized-text.js';
import { applyOrder } from '../../core/database/reorder.js';
import { replacementUpdate } from '../../core/database/replace-fields.js';
import { ApiError } from '../../core/http/api-error.js';
import { ResponseCode } from '../../core/http/response-codes.js';
import { deleteManagedFile } from '../../core/storage/storage.service.js';
import { ExpertiseModel } from '../expertise/expertise.model.js';
import { projectImageReferences } from './project.images.js';
import {
  ProjectModel,
  PROJECT_SORT,
  type ProjectDocument,
} from './project.model.js';
import { projectSchema, type ProjectInput } from './project.validation.js';
import { toObjectId } from '../../core/database/object-id.js';

/** MongoDB's duplicate-key error, from either unique index: `title.en` or `slug`. */
const DUPLICATE_KEY = 11000;

type LocalizedText = Record<string, string>;

export type GalleryImageResponse = {
  url: string;
  alt?: LocalizedText;
};

export type ProjectResponse = {
  id: string;
  /** The address it is reachable at. Never absent - the index requires it. */
  slug: string;
  title: LocalizedText;
  description: LocalizedText;
  stack: string[];
  imageUrl?: string;
  imageAlt?: LocalizedText;
  /** In display order, which is the order they are stored in. */
  gallery: GalleryImageResponse[];
  /** Why it was hard, rather than what it is. Absent until the owner writes it. */
  role?: LocalizedText;
  problem?: LocalizedText;
  approach?: LocalizedText;
  outcome?: LocalizedText;
  repoUrl?: string;
  liveUrl?: string;
  featured: boolean;
  order: number;
  updatedAt: string;
};

/** Mongoose stores localized text as a Map; the wire carries a plain object. */
function localesOf(
  value: Map<string, string> | undefined,
): LocalizedText | undefined {
  return value ? Object.fromEntries(value) : undefined;
}

export function toProjectResponse(project: ProjectDocument): ProjectResponse {
  return {
    id: project._id.toString(),
    slug: project.slug,
    title: Object.fromEntries(project.title),
    description: Object.fromEntries(project.description),
    stack: project.stack.map((reference) => reference.toString()),
    imageUrl: project.imageUrl ?? undefined,
    imageAlt: localesOf(project.imageAlt ?? undefined),
    // Always an array, never absent: a client that has to distinguish "no
    // gallery" from "no gallery field" is a client with a bug waiting in it.
    gallery: (project.gallery ?? []).map((image) => ({
      url: image.url,
      alt: localesOf(image.alt ?? undefined),
    })),
    role: localesOf(project.role ?? undefined),
    problem: localesOf(project.problem ?? undefined),
    approach: localesOf(project.approach ?? undefined),
    outcome: localesOf(project.outcome ?? undefined),
    repoUrl: project.repoUrl ?? undefined,
    liveUrl: project.liveUrl ?? undefined,
    featured: project.featured,
    order: project.order,
    updatedAt: project.updatedAt.toISOString(),
  };
}

/**
 * The unique index is the real guard against a duplicate title; checking first
 * would leave a race between the check and the write.
 *
 * Reported at `title.en` rather than `title`, because that is the path the
 * index covers and the one a client renders an input for.
 */
function asConflict(error: unknown): never {
  if ((error as { code?: number }).code === DUPLICATE_KEY) {
    // Which index actually collided. Reporting the title for a duplicate slug
    // would put the message on a field the owner did not touch, and leave the
    // one they did looking correct - the whole defect corrected across the
    // admin two days ago, reintroduced by a second index.
    const onSlug = String(
      (error as { message?: string }).message ?? '',
    ).includes('slug');

    throw new ApiError(ResponseCode.CONFLICT, {
      [onSlug ? 'slug' : localizedPath('title')]: onSlug
        ? 'SLUG_TAKEN'
        : 'ALREADY_EXISTS',
    });
  }

  throw error;
}

/**
 * Deletes every file the project stopped pointing at, as a set difference:
 * gallery images can move, leave or become the cover. External URLs are never
 * managed files.
 */
async function discardUnreferenced(
  before: string[],
  after: string[],
): Promise<void> {
  const kept = new Set(after);

  for (const reference of before) {
    if (!kept.has(reference)) {
      await deleteManagedFile(reference);
    }
  }
}

/**
 * Every stack reference must exist and be a technology or a tool - enforced
 * here for any client, not only the admin's picker.
 */
async function assertStackExists(ids: string[]): Promise<void> {
  if (ids.length === 0) {
    return;
  }

  const unique = [...new Set(ids)];
  const found = await ExpertiseModel.countDocuments({
    _id: { $in: unique },
    kind: { $in: ['technology', 'tool'] },
  });

  if (found !== unique.length) {
    throw new ApiError(ResponseCode.VALIDATION_ERROR, {
      stack: 'NOT_FOUND',
    });
  }
}

/** Every project, in display order. No pagination: a portfolio has tens. */
export async function listProjects(): Promise<ProjectDocument[]> {
  return ProjectModel.find().sort(PROJECT_SORT);
}

export async function createProject(
  input: ProjectInput,
): Promise<ProjectDocument> {
  await assertStackExists(input.stack);

  try {
    return await ProjectModel.create(input);
  } catch (error) {
    return asConflict(error);
  }
}

/**
 * Sets every field the schema defines and clears what was omitted, which is a
 * replacement in effect.
 */
export async function updateProject(
  id: string,
  input: ProjectInput,
): Promise<ProjectDocument> {
  await assertStackExists(input.stack);

  const target = { _id: toObjectId(id) };

  let previous: ProjectDocument | null;

  try {
    // Answering with the document *before* the write puts the cleanup decision
    // inside the same operation. Reading it separately first, as this used to,
    // leaves a window in which another write lands and the wrong file is
    // deleted - a race the gallery makes considerably easier to lose.
    previous = await ProjectModel.findOneAndUpdate(
      target,
      replacementUpdate(projectSchema, input),
      { returnDocument: 'before', runValidators: true },
    );
  } catch (error) {
    return asConflict(error);
  }

  if (!previous) {
    throw new ApiError(ResponseCode.NOT_FOUND);
  }

  const project = await ProjectModel.findById(previous._id);

  if (!project) {
    throw new ApiError(ResponseCode.NOT_FOUND);
  }

  await discardUnreferenced(
    projectImageReferences(previous),
    projectImageReferences(project),
  );

  return project;
}

export async function removeProject(id: string): Promise<void> {
  const deleted = await ProjectModel.findOneAndDelete({ _id: toObjectId(id) });

  if (!deleted) {
    throw new ApiError(ResponseCode.NOT_FOUND);
  }

  // The document is gone, so nothing can point at any of its images.
  await discardUnreferenced(projectImageReferences(deleted), []);
}

/** How many projects still reference a row - the delete guard's question. */
export async function countProjectsUsingExpertise(
  id: Types.ObjectId,
): Promise<number> {
  return ProjectModel.countDocuments({ stack: id });
}

/**
 * Writes a whole ordering. The shared helper owns the rules; this only names
 * the model they apply to.
 */
export async function reorderProjects(ids: string[]): Promise<void> {
  await applyOrder(ProjectModel, ids);
}
