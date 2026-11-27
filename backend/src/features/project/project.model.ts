import {
  Schema,
  model,
  type HydratedDocument,
  type InferSchemaType,
} from 'mongoose';

import {
  localizedPath,
  localizedText,
} from '../../core/database/localized-text.js';

const projectSchema = new Schema(
  {
    /**
     * The address this project is reachable at, and the readable half of its
     * URL. Not localized: one project is one page, and a URL that changed with
     * the reader's language would be two addresses for one thing.
     */
    slug: { type: String, required: true, trim: true },
    title: { ...localizedText, required: true },
    description: { ...localizedText, required: true },
    /**
     * What the project was built with: references to technologies and tools,
     * never skills, so a rename reaches every project. The service refuses the
     * wrong kind.
     */
    stack: [{ type: Schema.Types.ObjectId, ref: 'Expertise' }],
    // Images live in storage; only the reference is persisted.
    imageUrl: { type: String, trim: true },
    imageAlt: localizedText,
    /**
     * Screenshots and detail shots, beyond the single cover.
     *
     * Position in the array *is* the display order - there is no `order` field.
     * `PUT` sends the whole gallery, so reordering is sending the same entries
     * in a different sequence, and an ordering can never disagree with itself
     * the way a list of positions can.
     */
    gallery: {
      type: [
        {
          url: { type: String, required: true, trim: true },
          alt: localizedText,
          _id: false,
        },
      ],
      default: [],
    },
    /**
     * Why the project was hard, rather than what it is.
     *
     * All four optional, and that is the point: a project with only a
     * description still renders, and forcing a paragraph out of a weekend
     * build produces filler.
     */
    role: localizedText,
    problem: localizedText,
    approach: localizedText,
    outcome: localizedText,
    repoUrl: { type: String, trim: true },
    liveUrl: { type: String, trim: true },
    featured: { type: Boolean, default: false },
    // Display position, lowest first. Nothing sets it but the API yet.
    order: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

/**
 * Two projects called the same thing are a mistake, not a choice. Keyed on the
 * launch locale, as the other collections are: it is the one every project must
 * have, and translations of one project are not a second project.
 */
projectSchema.index({ [localizedPath('title')]: 1 }, { unique: true });

/**
 * Two projects cannot share an address, and the index is the guard rather than
 * a check in the service - a check leaves a race between reading and writing.
 * It is also the lookup the public page will do, by the only field a URL
 * carries.
 */
projectSchema.index({ slug: 1 }, { unique: true });

/** The delete guard queries this; without it that is a collection scan. */
projectSchema.index({ stack: 1 });

/** Featured first, then position, then alphabetically - what the API returns. */
export const PROJECT_SORT = {
  featured: -1,
  order: 1,
  [localizedPath('title')]: 1,
} as const;

type Project = InferSchemaType<typeof projectSchema>;
export type ProjectDocument = HydratedDocument<Project>;

export const ProjectModel = model('Project', projectSchema);
