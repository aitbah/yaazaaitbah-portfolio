import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { optionIndex, optionText } from '@/features/option/option-text';
import {
  absoluteImage,
  displayName,
  type PublicProfile,
} from '@/features/profile/public-profile';
import { SiteLoader } from '@/features/site/loader/site-loader';
import { MarkSprite } from '@/features/site/mark-sprite';
import { HomeMotion } from '@/features/site/motion/home-motion';
import { ContactSection } from '@/features/site/sections/contact-section';
import { ExpertiseSection } from '@/features/site/sections/expertise-section';
import { Hero } from '@/features/site/sections/hero';
import { PathSection } from '@/features/site/sections/path-section';
import { ProfileSection } from '@/features/site/sections/profile-section';
import { RecordSection } from '@/features/site/sections/record-section';
import { SiteFooter } from '@/features/site/sections/site-footer';
import { WorkSection } from '@/features/site/sections/work-section';
import { readSiteContent } from '@/features/site/site-content';
import { SiteHeader } from '@/features/site/site-header';
import { SiteCompanion } from '@/features/site/site-companion';
import { NAV_SECTIONS, visibleSections } from '@/features/site/site-sections';
import { localizedValue } from '@/i18n/localized-value';
import { resolveLocale } from '@/i18n/locale-params';
import { routing } from '@/i18n/routing';
import { storedFileExists } from '@/lib/server-api';
import {
  localeAlternates,
  openGraphAlternateLocales,
  openGraphLocale,
  siteUrl,
} from '@/lib/site';

/** Title and description from the profile; translations if the API is down. */
export async function generateMetadata({
  params,
}: PageProps<'/[locale]'>): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: 'metadata' });
  // Memoized: the same read the page makes.
  const { profile } = await readSiteContent();

  const name = displayName(profile, locale);
  const title = name || t('title');
  const description =
    localizedValue(profile?.headline, locale) || t('description');
  const image = absoluteImage(profile?.photoUrl);

  return {
    metadataBase: new URL(siteUrl()),
    title,
    description,
    alternates: {
      canonical: `/${locale}`,
      languages: localeAlternates(),
    },
    openGraph: {
      type: 'profile',
      title,
      description,
      url: `/${locale}`,
      locale: openGraphLocale(locale),
      alternateLocale: openGraphAlternateLocales(locale),
      ...(image ? { images: [image] } : {}),
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title,
      description,
      ...(image ? { images: [image] } : {}),
    },
  };
}

/** `Person` structured data, only when there is a real profile. */
function personJsonLd(profile: PublicProfile, locale: string) {
  const image = absoluteImage(profile.photoUrl);

  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: displayName(profile, locale),
    url: `${siteUrl()}/${locale}`,
    ...(localizedValue(profile.headline, locale)
      ? { jobTitle: localizedValue(profile.headline, locale) }
      : {}),
    ...(localizedValue(profile.bio, locale)
      ? { description: localizedValue(profile.bio, locale) }
      : {}),
    ...(image ? { image } : {}),
  };
}

/**
 * The home page: the owner's portrait and name, then the profile, the work, the
 * expertise, the path, the record and a way to write - every section rendered
 * on the server from the API, and only when it has content. The motion layer
 * moves what is already there; without it the page is complete.
 */
export default async function HomePage({ params }: PageProps<'/[locale]'>) {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: 'home' });
  const meta = await getTranslations({ locale, namespace: 'metadata' });
  const content = await readSiteContent();
  const {
    profile,
    projects,
    skills,
    technologies,
    tools,
    experience,
    education,
    certifications,
    courses,
    languages,
    socialLinks,
    options,
  } = content;
  const text = optionText(options, locale);
  const sections = visibleSections(content);
  const firstName = localizedValue(profile?.firstName, locale);
  const lastName = localizedValue(profile?.lastName, locale);
  const name = displayName(profile, locale) || meta('title');
  const location = localizedValue(profile?.contact?.location, locale);
  const availability = profile?.contact?.availability
    ? text('availability-status', profile.contact.availability)
    : '';
  const bio = localizedValue(profile?.bio, locale)
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const photo = profile?.photoUrl
    ? {
        url: profile.photoUrl,
        alt: localizedValue(profile.photoAlt, locale) || name,
      }
    : undefined;
  // The CV in the reader's language, else the default one, offered only when its file answers.
  const resumeLanguage = profile?.resume?.[locale]
    ? locale
    : routing.defaultLocale;
  const resumePath = localizedValue(profile?.resume, locale);
  const resume =
    resumePath && (await storedFileExists(resumePath))
      ? { href: resumePath, language: resumeLanguage }
      : undefined;

  return (
    <>
      {/* First, so the cover is in place before anything beneath it paints. */}
      <SiteLoader
        name={name}
        headline={localizedValue(profile?.headline, locale)}
        portrait={Boolean(photo)}
      />

      {profile ? (
        <script
          type="application/ld+json"
          // `<` escaped so no text field can close the tag.
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(personJsonLd(profile, locale)).replace(
              /</g,
              '\\u003c',
            ),
          }}
        />
      ) : null}

      <SiteHeader
        name={name}
        sections={NAV_SECTIONS.filter((section) => sections.includes(section))}
        locale={locale}
        resume={resume}
      />

      <main id="main">
        <Hero
          firstName={firstName || name}
          lastName={lastName}
          headline={localizedValue(profile?.headline, locale)}
          photo={photo}
          facts={[
            ...(location
              ? [{ label: t('hero.basedIn'), value: location }]
              : []),
            ...(availability && profile?.contact?.availability
              ? [
                  {
                    label: t('hero.status'),
                    value: availability,
                    open: profile.contact.availability.startsWith('open'),
                  },
                ]
              : []),
          ]}
          actions={{
            work: sections.includes('work') ? t('hero.work') : undefined,
            contact: t('hero.contact'),
          }}
        />

        {sections.includes('about') ? (
          <ProfileSection title={t('profile.title')} paragraphs={bio} />
        ) : null}

        {sections.includes('work') ? (
          <WorkSection
            projects={projects}
            expertise={[...technologies, ...tools]}
            locale={locale}
          />
        ) : null}

        {sections.includes('expertise') ? (
          <ExpertiseSection
            rows={{ skills, technologies, tools }}
            optionText={text}
            locale={locale}
          />
        ) : null}

        {sections.includes('path') ? (
          <PathSection
            experience={experience}
            education={education}
            optionText={text}
            locale={locale}
            today={new Date()}
          />
        ) : null}

        {sections.includes('record') ? (
          <RecordSection
            credentials={[...certifications, ...courses]}
            languages={languages}
            options={options}
            optionText={text}
            locale={locale}
          />
        ) : null}

        <ContactSection
          locale={locale}
          email={profile?.contact?.email}
          location={location}
          availability={availability}
          resume={resume}
          socialLinks={socialLinks}
          options={options}
          optionText={text}
        />
      </main>

      <SiteFooter
        locale={locale}
        firstName={firstName || name}
        lastName={lastName}
        updatedAt={profile?.updatedAt}
        email={profile?.contact?.email}
        resume={resume}
        location={location}
        availability={availability}
        sections={NAV_SECTIONS.filter((section) => sections.includes(section))}
        socialLinks={socialLinks}
        options={options}
        optionText={text}
      />

      <MarkSprite
        slugs={[
          ...[...skills, ...technologies, ...tools].map((row) =>
            row.icon?.kind === 'preset' ? row.icon.value : undefined,
          ),
          ...socialLinks.map(
            (link) =>
              optionIndex(options)('social-platform', link.platform)?.icon,
          ),
        ]}
      />
      <SiteCompanion label={t('nav.talk')} />
      <HomeMotion />
    </>
  );
}
