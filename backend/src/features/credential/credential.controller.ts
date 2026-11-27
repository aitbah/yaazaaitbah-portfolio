import type { RequestHandler } from 'express';

import {
  RESOURCE_BY_CREDENTIAL_KIND,
  type CredentialKind,
} from '@portfolio/shared';

import { sendSuccess } from '../../core/http/respond.js';
import { logger } from '../../core/logging/logger.js';
import {
  createCredential,
  listCredentials,
  removeCredential,
  toCredentialResponse,
  updateCredential,
} from './credential.service.js';
import { credentialSchema } from './credential.validation.js';
import { idOf } from '../../core/http/route-params.js';

/**
 * One set of handlers per kind, closed over it - the same arrangement the three
 * expertise resources use.
 *
 * The kind is fixed by the route rather than read from the body: `/api/courses`
 * can only ever create a course, so there is no request that names one kind and
 * lands in the other list.
 */
export function credentialHandlers(kind: CredentialKind) {
  // The plural the resource is mounted under, for the response envelope: a
  // caller reading `/api/courses` gets `{ courses: [...] }`, never `{ items }`.
  const collection = RESOURCE_BY_CREDENTIAL_KIND[kind];

  const get: RequestHandler = async (_req, res) => {
    const rows = await listCredentials(kind);

    sendSuccess(res, { [collection]: rows.map(toCredentialResponse) });
  };

  const post: RequestHandler = async (req, res) => {
    const input = credentialSchema.parse(req.body);
    const row = await createCredential(kind, input);

    logger.info(
      { userId: req.user?.id, kind, id: row.id },
      'Credential created',
    );

    sendSuccess(res, { credential: toCredentialResponse(row) });
  };

  const put: RequestHandler = async (req, res) => {
    const input = credentialSchema.parse(req.body);
    const row = await updateCredential(kind, idOf(req), input);

    logger.info(
      { userId: req.user?.id, kind, id: row.id },
      'Credential updated',
    );

    sendSuccess(res, { credential: toCredentialResponse(row) });
  };

  const remove: RequestHandler = async (req, res) => {
    await removeCredential(kind, idOf(req));

    logger.info(
      { userId: req.user?.id, kind, id: idOf(req) },
      'Credential deleted',
    );

    sendSuccess(res);
  };

  return { get, post, put, remove };
}
