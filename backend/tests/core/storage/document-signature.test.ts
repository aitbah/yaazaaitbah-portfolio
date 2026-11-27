import { describe, expect, it } from 'vitest';

import {
  detectDocumentExtension,
  detectImageExtension,
} from '../../../src/core/storage/image-signature.js';

const PDF = Buffer.from('%PDF-1.7\n%\xe2\xe3\xcf\xd3\n', 'binary');
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe('what a document really is', () => {
  it('recognises a PDF by its own bytes', () => {
    expect(detectDocumentExtension(PDF)).toBe('pdf');
  });

  /**
   * The declared Content-Type only chose the parser. A file renamed, or sent
   * under a type it is not, is decided here - by the bytes.
   */
  it.each([
    ['an image', PNG],
    ['HTML', Buffer.from('<!doctype html><script>alert(1)</script>')],
    ['a script', Buffer.from('#!/bin/sh\nrm -rf /\n')],
    ['SVG', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>')],
    ['nothing at all', Buffer.alloc(0)],
    ['almost a PDF', Buffer.from('%PDF')],
    ['a PDF header not at the start', Buffer.from('  %PDF-1.7')],
  ])('refuses %s', (_what, bytes) => {
    expect(detectDocumentExtension(bytes)).toBeNull();
  });
});

/**
 * The two detectors are deliberately separate: "which image is this" and
 * "which file is this" are different questions, and one function answering
 * both would make every image endpoint accept a document by omission.
 */
describe('the two questions stay apart', () => {
  it('does not let a PDF pass as an image', () => {
    expect(detectImageExtension(PDF)).toBeNull();
  });

  it('does not let an image pass as a document', () => {
    expect(detectDocumentExtension(PNG)).toBeNull();
  });
});
