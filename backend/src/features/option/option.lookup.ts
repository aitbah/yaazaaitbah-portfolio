import type { OptionListKey } from '@portfolio/shared';

import { ApiError } from '../../core/http/api-error.js';
import { ResponseCode } from '../../core/http/response-codes.js';
import { OptionModel } from './option.model.js';

/**
 * Whether a code is one a list offers. The contract settles a code's shape;
 * membership depends on rows the owner may have added since, so it is checked
 * here. Uses the option model, not its service, to avoid an import cycle.
 */
export async function assertOptionExists(
  list: OptionListKey,
  code: string,
  field: string,
): Promise<void> {
  const exists = await OptionModel.exists({ list, code });

  if (!exists) {
    // The same code a `z.enum` used to answer with: the value is well-formed
    // and is not one of the choices. What changed is where the choices live.
    throw new ApiError(ResponseCode.VALIDATION_ERROR, {
      [field]: 'INVALID_VALUE',
    });
  }
}

/**
 * The same check for a field that may legitimately be absent - the profile's
 * availability, which is a badge the owner need not display at all.
 */
export async function assertOptionalOptionExists(
  list: OptionListKey,
  code: string | undefined,
  field: string,
): Promise<void> {
  if (code === undefined) {
    return;
  }

  await assertOptionExists(list, code, field);
}
