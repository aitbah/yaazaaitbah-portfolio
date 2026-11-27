/**
 * How many items each list shows per step, chosen so a step ends on a full
 * row. Display only: the API returns whole lists.
 */
export const LIST_STEPS = {
  site: {
    /** A one- or two-column grid: three full rows of either. */
    projects: 6,
    /** One kind at a time, one row each: a screenful before asking for more. */
    expertise: 10,
    /** Dated records, one per row and each several lines tall. */
    experience: 4,
    education: 4,
    credentials: 4,
    languages: 6,
    socialLinks: 8,
    /** Screens on a project's page, two columns wide. */
    gallery: 6,
  },
  admin: {
    /** Cards one to four columns wide: twelve fills a row at every width. */
    projects: 12,
    /** Small cards, one to four columns: twenty-four fills a row at every width. */
    expertise: 24,
    /** Tall cards, one or two columns. */
    experience: 10,
    education: 10,
    credentials: 10,
    /** Short rows, one to three columns. */
    languages: 12,
    /** One table row each. */
    socialLinks: 20,
    /** Short rows, one to three columns: twenty-four fills a row at every width. */
    options: 24,
  },
} as const;
