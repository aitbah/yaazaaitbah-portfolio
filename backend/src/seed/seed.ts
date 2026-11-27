import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  DEFAULT_LOCALE,
  SKILL_ICON_SLUGS,
  type ExpertiseKind,
} from '@portfolio/shared';

import { env } from '../config/env.js';
import {
  connectDatabase,
  disconnectDatabase,
} from '../core/database/connection.js';
import { logger } from '../core/logging/logger.js';
import type { StorageCategory } from '../core/storage/storage.types.js';
import { UPLOADS_URL_PREFIX } from '../core/storage/storage.types.js';
import { MessageModel } from '../features/message/message.model.js';
import { OptionModel } from '../features/option/option.model.js';
import { seedOptions } from '../features/option/option.seed.js';
import {
  ProfileModel,
  SINGLETON_KEY,
} from '../features/profile/profile.model.js';
import { ProjectModel } from '../features/project/project.model.js';
import { CredentialModel } from '../features/credential/credential.model.js';
import { LanguageModel } from '../features/language/language.model.js';
import { EducationModel } from '../features/education/education.model.js';
import { ExperienceModel } from '../features/experience/experience.model.js';
import { ExpertiseModel } from '../features/expertise/expertise.model.js';
import { SocialLinkModel } from '../features/social-link/social-link.model.js';
import { readOwnerPhoto } from './owner-photo.js';
import { placeholderPng } from './placeholder-image.js';
import { placeholderPdf } from './placeholder-pdf.js';
import {
  type SeedText,
  SEED_MESSAGES,
  SEED_PROFILE,
  SEED_PROJECTS,
  SEED_CREDENTIALS,
  SEED_EDUCATION,
  SEED_LANGUAGES,
  SEED_EXPERIENCE,
  SEED_SKILLS,
  SEED_TECHNOLOGIES,
  SEED_TOOLS,
  SEED_SOCIAL_LINKS,
} from './seed-data.js';

/**
 * Fills an empty database with realistic content.
 *
 *   docker compose exec backend npm run db:seed
 *   docker compose exec backend npm run db:seed -- --reset
 *
 * Idempotent: every document is upserted on its unique key. `--reset` deletes
 * the seeded content first; it never touches admin users.
 */

/**
 * Seed text as the database stores it.
 *
 * A bare string is the default locale alone - which is most of this content,
 * and deliberately so: a fresh install where everything is translated never
 * shows the fallback working, and the fallback is the half that makes adding a
 * language cheap.
 */
function text(value: SeedText): Record<string, string> {
  return typeof value === 'string' ? { [DEFAULT_LOCALE]: value } : value;
}

/** The default-locale form, for the keys the upserts match on. */
function key(value: SeedText): string {
  return typeof value === 'string' ? value : value[DEFAULT_LOCALE];
}

const RESET = process.argv.includes('--reset');

/** A filename the storage layer will accept back: no dots, no slashes. */
function slugOf(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Writes a generated image and returns the reference to store.
 *
 * Deliberately not `saveImage`: that appends a UUID, so re-seeding would leave
 * the previous run's files behind as orphans. A name derived from the subject
 * means the second run overwrites the first.
 */
async function writePlaceholder(
  category: StorageCategory,
  name: string,
  width: number,
  height: number,
  index: number,
): Promise<string> {
  const filename = `seed-${name}.png`;
  const directory = path.join(path.resolve(env.UPLOADS_DIR), category);

  await mkdir(directory, { recursive: true });
  await writeFile(
    path.join(directory, filename),
    placeholderPng({ width, height, seed: name, index }),
  );

  return `${UPLOADS_URL_PREFIX}/${category}/${filename}`;
}

/**
 * Every preset slug the seed data names must exist, or the run stops.
 *
 * Checked up front rather than per row: a partial seed that failed halfway is
 * harder to reason about than one that refused to start. Skills are not
 * checked because skills have no logo - that is the shape, not an omission.
 */
function assertIconsExist(): void {
  const known = new Set<string>(SKILL_ICON_SLUGS);
  const missing = [...SEED_TECHNOLOGIES, ...SEED_TOOLS].filter(
    (row) => row.icon !== undefined && !known.has(row.icon),
  );

  if (missing.length > 0) {
    throw new Error(
      `Seed data names logos that are not in the vendored set: ${missing
        .map((row) => `${row.name} (${row.icon})`)
        .join(', ')}`,
    );
  }
}

/**
 * Writes a generated document and returns the reference to store.
 *
 * The same naming rule as the images: derived from the subject rather than
 * given a UUID, so a second run overwrites the first instead of leaving the
 * previous one behind as an orphan nothing points at.
 */
async function writePlaceholderPdf(
  name: string,
  lines: readonly string[],
): Promise<string> {
  const filename = `seed-${name}.pdf`;
  const directory = path.join(path.resolve(env.UPLOADS_DIR), 'resume');

  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, filename), placeholderPdf(lines));

  return `${UPLOADS_URL_PREFIX}/resume/${filename}`;
}

/**
 * The owner's own photograph when `private/` holds one, and a drawn placeholder
 * when it does not - a clean checkout, CI, anyone else running the project.
 *
 * Written under the placeholder's name, so a second run replaces the first
 * rather than leaving the previous avatar behind as an orphan.
 */
async function writeProfilePhoto(): Promise<string> {
  const photo = await readOwnerPhoto();

  if (!photo) {
    logger.info('No photograph in private/, so the avatar is a placeholder');

    return writePlaceholder('profile', 'avatar', 512, 512, 0);
  }

  const filename = `seed-avatar.${photo.extension}`;
  const directory = path.join(path.resolve(env.UPLOADS_DIR), 'profile');

  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, filename), photo.bytes);
  logger.info("The avatar is the owner's photograph from private/");

  return `${UPLOADS_URL_PREFIX}/profile/${filename}`;
}

async function seedProfile(): Promise<void> {
  const photoUrl = await writeProfilePhoto();

  // One CV per locale the seed data names - the field is a map, and leaving it
  // empty was the last unticked row on the dashboard's readiness list.
  const resume: Record<string, string> = {};

  for (const [locale, lines] of Object.entries(SEED_PROFILE.resume)) {
    resume[locale] = await writePlaceholderPdf(`resume-${locale}`, lines);
  }

  await ProfileModel.updateOne(
    { key: SINGLETON_KEY },
    {
      $set: {
        firstName: text(SEED_PROFILE.firstName),
        lastName: text(SEED_PROFILE.lastName),
        headline: text(SEED_PROFILE.headline),
        bio: text(SEED_PROFILE.bio),
        photoUrl,
        photoAlt: text(SEED_PROFILE.photoAlt),
        resume,
        contact: {
          ...SEED_PROFILE.contact,
          location: text(SEED_PROFILE.contact.location),
        },
      },
    },
    { upsert: true },
  );
}

/**
 * One kind at a time, returning name to id for the projects that reference
 * technologies and tools by name.
 *
 * Upserted on `{ kind, name.en }`, the pair the unique index covers, so a
 * second run updates the same document rather than colliding with it - and so
 * a tool called `Testing` never overwrites a skill of the same name.
 */
async function seedExpertise(
  kind: ExpertiseKind,
  rows: readonly {
    name: SeedText;
    category: string;
    level: number;
    icon?: string;
  }[],
): Promise<Map<string, string>> {
  const ids = new Map<string, string>();

  for (const [index, skill] of rows.entries()) {
    const result = await ExpertiseModel.findOneAndUpdate(
      { kind, [`name.${DEFAULT_LOCALE}`]: key(skill.name) },
      {
        $set: {
          kind,
          name: text(skill.name),
          category: skill.category,
          level: skill.level,
          order: index,
          ...(skill.icon
            ? { icon: { kind: 'preset', value: skill.icon } }
            : {}),
        },
        // A skill has no logo, and a row that changed kind must not keep one.
        ...(skill.icon ? {} : { $unset: { icon: '' } }),
      },
      { upsert: true, returnDocument: 'after' },
    );

    if (result) {
      ids.set(key(skill.name), result._id.toString());
    }
  }

  return ids;
}

/**
 * A localized alt text, built from the localized subject it describes.
 *
 * The covers and screenshots are generated, so their descriptions are
 * generated too - and a description that stayed English on an Arabic page
 * would be the one piece of the project a screen reader got in the wrong
 * language.
 */
function imageAlt(
  title: SeedText,
  shape: { en: string; fr: string; ar: string },
): Record<string, string> {
  const named = text(title);

  return Object.fromEntries(
    Object.entries(shape)
      .filter(([locale]) => named[locale] !== undefined)
      .map(([locale, pattern]) => [
        locale,
        pattern.replace('{name}', named[locale] ?? ''),
      ]),
  );
}

async function seedProjects(stackIds: Map<string, string>): Promise<void> {
  for (const [index, project] of SEED_PROJECTS.entries()) {
    // The address is derived from the default locale, which is the one every
    // row must carry - a slug that changed with the reader's language would
    // not be an address.
    const title = key(project.title);
    const slug = slugOf(title);

    const imageUrl = await writePlaceholder(
      'project',
      `${slug}-cover`,
      1200,
      800,
      index,
    );

    const gallery = [];

    for (let shot = 0; shot < project.galleryCount; shot += 1) {
      gallery.push({
        url: await writePlaceholder(
          'project',
          `${slug}-shot-${shot + 1}`,
          1200,
          800,
          // Offset so a project's own screenshots differ from its cover and
          // from each other, rather than all landing on one hue.
          index * 10 + shot + 1,
        ),
        alt: imageAlt(project.title, {
          en: `{name}, screen ${shot + 1}`,
          fr: `{name}, écran ${shot + 1}`,
          ar: `{name}، الشاشة ${shot + 1}`,
        }),
      });
    }

    // A named row that does not exist would be a silent gap on the page.
    const stack = project.stack.map((name) => {
      const id = stackIds.get(name);

      if (!id) {
        throw new Error(
          `Project "${title}" names an unseeded technology or tool: ${name}`,
        );
      }

      return id;
    });

    await ProjectModel.findOneAndUpdate(
      { [`title.${DEFAULT_LOCALE}`]: title },
      {
        $set: {
          // Also what backfills the address on a database seeded before slugs
          // existed: the upsert matches on the title, which has not changed.
          slug,
          title: text(project.title),
          description: text(project.description),
          stack,
          imageUrl,
          imageAlt: imageAlt(project.title, {
            en: '{name} cover',
            fr: 'Couverture de {name}',
            ar: 'غلاف {name}',
          }),
          gallery,
          role: text(project.role),
          problem: text(project.problem),
          approach: text(project.approach),
          outcome: text(project.outcome),
          featured: project.featured,
          order: index,
          ...(project.repoUrl ? { repoUrl: project.repoUrl } : {}),
          ...(project.liveUrl ? { liveUrl: project.liveUrl } : {}),
        },
        /*
          Both links, in one `$unset`.

          Only `repoUrl` was cleared before, so a project that lost its live
          URL in the seed data kept the stale one in the database. The two
          clauses cannot be written as two spreads either - the second `$unset`
          key would replace the first rather than merge with it.
        */
        ...(project.repoUrl && project.liveUrl
          ? {}
          : {
              $unset: {
                ...(project.repoUrl ? {} : { repoUrl: '' }),
                ...(project.liveUrl ? {} : { liveUrl: '' }),
              },
            }),
      },
      { upsert: true },
    );
  }
}

async function seedSocialLinks(): Promise<void> {
  for (const [index, link] of SEED_SOCIAL_LINKS.entries()) {
    await SocialLinkModel.updateOne(
      { url: link.url },
      { $set: { platform: link.platform, url: link.url, order: index } },
      { upsert: true },
    );
  }
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Messages have no natural key, so they are matched on sender and subject.
 * `createdAt` is set explicitly, so the inbox has a spread of dates.
 */
async function seedMessages(): Promise<void> {
  const now = Date.now();

  for (const message of SEED_MESSAGES) {
    const sentAt = new Date(now - message.daysAgo * DAY_MS);

    await MessageModel.updateOne(
      { email: message.email, subject: message.subject },
      {
        $set: {
          name: message.name,
          email: message.email,
          subject: message.subject,
          body: message.body,
          read: message.read,
          createdAt: sentAt,
          updatedAt: sentAt,
        },
      },
      { upsert: true, timestamps: false },
    );
  }
}

/**
 * The career. Upserted on the compound key the unique index already covers, so
 * a second run updates the same document rather than colliding with it.
 */
async function seedExperience(): Promise<void> {
  for (const position of SEED_EXPERIENCE) {
    await ExperienceModel.findOneAndUpdate(
      {
        [`role.${DEFAULT_LOCALE}`]: key(position.role),
        [`organisation.${DEFAULT_LOCALE}`]: key(position.organisation),
        startDate: position.startDate,
      },
      {
        $set: {
          role: text(position.role),
          organisation: text(position.organisation),
          location: text(position.location),
          employmentType: position.employmentType,
          startDate: position.startDate,
          current: position.current,
          description: text(position.description),
          ...(position.endDate ? { endDate: position.endDate } : {}),
        },
        // A current position has no end date, and one that became current must
        // not keep the date it used to have.
        ...(position.endDate ? {} : { $unset: { endDate: '' } }),
      },
      { upsert: true },
    );
  }
}

/**
 * What was studied. Upserted on the compound key the unique index covers, for
 * the same reason the career is.
 */
async function seedEducation(): Promise<void> {
  for (const entry of SEED_EDUCATION) {
    await EducationModel.findOneAndUpdate(
      {
        [`institution.${DEFAULT_LOCALE}`]: key(entry.institution),
        [`qualification.${DEFAULT_LOCALE}`]: key(entry.qualification),
        startDate: entry.startDate,
      },
      {
        $set: {
          institution: text(entry.institution),
          qualification: text(entry.qualification),
          level: entry.level,
          location: text(entry.location),
          startDate: entry.startDate,
          current: entry.current,
          ...(entry.description
            ? { description: text(entry.description) }
            : {}),
          ...(entry.fieldOfStudy
            ? { fieldOfStudy: text(entry.fieldOfStudy) }
            : {}),
          ...(entry.endDate ? { endDate: entry.endDate } : {}),
        },
        // A course under way has no end date, and one that became current must
        // not keep the date it used to have.
        ...(entry.endDate ? {} : { $unset: { endDate: '' } }),
      },
      { upsert: true },
    );
  }
}

/**
 * Certifications and courses. Upserted on the per-kind compound key the unique
 * index covers, so a second run updates rather than colliding.
 */
async function seedCredentials(): Promise<void> {
  for (const row of SEED_CREDENTIALS) {
    await CredentialModel.findOneAndUpdate(
      {
        kind: row.kind,
        [`name.${DEFAULT_LOCALE}`]: key(row.name),
        [`issuer.${DEFAULT_LOCALE}`]: key(row.issuer),
        issuedAt: row.issuedAt,
      },
      {
        $set: {
          kind: row.kind,
          name: text(row.name),
          issuer: text(row.issuer),
          issuedAt: row.issuedAt,
          description: text(row.description),
          ...(row.expiresAt ? { expiresAt: row.expiresAt } : {}),
          ...(row.credentialId ? { credentialId: row.credentialId } : {}),
          ...(row.credentialUrl ? { credentialUrl: row.credentialUrl } : {}),
        },
        // A credential that does not expire must not keep a date it once had.
        ...(row.expiresAt ? {} : { $unset: { expiresAt: '' } }),
      },
      { upsert: true },
    );
  }
}

/**
 * The languages, in the order they are declared - which is the order the admin
 * would have chosen, since there is no date to derive one from.
 */
async function seedLanguages(): Promise<void> {
  for (const [index, language] of SEED_LANGUAGES.entries()) {
    await LanguageModel.findOneAndUpdate(
      { code: language.code },
      { $set: { level: language.level, order: index } },
      { upsert: true },
    );
  }
}

/** Everything the seeder owns. Admin users are deliberately absent. */
async function reset(): Promise<void> {
  await Promise.all([
    ProfileModel.deleteMany({}),
    ExpertiseModel.deleteMany({}),
    ExperienceModel.deleteMany({}),
    EducationModel.deleteMany({}),
    CredentialModel.deleteMany({}),
    LanguageModel.deleteMany({}),
    ProjectModel.deleteMany({}),
    SocialLinkModel.deleteMany({}),
    MessageModel.deleteMany({}),
    OptionModel.deleteMany({}),
  ]);

  logger.info('Seeded collections cleared');
}

async function run(): Promise<void> {
  // A seeder overwrites content by design. Nothing about it should ever be
  // pointed at production, so it refuses rather than trusting the caller.
  if (env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed a production database.');
  }

  assertIconsExist();

  await connectDatabase();

  try {
    if (RESET) {
      await reset();
    }

    // Before everything: every other row stores a code from one of these
    // lists. `db:options` runs the same step on its own.
    await seedOptions();
    await seedProfile();
    await seedExpertise('skill', SEED_SKILLS);
    const technologies = await seedExpertise('technology', SEED_TECHNOLOGIES);
    const tools = await seedExpertise('tool', SEED_TOOLS);
    // Projects link to both, so both name spaces are searched as one.
    await seedProjects(new Map([...technologies, ...tools]));
    await seedExperience();
    await seedEducation();
    await seedCredentials();
    await seedLanguages();
    await seedSocialLinks();
    await seedMessages();

    logger.info(
      {
        skills: SEED_SKILLS.length,
        technologies: SEED_TECHNOLOGIES.length,
        tools: SEED_TOOLS.length,
        experience: SEED_EXPERIENCE.length,
        education: SEED_EDUCATION.length,
        credentials: SEED_CREDENTIALS.length,
        languages: SEED_LANGUAGES.length,
        projects: SEED_PROJECTS.length,
        socialLinks: SEED_SOCIAL_LINKS.length,
        messages: SEED_MESSAGES.length,
      },
      'Database seeded',
    );
  } finally {
    await disconnectDatabase();
  }
}

run().catch((error: unknown) => {
  logger.fatal({ err: error }, 'Seeding failed');
  process.exit(1);
});
