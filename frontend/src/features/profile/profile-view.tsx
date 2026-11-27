'use client';

import {
  BriefcaseIcon,
  EyeIcon,
  EyeOffIcon,
  MailIcon,
  MapPinIcon,
} from 'lucide-react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

import { StoredAvatar } from '@/components/admin/stored-avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { localizedValue } from '@/i18n/localized-value';
import { useOptionLabel } from '@/features/option/use-options';

import type { Profile } from './profile-api';

/**
 * One contact detail, and whether a stranger can see it.
 *
 * The badge is the point of the row. A stored address and a published one look
 * identical on a form once it is saved, and "did I turn that on?" is exactly
 * the question this view exists to answer at a glance.
 */
function ContactRow({
  icon,
  label,
  value,
  published,
  shownLabel,
  hiddenLabel,
  notSetLabel,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  published: boolean;
  shownLabel: string;
  hiddenLabel: string;
  notSetLabel: string;
}) {
  return (
    // A named group, so the badge belongs to a detail rather than floating
    // beside one: "Not shown" read on its own says nothing about what is not
    // shown, to a screen reader or to a test.
    <div
      role="group"
      aria-label={label}
      className="flex items-start justify-between gap-3"
    >
      <span className="flex min-w-0 items-start gap-2">
        <span className="mt-0.5 text-muted-foreground" aria-hidden>
          {icon}
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="text-xs text-muted-foreground">{label}</span>
          <span className="truncate text-sm" dir="auto">
            {value || (
              <span className="text-muted-foreground">{notSetLabel}</span>
            )}
          </span>
        </span>
      </span>

      {/* Only where there is something to publish: "not shown" beside an empty
          field is an answer to a question nobody asked. */}
      {value ? (
        <Badge
          variant={published ? 'secondary' : 'outline'}
          className="shrink-0 gap-1 font-normal"
        >
          {published ? (
            <EyeIcon className="size-3" aria-hidden />
          ) : (
            <EyeOffIcon className="size-3" aria-hidden />
          )}
          {published ? shownLabel : hiddenLabel}
        </Badge>
      ) : null}
    </div>
  );
}

/**
 * The profile as it stands, before anything is edited.
 *
 * Reading is the common case - you open the page to check what is published far
 * more often than to change it - and a form of fifteen inputs is a poor way to
 * read anything. It is also the only place that says at a glance which contact
 * details are published.
 */
export function ProfileView({ profile }: { profile: Profile }) {
  const t = useTranslations('admin.profile');
  const tContact = useTranslations('admin.profile.contact');
  const availabilityLabel = useOptionLabel('availability-status');
  const format = useFormatter();
  const locale = useLocale();

  const first = localizedValue(profile.firstName, locale);
  const last = localizedValue(profile.lastName, locale);
  const fullName = [first, last].filter(Boolean).join(' ');
  const initials = [first, last]
    .map((part) => part.slice(0, 1).toUpperCase())
    .join('');

  return (
    <Card>
      <CardContent className="flex flex-col gap-6">
        <div className="flex flex-col gap-4 @2xl/admin-content:flex-row @2xl/admin-content:items-end">
          <StoredAvatar
            url={profile.photoUrl ?? ''}
            alt={localizedValue(profile.photoAlt, locale) || fullName}
            initials={initials || '—'}
            width={96}
            className="size-24"
            fallbackClassName="text-2xl"
          />

          <div className="flex min-w-0 flex-col gap-1">
            <h2 className="text-xl font-semibold tracking-tight" dir="auto">
              {fullName}
            </h2>
            <p className="text-sm text-muted-foreground" dir="auto">
              {localizedValue(profile.headline, locale)}
            </p>
          </div>
        </div>

        {localizedValue(profile.bio, locale) ? (
          <>
            <Separator />
            {/* The admin's own line breaks are the only structure a bio has. */}
            <p className="max-w-3xl whitespace-pre-wrap text-sm" dir="auto">
              {localizedValue(profile.bio, locale)}
            </p>
          </>
        ) : null}

        <Separator />

        <div className="flex max-w-3xl flex-col gap-3">
          <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {tContact('title')}
          </h3>

          <ContactRow
            icon={<MailIcon className="size-4" />}
            label={tContact('emailLabel')}
            value={profile.contact?.email ?? ''}
            published={profile.contact?.emailPublic ?? false}
            shownLabel={tContact('shown')}
            hiddenLabel={tContact('hidden')}
            notSetLabel={tContact('notSet')}
          />
          <ContactRow
            icon={<MapPinIcon className="size-4" />}
            label={tContact('locationLabel')}
            value={localizedValue(profile.contact?.location, locale)}
            published={profile.contact?.locationPublic ?? false}
            shownLabel={tContact('shown')}
            hiddenLabel={tContact('hidden')}
            notSetLabel={tContact('notSet')}
          />
          <ContactRow
            icon={<BriefcaseIcon className="size-4" />}
            label={tContact('availabilityLabel')}
            value={
              profile.contact?.availability
                ? availabilityLabel(profile.contact.availability)
                : ''
            }
            published={profile.contact?.availabilityPublic ?? true}
            shownLabel={tContact('shown')}
            hiddenLabel={tContact('hidden')}
            notSetLabel={tContact('notSet')}
          />
        </div>

        <p className="text-xs text-muted-foreground">
          {t('updated', {
            date: format.dateTime(new Date(profile.updatedAt), {
              dateStyle: 'medium',
              timeStyle: 'short',
            }),
          })}
        </p>
      </CardContent>
    </Card>
  );
}
