import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { createApp } from '../../../src/app.js';
import { loginRateLimit } from '../../../src/features/auth/auth.routes.js';
import { ProfileModel } from '../../../src/features/profile/profile.model.js';
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  buildAdmin,
  stubUserLookup,
  type FakeAdmin,
} from '../auth/admin.fixture.js';

vi.mock('../../../src/features/option/option.lookup.js', () => ({
  // These suites mock their models, so there are no option rows for the real
  // check to read. That a level or a category must be one the owner offers is
  // proved against a real database in `option/option.reference.test.ts`.
  assertOptionExists: vi.fn(),
  assertOptionalOptionExists: vi.fn(),
}));
vi.mock('../../../src/features/auth/user.model.js', () => ({
  UserModel: {
    findOne: vi.fn(),
    findById: vi.fn(),
    findByIdAndUpdate: vi.fn(),
  },
}));
vi.mock('../../../src/features/profile/profile.model.js', () => ({
  ProfileModel: { findOne: vi.fn(), findOneAndUpdate: vi.fn() },
  SINGLETON_KEY: 'profile',
}));

// The endpoint's contract is what it stores and answers; where the bytes land
// belongs to the storage suite.
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

    return Promise.resolve(`/uploads/profile/${name}-fixed.${extension}`);
  },
  saveDocument: (
    _category: string,
    name: string,
    _bytes: Buffer,
    extension: string,
  ) => Promise.resolve(`/uploads/resume/${name}-fixed.${extension}`),
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

const VALID_BODY = {
  firstName: { en: 'Yaaza' },
  lastName: { en: 'Ait Bah' },
  headline: { en: 'Full-stack developer' },
};

const BILINGUAL_BODY = {
  firstName: { en: 'Yaaza', ar: 'ياعزى' },
  lastName: { en: 'Ait Bah', ar: 'أيت بها' },
  headline: { en: 'Full-stack developer', ar: 'مطور ويب' },
};

const UPDATED_AT = new Date('2026-08-30T10:00:00.000Z');

/** What a client receives: the content fields plus the last-changed date. */
function expected(body: Record<string, Record<string, string>>) {
  return { ...body, updatedAt: UPDATED_AT.toISOString() };
}

const model = ProfileModel as unknown as {
  findOne: ReturnType<typeof vi.fn>;
  findOneAndUpdate: ReturnType<typeof vi.fn>;
};

/** The shape the service reads: localized fields are Maps on a document. */
function asDocument(
  body: Record<string, Record<string, string>>,
  extra: Record<string, unknown> = {},
) {
  return {
    ...Object.fromEntries(
      Object.entries(body).map(([field, locales]) => [
        field,
        new Map(Object.entries(locales)),
      ]),
    ),
    ...extra,
    updatedAt: UPDATED_AT,
  };
}

function stubStoredProfile(document: unknown) {
  model.findOne.mockResolvedValue(document);
}

/**
 * The write returns the document it replaced - null when it inserted - and the
 * service reads the saved one back through findOne.
 */
function stubSave(saved: unknown, previous: unknown = null) {
  model.findOneAndUpdate.mockResolvedValue(previous);
  model.findOne.mockResolvedValue(saved);
}

/** supertest types the body as `any`; details are read through one narrowing. */
function detailsOf(response: request.Response): Record<string, unknown> {
  return (response.body as { details: Record<string, unknown> }).details;
}

/** supertest types the body as `any`; read it through one narrowing here. */
function profileOf(response: request.Response): Record<string, unknown> {
  return (response.body as { details: { profile: Record<string, unknown> } })
    .details.profile;
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
  stubSave(asDocument(VALID_BODY));

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

describe('GET /api/profile', () => {
  it('reads the profile without a session, since the public site shows it', async () => {
    stubStoredProfile(asDocument(VALID_BODY));

    const response = await request(app).get('/api/profile');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      code: 'SUCCESS',
      details: { profile: expected(VALID_BODY) },
    });
  });

  // Nothing written yet is an answer, not a failure: the client maps it.
  it('answers NOT_FOUND while no profile has been saved', async () => {
    stubStoredProfile(null);

    const response = await request(app).get('/api/profile');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ code: 'NOT_FOUND', details: {} });
  });

  // updatedAt is deliberate; the document's own bookkeeping is not.
  it('returns the content fields and the last-changed date, nothing else', async () => {
    stubStoredProfile({
      ...asDocument(VALID_BODY),
      _id: 'should-not-leak',
      __v: 3,
      createdAt: new Date(),
    });

    const response = await request(app).get('/api/profile');

    expect(Object.keys(profileOf(response))).toEqual([
      'firstName',
      'lastName',
      'headline',
      'updatedAt',
    ]);
  });
});

/**
 * The contact block is the one part of a public document that is not public.
 *
 * Every assertion here goes through the real endpoint rather than through
 * `publicContactDetails`, because the rule only protects anything if the route
 * applies it: a correct filter nobody calls is a filter that does not exist.
 */
describe('GET /api/profile - who may see the contact details', () => {
  /** A profile whose location is published and whose address is not. */
  function withContact(overrides: Record<string, unknown> = {}) {
    return asDocument(VALID_BODY, {
      contact: {
        email: 'hello@example.com',
        emailPublic: false,
        location: new Map([['en', 'Casablanca, Morocco']]),
        locationPublic: true,
        availability: 'open-to-freelance',
        availabilityPublic: true,
        ...overrides,
      },
    });
  }

  function contactOf(response: request.Response): Record<string, unknown> {
    return profileOf(response).contact as Record<string, unknown>;
  }

  it('withholds an unpublished address from a stranger entirely', async () => {
    stubStoredProfile(withContact());

    const contact = contactOf(await request(app).get('/api/profile'));

    // Absent, not null: a key that is present and empty still says the field
    // exists, and an address that "exists" is an address worth guessing at.
    expect(contact).not.toHaveProperty('email');
    expect(contact.emailPublic).toBe(false);
  });

  it('sends a published detail to a stranger', async () => {
    stubStoredProfile(withContact());

    const contact = contactOf(await request(app).get('/api/profile'));

    expect(contact.location).toEqual({ en: 'Casablanca, Morocco' });
    expect(contact.availability).toBe('open-to-freelance');
  });

  it('withholds a location that is not published', async () => {
    stubStoredProfile(withContact({ locationPublic: false }));

    const contact = contactOf(await request(app).get('/api/profile'));

    expect(contact).not.toHaveProperty('location');
  });

  it('withholds an availability that is not published', async () => {
    stubStoredProfile(withContact({ availabilityPublic: false }));

    const contact = contactOf(await request(app).get('/api/profile'));

    expect(contact).not.toHaveProperty('availability');
  });

  /** The admin edits these, so the owner must read back what is stored. */
  it('sends everything to the signed-in owner', async () => {
    stubStoredProfile(withContact());

    const response = await request(app)
      .get('/api/profile')
      .set('Cookie', await sessionCookie());

    expect(contactOf(response).email).toBe('hello@example.com');
  });

  /**
   * The owner is identified by a session that still works. A token for a
   * revoked or deleted account must read as a stranger rather than fail the
   * request: this endpoint is public, and answering 401 because a cookie went
   * stale would break the page for everyone.
   */
  it('treats a stale session as a stranger rather than an error', async () => {
    stubStoredProfile(withContact());

    const response = await request(app)
      .get('/api/profile')
      .set('Cookie', 'session=not-a-real-token');

    expect(response.status).toBe(200);
    expect(contactOf(response)).not.toHaveProperty('email');
  });

  it('says nothing about contact when the profile carries none', async () => {
    stubStoredProfile(asDocument(VALID_BODY));

    const response = await request(app).get('/api/profile');

    expect(profileOf(response)).not.toHaveProperty('contact');
  });
});

/**
 * The CV. A PDF, decided from its own bytes like every other upload - the
 * declared Content-Type only chose the parser.
 */
describe('POST /api/profile/resume', () => {
  const PDF = Buffer.from('%PDF-1.7\n');

  it('refuses an anonymous upload', async () => {
    const response = await request(app)
      .post('/api/profile/resume')
      .set('Content-Type', 'application/pdf')
      .send(PDF);

    expect(response.status).toBe(401);
  });

  it('stores a PDF and answers with the path to persist', async () => {
    const response = await request(app)
      .post('/api/profile/resume')
      .set('Cookie', await sessionCookie())
      .set('Content-Type', 'application/pdf')
      .send(PDF);

    expect(response.status).toBe(200);
    expect(detailsOf(response).resumeUrl).toBe('/uploads/resume/cv-fixed.pdf');
  });

  /**
   * The bytes decide. A PNG sent as `application/pdf` gets as far as the parser
   * and no further - which is the same rule the image endpoints follow, applied
   * to the other question.
   */
  it('refuses an image renamed as a PDF', async () => {
    const response = await request(app)
      .post('/api/profile/resume')
      .set('Cookie', await sessionCookie())
      .set('Content-Type', 'application/pdf')
      .send(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));

    expect(response.status).toBe(422);
    expect(detailsOf(response)).toEqual({ resume: 'INVALID_DOCUMENT' });
  });

  it('refuses an empty body', async () => {
    const response = await request(app)
      .post('/api/profile/resume')
      .set('Cookie', await sessionCookie())
      .set('Content-Type', 'application/pdf')
      .send(Buffer.alloc(0));

    expect(response.status).toBe(422);
    expect(detailsOf(response)).toEqual({ resume: 'INVALID_DOCUMENT' });
  });

  // The document parser accepts one type, so an image never reaches it at all.
  it('refuses a content type it does not parse', async () => {
    const response = await request(app)
      .post('/api/profile/resume')
      .set('Cookie', await sessionCookie())
      .set('Content-Type', 'image/png')
      .send(PDF);

    expect(response.status).toBe(422);
    expect(detailsOf(response)).toEqual({ resume: 'INVALID_DOCUMENT' });
  });

  // A document does not belong on an image endpoint either.
  it('is not accepted by the photo endpoint', async () => {
    const response = await request(app)
      .post('/api/profile/photo')
      .set('Cookie', await sessionCookie())
      .set('Content-Type', 'application/pdf')
      .send(PDF);

    expect(response.status).toBe(422);
    expect(detailsOf(response)).toEqual({ photo: 'INVALID_IMAGE' });
  });
});

describe('PUT /api/profile', () => {
  it('rejects a write with no session', async () => {
    const response = await request(app).put('/api/profile').send(VALID_BODY);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ code: 'UNAUTHENTICATED', details: {} });
    expect(model.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('saves a valid profile for the authenticated admin', async () => {
    const response = await request(app)
      .put('/api/profile')
      .set('Cookie', await sessionCookie())
      .send(VALID_BODY);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      code: 'SUCCESS',
      details: { profile: expected(VALID_BODY) },
    });
  });

  // One upsert covers both cases, so no singleton bookkeeping is needed.
  it('creates or replaces the single profile in one write', async () => {
    await request(app)
      .put('/api/profile')
      .set('Cookie', await sessionCookie())
      .send(VALID_BODY);

    expect(model.findOneAndUpdate).toHaveBeenCalledWith(
      { key: 'profile' },
      {
        $set: VALID_BODY,
        // PUT replaces, so what the client left out is cleared - every
        // optional field, which is what makes an image removable at all.
        $unset: {
          bio: '',
          photoUrl: '',
          photoAlt: '',
          resume: '',
          contact: '',
        },
      },
      expect.objectContaining({ upsert: true, runValidators: true }),
    );
  });

  /**
   * Not a replacement, though the effect is one: a replacement document
   * carries no `createdAt`, and Mongoose fills the missing one in with the
   * current time, so every save silently reset the profile's creation date.
   * The persistence suite proves the date survives; this proves the call that
   * makes it possible.
   */
  it('sets what was sent rather than replacing the document', async () => {
    const complete = {
      ...VALID_BODY,
      bio: { en: 'Building things for the web.' },
      photoUrl: 'https://cdn.example.com/me.jpg',
      photoAlt: { en: 'Yaaza, smiling' },
      resume: { en: '/uploads/resume/cv-3f2a.pdf' },
      // Every flag written out, because they carry defaults: a body that
      // omitted them would be set with the parsed values rather than the sent
      // ones, and this assertion is about the call, not the parse.
      contact: {
        email: 'hello@example.com',
        emailPublic: false,
        location: { en: 'Casablanca, Morocco' },
        locationPublic: true,
        availability: 'open-to-freelance',
        availabilityPublic: true,
      },
    };

    await request(app)
      .put('/api/profile')
      .set('Cookie', await sessionCookie())
      .send(complete);

    // Nothing omitted, so nothing to clear - and no `$unset` key at all,
    // because an empty one is an error in MongoDB rather than a no-op.
    expect(model.findOneAndUpdate).toHaveBeenCalledWith(
      { key: 'profile' },
      { $set: complete },
      expect.objectContaining({ upsert: true, runValidators: true }),
    );
  });

  // toProfileResponse branches on both optional fields; this covers them set.
  it('returns the optional fields when they carry a value', async () => {
    const complete = {
      ...VALID_BODY,
      bio: { en: 'Building things for the web.' },
    };
    stubSave({
      ...asDocument(complete),
      photoUrl: 'https://cdn.example.com/me.jpg',
    });

    const response = await request(app)
      .put('/api/profile')
      .set('Cookie', await sessionCookie())
      .send({ ...complete, photoUrl: 'https://cdn.example.com/me.jpg' });

    expect(profileOf(response)).toEqual({
      ...expected(complete),
      photoUrl: 'https://cdn.example.com/me.jpg',
    });
  });

  it('updates a profile that already exists', async () => {
    const updated = { ...VALID_BODY, headline: { en: 'Backend engineer' } };
    stubSave(asDocument(updated), asDocument(VALID_BODY));

    const response = await request(app)
      .put('/api/profile')
      .set('Cookie', await sessionCookie())
      .send(updated);

    expect(response.status).toBe(200);
    expect(profileOf(response)).toEqual(expected(updated));
  });

  it('reports invalid input as VALIDATION_ERROR with per-field codes', async () => {
    const response = await request(app)
      .put('/api/profile')
      .set('Cookie', await sessionCookie())
      .send({ ...VALID_BODY, firstName: { ar: 'ياعزى' }, photoUrl: 'nope' });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      code: 'VALIDATION_ERROR',
      details: { 'firstName.en': 'REQUIRED', photoUrl: 'INVALID_URL' },
    });
    expect(model.findOneAndUpdate).not.toHaveBeenCalled();
  });
});

describe('multilingual fields', () => {
  it('stores and returns every locale that was sent', async () => {
    stubSave(asDocument(BILINGUAL_BODY));

    const response = await request(app)
      .put('/api/profile')
      .set('Cookie', await sessionCookie())
      .send(BILINGUAL_BODY);

    expect(response.status).toBe(200);
    expect(profileOf(response)).toEqual(expected(BILINGUAL_BODY));
    expect(model.findOneAndUpdate).toHaveBeenCalledWith(
      { key: 'profile' },
      expect.objectContaining({ $set: BILINGUAL_BODY }),
      expect.anything(),
    );
  });

  it('serializes a localized field as an object, never as a Map', async () => {
    stubStoredProfile(asDocument(BILINGUAL_BODY));

    const response = await request(app).get('/api/profile');

    expect(profileOf(response).firstName).toEqual({
      en: 'Yaaza',
      ar: 'ياعزى',
    });
  });
});

describe('POST /api/profile/photo', () => {
  it('rejects an upload with no session', async () => {
    const response = await request(app)
      .post('/api/profile/photo')
      .set('Content-Type', 'image/png')
      .send(PNG);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ code: 'UNAUTHENTICATED', details: {} });
    // Nothing was even read from the body of an unauthenticated request.
    expect(saved).toHaveLength(0);
  });

  it('stores a valid image and answers with its relative path', async () => {
    const response = await request(app)
      .post('/api/profile/photo')
      .set('Cookie', await sessionCookie())
      .set('Content-Type', 'image/png')
      .send(PNG);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      code: 'SUCCESS',
      details: { photoUrl: '/uploads/profile/avatar-fixed.png' },
    });
  });

  // The declared type only picks the parser; the bytes decide what it is.
  it('rejects SVG bytes sent under an accepted content type', async () => {
    const response = await request(app)
      .post('/api/profile/photo')
      .set('Cookie', await sessionCookie())
      .set('Content-Type', 'image/png')
      .send(SVG);

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      code: 'VALIDATION_ERROR',
      details: { photo: 'INVALID_IMAGE' },
    });
    expect(saved).toHaveLength(0);
  });

  it('rejects a file whose bytes are not an image at all', async () => {
    const response = await request(app)
      .post('/api/profile/photo')
      .set('Cookie', await sessionCookie())
      .set('Content-Type', 'image/jpeg')
      .send(Buffer.from('#!/bin/sh\nrm -rf /'));

    expect(response.status).toBe(422);
    expect(detailsOf(response)).toEqual({ photo: 'INVALID_IMAGE' });
  });

  it('rejects a content type the application does not accept', async () => {
    const response = await request(app)
      .post('/api/profile/photo')
      .set('Cookie', await sessionCookie())
      .set('Content-Type', 'image/svg+xml')
      .send(SVG);

    expect(response.status).toBe(422);
    expect(detailsOf(response)).toEqual({ photo: 'INVALID_IMAGE' });
    expect(saved).toHaveLength(0);
  });

  it('rejects a file over the size limit', async () => {
    const response = await request(app)
      .post('/api/profile/photo')
      .set('Cookie', await sessionCookie())
      .set('Content-Type', 'image/png')
      .send(Buffer.concat([PNG, Buffer.alloc(3 * 1024 * 1024)]));

    expect(response.status).toBe(422);
    expect(detailsOf(response)).toEqual({ photo: 'IMAGE_TOO_LARGE' });
    expect(saved).toHaveLength(0);
  });

  // The filename is generated; no part of the request can influence the path.
  it('names the file itself, from the detected type', async () => {
    await request(app)
      .post('/api/profile/photo')
      .set('Cookie', await sessionCookie())
      .set('Content-Type', 'image/jpeg')
      .set('Content-Disposition', 'attachment; filename="../../evil.sh"')
      .send(PNG);

    expect(saved).toHaveLength(1);
    // Sent as JPEG, written as PNG, because that is what the bytes say.
    expect(saved[0]?.extension).toBe('png');
  });
});

describe('replacing the stored photo', () => {
  it('deletes the file the profile stops pointing at', async () => {
    stubSave(asDocument(VALID_BODY), {
      photoUrl: '/uploads/profile/avatar-old.png',
    });

    await request(app)
      .put('/api/profile')
      .set('Cookie', await sessionCookie())
      .send(VALID_BODY);

    expect(deleted).toEqual(['/uploads/profile/avatar-old.png']);
  });

  /**
   * The CV is a map, so replacement is read per locale: swapping the English
   * one must not touch the French one, and clearing the field must delete both.
   */
  it('deletes only the CV that was replaced', async () => {
    stubSave(
      asDocument(VALID_BODY, {
        resume: new Map([
          ['en', '/uploads/resume/cv-new.pdf'],
          ['fr', '/uploads/resume/cv-fr.pdf'],
        ]),
      }),
      {
        resume: new Map([
          ['en', '/uploads/resume/cv-old.pdf'],
          ['fr', '/uploads/resume/cv-fr.pdf'],
        ]),
      },
    );

    await request(app)
      .put('/api/profile')
      .set('Cookie', await sessionCookie())
      .send(VALID_BODY);

    expect(deleted).toEqual(['/uploads/resume/cv-old.pdf']);
  });

  it('deletes every CV when the field is cleared', async () => {
    stubSave(asDocument(VALID_BODY), {
      resume: new Map([
        ['en', '/uploads/resume/cv-en.pdf'],
        ['fr', '/uploads/resume/cv-fr.pdf'],
      ]),
    });

    await request(app)
      .put('/api/profile')
      .set('Cookie', await sessionCookie())
      .send(VALID_BODY);

    expect(deleted).toEqual([
      '/uploads/resume/cv-en.pdf',
      '/uploads/resume/cv-fr.pdf',
    ]);
  });

  // Someone else's file is not ours to remove; the storage layer guards it too.
  it('passes an external URL to storage rather than deciding itself', async () => {
    stubSave(asDocument(VALID_BODY), {
      photoUrl: 'https://cdn.example.com/me.jpg',
    });

    await request(app)
      .put('/api/profile')
      .set('Cookie', await sessionCookie())
      .send(VALID_BODY);

    expect(deleted).toEqual(['https://cdn.example.com/me.jpg']);
  });

  it('deletes nothing when the photo is unchanged', async () => {
    const unchanged = {
      ...asDocument(VALID_BODY),
      photoUrl: '/uploads/profile/avatar-same.png',
    };
    stubSave(unchanged, { photoUrl: '/uploads/profile/avatar-same.png' });

    await request(app)
      .put('/api/profile')
      .set('Cookie', await sessionCookie())
      .send({ ...VALID_BODY, photoUrl: '/uploads/profile/avatar-same.png' });

    expect(deleted).toEqual([]);
  });
});
