import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';

/**
 * The root has to exist before the module graph is loaded: `storage.service`
 * resolves it at import time, and `app` reads it from there.
 */
const ROOT = await mkdtemp(path.join(tmpdir(), 'portfolio-serving-'));
process.env.UPLOADS_DIR = ROOT;

const { createApp } = await import('../../../src/app.js');

const app = createApp();

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PDF = Buffer.from('%PDF-1.7\n');

async function store(category: string, filename: string, bytes: Buffer) {
  await mkdir(path.join(ROOT, category), { recursive: true });
  await writeFile(path.join(ROOT, category, filename), bytes);

  return `/uploads/${category}/${filename}`;
}

let image = '';
let resume = '';

beforeAll(async () => {
  image = await store('profile', 'avatar-abc.png', PNG);
  resume = await store('resume', 'cv-abc.pdf', PDF);
});

/**
 * A directory of visitor-supplied bytes served from our own origin. The upload
 * path refuses anything whose signature is wrong, so nothing scriptable should
 * be in here at all; these headers decide what happens if that is ever wrong.
 */
describe('every stored file', () => {
  it.each([
    ['an image', () => image],
    ['a document', () => resume],
  ])('is served to %s with the sandboxing headers', async (_what, of) => {
    const response = await request(app).get(of());

    expect(response.status).toBe(200);
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['content-security-policy']).toContain(
      "default-src 'none'",
    );
    expect(response.headers['content-security-policy']).toContain('sandbox');
  });
});

/**
 * A PDF asks a question the headers above do not answer: the browser's own
 * viewer is a plugin, and "render this in a tab from our origin" is not
 * something a CV needs. Served as an attachment, a stored PDF has no path to
 * rendering here at all - and a download is what the reader wanted anyway.
 */
describe('a document', () => {
  it('is handed over rather than rendered', async () => {
    const response = await request(app).get(resume);

    expect(response.status).toBe(200);
    expect(response.headers['content-disposition']).toBe('attachment');
  });
});

// Only that category: an avatar must still render in an `img` element.
describe('an image', () => {
  it('is not turned into a download', async () => {
    const response = await request(app).get(image);

    expect(response.status).toBe(200);
    expect(response.headers['content-disposition']).toBeUndefined();
  });
});
