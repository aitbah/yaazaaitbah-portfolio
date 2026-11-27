import type { DocumentExtension, ImageExtension } from './storage.types.js';

type Signature<Extension> = {
  extension: Extension;
  matches: (bytes: Buffer) => boolean;
};

function startsWith(bytes: Buffer, ...prefix: number[]) {
  return prefix.every((byte, index) => bytes[index] === byte);
}

function ascii(bytes: Buffer, start: number, end: number) {
  return bytes.subarray(start, end).toString('ascii');
}

/**
 * SVG is deliberately absent, and not only because it has no binary signature:
 * it is XML that can carry script, and it would be served from our own origin.
 */
const IMAGE_SIGNATURES: Signature<ImageExtension>[] = [
  {
    extension: 'png',
    matches: (bytes) =>
      startsWith(bytes, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a),
  },
  {
    extension: 'jpg',
    matches: (bytes) => startsWith(bytes, 0xff, 0xd8, 0xff),
  },
  {
    extension: 'webp',
    matches: (bytes) =>
      bytes.length >= 12 &&
      ascii(bytes, 0, 4) === 'RIFF' &&
      ascii(bytes, 8, 12) === 'WEBP',
  },
];

/**
 * What the file really is, read from its own bytes. A declared Content-Type or
 * a client filename is a claim, never evidence.
 */
export function detectImageExtension(bytes: Buffer): ImageExtension | null {
  return (
    IMAGE_SIGNATURES.find((signature) => signature.matches(bytes))?.extension ??
    null
  );
}

const DOCUMENT_SIGNATURES: Signature<DocumentExtension>[] = [
  {
    extension: 'pdf',
    // `%PDF-`, which every conforming file begins with.
    matches: (bytes) => ascii(bytes, 0, 5) === '%PDF-',
  },
];

/**
 * The same question for documents, asked separately.
 *
 * Deliberately not folded into `detectImageExtension`: widening that to answer
 * "which file is this" would make every existing caller accept a PDF without
 * anyone deciding that it should.
 */
export function detectDocumentExtension(
  bytes: Buffer,
): DocumentExtension | null {
  return (
    DOCUMENT_SIGNATURES.find((signature) => signature.matches(bytes))
      ?.extension ?? null
  );
}
