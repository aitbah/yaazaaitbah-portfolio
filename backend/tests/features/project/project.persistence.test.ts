import mongoose from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { connectOrSkip } from '../../support/mongo.js';
import { seedOptionLists } from '../../support/options.js';
import type { ProjectInput } from '../../../src/features/project/project.validation.js';

const { ProjectModel } =
  await import('../../../src/features/project/project.model.js');
const { ExpertiseModel } =
  await import('../../../src/features/expertise/expertise.model.js');
const {
  createProject,
  listProjects,
  removeProject,
  updateProject,
  countProjectsUsingExpertise,
} = await import('../../../src/features/project/project.service.js');
const { createExpertise, removeExpertise } =
  await import('../../../src/features/expertise/expertise.service.js');

/** A project's stack is technologies and tools, so these are technologies. */
const createTechnology = (input: Parameters<typeof createExpertise>[1]) =>
  createExpertise('technology', input);
const removeTechnology = (id: string) => removeExpertise('technology', id);

/**
 * These run against a real MongoDB. The mocked suite can only prove the service
 * calls Mongoose as intended; that the unique index refuses a duplicate, that
 * the delete guard actually finds referencing projects, and that timestamps
 * survive an update are only real here.
 */
const URI =
  process.env.PROJECT_MONGO_URI ??
  'mongodb://127.0.0.1:27017/portfolio_project_test';

const connected = await connectOrSkip('project', URI);

const TECHNOLOGY = {
  name: { en: 'TypeScript' },
  category: 'frontend' as const,
  level: 80,
  order: 0,
};

/**
 * Typed as the service's own input rather than inferred, so a field added to
 * the schema fails here instead of being silently absent from every fixture.
 * The service takes *validated* input, in which defaults have already been
 * applied - an empty gallery is a real empty array, not a missing field.
 */
const VALID: ProjectInput = {
  slug: 'portfolio',
  title: { en: 'Portfolio' },
  description: { en: 'This site.' },
  stack: [],
  gallery: [],
  featured: false,
  order: 0,
};

describe.skipIf(!connected)('project persistence', () => {
  beforeAll(async () => {
    await ProjectModel.syncIndexes();
    await ExpertiseModel.syncIndexes();
    // Six services refuse a code no option list offers, so the lists the
    // content under test references have to exist.
    await seedOptionLists(
      'skill-category',
      'technology-category',
      'tool-category',
    );
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  beforeEach(async () => {
    await ProjectModel.deleteMany({});
    await ExpertiseModel.deleteMany({});
  });

  describe('the unique title', () => {
    /**
     * Both unique indexes, named. `find(index => index.unique)` returned
     * whichever came first, which was a passing assertion about an
     * unspecified index the moment a second one existed.
     */
    it('declares a unique index on the launch locale and on the address', async () => {
      const indexes = await ProjectModel.collection.indexes();
      const unique = indexes
        .filter((index) => index.unique)
        .map((index) => index.key);

      expect(unique).toContainEqual({ 'title.en': 1 });
      expect(unique).toContainEqual({ slug: 1 });
    });

    it('refuses a second project with the same English title', async () => {
      await createProject(VALID);

      await expect(createProject(VALID)).rejects.toMatchObject({
        code: 'CONFLICT',
        details: { 'title.en': 'ALREADY_EXISTS' },
      });
      expect(await ProjectModel.countDocuments()).toBe(1);
    });
  });

  describe('the unique address', () => {
    /**
     * Reported on `slug`, not on the title. Two projects can legitimately be
     * called different things and still be given the same address, and putting
     * the message on the title would leave the field the owner actually has to
     * fix looking correct.
     */
    it('refuses a second project at the same address', async () => {
      await createProject(VALID);

      await expect(
        createProject({ ...VALID, title: { en: 'Something else' } }),
      ).rejects.toMatchObject({
        code: 'CONFLICT',
        details: { slug: 'SLUG_TAKEN' },
      });
      expect(await ProjectModel.countDocuments()).toBe(1);
    });

    it('still reports a duplicate title on the title', async () => {
      await createProject(VALID);

      await expect(
        createProject({ ...VALID, slug: 'a-different-address' }),
      ).rejects.toMatchObject({
        code: 'CONFLICT',
        details: { 'title.en': 'ALREADY_EXISTS' },
      });
    });
  });

  describe('stack references', () => {
    it('stores them and reads them back as identifiers', async () => {
      const row = await createTechnology(TECHNOLOGY);
      const project = await createProject({ ...VALID, stack: [row.id] });

      expect(project.stack.map(String)).toEqual([row.id]);
    });

    /**
     * Without this a project could point at a deleted or invented row, and
     * the public page would render a gap nobody could diagnose.
     */
    /**
     * A project's stack is what it was built with. A skill in it would be a
     * category error the public page could not render, and the check is here
     * rather than in the form so it holds for any client.
     */
    it('refuses a reference to a skill, however real it is', async () => {
      const skill = await createExpertise('skill', {
        name: { en: 'Problem Solving' },
        category: 'engineering',
        level: 90,
        order: 0,
      });

      await expect(
        createProject({ ...VALID, stack: [skill.id] }),
      ).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
        details: { stack: 'NOT_FOUND' },
      });
    });

    it('accepts a tool as readily as a technology', async () => {
      const tool = await createExpertise('tool', {
        name: { en: 'Docker' },
        category: 'devops',
        level: 80,
        order: 0,
      });

      const project = await createProject({ ...VALID, stack: [tool.id] });

      expect(project.stack.map(String)).toEqual([tool.id]);
    });

    it('refuses a reference to a row that does not exist', async () => {
      const absent = new mongoose.Types.ObjectId().toString();

      await expect(
        createProject({ ...VALID, stack: [absent] }),
      ).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
        details: { stack: 'NOT_FOUND' },
      });
    });

    it('refuses one absent reference among several real ones', async () => {
      const row = await createTechnology(TECHNOLOGY);
      const absent = new mongoose.Types.ObjectId().toString();

      await expect(
        createProject({ ...VALID, stack: [row.id, absent] }),
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    });

    it('checks the same on update', async () => {
      const project = await createProject(VALID);
      const absent = new mongoose.Types.ObjectId().toString();

      await expect(
        updateProject(project.id, { ...VALID, stack: [absent] }),
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    });

    it('counts the projects using a row', async () => {
      const row = await createTechnology(TECHNOLOGY);
      await createProject({ ...VALID, stack: [row.id] });
      await createProject({
        ...VALID,
        slug: 'another',
        title: { en: 'Another' },
        stack: [row.id],
      });

      expect(await countProjectsUsingExpertise(row._id)).toBe(2);
    });
  });

  describe('deleting a row a project uses', () => {
    /**
     * Cascading the removal would change what those projects display without
     * anyone seeing it happen - the admin never opened them.
     */
    it('is refused, and the row survives', async () => {
      const row = await createTechnology(TECHNOLOGY);
      await createProject({ ...VALID, stack: [row.id] });

      await expect(removeTechnology(row.id)).rejects.toMatchObject({
        code: 'CONFLICT',
        details: { technology: 'IN_USE', projects: 1 },
      });
      expect(await ExpertiseModel.countDocuments()).toBe(1);
    });

    it('is allowed once nothing references it any more', async () => {
      const row = await createTechnology(TECHNOLOGY);
      const project = await createProject({ ...VALID, stack: [row.id] });

      await removeProject(project.id);
      await removeTechnology(row.id);

      expect(await ExpertiseModel.countDocuments()).toBe(0);
    });

    it('is allowed for a row no project ever used', async () => {
      const row = await createTechnology(TECHNOLOGY);
      await createProject(VALID);

      await removeTechnology(row.id);

      expect(await ExpertiseModel.countDocuments()).toBe(0);
    });
  });

  describe('updating', () => {
    it('keeps the original creation date', async () => {
      const project = await createProject(VALID);
      const madeAMonthAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000);

      await ProjectModel.collection.updateOne(
        { _id: project._id },
        { $set: { createdAt: madeAMonthAgo } },
      );

      const updated = await updateProject(project.id, {
        ...VALID,
        featured: true,
      });

      expect(updated.createdAt.getTime()).toBe(madeAMonthAgo.getTime());
      expect(updated.featured).toBe(true);
    });

    // PUT replaces: what the client left out is cleared, not left as it was.
    it('clears an optional field that is omitted', async () => {
      const project = await createProject({
        ...VALID,
        repoUrl: 'https://github.com/me/repo',
        liveUrl: 'https://example.com',
      });

      const updated = await updateProject(project.id, VALID);

      expect(updated.repoUrl ?? null).toBeNull();
      expect(updated.liveUrl ?? null).toBeNull();
    });
  });

  describe('display order', () => {
    it('puts the featured first, then by position, then alphabetically', async () => {
      await createProject({
        ...VALID,
        slug: 'zebra',
        title: { en: 'Zebra' },
        order: 0,
      });
      await createProject({
        ...VALID,
        slug: 'alpha',
        title: { en: 'Alpha' },
        order: 0,
      });
      await createProject({
        ...VALID,
        slug: 'later',
        title: { en: 'Later' },
        order: 5,
      });
      await createProject({
        ...VALID,
        slug: 'pinned',
        title: { en: 'Pinned' },
        featured: true,
        order: 9,
      });

      const titles = (await listProjects()).map((p) => p.title.get('en'));

      expect(titles).toEqual(['Pinned', 'Alpha', 'Zebra', 'Later']);
    });
  });
});
