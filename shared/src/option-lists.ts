import { z } from 'zod';

import { SKILL_ICON_SLUGS } from './skill-icon-slugs.js';

/**
 * The dropdown lists the owner manages as content. A key is part of the API
 * surface (`/api/options?list=...`, admin URLs): kebab-case and singular,
 * naming one option.
 */
export const OPTION_LISTS = [
  'availability-status',
  'skill-category',
  'technology-category',
  'tool-category',
  'employment-type',
  'education-level',
  'language-level',
  'social-platform',
  'social-platform-group',
] as const;

export type OptionListKey = (typeof OPTION_LISTS)[number];

export type OptionListShape = {
  /**
   * The list this one's options are grouped under, for a list too long to
   * scan flat. The group codes are themselves options, so the headings are
   * managed and translated the same way everything else is.
   */
  groupedBy?: OptionListKey;
  /** Whether an option here may name a vendored brand mark. */
  icons?: true;
};

/**
 * What each list carries beyond a code and a name.
 *
 * Only the platform list carries anything: thirty-two flat options is a list
 * you read top to bottom rather than scan, and a platform without its mark is
 * a row of identical grey text. The other eight are a code and a label, which
 * is what a dropdown option normally is.
 */
export const OPTION_LIST_SHAPES = {
  'availability-status': {},
  'skill-category': {},
  'technology-category': {},
  'tool-category': {},
  'employment-type': {},
  'education-level': {},
  'language-level': {},
  'social-platform': { groupedBy: 'social-platform-group', icons: true },
  'social-platform-group': {},
} as const satisfies Record<OptionListKey, OptionListShape>;

export const MAX_OPTION_CODE_LENGTH = 40;
export const MAX_OPTION_NAME_LENGTH = 60;

const OPTION_CODE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** A string first, then the enum, for the reason `expertiseCategory` explains. */
export const optionList = z.string().pipe(z.enum(OPTION_LISTS));

/**
 * The value a row stores. Rows reference an option by this code, so a code is
 * fixed at creation - renaming it would strand every row holding it - and only
 * the name is editable. Checked explicitly rather than with `.regex()`, which
 * reports `INVALID_REGEX`.
 */
export const optionCode = z
  .string()
  .trim()
  .min(1)
  .max(MAX_OPTION_CODE_LENGTH)
  .check((ctx) => {
    if (!OPTION_CODE.test(ctx.value)) {
      ctx.issues.push({
        code: 'invalid_format',
        format: 'code',
        input: ctx.value,
        message: 'Not a code',
      });
    }
  });

/**
 * An option's mark, which is a preset slug and never an upload.
 *
 * The same vendored set an expertise icon draws from, minus the upload arm: a
 * dropdown option is a label with a logo beside it, not a piece of content with
 * a file of its own. Nothing here owns a file, so nothing here has to be
 * cleaned up when a row goes.
 */
export const optionIcon = z.enum(SKILL_ICON_SLUGS);

/** Display position, lowest first - as on an expertise row. */
export const optionOrder = z.number().int().min(0);
