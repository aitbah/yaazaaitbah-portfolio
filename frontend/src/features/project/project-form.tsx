'use client';

import { useTranslations } from 'next-intl';
import { slugFrom } from '@portfolio/shared';
import { useEffect, useState } from 'react';
import { useForm, useWatch, type FieldErrors } from 'react-hook-form';

import { CheckboxField } from '@/components/form/checkbox-field';
import { LocalizedField } from '@/components/form/localized-field';
import { TextField } from '@/components/form/text-field';
import { FieldRow } from '@/components/form/field-row';
import { FormSection } from '@/components/form/form-section';
import { FormActions } from '@/components/form/form-actions';
import { FormFields, FormLayout } from '@/components/form/form-layout';
import type { Expertise } from '@/features/expertise/expertise-api';
import { ApiRequestError } from '@/lib/api-client';
import {
  toFieldCode,
  toFieldErrors,
  toResponseCode,
  type ResponseCode,
} from '@/lib/error-codes';
import { createFormResolver, toFieldPath } from '@/lib/form-resolver';

import { CoverField } from './cover-field';
import { GalleryField } from './gallery-field';
import type { Project } from './project-api';
import {
  projectSchema,
  type ProjectFormValues,
  type ProjectInput,
} from './project-schema';
import { StackField } from './stack-field';
import { useCreateProject, useUpdateProject } from './use-projects';
import {
  DEFAULT_LOCALE,
  LOCALES,
  keepUnrendered,
  localesOf,
} from '@/lib/localized-form';

function toFormValues(project: Project | null): ProjectFormValues {
  return {
    slug: project?.slug ?? '',
    title: localesOf(project?.title),
    description: localesOf(project?.description),
    stack: project?.stack ?? [],
    imageUrl: project?.imageUrl ?? '',
    imageAlt: localesOf(project?.imageAlt),
    // Every entry's alt gets a value per locale, so no input starts
    // uncontrolled - the same rule the top-level localized fields follow.
    gallery: (project?.gallery ?? []).map((image) => ({
      url: image.url,
      alt: localesOf(image.alt),
    })),
    role: localesOf(project?.role),
    problem: localesOf(project?.problem),
    approach: localesOf(project?.approach),
    outcome: localesOf(project?.outcome),
    repoUrl: project?.repoUrl ?? '',
    liveUrl: project?.liveUrl ?? '',
    featured: project?.featured ?? false,
    order: project?.order ?? 0,
  };
}

/**
 * `PUT` replaces the document, so a locale the form did not render - one
 * written straight through the API, or left from a language since removed from
 * `routing.locales` - would be deleted by an ordinary save.
 */
function withUnrenderedLocales(
  input: ProjectInput,
  project: Project | null,
): ProjectInput {
  if (!project) {
    return input;
  }

  return {
    ...input,
    title: keepUnrendered(project.title, input.title),
    description: keepUnrendered(project.description, input.description),
    // Only when the field survived validation. An optional one the admin
    // cleared is absent by then, and resurrecting it from a locale this form
    // never rendered would undo the clearing on purpose.
    role: input.role ? keepUnrendered(project.role, input.role) : input.role,
    problem: input.problem
      ? keepUnrendered(project.problem, input.problem)
      : input.problem,
    approach: input.approach
      ? keepUnrendered(project.approach, input.approach)
      : input.approach,
    outcome: input.outcome
      ? keepUnrendered(project.outcome, input.outcome)
      : input.outcome,
  };
}

/**
 * Exactly what has an input on screen. The localized fields are not themselves
 * rendered - one input exists per configured locale.
 */
function hasVisibleMessage(errors: FieldErrors<ProjectFormValues>): boolean {
  const localized = [
    'title',
    'description',
    'role',
    'problem',
    'approach',
    'outcome',
  ] as const;

  return (
    localized.some((field) => {
      const value = errors[field] as Record<string, unknown> | undefined;

      return LOCALES.some((locale) => value?.[locale] !== undefined);
    }) ||
    errors.slug !== undefined ||
    errors.stack !== undefined ||
    errors.imageUrl !== undefined ||
    errors.imageAlt !== undefined ||
    errors.gallery !== undefined ||
    errors.repoUrl !== undefined ||
    errors.liveUrl !== undefined ||
    errors.featured !== undefined
  );
}

type ProjectFormProps = {
  /** `null` creates a new project; a project edits that one. */
  project: Project | null;
  /** Technologies and tools - a project's stack, never its skills. */
  options: Expertise[];
  nameOf: (row: Expertise) => string;
  onDone: () => void;
};

export function ProjectForm({
  project,
  options,
  nameOf,
  onDone,
}: ProjectFormProps) {
  const t = useTranslations('admin.projects');
  const tKind = useTranslations('admin.expertise.kinds');
  const tField = useTranslations('validation');
  const tResponse = useTranslations('responses');

  const create = useCreateProject();
  const update = useUpdateProject();
  const isPending = create.isPending || update.isPending;

  const [errorCode, setErrorCode] = useState<ResponseCode | null>(null);

  const form = useForm<ProjectFormValues, unknown, ProjectInput>({
    resolver: createFormResolver<ProjectFormValues, ProjectInput>(
      projectSchema,
      tField,
    ),
    defaultValues: toFormValues(project),
  });

  /**
   * The address follows the title only while creating and until edited by hand
   * (`dirtyFields`), so a published project's URL never moves with a renamed
   * title.
   */
  const title = useWatch({ control: form.control, name: 'title' });
  const suggestion = slugFrom(title?.[DEFAULT_LOCALE] ?? '');
  const slugTouched = form.formState.dirtyFields.slug === true;

  useEffect(() => {
    if (project || slugTouched) {
      return;
    }

    form.setValue('slug', suggestion);
  }, [project, slugTouched, suggestion, form]);

  function onSubmit(input: ProjectInput) {
    setErrorCode(null);

    const payload = withUnrenderedLocales(input, project);

    const onError = (error: unknown) => {
      // The backend answers with the same field codes at the same paths, so
      // they land on the very fields RHF already knows. CONFLICT counts too:
      // a duplicate title names the field it is about.
      if (
        error instanceof ApiRequestError &&
        (error.code === 'VALIDATION_ERROR' || error.code === 'CONFLICT')
      ) {
        for (const [path, code] of Object.entries(
          toFieldErrors(error.details),
        )) {
          form.setError(toFieldPath<ProjectFormValues>(path), {
            type: code,
            message: tField(toFieldCode(code)),
          });
        }
      }

      setErrorCode(toResponseCode(error));
    };

    if (project) {
      update.mutate(
        { id: project.id, input: payload },
        { onSuccess: onDone, onError },
      );

      return;
    }

    create.mutate(payload, { onSuccess: onDone, onError });
  }

  // Read unconditionally: `formState` is a proxy that subscribes the component
  // to whatever it touches during render, and reading it behind a short-circuit
  // means the first render never subscribes.
  const { errors } = form.formState;
  const globalError =
    errorCode !== null && !hasVisibleMessage(errors)
      ? tResponse(errorCode)
      : null;

  return (
    <FormLayout
      onSubmit={(event) => void form.handleSubmit(onSubmit)(event)}
      isDirty={form.formState.isDirty}
    >
      <FormFields>
        <FormSection title={t('groups.details')}>
          {/* Both run long, so both keep a full row. */}
          <LocalizedField
            control={form.control}
            name="title"
            required
            label={t('fields.title')}
          />
          <LocalizedField
            control={form.control}
            name="description"
            required
            label={t('fields.description')}
            multiline
          />
          {/*
            The address, beneath the title it is prefilled from. Read second
            because that is the order it is written in - and it stays editable
            afterwards, since the owner is the one who knows whether a link is
            already out there.
          */}
          <TextField
            control={form.control}
            name="slug"
            id="project-slug"
            label={t('fields.slug')}
            description={t('slugHint')}
            required
          />

          {/* The stack is part of what the project *is*, not a separate
              subject, so it stays in this group. */}
          <StackField
            control={form.control}
            id="project-stack"
            title={t('stack.title')}
            empty={t('stack.empty')}
            options={options}
            nameOf={nameOf}
            groupLabel={(kind) => tKind(`${kind}.nav`)}
          />
        </FormSection>

        {/*
          Second, ahead of the pictures, because this is the part a reader is
          actually judging. Every field is optional: a project written up later,
          or not at all, still saves.
        */}
        <FormSection title={t('groups.story')} description={t('storyHint')}>
          <LocalizedField
            control={form.control}
            name="role"
            label={t('fields.role')}
          />
          <LocalizedField
            control={form.control}
            name="problem"
            label={t('fields.problem')}
            multiline
          />
          <LocalizedField
            control={form.control}
            name="approach"
            label={t('fields.approach')}
            multiline
          />
          <LocalizedField
            control={form.control}
            name="outcome"
            label={t('fields.outcome')}
            multiline
          />
        </FormSection>

        {/*
          The cover and the gallery together, because they are one decision:
          which pictures the project shows. Each image sits beside its own
          description, so it is written while looking at what it describes.
        */}
        <FormSection title={t('groups.images')} description={t('altHint')}>
          <FieldRow>
            <CoverField form={form} />
            <LocalizedField
              control={form.control}
              name="imageAlt"
              label={t('fields.imageAlt')}
            />
          </FieldRow>
          <GalleryField form={form} />
        </FormSection>

        <FormSection title={t('groups.links')}>
          {/* Two URLs of the same kind: paired, so they read as a set. */}
          <FieldRow>
            <TextField
              control={form.control}
              name="repoUrl"
              id="project-repo"
              label={t('fields.repoUrl')}
              type="url"
            />
            <TextField
              control={form.control}
              name="liveUrl"
              id="project-live"
              label={t('fields.liveUrl')}
              type="url"
            />
          </FieldRow>
        </FormSection>

        <FormSection title={t('groups.visibility')}>
          <CheckboxField
            control={form.control}
            name="featured"
            id="project-featured"
            label={t('fields.featured')}
            description={t('featuredHint')}
          />
        </FormSection>
      </FormFields>

      <FormActions
        submitLabel={t('submit')}
        submittingLabel={t('submitting')}
        isPending={isPending}
        cancelLabel={t('cancel')}
        onCancel={onDone}
        error={globalError}
      />
    </FormLayout>
  );
}
