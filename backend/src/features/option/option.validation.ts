import { z } from 'zod';

import {
  localizedText,
  notAllowed,
  optionCode,
  optionIcon,
  optionList,
  optionOrder,
  MAX_OPTION_NAME_LENGTH,
  OPTION_LIST_SHAPES,
  type OptionListKey,
  type OptionListShape,
} from '@portfolio/shared';

/** Which list a write is about, when it arrives in the body rather than a path. */
export const optionTarget = z.object({ list: optionList });

/**
 * What a list allows, rather than what an option might have.
 *
 * `group` and `icon` are refused outright on the lists that have neither.
 * Silently dropping them would let a client believe it had set a heading on an
 * education level; `NOT_ALLOWED` says which field does not belong here, the
 * same answer a logo on a skill already gets.
 */
export function optionSchema(list: OptionListKey) {
  // Widened from the literal, whose members do not all carry both keys.
  const shape: OptionListShape = OPTION_LIST_SHAPES[list];

  return z.object({
    code: optionCode,
    name: localizedText(MAX_OPTION_NAME_LENGTH),
    group: shape.groupedBy ? optionCode.optional() : notAllowed,
    icon: shape.icons ? optionIcon.optional() : notAllowed,
    /** Absent means "leave it at the back"; the ordering has its own endpoint. */
    order: optionOrder.optional(),
  });
}

/**
 * An edit, which is everything but the code.
 *
 * Omitted rather than merely ignored: a client sending a different code is
 * asking for something this design cannot do, and answering `NOT_ALLOWED`
 * says so where a silent drop would look like it had worked.
 */
export function optionEditSchema(list: OptionListKey) {
  return optionSchema(list).omit({ code: true }).extend({ code: notAllowed });
}

export type OptionInput = z.infer<ReturnType<typeof optionSchema>>;
export type OptionEditInput = z.infer<ReturnType<typeof optionEditSchema>>;
