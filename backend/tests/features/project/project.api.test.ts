import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { createApp } from '../../../src/app.js';
import { loginRateLimit } from '../../../src/features/auth/auth.routes.js';
import { ProjectModel } from '../../../src/features/project/project.model.js';
import { ExpertiseModel } from '../../../src/features/expertise/expertise.model.js';
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  buildAdmin,
  stubUserLookup,
  type FakeAdmin,
} from '../auth/admin.fixture.js';

vi.mock('../../../src/features/auth/user.model.js', () => ({
  UserModel: {
    findOne: vi.fn(),
    findById: vi.fn(),
    findByIdAndUpdate: vi.fn(),
  },
}));
vi.mock('../../../src/features/project/project.model.js', () => ({
  ProjectModel: {
    find: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn(),
    findOneAndUpdate: vi.fn(),
    // An update answers with the document *before* the write, so deciding which
    // files are now unreferenced happens inside the same operation. Reading the
    // result back is the second half of that.
    findById: vi.fn(),
    findOneAndDelete: vi.fn(),
    countDocuments: vi.fn(),
  },
  PROJECT_SORT: { featured: -1, order: 1, 'title.en': 1 },
}));
vi.mock('../../../src/features/expertise/expertise.model.js', () => ({
  ExpertiseModel: { countDocuments: vi.fn() },
  EXPERTISE_SORT: { order: 1, 'name.en': 1 },
}));

// Where the bytes land belongs to the storage suite; this covers the contract.
const saved: { bytes: Buffer; extension: string }[] = [];
const deleted: string[] = [];

vi.mock('../../../src/core/storage/storage.service.js', () => ({
  saveImage: (
    _category: string,
    name: string,
    bytes: Buffer,
    extension: string,
  ) => {
    saved.push({ bytes, extension });

    return Promise.resolve(`/uploads/project/${name}-fixed.${extension}`);
  },
  deleteManagedFile: (reference: string) => {
    deleted.push(reference);

    return Promise.resolve();
  },
  isManagedReference: (reference: string) => reference.startsWith('/uploads/'),
  UPLOADS_ROOT: '/tmp/portfolio-test-uploads',
}));

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>');

const app = createApp();

const ID = '507f1f77bcf86cd799439022';
const SKILL_ID = '507f1f77bcf86cd799439011';
const UPDATED_AT = new Date('2026-09-02T10:00:00.000Z');

const VALID_BODY = {
  slug: 'portfolio',
  title: { en: 'Portfolio' },
  description: { en: 'This site.' },
};

function asDocument(body: Record<string, unknown> = {}) {
  return {
    _id: ID,
    id: ID,
    slug: VALID_BODY.slug,
    title: new Map(Object.entries(VALID_BODY.title)),
    description: new Map(Object.entries(VALID_BODY.description)),
    stack: [],
    gallery: [],
    featured: false,
    order: 0,
    updatedAt: UPDATED_AT,
    ...body,
  };
}

const model = ProjectModel as unknown as Record<
  string,
  ReturnType<typeof vi.fn>
>;
const skills = ExpertiseModel as unknown as Record<
  string,
  ReturnType<typeof vi.fn>
>;

function stubList(documents: unknown[]) {
  model.find?.mockReturnValue({ sort: () => Promise.resolve(documents) });
}

/**
 * An update reads the document twice: `findOneAndUpdate` answers with the state
 * *before* the write, which is what says whether a file has been abandoned, and
 * `findById` reads back the result. Stubbing both together keeps the two
 * halves of that from drifting apart in a test.
 */
function stubUpdate(before: unknown, after: unknown = before) {
  model.findOneAndUpdate?.mockResolvedValue(before);
  model.findById?.mockResolvedValue(after);
}

/** supertest types the body as `any`; narrow it in one place. */
function detailsOf(response: request.Response): Record<string, unknown> {
  return (response.body as { details: Record<string, unknown> }).details;
}

let admin: FakeAdmin;

beforeAll(async () => {
  admin = await buildAdmin();
});

beforeEach(() => {
  vi.clearAllMocks();
  saved.length = 0;
  deleted.length = 0;
  stubUserLookup(admin);
  stubList([]);
  stubUpdate(asDocument());
  // Every referenced skill is taken to exist unless a test says otherwise.
  skills.countDocuments?.mockResolvedValue(1);

  for (const key of ['127.0.0.1', '::1']) {
    loginRateLimit.resetKey(key);
  }
});

async function sessionCookie() {
  const response = await request(app)
    .post('/api/auth/login')
    .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  const raw = (
    response.headers as Record<string, string[] | string | undefined>
  )['set-cookie'];

  return (Array.isArray(raw) ? raw[0] : raw) ?? '';
}

describe('GET /api/projects', () => {
  it('lists them without a session, since the public site shows them', async () => {
    stubList([asDocument()]);

    const response = await request(app).get('/api/projects');

    expect(response.status).toBe(200);
    expect(detailsOf(response).projects).toEqual([
      {
        id: ID,
        // Never absent: the public page finds a project by this and nothing
        // else, so a response without one is a page that cannot be reached.
        slug: 'portfolio',
        title: { en: 'Portfolio' },
        description: { en: 'This site.' },
        stack: [],
        // Always present, even when empty: a client that has to tell "no
        // gallery" from "no gallery field" is a client with a bug waiting.
        gallery: [],
        featured: false,
        order: 0,
        updatedAt: UPDATED_AT.toISOString(),
      },
    ]);
  });

  /**
   * A field can be stored, validated and cleaned up correctly and still never
   * reach anyone, because the response mapper is a separate list of fields.
   * That is exactly what happened to the gallery - every other test passed
   * while the API returned nothing at all - so the shape is pinned here.
   */
  it('returns the gallery and the alt text it stored', async () => {
    stubList([
      asDocument({
        imageUrl: '/uploads/project/cover.png',
        imageAlt: new Map([['en', 'The cover']]),
        gallery: [
          { url: '/uploads/project/one.png', alt: new Map([['en', 'One']]) },
          // Alt is optional: a decorative screenshot is allowed to have none.
          { url: '/uploads/project/two.png' },
        ],
      }),
    ]);

    const response = await request(app).get('/api/projects');
    const [project] = detailsOf(response).projects as Record<string, unknown>[];

    expect(project?.imageAlt).toEqual({ en: 'The cover' });
    expect(project?.gallery).toEqual([
      { url: '/uploads/project/one.png', alt: { en: 'One' } },
      { url: '/uploads/project/two.png', alt: undefined },
    ]);
  });

  it('answers with an empty list rather than NOT_FOUND', async () => {
    const response = await request(app).get('/api/projects');

    expect(response.status).toBe(200);
    expect(detailsOf(response).projects).toEqual([]);
  });

  it('asks the database for them in display order', async () => {
    const sort = vi.fn().mockResolvedValue([]);
    model.find?.mockReturnValue({ sort });

    await request(app).get('/api/projects');

    expect(sort).toHaveBeenCalledWith({
      featured: -1,
      order: 1,
      'title.en': 1,
    });
  });
});

describe('POST /api/projects', () => {
  it('refuses without a session', async () => {
    const response = await request(app).post('/api/projects').send(VALID_BODY);

    expect(response.status).toBe(401);
    expect(model.create).not.toHaveBeenCalled();
  });

  it('creates the project for a signed-in admin', async () => {
    model.create?.mockResolvedValue(asDocument());

    const response = await request(app)
      .post('/api/projects')
      .set('Cookie', await sessionCookie())
      .send(VALID_BODY);

    expect(response.status).toBe(200);
    expect(model.create).toHaveBeenCalledWith({
      ...VALID_BODY,
      stack: [],
      gallery: [],
      featured: false,
      order: 0,
    });
  });

  it('answers CONFLICT when the title is already taken', async () => {
    model.create?.mockRejectedValue(
      Object.assign(new Error('E11000'), { code: 11000 }),
    );

    const response = await request(app)
      .post('/api/projects')
      .set('Cookie', await sessionCookie())
      .send(VALID_BODY);

    expect(response.status).toBe(409);
    expect(detailsOf(response)).toEqual({ 'title.en': 'ALREADY_EXISTS' });
  });

  it('refuses a reference to a skill that does not exist', async () => {
    skills.countDocuments?.mockResolvedValue(0);

    const response = await request(app)
      .post('/api/projects')
      .set('Cookie', await sessionCookie())
      .send({ ...VALID_BODY, stack: [SKILL_ID] });

    expect(response.status).toBe(422);
    expect(detailsOf(response)).toEqual({ stack: 'NOT_FOUND' });
    expect(model.create).not.toHaveBeenCalled();
  });

  it('reports an unsafe link on the field and stores nothing', async () => {
    const response = await request(app)
      .post('/api/projects')
      .set('Cookie', await sessionCookie())
      .send({ ...VALID_BODY, repoUrl: 'javascript:alert(1)' });

    expect(response.status).toBe(422);
    expect(detailsOf(response)).toEqual({ repoUrl: 'INVALID_URL' });
    expect(model.create).not.toHaveBeenCalled();
  });
});

describe('PUT /api/projects/:id', () => {
  it('refuses without a session', async () => {
    const response = await request(app)
      .put(`/api/projects/${ID}`)
      .send(VALID_BODY);

    expect(response.status).toBe(401);
    expect(model.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('sets what was sent and clears what was omitted', async () => {
    stubUpdate(asDocument());

    await request(app)
      .put(`/api/projects/${ID}`)
      .set('Cookie', await sessionCookie())
      .send(VALID_BODY);

    const [, update] = model.findOneAndUpdate?.mock.calls[0] as [
      unknown,
      Record<string, unknown>,
    ];

    expect(update.$set).toEqual({
      ...VALID_BODY,
      stack: [],
      gallery: [],
      featured: false,
      order: 0,
    });
    // Every optional field, including the four that say why the project was
    // hard. `replacementUpdate` reads its list from the Zod schema, so this
    // grew on its own when they were added - which is the property being
    // asserted here, not the particular names.
    expect(update.$unset).toEqual({
      imageUrl: '',
      imageAlt: '',
      role: '',
      problem: '',
      approach: '',
      outcome: '',
      repoUrl: '',
      liveUrl: '',
    });
  });

  /**
   * The four fields that say why the project was hard, rather than what it is.
   *
   * Asserted through the wire in both directions, because a localized field has
   * two shapes - a `Map` in Mongoose and a plain object on the wire - and a
   * mapper that forgets one of them fails silently, returning `undefined` for
   * text the owner definitely wrote.
   */
  it('stores and returns what a project says about itself', async () => {
    const said = {
      role: { en: 'Built the sync layer' },
      problem: { en: 'Two clients could write the same row offline.' },
      approach: { en: 'Last-write-wins was wrong; the merge is per field.' },
      outcome: { en: 'Conflicts fell to none over a month of use.' },
    };

    // Both halves: `findOneAndUpdate` answers with the state before the write
    // and `findById` reads the result back - the response is built from the
    // second one.
    stubUpdate(
      asDocument(),
      asDocument(
        Object.fromEntries(
          Object.entries(said).map(([field, value]) => [
            field,
            new Map(Object.entries(value)),
          ]),
        ),
      ),
    );

    const response = await request(app)
      .put(`/api/projects/${ID}`)
      .set('Cookie', await sessionCookie())
      .send({ ...VALID_BODY, ...said });

    expect(response.status).toBe(200);

    const [, update] = model.findOneAndUpdate?.mock.calls[0] as [
      unknown,
      Record<string, Record<string, unknown>>,
    ];
    expect(update.$set).toMatchObject(said);
    expect(detailsOf(response).project).toMatchObject(said);
  });

  it('answers NOT_FOUND for an id that is not an identifier', async () => {
    const response = await request(app)
      .put('/api/projects/not-an-id')
      .set('Cookie', await sessionCookie())
      .send(VALID_BODY);

    expect(response.status).toBe(404);
    expect(model.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('deletes the cover the project stops pointing at', async () => {
    stubUpdate(
      asDocument({ imageUrl: '/uploads/project/old.png' }),
      asDocument({ imageUrl: '/uploads/project/new.png' }),
    );

    await request(app)
      .put(`/api/projects/${ID}`)
      .set('Cookie', await sessionCookie())
      .send({ ...VALID_BODY, imageUrl: '/uploads/project/new.png' });

    expect(deleted).toEqual(['/uploads/project/old.png']);
  });

  /**
   * The gallery is what makes this a set difference rather than a field
   * comparison. An image can leave the gallery, move position, or be promoted
   * to the cover, and only "referenced before but not now" is really unused.
   */
  it('deletes gallery images the project no longer lists', async () => {
    stubUpdate(
      asDocument({
        gallery: [
          { url: '/uploads/project/kept.png' },
          { url: '/uploads/project/dropped.png' },
        ],
      }),
      asDocument({ gallery: [{ url: '/uploads/project/kept.png' }] }),
    );

    await request(app)
      .put(`/api/projects/${ID}`)
      .set('Cookie', await sessionCookie())
      .send({
        ...VALID_BODY,
        gallery: [{ url: '/uploads/project/kept.png' }],
      });

    expect(deleted).toEqual(['/uploads/project/dropped.png']);
  });

  it('keeps a gallery image that only moved position', async () => {
    const first = { url: '/uploads/project/one.png' };
    const second = { url: '/uploads/project/two.png' };

    stubUpdate(
      asDocument({ gallery: [first, second] }),
      asDocument({ gallery: [second, first] }),
    );

    await request(app)
      .put(`/api/projects/${ID}`)
      .set('Cookie', await sessionCookie())
      .send({ ...VALID_BODY, gallery: [second, first] });

    expect(deleted).toEqual([]);
  });

  // Promotion, not deletion: the file is still referenced, by another field.
  it('keeps an image moved from the gallery to the cover', async () => {
    const promoted = '/uploads/project/shot.png';

    stubUpdate(
      asDocument({ gallery: [{ url: promoted }] }),
      asDocument({ imageUrl: promoted, gallery: [] }),
    );

    await request(app)
      .put(`/api/projects/${ID}`)
      .set('Cookie', await sessionCookie())
      .send({ ...VALID_BODY, imageUrl: promoted, gallery: [] });

    expect(deleted).toEqual([]);
  });

  it('keeps the cover when it did not change', async () => {
    const same = '/uploads/project/same.png';
    stubUpdate(asDocument({ imageUrl: same }));

    await request(app)
      .put(`/api/projects/${ID}`)
      .set('Cookie', await sessionCookie())
      .send({ ...VALID_BODY, imageUrl: same });

    expect(deleted).toEqual([]);
  });
});

describe('DELETE /api/projects/:id', () => {
  it('refuses without a session', async () => {
    const response = await request(app).delete(`/api/projects/${ID}`);

    expect(response.status).toBe(401);
    expect(model.findOneAndDelete).not.toHaveBeenCalled();
  });

  // The document is gone, so nothing can point at its cover any more.
  it('deletes the project and its cover', async () => {
    model.findOneAndDelete?.mockResolvedValue(
      asDocument({ imageUrl: '/uploads/project/gone.png' }),
    );

    const response = await request(app)
      .delete(`/api/projects/${ID}`)
      .set('Cookie', await sessionCookie());

    expect(response.status).toBe(200);
    expect(deleted).toEqual(['/uploads/project/gone.png']);
  });

  it('answers NOT_FOUND when no project has that id', async () => {
    model.findOneAndDelete?.mockResolvedValue(null);

    const response = await request(app)
      .delete(`/api/projects/${ID}`)
      .set('Cookie', await sessionCookie());

    expect(response.status).toBe(404);
  });
});

describe('POST /api/projects/image', () => {
  it('refuses without a session, before reading any bytes', async () => {
    const response = await request(app)
      .post('/api/projects/image')
      .set('Content-Type', 'image/png')
      .send(PNG);

    expect(response.status).toBe(401);
    expect(saved).toEqual([]);
  });

  it('stores the image and answers with its reference', async () => {
    const response = await request(app)
      .post('/api/projects/image')
      .set('Cookie', await sessionCookie())
      .set('Content-Type', 'image/png')
      .send(PNG);

    expect(response.status).toBe(200);
    expect(detailsOf(response).imageUrl).toBe(
      '/uploads/project/cover-fixed.png',
    );
    expect(saved[0]?.extension).toBe('png');
  });

  // The declared Content-Type only chooses the parser; the bytes decide.
  it('rejects an SVG announced as a PNG', async () => {
    const response = await request(app)
      .post('/api/projects/image')
      .set('Cookie', await sessionCookie())
      .set('Content-Type', 'image/png')
      .send(SVG);

    expect(response.status).toBe(422);
    expect(detailsOf(response)).toEqual({ image: 'INVALID_IMAGE' });
    expect(saved).toEqual([]);
  });
});
