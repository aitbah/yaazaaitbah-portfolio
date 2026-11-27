/**
 * One directory per entity, so uploads stay sorted as the application grows.
 * A category lands here when its feature really stores something.
 */
export const STORAGE_CATEGORIES = [
  'profile',
  'project',
  'expertise',
  'resume',
] as const;

export type StorageCategory = (typeof STORAGE_CATEGORIES)[number];

/** The image formats the application accepts, named by file extension. */
export const IMAGE_EXTENSIONS = ['png', 'jpg', 'webp'] as const;

export type ImageExtension = (typeof IMAGE_EXTENSIONS)[number];

/**
 * The document formats it accepts, which is one: a CV is a PDF.
 *
 * A separate list from the images, and a separate detector, because "which
 * image is this" and "which file is this" are different questions. Merged, the
 * image endpoints would accept a document by omission.
 */
export const DOCUMENT_EXTENSIONS = ['pdf'] as const;

export type DocumentExtension = (typeof DOCUMENT_EXTENSIONS)[number];

/** Every extension the storage layer can emit, for the reference shapes. */
export type StoredExtension = ImageExtension | DocumentExtension;

/** Public prefix the managed files are served under. */
export const UPLOADS_URL_PREFIX = '/uploads';

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

/**
 * Larger than an image, because a CV with a few pages of vector text and one
 * photograph routinely is - and small enough that nothing else fits.
 */
export const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;

/**
 * The content types the upload route will parse at all. It only chooses the
 * parser - the bytes decide what the file actually is.
 */
export const ACCEPTED_IMAGE_MIME = ['image/png', 'image/jpeg', 'image/webp'];

/** As above: it only chooses the parser. The bytes decide. */
export const ACCEPTED_DOCUMENT_MIME = ['application/pdf'];

/**
 * Categories served as a download rather than rendered: a CV has no need of the
 * browser's PDF viewer on our origin.
 */
export const ATTACHMENT_CATEGORIES: readonly StorageCategory[] = ['resume'];
