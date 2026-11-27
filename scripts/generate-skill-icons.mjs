/**
 * Generates the vendored skill-icon set in `shared/src/skill-icons.data.ts`.
 *
 *   node scripts/generate-skill-icons.mjs
 *
 * Why vendor rather than depend: `simple-icons` unpacks to ~16 MB and carries
 * over 3,400 icons, of which a portfolio uses perhaps thirty. Depending on it
 * at runtime would put that weight in both the backend image and the browser
 * bundle in order to draw a handful of logos. Generating a curated subset
 * instead keeps the data a committed contract that both packages already share,
 * and leaves `simple-icons` a dev dependency of this script alone.
 *
 * The icon set is CC0; the marks themselves remain their owners' trademarks and
 * are used to identify the technology, which is exactly what this set is for.
 *
 * Adding a technology means adding its slug below and re-running this. An
 * unknown slug fails the run rather than emitting a hole that would render as a
 * blank square months later.
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import prettier from "prettier";
import * as simpleIcons from "simple-icons";

/**
 * Absent on purpose, because simple-icons does not carry them: several well
 * known marks - AWS, Visual Studio Code, Slack, Playwright, OpenAI, Heroku,
 * Twilio, C#, PHPUnit, and LinkedIn - were removed upstream after trademark
 * requests, and no substitute exists. LinkedIn is why the social-links table
 * draws a generic mark when a platform has no vendored logo, rather than
 * assuming every platform has one. Re-adding them here only fails the run. They are the
 * reason the custom upload path is not optional: the preset set is broad, not
 * complete.
 *
 * The technologies a developer portfolio plausibly lists, plus the social
 * platforms it links to. Grouped only for readability - the categories a skill
 * can hold live in `validation-rules.ts` and are chosen per skill, not implied
 * by its logo.
 */
const SLUGS = [
  // Languages
  "javascript",
  "typescript",
  "python",
  "php",
  "go",
  "rust",
  "ruby",
  "kotlin",
  "swift",
  "dart",
  "scala",
  "elixir",
  "lua",
  "perl",
  "r",
  "haskell",
  "clojure",
  "c",
  "cplusplus",
  "gnubash",
  "ocaml",
  "erlang",
  "julia",
  "zig",

  // Frontend frameworks and libraries
  "react",
  "vuedotjs",
  "angular",
  "svelte",
  "nextdotjs",
  "nuxt",
  "astro",
  "remix",
  "solid",
  "qwik",
  "preact",
  "alpinedotjs",
  "htmx",
  "lit",
  "emberdotjs",
  "backbonedotjs",
  "jquery",
  "redux",
  "reactquery",
  "mobx",
  "pinia",
  "vite",
  "webpack",
  "rollupdotjs",
  "esbuild",
  "babel",
  "turborepo",

  // Markup, styling and design
  "html5",
  "css",
  "sass",
  "less",
  "stylus",
  "tailwindcss",
  "bootstrap",
  "bulma",
  "chakraui",
  "mui",
  "radixui",
  "shadcnui",
  "styledcomponents",
  "storybook",
  "figma",
  "sketch",
  "framer",
  "blender",

  // Backend frameworks and runtimes
  "nodedotjs",
  "deno",
  "bun",
  "express",
  "nestjs",
  "fastify",
  "koa",
  "laravel",
  "symfony",
  "django",
  "flask",
  "fastapi",
  "rubyonrails",
  "spring",
  "springboot",
  "dotnet",
  "phoenixframework",
  "gin",
  "strapi",
  "graphql",
  "apollographql",
  "trpc",
  "socketdotio",
  "prisma",
  "sequelize",
  "drizzle",
  "hibernate",

  // Databases, caches and search
  "mongodb",
  "mongoose",
  "mysql",
  "postgresql",
  "sqlite",
  "mariadb",
  "redis",
  "elasticsearch",
  "opensearch",
  "apachecassandra",
  "couchbase",
  "neo4j",
  "influxdb",
  "supabase",
  "firebase",
  "planetscale",
  "cockroachlabs",
  "clickhouse",
  "duckdb",
  "apachekafka",
  "rabbitmq",
  "natsdotio",

  // Cloud, infrastructure and CI
  "docker",
  "kubernetes",
  "terraform",
  "ansible",
  "vagrant",
  "helm",
  "googlecloud",
  "digitalocean",
  "akamai",
  "vultr",
  "vercel",
  "netlify",
  "cloudflare",
  "railway",
  "render",
  "flydotio",
  "nginx",
  "apache",
  "traefikproxy",
  "caddy",
  "pm2",
  "githubactions",
  "gitlab",
  "jenkins",
  "circleci",
  "travisci",
  "argo",
  "prometheus",
  "grafana",
  "sentry",
  "datadog",
  "elastic",

  // Operating systems and shells
  "linux",
  "ubuntu",
  "debian",
  "fedora",
  "archlinux",
  "redhat",
  "alpinelinux",
  "apple",
  "gnu",
  "zsh",

  // Tooling, testing and workflow
  "git",
  "github",
  "bitbucket",
  "npm",
  "yarn",
  "pnpm",
  "eslint",
  "prettier",
  "jest",
  "vitest",
  "testinglibrary",
  "cypress",
  "puppeteer",
  "mocha",
  "chai",
  "pytest",
  "selenium",
  "sonarqubecloud",
  "postman",
  "insomnia",
  "swagger",
  "openapiinitiative",
  "jira",
  "confluence",
  "notion",
  "trello",
  "linear",
  "asana",
  "neovim",
  "vim",
  "jetbrains",
  "intellijidea",
  "phpstorm",
  "webstorm",
  "pycharm",
  "androidstudio",
  "xcode",
  "sublimetext",

  // Mobile and desktop
  "flutter",
  "reactivex",
  "ionic",
  "capacitor",
  "electron",
  "tauri",
  "android",
  "qt",
  "gtk",

  // Content, commerce and services
  "wordpress",
  "drupal",
  "contentful",
  "sanity",
  "ghost",
  "shopify",
  "woocommerce",
  "stripe",
  "paypal",
  "auth0",
  "okta",
  "keycloak",
  "algolia",
  "cloudinary",
  "mailchimp",

  // Data and machine learning
  "pandas",
  "numpy",
  "scipy",
  "scikitlearn",
  "tensorflow",
  "pytorch",
  "keras",
  "opencv",
  "jupyter",
  "anaconda",
  "apachespark",
  "apacheairflow",
  "huggingface",
  "langchain",

  // Social platforms. Not skills: these draw the social-links table, where a
  // row saying "GitHub" beside a URL is a row you have to read to recognise.
  // They live in the same set because the set is "brand marks we vendor", and
  // a second generator emitting a second file to hold six more paths would be
  // two things to keep in step instead of one.
  //
  // `github`, `gitlab`, `bitbucket`, `docker`, `npm`, `huggingface`, `figma`
  // and `notion` are already listed above as tooling, and a slug listed twice
  // fails the run - so the platforms that share a mark with a tool are not
  // repeated here.
  "codeberg",
  "stackoverflow",
  "devdotto",
  "freecodecamp",
  "hashnode",
  "medium",
  "substack",
  "kaggle",
  "leetcode",
  "x",
  "mastodon",
  "bluesky",
  "threads",
  "facebook",
  "instagram",
  "tiktok",
  "youtube",
  "twitch",
  "discord",
  "telegram",
  "reddit",
  "dribbble",
  "behance",
  "producthunt",
];

const byName = new Map(
  Object.values(simpleIcons)
    .filter((icon) => icon && typeof icon === "object" && "slug" in icon)
    .map((icon) => [icon.slug, icon]),
);

const unknown = SLUGS.filter((slug) => !byName.has(slug));

if (unknown.length > 0) {
  console.error(
    `Not in simple-icons - a typo, or renamed upstream:\n  ${unknown.join("\n  ")}`,
  );
  process.exit(1);
}

const duplicates = SLUGS.filter((slug, index) => SLUGS.indexOf(slug) !== index);

if (duplicates.length > 0) {
  console.error(`Listed twice: ${[...new Set(duplicates)].join(", ")}`);
  process.exit(1);
}

// Sorted by title so the picker is browsable without sorting at runtime.
const entries = SLUGS.map((slug) => byName.get(slug))
  .map(({ slug, title, hex, path }) => ({ slug, title, hex, path }))
  .sort((a, b) => a.title.localeCompare(b.title, "en"));

/**
 * Formatted through Prettier on the way out, so the committed file satisfies
 * `format:check` like everything else. Exempting generated code from the
 * project's own formatting would only mean noticing the exemption every time
 * someone opens it.
 */
const write = async (name, contents) => {
  const target = fileURLToPath(
    new URL(`../shared/src/${name}`, import.meta.url),
  );
  const config = await prettier.resolveConfig(target);

  writeFileSync(
    target,
    await prettier.format(contents, { ...config, filepath: target }),
  );
};

/**
 * Two files, because the two packages need different halves of this.
 *
 * The backend only ever asks "is this a slug we know?", and pulling 300 kB of
 * path data into an API process to answer that would be absurd. The picker is
 * the only thing that draws the logos, so the drawings live behind a subpath
 * the picker imports and nothing else does.
 */
const slugList = entries
  .map(({ slug }) => `  ${JSON.stringify(slug)},`)
  .join("\n");

await write(
  "skill-icon-slugs.ts",
  `/**
 * Every preset logo's slug - GENERATED, do not edit.
 *
 * Run \`node scripts/generate-skill-icons.mjs\` to regenerate.
 *
 * The names alone, with none of the drawings: this is what validation needs on
 * both sides of the wire, and it is small enough to sit in the shared barrel.
 * The paths live in \`skill-icons.data.ts\`, behind its own subpath, because only
 * the picker draws them.
 */

export const SKILL_ICON_SLUGS = [
${slugList}
] as const;

export type SkillIconSlug = (typeof SKILL_ICON_SLUGS)[number];
`,
);

const definitions = entries
  .map(
    ({ slug, title, hex, path }) =>
      `  {\n    slug: ${JSON.stringify(slug)},\n    title: ${JSON.stringify(title)},\n    hex: ${JSON.stringify(hex)},\n    path: ${JSON.stringify(path)},\n  },`,
  )
  .join("\n");

await write(
  "skill-icons.data.ts",
  `/**
 * Brand logos for skills - GENERATED, do not edit.
 *
 * Run \`node scripts/generate-skill-icons.mjs\` to regenerate after changing the
 * slug list in that script. Vendored from simple-icons (CC0); each mark remains
 * its owner's trademark and identifies the technology it names.
 *
 * \`path\` is the \`d\` attribute of a single path on a 24×24 viewBox, which is how
 * the whole set is drawn. \`hex\` is the brand colour, without the \`#\`.
 *
 * Reached through \`@portfolio/shared/skill-icons\` rather than the barrel: it is
 * 300 kB, and only the admin's icon picker has any use for it.
 */
import type { SkillIconSlug } from './skill-icon-slugs.js';

export type SkillIconDefinition = {
  slug: SkillIconSlug;
  title: string;
  hex: string;
  path: string;
};

export const SKILL_ICONS: readonly SkillIconDefinition[] = [
${definitions}
];
`,
);

console.log(`Wrote ${entries.length} icons`);
