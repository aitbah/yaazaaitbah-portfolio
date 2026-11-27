'use client';

import {
  ArrowRightIcon,
  BriefcaseIcon,
  CheckIcon,
  FolderGitIcon,
  MailIcon,
  SparklesIcon,
  type LucideIcon,
} from 'lucide-react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';

import { StoredAvatar } from '@/components/admin/stored-avatar';
import { ErrorText } from '@/components/error-text';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { useCredentials } from '@/features/credential/use-credentials';
import { useEducation } from '@/features/education/use-education';
import { useExperience } from '@/features/experience/use-experience';
import { useExpertise } from '@/features/expertise/use-expertise';
import { useLanguages } from '@/features/language/use-languages';
import { useMessages } from '@/features/message/use-messages';
import { useProfile } from '@/features/profile/use-profile';
import { useProjects } from '@/features/project/use-projects';
import { useSocialLinks } from '@/features/social-link/use-social-links';
import { localizedValue } from '@/i18n/localized-value';
import { Link } from '@/i18n/navigation';
import { useErrorMessages } from '@/lib/error-messages';
import { cn } from '@/lib/utils';

import { readinessChecks } from './dashboard-readiness';
import { useAdminIdentity } from './use-admin-identity';

/** How many of the latest messages the overview shows before deferring to the inbox. */
const RECENT_LIMIT = 4;

type StatProps = {
  label: string;
  value: number;
  detail: string | null;
  icon: LucideIcon;
  href: string;
  action: string;
  error: unknown;
};

/**
 * One number, what it is, and one line about it.
 *
 * The whole card is the link. It used to hold an outline button repeating the
 * card's own heading - four words of chrome per tile, and a click target
 * smaller than the tile it sat in.
 */
function Stat({
  label,
  value,
  detail,
  icon: Icon,
  href,
  action,
  error,
}: StatProps) {
  const errorMessage = useErrorMessages();

  return (
    // The whole tile is the link, rather than an outline button inside it
    // repeating the tile's own heading. Named by what clicking it does, so the
    // accessible name is an action and not the sentence the tile happens to
    // read as.
    <Link
      href={href}
      aria-label={action}
      className="group block h-full rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <Card className="h-full gap-3 transition-colors group-hover:bg-accent/30 group-hover:ring-ring/30">
        <CardHeader>
          <CardDescription>{label}</CardDescription>
          {error ? (
            <CardTitle
              role="alert"
              className="text-base font-normal text-destructive"
            >
              {errorMessage.response(error)}
            </CardTitle>
          ) : (
            <CardTitle className="text-3xl font-semibold tabular-nums">
              {value}
            </CardTitle>
          )}
          <CardAction>
            <span className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <Icon className="size-4" aria-hidden />
            </span>
          </CardAction>
        </CardHeader>
        <CardFooter className="text-sm text-muted-foreground">
          <span className="flex w-full items-center justify-between gap-2">
            {error ? null : (detail ?? <span aria-hidden>&nbsp;</span>)}
            <ArrowRightIcon
              className="size-4 shrink-0 transition-transform ltr:group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5"
              aria-hidden
            />
          </span>
        </CardFooter>
      </Card>
    </Link>
  );
}

type BackgroundRow = {
  key: string;
  label: string;
  count: number;
  href: string;
  error: unknown;
};

/**
 * Sections written once and checked occasionally, listed rather than given
 * tiles, so the tiles keep their weight. No combined total - it would be a
 * count of nothing.
 */
function Background({
  title,
  description,
  rows,
}: {
  title: string;
  description: string;
  rows: BackgroundRow[];
}) {
  const t = useTranslations('admin.dashboard');
  const errorMessage = useErrorMessages();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col">
          {rows.map(({ key, label, count, href, error }) => (
            <li key={key}>
              <Link
                href={href}
                // The visible row is a name and a number, which reads as a
                // fragment on its own. The label says the sentence.
                aria-label={t('backgroundRow', { name: label, count })}
                className="-mx-2 flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent"
              >
                <span className="truncate">{label}</span>
                {/* One failed read costs its own number and nothing else: the
                    other three sections are still worth reporting. */}
                {error ? (
                  <span role="alert" className="text-xs text-destructive">
                    {errorMessage.response(error)}
                  </span>
                ) : (
                  <span className="tabular-nums text-muted-foreground">
                    {count}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

/**
 * What the admin lands on after signing in, built from the queries each page
 * already makes. A failed section says so without blanking the rest.
 */
export function DashboardOverview() {
  const t = useTranslations('admin.dashboard');
  const errorMessage = useErrorMessages();
  const format = useFormatter();
  const locale = useLocale();

  const skills = useExpertise('skill');
  const technologies = useExpertise('technology');
  const tools = useExpertise('tool');
  const experience = useExperience();
  const projects = useProjects();
  const socialLinks = useSocialLinks();
  const inbox = useMessages();
  const profile = useProfile();
  const education = useEducation();
  const certifications = useCredentials('certification');
  const courses = useCredentials('course');
  const languages = useLanguages();
  const { name, email, photoUrl, initials } = useAdminIdentity();

  const loading =
    skills.isPending ||
    technologies.isPending ||
    tools.isPending ||
    experience.isPending ||
    projects.isPending ||
    socialLinks.isPending ||
    inbox.isPending ||
    profile.isPending ||
    education.isPending ||
    certifications.isPending ||
    courses.isPending ||
    languages.isPending;

  if (loading) {
    return (
      <div
        role="status"
        aria-label={t('loading')}
        aria-busy
        className="flex flex-col gap-6"
      >
        <div className="grid gap-4 @2xl/admin-content:grid-cols-2 @5xl/admin-content:grid-cols-4">
          {[0, 1, 2, 3].map((slot) => (
            <Skeleton key={slot} className="h-32 w-full" />
          ))}
        </div>
        <div className="grid gap-4 @3xl/admin-content:grid-cols-2 @6xl/admin-content:grid-cols-4">
          {[0, 1, 2, 3].map((slot) => (
            <Skeleton key={slot} className="h-64 w-full" />
          ))}
        </div>
      </div>
    );
  }

  const featured = projects.projects.filter(
    (project) => project.featured,
  ).length;
  const expertiseTotal =
    skills.rows.length + technologies.rows.length + tools.rows.length;
  const currentPosition = experience.positions.find(
    (position) => position.current,
  );

  const stats = [
    {
      key: 'projects',
      label: t('counts.projects'),
      value: projects.projects.length,
      detail: t('featured', { count: featured }),
      icon: FolderGitIcon,
      href: '/admin/projects',
      error: projects.error,
    },
    {
      key: 'expertise',
      label: t('counts.expertise'),
      value: expertiseTotal,
      // The breakdown is the point of the split, so the tile says it rather
      // than presenting one total as if the three were interchangeable.
      detail: t('expertiseBreakdown', {
        skills: skills.rows.length,
        technologies: technologies.rows.length,
        tools: tools.rows.length,
      }),
      icon: SparklesIcon,
      href: '/admin/skills',
      error: skills.error ?? technologies.error ?? tools.error,
    },
    {
      key: 'experience',
      label: t('counts.experience'),
      value: experience.positions.length,
      detail: currentPosition
        ? t('currentRole', {
            role: localizedValue(currentPosition.role, locale),
          })
        : null,
      icon: BriefcaseIcon,
      href: '/admin/experience',
      error: experience.error,
    },
    {
      key: 'messages',
      label: t('counts.messages'),
      value: inbox.total,
      detail: t('unread', { count: inbox.unread }),
      icon: MailIcon,
      href: '/admin/messages',
      error: inbox.error,
    },
  ];

  const background: BackgroundRow[] = [
    {
      key: 'education',
      label: t('background.education'),
      count: education.entries.length,
      href: '/admin/education',
      error: education.error,
    },
    {
      key: 'certifications',
      label: t('background.certifications'),
      count: certifications.rows.length,
      href: '/admin/certifications',
      error: certifications.error,
    },
    {
      key: 'courses',
      label: t('background.courses'),
      count: courses.rows.length,
      href: '/admin/courses',
      error: courses.error,
    },
    {
      key: 'languages',
      label: t('background.languages'),
      count: languages.languages.length,
      href: '/admin/languages',
      error: languages.error,
    },
  ];

  const checks = readinessChecks({
    profile: profile.profile,
    skills: skills.rows,
    technologies: technologies.rows,
    tools: tools.rows,
    positions: experience.positions,
    projects: projects.projects,
    socialLinks: socialLinks.socialLinks,
  });
  const done = checks.filter((check) => check.done).length;
  const remaining = checks.filter((check) => !check.done);
  const percent = Math.round((done / checks.length) * 100);

  const recent = inbox.messages.slice(0, RECENT_LIMIT);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 @2xl/admin-content:grid-cols-2 @5xl/admin-content:grid-cols-4">
        {stats.map(({ key, ...stat }) => (
          <Stat
            key={key}
            action={t('manage', { name: stat.label })}
            {...stat}
          />
        ))}
      </div>

      {/* Four panels rather than three, so two columns for most of the range
          and four only where there is really room: three plus an orphan is
          what a fourth would otherwise look like on a laptop. */}
      <div className="grid items-start gap-4 @3xl/admin-content:grid-cols-2 @6xl/admin-content:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('profileTitle')}</CardTitle>
            <CardDescription>
              {profile.profile === null
                ? t('profileMissing')
                : t('profileUpdated', {
                    date: format.dateTime(new Date(profile.profile.updatedAt), {
                      dateStyle: 'medium',
                    }),
                  })}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-3">
            <StoredAvatar
              url={photoUrl}
              alt=""
              initials={initials}
              width={48}
              className="size-12 rounded-lg"
              fallbackClassName="rounded-lg"
            />
            <div className="flex min-w-0 flex-col">
              <span className="truncate font-medium" dir="auto">
                {name || email}
              </span>
              <span
                className="truncate text-sm text-muted-foreground"
                dir="auto"
              >
                {localizedValue(profile.profile?.headline, locale) || email}
              </span>
            </div>
          </CardContent>
          <CardFooter className="flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/profile">{t('editProfile')}</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/admin/social-links">
                {t('linkCount', { count: socialLinks.socialLinks.length })}
              </Link>
            </Button>
          </CardFooter>
        </Card>

        {/*
          The one panel that is not a count. The counts say what exists; only
          their absence says what to do next, and a new install otherwise lands
          on a page of zeroes with no order to them.
        */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('readinessTitle')}</CardTitle>
            <CardDescription>
              {t('readinessProgress', { done, total: checks.length })}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Progress
              value={percent}
              aria-label={t('readinessTitle')}
              className="h-2"
            />
            {remaining.length === 0 ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckIcon className="size-4" aria-hidden />
                {t('readinessComplete')}
              </p>
            ) : (
              // Only what is missing: a list of ticks beside a percentage is
              // the same fact said twice, and the rows worth clicking are the
              // ones that are not done.
              <ul className="flex flex-col">
                {remaining.map((check) => (
                  <li key={check.key}>
                    <Link
                      href={check.href}
                      className="-mx-2 flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent"
                    >
                      {t(`readiness.${check.key}` as 'readiness.bio')}
                      <ArrowRightIcon
                        className="size-3.5 shrink-0 text-muted-foreground rtl:rotate-180"
                        aria-hidden
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Background
          title={t('backgroundTitle')}
          description={t('backgroundDescription')}
          rows={background}
        />

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('recentTitle')}</CardTitle>
            <CardDescription>
              {t('unread', { count: inbox.unread })}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-1">
            {inbox.error ? (
              <ErrorText>{errorMessage.response(inbox.error)}</ErrorText>
            ) : recent.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t('recentEmpty')}
              </p>
            ) : (
              <ul className="flex flex-col">
                {recent.map((message) => (
                  <li
                    key={message.id}
                    className="flex flex-col gap-0.5 border-b py-2 first:pt-0 last:border-b-0 last:pb-0"
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className={cn(
                          'min-w-0 flex-1 truncate text-sm',
                          message.read ? 'font-normal' : 'font-medium',
                        )}
                        dir="auto"
                      >
                        {message.subject}
                      </span>
                      {message.read ? null : (
                        <Badge variant="secondary" className="shrink-0">
                          {t('unreadBadge')}
                        </Badge>
                      )}
                    </span>
                    <span className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span className="truncate" dir="auto">
                        {message.name}
                      </span>
                      <time dateTime={message.receivedAt} className="shrink-0">
                        {format.dateTime(new Date(message.receivedAt), {
                          dateStyle: 'medium',
                        })}
                      </time>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
          <CardFooter>
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/messages">{t('viewAll')}</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
