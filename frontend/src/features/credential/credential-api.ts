import {
  RESOURCE_BY_CREDENTIAL_KIND,
  type CredentialKind,
} from '@portfolio/shared';

import { collectionApi } from '@/lib/collection-api';

import type { CredentialInput, LocalizedValues } from './credential-schema';

/** A credential as the API returns it - see docs/api-endpoints/credentials-api.md. */
export type Credential = {
  id: string;
  kind: CredentialKind;
  name: LocalizedValues;
  issuer: LocalizedValues;
  /** `YYYY-MM`. */
  issuedAt: string;
  /** Absent means it does not expire - never that it is still under way. */
  expiresAt?: string;
  credentialId?: string;
  credentialUrl?: string;
  description?: LocalizedValues;
  updatedAt: string;
};

/** Two resources from one shape, so the path and the envelope come from the kind. */
function credentials(kind: CredentialKind) {
  return collectionApi<Credential, CredentialInput>(
    `/api/${RESOURCE_BY_CREDENTIAL_KIND[kind]}`,
    { list: RESOURCE_BY_CREDENTIAL_KIND[kind], one: 'credential' },
  );
}

export function fetchCredentials(kind: CredentialKind): Promise<Credential[]> {
  return credentials(kind).list();
}

export function createCredential(
  kind: CredentialKind,
  input: CredentialInput,
): Promise<Credential> {
  return credentials(kind).create(input);
}

export function updateCredential(
  kind: CredentialKind,
  id: string,
  input: CredentialInput,
): Promise<Credential> {
  return credentials(kind).update(id, input);
}

export function deleteCredential(
  kind: CredentialKind,
  id: string,
): Promise<void> {
  return credentials(kind).remove(id);
}
