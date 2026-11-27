import { mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

// The service resolves its root once, at import; point it somewhere disposable
// before that happens.
const ROOT = await mkdtemp(path.join(tmpdir(), 'portfolio-uploads-'));
process.env.UPLOADS_DIR = ROOT;

const { detectImageExtension } =
  await import('../../../src/core/storage/image-signature.js');
const { deleteManagedFile, isManagedReference, saveImage } =
  await import('../../../src/core/storage/storage.service.js');

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]);
const WEBP = Buffer.concat([
  Buffer.from('RIFF', 'ascii'),
  Buffer.from([0x24, 0x00, 0x00, 0x00]),
  Buffer.from('WEBP', 'ascii'),
]);
const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>');

describe('detecting an image from its bytes', () => {
  it('recognises the formats the application accepts', () => {
    expect(detectImageExtension(PNG)).toBe('png');
    expect(detectImageExtension(JPEG)).toBe('jpg');
    expect(detectImageExtension(WEBP)).toBe('webp');
  });

  // It is XML that can carry script, and it would be served from our origin.
  it('rejects SVG', () => {
    expect(detectImageExtension(SVG)).toBeNull();
  });

  it('rejects anything without a known signature', () => {
    expect(detectImageExtension(Buffer.from('not an image'))).toBeNull();
    expect(detectImageExtension(Buffer.alloc(0))).toBeNull();
  });

  // A PNG header on an HTML payload is still not a PNG, but the reverse matters
  // more here: the declared type cannot make bytes into an image.
  it('reads the bytes, not the surrounding claim', () => {
    expect(detectImageExtension(Buffer.from('\x89PNG'))).toBeNull();
  });
});

describe('saveImage', () => {
  it('writes the file under its category and returns a relative reference', async () => {
    const reference = await saveImage('profile', 'avatar', PNG, 'png');

    expect(reference).toMatch(/^\/uploads\/profile\/avatar-[\w-]+\.png$/);
    const written = await readFile(
      path.join(ROOT, reference.slice('/uploads/'.length)),
    );
    expect(written.equals(PNG)).toBe(true);
  });

  // The reference is persisted, so it must not carry a hostname.
  it('never returns an absolute URL', async () => {
    const reference = await saveImage('profile', 'avatar', PNG, 'png');

    expect(reference.startsWith('/uploads/')).toBe(true);
    expect(reference).not.toContain('http');
  });

  it('gives every upload its own name', async () => {
    const first = await saveImage('profile', 'avatar', PNG, 'png');
    const second = await saveImage('profile', 'avatar', PNG, 'png');

    expect(first).not.toBe(second);
  });
});

describe('isManagedReference', () => {
  it('accepts only the shape the service itself produces', () => {
    expect(isManagedReference('/uploads/profile/avatar-abc.png')).toBe(true);
    expect(isManagedReference('/uploads/profile/avatar-abc.webp')).toBe(true);
  });

  it('rejects external URLs and anything that could escape the root', () => {
    for (const reference of [
      'https://cdn.example.com/a.png',
      '/uploads/../secret.png',
      '/uploads/profile/../../etc/passwd',
      '/uploads/profile/a.svg',
      '/etc/passwd',
      '/uploads/profile/nested/a.png',
    ]) {
      expect(isManagedReference(reference)).toBe(false);
    }
  });
});

describe('deleteManagedFile', () => {
  it('removes a file this service wrote', async () => {
    const reference = await saveImage('profile', 'avatar', PNG, 'png');

    await deleteManagedFile(reference);

    const remaining = await readdir(path.join(ROOT, 'profile'));
    expect(remaining).not.toContain(reference.split('/').pop());
  });

  // The whole point of the guard: a profile may hold someone else's URL.
  it('leaves anything it does not own alone', async () => {
    const outside = path.join(ROOT, 'outside.png');
    await writeFile(outside, PNG);

    await deleteManagedFile('https://cdn.example.com/a.png');
    await deleteManagedFile('/uploads/../outside.png');
    await deleteManagedFile('/etc/passwd');

    expect((await readFile(outside)).equals(PNG)).toBe(true);
  });

  it('treats an already missing file as done', async () => {
    await expect(
      deleteManagedFile('/uploads/profile/avatar-gone.png'),
    ).resolves.toBeUndefined();
  });
});

describe('the uploads root', () => {
  let categories: string[];

  beforeAll(async () => {
    categories = await readdir(ROOT);
  });

  it('keeps files inside their category directory', () => {
    expect(categories).toContain('profile');
  });
});
