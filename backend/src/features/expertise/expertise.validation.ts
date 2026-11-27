import { z } from 'zod';

import {
  expertiseCategory,
  expertiseIcon,
  expertiseLevel,
  expertiseOrder,
  localizedText,
  notAllowed,
  KIND_HAS_ICON,
  MAX_EXPERTISE_NAME_LENGTH,
  type ExpertiseKind,
} from '@portfolio/shared';

/**
 * The whole row, one schema per kind - categories and logos differ by kind, so
 * the rule is enforced rather than conventional. `PUT` replaces; omitted
 * optional fields are cleared.
 */
export function expertiseSchema(kind: ExpertiseKind) {
  return z.object({
    name: localizedText(MAX_EXPERTISE_NAME_LENGTH),
    category: expertiseCategory,
    level: expertiseLevel,
    // Present for a technology and a tool, refused for a skill: there is no
    // brand mark for "Problem Solving", and silently dropping one that was sent
    // would leave a client bug undiagnosed.
    icon: KIND_HAS_ICON[kind] ? expertiseIcon.optional() : notAllowed,
    // Absent means "leave it at the back"; the order is sent as a whole list
    // through its own endpoint.
    order: expertiseOrder.default(0),
  });
}

export type ExpertiseInput = z.infer<ReturnType<typeof expertiseSchema>>;
