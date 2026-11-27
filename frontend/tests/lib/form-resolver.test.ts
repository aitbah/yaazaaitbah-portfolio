import type { ResolverOptions } from 'react-hook-form';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { createFormResolver, toFieldPath } from '../../src/lib/form-resolver';

// Shaped like a real localized field, so the dotted paths are the ones the
// backend actually sends - but owned here, so lib tests stay feature-free.
const schema = z.object({
  title: z.object({ en: z.string().min(1) }).catchall(z.string().min(1)),
  link: z.preprocess(
    (value) => (typeof value === 'string' ? value.trim() || undefined : value),
    z.url().optional(),
  ),
});

type Payload = z.infer<typeof schema>;

/** What a form holds: the optional input exists and is a string, blank or not. */
type FormValues = { title: Record<string, string>; link: string };

/** Distinguishable from any real message, so untranslated text stands out. */
const translate = (code: string) => `translated:${code}`;

const resolver = createFormResolver<FormValues, Payload>(schema, translate);

const OPTIONS = {
  fields: {},
  shouldUseNativeValidation: false,
} as ResolverOptions<FormValues>;

/** RHF nests errors by path; naming the shape keeps the assertions type-safe. */
type Issue = { type?: string; message?: string };

function resolve(values: Partial<FormValues>) {
  return resolver(values as FormValues, undefined, OPTIONS) as Promise<{
    values: Partial<Payload>;
    errors: { title?: { en?: Issue }; link?: Issue } & Record<string, unknown>;
  }>;
}

describe('createFormResolver', () => {
  it('passes parsed values through when the input is valid', async () => {
    const input = { title: { en: 'Hello' }, link: 'https://example.com' };

    const { values, errors } = await resolve(input);

    expect(values).toEqual(input);
    expect(errors).toEqual({});
  });

  // handleSubmit receives these values, so the payload must already be clean.
  // Zod keeps the key holding `undefined`; what matters is the request body,
  // and JSON.stringify omits it there.
  it('hands back the parsed payload, not the raw field values', async () => {
    const { values } = await resolve({ title: { en: 'Hello' }, link: '   ' });

    expect(values.link).toBeUndefined();
    expect(JSON.parse(JSON.stringify(values))).toEqual({
      title: { en: 'Hello' },
    });
  });

  // RHF reads errors by walking the path, so a flat 'title.en' key never renders.
  it('nests a dotted path instead of keying it flat', async () => {
    const { errors } = await resolve({ title: {} });

    expect(errors['title.en']).toBeUndefined();
    expect(errors.title?.en).toBeDefined();
  });

  it('reports the project code as the error type', async () => {
    const { errors } = await resolve({ title: {}, link: 'not-a-url' });

    expect(errors.title?.en?.type).toBe('REQUIRED');
    expect(errors.link?.type).toBe('INVALID_URL');
  });

  // The whole point of the resolver: Zod's English must never reach a field.
  it('stores the translated message, never Zod wording', async () => {
    const { errors } = await resolve({ title: {} });

    expect(errors.title?.en?.message).toBe('translated:REQUIRED');
  });

  it('drops the values when validation fails', async () => {
    const { values } = await resolve({ title: {} });

    expect(values).toEqual({});
  });
});

describe('toFieldPath', () => {
  it('returns the path unchanged, since the two syntaxes already agree', () => {
    expect(toFieldPath<FormValues>('title.en')).toBe('title.en');
  });
});
