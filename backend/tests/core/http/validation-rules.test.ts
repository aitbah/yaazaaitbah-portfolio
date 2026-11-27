import { describe, expect, it } from 'vitest';

import { UPLOAD_IMAGE_EXTENSIONS, UPLOAD_PATH_PREFIX } from '@portfolio/shared';
import {
  IMAGE_EXTENSIONS,
  UPLOADS_URL_PREFIX,
} from '../../../src/core/storage/storage.types.js';

/**
 * The rules file is copied verbatim into the frontend, so it cannot import from
 * the storage layer. These assertions are what keep the two in step instead.
 */
describe('the shared rules agree with the storage layer', () => {
  it('uses the same public prefix', () => {
    expect(UPLOAD_PATH_PREFIX).toBe(UPLOADS_URL_PREFIX);
  });

  it('accepts exactly the extensions storage can produce', () => {
    expect([...UPLOAD_IMAGE_EXTENSIONS]).toEqual([...IMAGE_EXTENSIONS]);
  });
});
