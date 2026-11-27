import type { CredentialKind, LanguageCode } from '@portfolio/shared';

/**
 * The content the seeder writes: the owner's own, as on the live site, so
 * development and tests run on what visitors see. Preset logos are checked
 * against the vendored set before anything is written.
 */

/**
 * Text stored as a localized map. A bare string is the default locale alone -
 * most of this file, on purpose, so the seed shows the fallback as well as
 * translations. Proper nouns are never translated.
 */
export type SeedText = string | { en: string; fr: string; ar: string };

/** Ordered as they should appear within their kind; position becomes `order`. */
export type SeedSkill = {
  name: SeedText;
  category: string;
  level: number;
};

/**
 * Capabilities and methodologies. No logos: there is no brand mark for
 * "Problem Solving", which is exactly why the skill shape has no icon field.
 */
export const SEED_SKILLS: SeedSkill[] = [
  {
    name: {
      en: 'Full-stack web development',
      fr: 'Développement web full-stack',
      ar: 'تطوير الويب المتكامل',
    },
    category: 'engineering',
    level: 85,
  },
  {
    name: {
      en: 'REST API design',
      fr: "Conception d'API REST",
      ar: 'تصميم واجهات REST',
    },
    category: 'architecture',
    level: 80,
  },
  {
    name: {
      en: 'Working end to end, alone',
      fr: 'Travail de bout en bout, en autonomie',
      ar: 'العمل من الطرف إلى الطرف بشكل مستقل',
    },
    category: 'delivery',
    level: 80,
  },
  {
    name: {
      en: 'Git and GitHub',
      fr: 'Git et GitHub',
      ar: 'Git وGitHub',
    },
    category: 'collaboration',
    level: 80,
  },
  {
    name: {
      en: 'Application architecture',
      fr: 'Architecture applicative',
      ar: 'بنية التطبيقات',
    },
    category: 'architecture',
    level: 75,
  },
  {
    name: {
      en: 'Internationalisation and right-to-left interfaces',
      fr: 'Internationalisation et interfaces de droite à gauche',
      ar: 'التعريب وواجهات من اليمين إلى اليسار',
    },
    category: 'engineering',
    level: 75,
  },
  {
    name: {
      en: 'Database modelling',
      fr: 'Modélisation de données',
      ar: 'نمذجة قواعد البيانات',
    },
    category: 'data',
    level: 70,
  },
  {
    name: {
      en: 'Automated testing',
      fr: 'Tests automatisés',
      ar: 'الاختبارات الآلية',
    },
    category: 'quality',
    level: 70,
  },
  {
    name: {
      en: 'Web application security',
      fr: 'Sécurité des applications web',
      ar: 'أمن تطبيقات الويب',
    },
    category: 'security',
    level: 70,
  },
  {
    name: {
      en: 'Learning a business domain',
      fr: "Apprentissage d'un domaine métier",
      ar: 'تعلّم مجال العمل',
    },
    category: 'product',
    level: 70,
  },
  {
    name: {
      en: 'Technical writing',
      fr: 'Rédaction technique',
      ar: 'الكتابة التقنية',
    },
    category: 'communication',
    level: 70,
  },
  {
    name: {
      en: 'Deployment and server administration',
      fr: 'Déploiement et administration serveur',
      ar: 'النشر وإدارة الخوادم',
    },
    category: 'operations',
    level: 65,
  },
  {
    name: {
      en: 'Accessibility',
      fr: 'Accessibilité',
      ar: 'إتاحة الوصول',
    },
    category: 'quality',
    level: 65,
  },
  {
    name: {
      en: 'Agile / Scrum',
      fr: 'Agile / Scrum',
      ar: 'أجايل / سكرم',
    },
    category: 'delivery',
    level: 55,
  },
];

export type SeedTechnology = {
  name: string;
  category: string;
  level: number;
  /** A preset logo; absent where the brand has none in the set. */
  icon?: string;
};

/** Languages, frameworks and stores - the things a project is built out of. */
export const SEED_TECHNOLOGIES: SeedTechnology[] = [
  {
    name: 'JavaScript',
    category: 'language',
    level: 85,
    icon: 'javascript',
  },
  {
    name: 'TypeScript',
    category: 'language',
    level: 75,
    icon: 'typescript',
  },
  {
    name: 'PHP',
    category: 'language',
    level: 75,
    icon: 'php',
  },
  {
    name: 'HTML5',
    category: 'language',
    level: 85,
    icon: 'html5',
  },
  {
    name: 'CSS',
    category: 'language',
    level: 80,
    icon: 'css',
  },
  {
    name: 'React',
    category: 'frontend',
    level: 85,
    icon: 'react',
  },
  {
    name: 'Next.js',
    category: 'frontend',
    level: 75,
    icon: 'nextdotjs',
  },
  {
    name: 'Vue.js',
    category: 'frontend',
    level: 60,
    icon: 'vuedotjs',
  },
  {
    name: 'Tailwind CSS',
    category: 'frontend',
    level: 85,
    icon: 'tailwindcss',
  },
  {
    name: 'shadcn/ui',
    category: 'frontend',
    level: 80,
    icon: 'shadcnui',
  },
  {
    name: 'Radix UI',
    category: 'frontend',
    level: 70,
    icon: 'radixui',
  },
  {
    name: 'Redux Toolkit',
    category: 'frontend',
    level: 70,
    icon: 'redux',
  },
  {
    name: 'TanStack Query',
    category: 'frontend',
    level: 80,
    icon: 'reactquery',
  },
  {
    name: 'Vite',
    category: 'frontend',
    level: 65,
    icon: 'vite',
  },
  {
    name: 'Bootstrap',
    category: 'frontend',
    level: 60,
    icon: 'bootstrap',
  },
  {
    name: 'Laravel',
    category: 'backend',
    level: 75,
    icon: 'laravel',
  },
  {
    name: 'Node.js',
    category: 'backend',
    level: 75,
    icon: 'nodedotjs',
  },
  {
    name: 'Express',
    category: 'backend',
    level: 75,
    icon: 'express',
  },
  {
    name: 'Inertia.js',
    category: 'backend',
    level: 55,
  },
  {
    name: 'Mongoose',
    category: 'backend',
    level: 70,
    icon: 'mongoose',
  },
  {
    name: 'MySQL',
    category: 'database',
    level: 70,
    icon: 'mysql',
  },
  {
    name: 'MongoDB',
    category: 'database',
    level: 70,
    icon: 'mongodb',
  },
  {
    name: 'PostgreSQL',
    category: 'database',
    level: 60,
    icon: 'postgresql',
  },
  {
    name: 'Laravel Sanctum',
    category: 'security',
    level: 70,
  },
  {
    name: 'JSON Web Tokens',
    category: 'security',
    level: 65,
  },
  {
    name: 'Zod',
    category: 'api',
    level: 75,
  },
  {
    name: 'Axios',
    category: 'api',
    level: 75,
  },
  {
    name: 'React Hook Form',
    category: 'frontend',
    level: 75,
  },
  {
    name: 'Laravel Reverb',
    category: 'messaging',
    level: 65,
  },
  {
    name: 'Pusher',
    category: 'messaging',
    level: 60,
  },
  {
    name: 'WebSocket',
    category: 'messaging',
    level: 65,
  },
];

export type SeedTool = {
  name: string;
  category: string;
  level: number;
  /** A preset logo; absent where the brand has none in the set. */
  icon?: string;
};

/** Software you operate, rather than build with. */
export const SEED_TOOLS: SeedTool[] = [
  {
    name: 'Git',
    category: 'versioning',
    level: 85,
    icon: 'git',
  },
  {
    name: 'GitHub',
    category: 'versioning',
    level: 80,
    icon: 'github',
  },
  {
    name: 'VS Code',
    category: 'editor',
    level: 85,
  },
  {
    name: 'Docker',
    category: 'containers',
    level: 75,
    icon: 'docker',
  },
  {
    name: 'Docker Compose',
    category: 'containers',
    level: 75,
    icon: 'docker',
  },
  {
    name: 'Linux',
    category: 'infrastructure',
    level: 70,
    icon: 'linux',
  },
  {
    name: 'Ubuntu',
    category: 'infrastructure',
    level: 70,
    icon: 'ubuntu',
  },
  {
    name: 'Caddy',
    category: 'infrastructure',
    level: 60,
    icon: 'caddy',
  },
  {
    name: 'Cloudflare',
    category: 'infrastructure',
    level: 55,
    icon: 'cloudflare',
  },
  {
    name: 'Postman',
    category: 'api',
    level: 70,
    icon: 'postman',
  },
  {
    name: 'npm',
    category: 'devops',
    level: 80,
    icon: 'npm',
  },
  {
    name: 'GitHub Actions',
    category: 'ci-cd',
    level: 65,
    icon: 'githubactions',
  },
  {
    name: 'Vitest',
    category: 'testing',
    level: 70,
    icon: 'vitest',
  },
  {
    name: 'Playwright',
    category: 'testing',
    level: 70,
  },
  {
    name: 'ESLint',
    category: 'ci-cd',
    level: 75,
    icon: 'eslint',
  },
  {
    name: 'Prettier',
    category: 'ci-cd',
    level: 75,
    icon: 'prettier',
  },
];

export type SeedExperience = {
  role: SeedText;
  organisation: SeedText;
  location: SeedText;
  employmentType: string;
  startDate: string;
  endDate?: string;
  current: boolean;
  description: SeedText;
};

/** The owner's career. The API sorts it by date, so the order here does not matter. */
export const SEED_EXPERIENCE: SeedExperience[] = [
  {
    role: {
      en: 'Full-Stack Web Developer',
      fr: 'Développeur web full-stack',
      ar: 'مطوّر ويب متكامل',
    },
    organisation: 'Neo Expertise',
    location: {
      en: 'Casablanca-Settat, Morocco',
      fr: 'Casablanca-Settat, Maroc',
      ar: 'الدار البيضاء-سطات، المغرب',
    },
    employmentType: 'full-time',
    startDate: '2026-07',
    current: true,
    description: {
      en: "I build a SaaS platform for accounting and business management, bringing accounting, chart-of-accounts management, sales, inventory and company management together in one application. It is built with Laravel, Vue.js, Inertia.js and PostgreSQL, developed on Linux/Ubuntu with Git and GitHub. A good part of the work is learning the accounting side well enough to turn the company's requirements into features that fit them.",
      fr: "Je développe une plateforme SaaS de comptabilité et de gestion d'entreprise, qui réunit la comptabilité, la gestion du plan comptable, les ventes, les stocks et la gestion de l'entreprise dans une seule application. Elle est construite avec Laravel, Vue.js, Inertia.js et PostgreSQL, développée sous Linux/Ubuntu avec Git et GitHub. Une bonne part du travail consiste à apprendre la comptabilité assez bien pour traduire les besoins de l'entreprise en fonctionnalités qui leur correspondent.",
      ar: 'أطوّر منصّة SaaS للمحاسبة وتدبير الشركات، تجمع المحاسبة وتدبير المخطّط المحاسبي والمبيعات والمخزون وتدبير الشركة في تطبيق واحد. بُنيت بـLaravel وVue.js وInertia.js وPostgreSQL، وتُطوَّر على Linux/Ubuntu باستعمال Git وGitHub. وجزء مهم من العمل هو تعلّم المحاسبة بما يكفي لتحويل حاجيات الشركة إلى خصائص تناسبها.',
    },
  },
];

export type SeedProject = {
  title: SeedText;
  description: SeedText;
  /** Technology and tool names, resolved to ids when written. */
  stack: string[];
  repoUrl?: string;
  liveUrl?: string;
  featured: boolean;
  /** How many gallery images to generate beside the cover. */
  galleryCount: number;
  /**
   * The four story fields, which the form asks for and the seed used to leave
   * empty - so a seeded project rendered as a title, a picture and a sentence,
   * and the half of the editor that asks what you actually *did* looked
   * optional. The admin's own hint says the approach is worth the most: name
   * the decision and the obvious alternative you rejected. These follow it.
   */
  role: SeedText;
  problem: SeedText;
  approach: SeedText;
  outcome: SeedText;
};

export const SEED_PROJECTS: SeedProject[] = [
  {
    title: 'Digitalgardn',
    description: {
      en: 'A marketplace that connects freelancers and clients: a Laravel REST API and a React interface, built on my own. Freelancers publish services, clients order and pay from a wallet, the two talk in real time, and an administration area runs the platform.',
      fr: "Une plateforme de mise en relation entre freelances et clients : une API REST Laravel et une interface React, développées seul. Les freelances publient des services, les clients commandent et paient depuis un portefeuille, les deux échangent en temps réel, et un espace d'administration pilote la plateforme.",
      ar: 'منصّة تجمع المستقلّين بالعملاء: واجهة برمجة REST بـLaravel وواجهة بـReact، أنجزتُهما وحدي. ينشر المستقلّون خدماتهم، ويطلب العملاء ويؤدّون من محفظة، ويتحادث الطرفان فوريًّا، ويُدير المنصّةَ فضاءٌ للإدارة.',
    },
    stack: [
      'Laravel',
      'PHP',
      'MySQL',
      'Laravel Sanctum',
      'Laravel Reverb',
      'Pusher',
      'React',
      'Vite',
      'Redux Toolkit',
      'TanStack Query',
      'React Hook Form',
      'Zod',
      'Axios',
      'Tailwind CSS',
      'shadcn/ui',
      'WebSocket',
    ],
    repoUrl: 'https://github.com/aitbah/digitalgardn-backend',
    featured: true,
    galleryCount: 0,
    role: {
      en: 'Sole developer, backend and frontend, from the first line to the last.',
      fr: 'Seul développeur, backend et frontend, de la première à la dernière ligne.',
      ar: 'المطوّر الوحيد، للواجهة الخلفية والأمامية، من أوّل سطر إلى آخره.',
    },
    problem: {
      en: 'A marketplace is not one application but several that must agree: a catalogue, an order with a state machine, money held in a wallet, a conversation, and an administration area over all of it. Each one can be built alone; the difficulty is that an order changing state has to move money, open a conversation and reach two browsers at once.',
      fr: "Une place de marché n'est pas une application mais plusieurs qui doivent s'accorder : un catalogue, une commande avec sa machine à états, de l'argent dans un portefeuille, une conversation, et un espace d'administration au-dessus. Chacune se construit seule ; la difficulté est qu'une commande qui change d'état doit déplacer de l'argent, ouvrir une conversation et atteindre deux navigateurs à la fois.",
      ar: 'المنصّة ليست تطبيقًا واحدًا بل تطبيقات يجب أن تتوافق: كتالوغ، وطلب بآلة حالات، ومال في محفظة، ومحادثة، وفضاء إدارة فوق ذلك كلّه. كلٌّ منها يُبنى وحده؛ والصعوبة أنّ طلبًا يغيّر حالته عليه أن يحرّك المال ويفتح محادثة ويصل إلى متصفّحين في الوقت نفسه.',
    },
    approach: {
      en: "Status transitions are validated against the caller's role rather than trusted from the client, and each one raises an event that the wallet, the conversation and both browsers listen to — Laravel Reverb over private channels, with the frontend cache invalidated by the same event. The obvious alternative, polling and letting the client decide what a seller may do, was rejected: it puts the rule in the place least able to enforce it.",
      fr: "Les transitions de statut sont validées contre le rôle de l'appelant plutôt que crues sur parole, et chacune émet un événement qu'écoutent le portefeuille, la conversation et les deux navigateurs — Laravel Reverb sur des canaux privés, avec le cache frontend invalidé par ce même événement. L'alternative évidente, du polling et un client qui décide ce qu'un vendeur peut faire, a été écartée : elle met la règle là où elle est le moins applicable.",
      ar: 'تُتحقَّق انتقالات الحالة انطلاقًا من دور المُنادي لا ثقةً بالعميل، ويُطلق كلُّ انتقال حدثًا تُنصت إليه المحفظةُ والمحادثةُ والمتصفّحان — عبر Laravel Reverb على قنوات خاصّة، مع إبطال ذاكرة الواجهة بالحدث نفسه. أمّا البديل البديهي، أي الاستقصاء المتكرّر وترك العميل يقرّر ما يحقّ للبائع، فقد استُبعد: لأنّه يضع القاعدة في أقلّ موضع قادر على فرضها.',
    },
    outcome: {
      en: 'The platform covers the whole path: registration, a public catalogue, an order, payment from the wallet, a conversation, a review, and an administration area with statistics and moderation. It is published under the MIT licence and the code is public.',
      fr: "La plateforme couvre tout le parcours : inscription, catalogue public, commande, paiement depuis le portefeuille, conversation, avis, et un espace d'administration avec statistiques et modération. Elle est publiée sous licence MIT et le code est public.",
      ar: 'تغطّي المنصّة المسار كاملًا: التسجيل، وكتالوغ عمومي، وطلب، وأداء من المحفظة، ومحادثة، وتقييم، وفضاء إدارة بإحصاءات وتدبير للمحتوى. نُشرت برخصة MIT وشيفرتها عمومية.',
    },
  },
  {
    title: 'This portfolio',
    description: {
      en: 'The site you are reading: a Next.js front end, an Express API and MongoDB, in English, French and Arabic, with an administration area that manages every word on it. Built, tested and deployed to a VPS end to end.',
      fr: "Le site que vous lisez : un frontend Next.js, une API Express et MongoDB, en anglais, français et arabe, avec un espace d'administration qui gère chacun de ses mots. Construit, testé et déployé sur un VPS de bout en bout.",
      ar: 'الموقع الذي تقرؤه: واجهة بـNext.js، وواجهة برمجة بـExpress، وMongoDB، بالإنجليزية والفرنسية والعربية، مع فضاء إدارة يتحكّم في كلّ كلمة فيه. بُني واختُبر ونُشر على خادم خاصّ من الطرف إلى الطرف.',
    },
    stack: [
      'TypeScript',
      'Next.js',
      'React',
      'Tailwind CSS',
      'shadcn/ui',
      'Radix UI',
      'TanStack Query',
      'React Hook Form',
      'Zod',
      'Node.js',
      'Express',
      'MongoDB',
      'Mongoose',
      'JSON Web Tokens',
      'Docker',
      'Docker Compose',
      'Caddy',
      'Vitest',
      'Playwright',
      'GitHub Actions',
      'Linux',
    ],
    liveUrl: 'https://aitbah.com',
    featured: true,
    galleryCount: 0,
    role: {
      en: 'Everything: the design, the frontend, the API, the database, the tests, the deployment.',
      fr: "Tout : le design, le frontend, l'API, la base de données, les tests, le déploiement.",
      ar: 'كلّ شيء: التصميم، والواجهة، وواجهة البرمجة، وقاعدة البيانات، والاختبارات، والنشر.',
    },
    problem: {
      en: 'Three languages, one of them read right to left, and every word on the page stored rather than written in the code — so that adding a language is content and configuration, never a schema change.',
      fr: "Trois langues, dont une qui se lit de droite à gauche, et chaque mot de la page stocké plutôt qu'écrit dans le code — pour qu'ajouter une langue soit du contenu et de la configuration, jamais un changement de schéma.",
      ar: 'ثلاث لغات، إحداها تُقرأ من اليمين إلى اليسار، وكلّ كلمة في الصفحة مخزّنة لا مكتوبة في الشيفرة — حتى تصير إضافةُ لغةٍ محتوًى وإعدادًا، لا تغييرًا في البنية.',
    },
    approach: {
      en: 'Every stored string is a map keyed by locale with only the default required, and the layout uses logical properties throughout rather than left and right. The alternative — a column per language — was rejected because it makes a fourth language a migration instead of a folder.',
      fr: "Chaque chaîne stockée est une table indexée par langue dont seule la langue par défaut est requise, et la mise en page utilise partout des propriétés logiques plutôt que gauche et droite. L'alternative — une colonne par langue — a été écartée : elle ferait d'une quatrième langue une migration au lieu d'un dossier.",
      ar: 'كلّ نصّ مخزَّن هو خريطة مفاتيحُها اللغات، لا يُشترط منها إلّا الافتراضية، والتخطيط يستعمل الخصائص المنطقية في كلّ موضع بدل اليمين واليسار. أمّا البديل — عمود لكلّ لغة — فاستُبعد لأنّه يجعل اللغةَ الرابعة ترحيلًا بدل أن تكون مجلّدًا.',
    },
    outcome: {
      en: 'Live on a VPS behind a reverse proxy with automatic TLS, the administration area on a host of its own, and a test suite of over 1,500 cases that runs on every push.',
      fr: "En ligne sur un VPS derrière un reverse proxy avec TLS automatique, l'espace d'administration sur son propre domaine, et une suite de plus de 1 500 tests qui tourne à chaque push.",
      ar: 'يعمل على خادم خاصّ خلف وسيط عكسي بشهادات تلقائية، وفضاءُ الإدارة على نطاق خاصّ به، ومجموعةُ اختبارات تتجاوز 1500 حالة تعمل مع كلّ دفعة.',
    },
  },
];

export const SEED_SOCIAL_LINKS: { platform: string; url: string }[] = [
  {
    platform: 'github',
    url: 'https://github.com/aitbah',
  },
  {
    platform: 'freecodecamp',
    url: 'https://www.freecodecamp.org/aitbah',
  },
];

export type SeedEducation = {
  institution: SeedText;
  qualification: SeedText;
  fieldOfStudy?: SeedText;
  level: string;
  location: SeedText;
  startDate: string;
  endDate?: string;
  current: boolean;
  description?: SeedText;
};

/** The owner's education, most recent first. */
export const SEED_EDUCATION: SeedEducation[] = [
  {
    institution: 'ISTA Hay Hassani 1',
    qualification: {
      en: 'Technicien Spécialisé en Développement Digital',
      fr: 'Technicien Spécialisé en Développement Digital',
      ar: 'تقني متخصص في التطوير الرقمي',
    },
    fieldOfStudy: {
      en: 'Digital development',
      fr: 'Développement digital',
      ar: 'التطوير الرقمي',
    },
    level: 'vocational',
    location: {
      en: 'Casablanca, Morocco',
      fr: 'Casablanca, Maroc',
      ar: 'الدار البيضاء، المغرب',
    },
    startDate: '2025-09',
    endDate: '2026-07',
    current: false,
    description: {
      en: 'Full-stack web development, relational databases, modern frameworks, and Agile/Scrum project management.',
      fr: 'Développement web full-stack, bases de données relationnelles, frameworks modernes, gestion de projets Agile/Scrum.',
      ar: 'تطوير الويب المتكامل، وقواعد البيانات العلائقية، والأطر الحديثة، وتدبير المشاريع بمنهج أجايل/سكرم.',
    },
  },
  {
    institution: 'Lycée Tayeb-El-Khemal',
    qualification: {
      en: 'Baccalauréat en Sciences Physiques',
      fr: 'Baccalauréat en Sciences Physiques',
      ar: 'بكالوريا في العلوم الفيزيائية',
    },
    level: 'secondary',
    location: {
      en: 'Darbouazza, Morocco',
      fr: 'Darbouazza, Maroc',
      ar: 'دار بوعزة، المغرب',
    },
    startDate: '2022-09',
    endDate: '2023-07',
    current: false,
  },
];

export type SeedCredential = {
  kind: CredentialKind;
  name: SeedText;
  /** A brand, so it is one word in every language - see the entries below. */
  issuer: SeedText;
  issuedAt: string;
  expiresAt?: string;
  credentialId?: string;
  credentialUrl?: string;
  description: SeedText;
};

/** The owner's certifications and courses. */
export const SEED_CREDENTIALS: SeedCredential[] = [
  {
    kind: 'certification',
    name: 'Front End Development Libraries',
    issuer: 'freeCodeCamp',
    issuedAt: '2026-01',
    credentialUrl: 'https://www.freecodecamp.org/aitbah',
    description: {
      en: 'In progress — not yet obtained.',
      fr: 'En cours — pas encore obtenue.',
      ar: 'قيد الإنجاز — لم تُنَل بعد.',
    },
  },
  {
    kind: 'certification',
    name: 'JavaScript Algorithms and Data Structures',
    issuer: 'freeCodeCamp',
    issuedAt: '2026-01',
    credentialUrl: 'https://www.freecodecamp.org/aitbah',
    description: {
      en: 'In progress — not yet obtained.',
      fr: 'En cours — pas encore obtenue.',
      ar: 'قيد الإنجاز — لم تُنَل بعد.',
    },
  },
  {
    kind: 'course',
    name: {
      en: 'Accounting and Business Management',
      fr: "Comptabilité et gestion d'entreprise",
      ar: 'المحاسبة وتدبير الشركات',
    },
    issuer: 'Neo Expertise',
    issuedAt: '2026-07',
    description: {
      en: 'In progress — studied alongside the work of building the accounting platform.',
      fr: 'En cours — étudiée en parallèle du développement de la plateforme comptable.',
      ar: 'قيد الإنجاز — تُدرَس بموازاة العمل على بناء المنصّة المحاسبية.',
    },
  },
];

export type SeedLanguage = { code: LanguageCode; level: string };

/**
 * In the order they should be read, which is the whole reason this entity has
 * an `order`: there is no date to sort by, and alphabetical would put Arabic
 * first for reasons nobody intends. The names are not here at all - the reader's
 * own locale supplies them.
 */
export const SEED_LANGUAGES: SeedLanguage[] = [
  {
    code: 'ar',
    level: 'native',
  },
  {
    code: 'fr',
    level: 'b1',
  },
  {
    code: 'en',
    level: 'a2',
  },
];

export const SEED_PROFILE = {
  /*
   * The Arabic is the owner's own spelling, split like the Latin one: `يعزى` |
   * `أيت به`. Never transliterated: a name has one correct spelling, and its
   * owner decides it.
   */
  firstName: { en: 'Yaaza', fr: 'Yaaza', ar: 'يعزى' },
  lastName: { en: 'Ait Bah', fr: 'Ait Bah', ar: 'أيت به' },
  headline: {
    en: 'Full-stack web developer',
    fr: 'Développeur web full-stack',
    ar: 'مطوّر ويب متكامل',
  },
  bio: {
    en: 'I am a full-stack web developer based in Casablanca. I work across the whole of an application — the interface, the API, the database and the deployment — and I am most at home in JavaScript, React and Next.js.\n\nI currently build a SaaS platform for accounting and business management at Neo Expertise, with Laravel, Vue.js, Inertia.js and PostgreSQL. Before that I built Digitalgardn, a freelance marketplace, on my own from the first line to the last: a Laravel API, a React interface, real-time messaging, a wallet and an administration area.\n\nI enjoy projects of every kind, e-commerce most of all, and I like learning a business domain well enough to build software that actually fits it.',
    fr: "Je suis développeur web full-stack, basé à Casablanca. Je travaille sur l'ensemble d'une application — l'interface, l'API, la base de données et la mise en production — et je suis le plus à l'aise en JavaScript, React et Next.js.\n\nJe construis actuellement une plateforme SaaS de comptabilité et de gestion d'entreprise chez Neo Expertise, avec Laravel, Vue.js, Inertia.js et PostgreSQL. Avant cela j'ai développé Digitalgardn, une plateforme de mise en relation freelances/clients, de A à Z en autonomie : une API Laravel, une interface React, une messagerie temps réel, un portefeuille et un espace d'administration.\n\nJ'aime les projets de toutes sortes, l'e-commerce en particulier, et j'aime apprendre un domaine métier assez bien pour construire un logiciel qui lui corresponde vraiment.",
    ar: 'أنا مطوّر ويب متكامل مقيم في الدار البيضاء. أشتغل على التطبيق كاملًا — الواجهة، وواجهة البرمجة، وقاعدة البيانات، والنشر — وأكثر ما أرتاح إليه هو JavaScript وReact وNext.js.\n\nأبني حاليًا منصّة SaaS للمحاسبة وتدبير الشركات في Neo Expertise، باستعمال Laravel وVue.js وInertia.js وPostgreSQL. وقبل ذلك أنجزتُ Digitalgardn، وهي منصّة تجمع المستقلّين بالعملاء، بنيتُها وحدي من أوّل سطر إلى آخره: واجهة برمجة بـLaravel، وواجهة بـReact، ومراسلة فورية، ومحفظة، وفضاء للإدارة.\n\nأستمتع بالمشاريع على اختلافها، والتجارة الإلكترونية أكثرها، وأحبّ أن أتعلّم مجال العمل جيّدًا حتى أبني برمجيات تناسبه فعلًا.',
  },
  photoAlt: {
    en: 'Yaaza Ait Bah',
    fr: 'Yaaza Ait Bah',
    ar: 'يعزى أيت به',
  },
  /**
   * Contact details, seeded in the state a real profile would sensibly start
   * in: an address stored but not published, a city that is, and a status
   * anyone may read. A seed that published the address by default would be
   * teaching the wrong lesson about what these flags are for.
   */
  /**
   * The CV, one per locale. Generated rather than committed - a real CV does
   * not belong in the repository - and each says on its first page that it is a
   * placeholder.
   */
  resume: {
    en: [
      'Yaaza Ait Bah — CV',
      'Placeholder document, written by the seeder.',
      'Replace it in the admin, under Profile.',
    ],
    fr: [
      'Yaaza Ait Bah — CV',
      'Document d’exemple, écrit par le script de démarrage.',
      'À remplacer dans l’administration, sous Profil.',
    ],
    /*
     * In Latin script on purpose: the PDF generator's standard fonts have no
     * Arabic glyphs, and embedding one is the dependency it avoids. A real
     * Arabic CV is uploaded, not generated.
     */
    ar: [
      'Yaaza Ait Bah — CV (AR)',
      'Placeholder document for the Arabic locale.',
      'Replace it in the admin, under Profile.',
    ],
  } as Record<string, readonly string[]>,
  contact: {
    email: 'hello@example.com',
    emailPublic: true,
    location: {
      en: 'Casablanca, Morocco',
      fr: 'Casablanca, Maroc',
      ar: 'الدار البيضاء، المغرب',
    },
    locationPublic: true,
    availability: 'not-looking' as string,
    availabilityPublic: true,
  },
};

/**
 * A populated inbox: mostly read, a few not, so the unread badge and the filter
 * both have something to show. Ages are in days back from the seeding run.
 */
export const SEED_MESSAGES = [
  {
    name: 'Amina Berrada',
    email: 'amina.berrada@example.com',
    subject: 'Freelance availability in March',
    body: "Hello,\n\nWe're rebuilding our booking flow and are looking for someone who can take the API side end to end. Would you have availability from early March?\n\nBest,\nAmina",
    read: false,
    daysAgo: 0,
  },
  {
    name: 'Tom Hargreaves',
    email: 't.hargreaves@example.co.uk',
    subject: 'Question about the inventory project',
    body: 'Saw the write-up on the reservation handling. How are you dealing with the case where two reservations land in the same millisecond? Optimistic locking, or something at the database level?',
    read: false,
    daysAgo: 1,
  },
  {
    name: 'Sofia Marchetti',
    email: 'sofia@studiomarchetti.example',
    subject: 'Design collaboration',
    body: "We're a small design studio and we keep needing a developer who can take a Figma file and not lose the details. Would you be open to a chat about ongoing work?",
    read: false,
    daysAgo: 2,
  },
  {
    name: 'Daniel Okonkwo',
    email: 'd.okonkwo@example.net',
    subject: 'Speaking at our meetup',
    body: 'We run a monthly web development meetup and would love a talk on containerised local development. Forty minutes, any month that suits you.',
    read: true,
    daysAgo: 6,
  },
  {
    name: 'Lena Fischer',
    email: 'lena.fischer@example.de',
    subject: 'Following up on our call',
    body: 'Thanks for the time yesterday. Sending over the requirements document we discussed — let me know if the timeline looks realistic to you.',
    read: true,
    daysAgo: 9,
  },
  {
    name: 'Marcus Reid',
    email: 'marcus@reidconsulting.example',
    subject: 'Contract role, remote',
    body: 'Six-month contract, fully remote, TypeScript and Node. Happy to send the full brief if it sounds relevant.',
    read: true,
    daysAgo: 14,
  },
  {
    name: 'Priya Raghavan',
    email: 'priya.r@example.in',
    subject: 'Thank you',
    body: 'Just wanted to say the article on error handling saved me a very long afternoon. Thank you for writing it up.',
    read: true,
    daysAgo: 21,
  },
  {
    name: 'Guillaume Petit',
    email: 'g.petit@example.fr',
    subject: 'Bug on the contact form',
    body: 'Small thing — the form let me submit twice in a row and I think it sent the message twice. Sorry about the duplicate.',
    read: true,
    daysAgo: 30,
  },
];
