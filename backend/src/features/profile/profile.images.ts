/**
 * Every profile field that references a stored file. Saving and pruning must
 * agree on it: a field missing from pruning deletes an image in use. Outside
 * the model, which the API suite mocks.
 */
export const PROFILE_IMAGE_FIELDS = ['photoUrl'] as const;

/**
 * The field holding the stored CVs, one per locale.
 *
 * Separate from the images because it is a separate storage category with its
 * own sweep, and because it is a map rather than a string - the two are read
 * differently even though both hold references.
 */
export const PROFILE_DOCUMENT_FIELD = 'resume' as const;
