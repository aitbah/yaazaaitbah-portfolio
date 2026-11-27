import type { OptionListKey } from './option-lists.js';

/**
 * The lists as they shipped - GENERATED from the message files they replaced.
 *
 * Behind its own subpath, like the icon set: it is 122 options with a label per
 * locale, wanted by exactly two callers - the seeder that fills a fresh database
 * in, and the frontend tests that stand in for it. Neither is application code,
 * and putting it in the barrel would put it in the browser bundle.
 *
 * Every code and every label here was, until this pass, a frozen array in
 * `shared/src/validation-rules.ts` paired with a message key in
 * `frontend/messages/{en,fr}/admin.json`. The text is copied across exactly, so
 * nothing a reader has already seen changes wording on the day it stopped
 * being a translation and started being a row.
 *
 * This is a *starting point*, not a definition. The owner adds, renames,
 * reorders and deletes from the admin, and the seeder never overwrites a name
 * that has been edited - see `seedOptions` for how that is kept true.
 *
 * The order within each list is the order it shipped in, which was chosen
 * rather than alphabetical: `other` sits at the end of the lists that have one,
 * and the CEFR levels run A1 to native.
 */
export type SeedOption = {
  code: string;
  name: { en: string; fr: string; ar: string };
  /** Only the platform list: the heading this option sits under. */
  group?: string;
  /** Only the platform list: a vendored brand mark, by slug. */
  icon?: string;
};

export const SEED_OPTIONS: Record<OptionListKey, readonly SeedOption[]> = {
  'availability-status': [
    {
      code: 'open-to-work',
      name: {
        en: 'Open to work',
        fr: 'Ouvert aux opportunités',
        ar: 'منفتح على فرص العمل',
      },
    },
    {
      code: 'open-to-freelance',
      name: {
        en: 'Open to freelance',
        fr: 'Ouvert au freelance',
        ar: 'منفتح على العمل الحر',
      },
    },
    {
      code: 'open-to-collaboration',
      name: {
        en: 'Open to collaboration',
        fr: 'Ouvert à la collaboration',
        ar: 'منفتح على التعاون',
      },
    },
    {
      code: 'not-looking',
      name: {
        en: 'Not looking',
        fr: 'Pas en recherche',
        ar: 'غير باحث حاليًا',
      },
    },
  ],
  'skill-category': [
    {
      code: 'engineering',
      name: { en: 'Engineering', fr: 'Ingénierie', ar: 'الهندسة' },
    },
    {
      code: 'architecture',
      name: { en: 'Architecture', fr: 'Architecture', ar: 'بناء الأنظمة' },
    },
    {
      code: 'quality',
      name: {
        en: 'Quality & testing',
        fr: 'Qualité et tests',
        ar: 'الجودة والاختبار',
      },
    },
    { code: 'security', name: { en: 'Security', fr: 'Sécurité', ar: 'الأمن' } },
    {
      code: 'operations',
      name: {
        en: 'Operations & reliability',
        fr: 'Exploitation et fiabilité',
        ar: 'التشغيل والموثوقية',
      },
    },
    { code: 'data', name: { en: 'Data', fr: 'Données', ar: 'البيانات' } },
    {
      code: 'ai',
      name: {
        en: 'AI & machine learning',
        fr: 'IA et apprentissage automatique',
        ar: 'الذكاء الاصطناعي وتعلّم الآلة',
      },
    },
    {
      code: 'design',
      name: {
        en: 'Design & UX',
        fr: 'Design et UX',
        ar: 'التصميم وتجربة المستخدم',
      },
    },
    { code: 'product', name: { en: 'Product', fr: 'Produit', ar: 'المنتج' } },
    {
      code: 'delivery',
      name: {
        en: 'Delivery & process',
        fr: 'Livraison et processus',
        ar: 'التسليم وسير العمل',
      },
    },
    {
      code: 'leadership',
      name: {
        en: 'Leadership & mentoring',
        fr: 'Encadrement et mentorat',
        ar: 'القيادة والإرشاد',
      },
    },
    {
      code: 'collaboration',
      name: { en: 'Collaboration', fr: 'Collaboration', ar: 'التعاون' },
    },
    {
      code: 'communication',
      name: { en: 'Communication', fr: 'Communication', ar: 'التواصل' },
    },
    { code: 'other', name: { en: 'Other', fr: 'Autre', ar: 'أخرى' } },
  ],
  'technology-category': [
    {
      code: 'language',
      name: { en: 'Language', fr: 'Langage', ar: 'لغة برمجة' },
    },
    {
      code: 'frontend',
      name: { en: 'Frontend', fr: 'Frontend', ar: 'الواجهة الأمامية' },
    },
    {
      code: 'backend',
      name: { en: 'Backend', fr: 'Backend', ar: 'الواجهة الخلفية' },
    },
    {
      code: 'mobile',
      name: { en: 'Mobile', fr: 'Mobile', ar: 'الهواتف المحمولة' },
    },
    {
      code: 'desktop',
      name: { en: 'Desktop', fr: 'Bureau', ar: 'سطح المكتب' },
    },
    {
      code: 'database',
      name: { en: 'Database', fr: 'Base de données', ar: 'قواعد البيانات' },
    },
    {
      code: 'data-engineering',
      name: {
        en: 'Data engineering',
        fr: 'Ingénierie des données',
        ar: 'هندسة البيانات',
      },
    },
    {
      code: 'ai',
      name: {
        en: 'AI & machine learning',
        fr: 'IA et apprentissage automatique',
        ar: 'الذكاء الاصطناعي وتعلّم الآلة',
      },
    },
    {
      code: 'cloud',
      name: { en: 'Cloud platform', fr: 'Plateforme cloud', ar: 'منصة سحابية' },
    },
    {
      code: 'infrastructure',
      name: {
        en: 'Infrastructure',
        fr: 'Infrastructure',
        ar: 'البنية التحتية',
      },
    },
    {
      code: 'messaging',
      name: {
        en: 'Messaging & streaming',
        fr: 'Messagerie et flux',
        ar: 'المراسلة والتدفقات',
      },
    },
    {
      code: 'api',
      name: {
        en: 'API & integration',
        fr: 'API et intégration',
        ar: 'واجهات البرمجة والتكامل',
      },
    },
    { code: 'testing', name: { en: 'Testing', fr: 'Tests', ar: 'الاختبار' } },
    { code: 'security', name: { en: 'Security', fr: 'Sécurité', ar: 'الأمن' } },
    {
      code: 'embedded',
      name: {
        en: 'Embedded & IoT',
        fr: 'Embarqué et IoT',
        ar: 'الأنظمة المدمجة وإنترنت الأشياء',
      },
    },
    {
      code: 'game',
      name: {
        en: 'Game development',
        fr: 'Développement de jeux',
        ar: 'تطوير الألعاب',
      },
    },
    {
      code: 'blockchain',
      name: { en: 'Blockchain', fr: 'Blockchain', ar: 'البلوكتشين' },
    },
    { code: 'other', name: { en: 'Other', fr: 'Autre', ar: 'أخرى' } },
  ],
  'tool-category': [
    {
      code: 'editor',
      name: {
        en: 'Editor & IDE',
        fr: 'Éditeur et IDE',
        ar: 'المحرّرات وبيئات التطوير',
      },
    },
    {
      code: 'terminal',
      name: {
        en: 'Terminal & shell',
        fr: 'Terminal et shell',
        ar: 'الطرفية والصدفة',
      },
    },
    {
      code: 'versioning',
      name: {
        en: 'Version control',
        fr: 'Gestion de versions',
        ar: 'إدارة الإصدارات',
      },
    },
    {
      code: 'ci-cd',
      name: { en: 'CI/CD', fr: 'CI/CD', ar: 'التكامل والنشر المستمران' },
    },
    {
      code: 'containers',
      name: {
        en: 'Containers & orchestration',
        fr: 'Conteneurs et orchestration',
        ar: 'الحاويات وتنسيقها',
      },
    },
    {
      code: 'infrastructure',
      name: {
        en: 'Infrastructure as code',
        fr: 'Infrastructure as code',
        ar: 'البنية التحتية ككود',
      },
    },
    {
      code: 'monitoring',
      name: {
        en: 'Monitoring & observability',
        fr: 'Supervision et observabilité',
        ar: 'المراقبة والرصد',
      },
    },
    {
      code: 'devops',
      name: {
        en: 'DevOps & automation',
        fr: 'DevOps et automatisation',
        ar: 'DevOps والأتمتة',
      },
    },
    { code: 'testing', name: { en: 'Testing', fr: 'Tests', ar: 'الاختبار' } },
    {
      code: 'api',
      name: {
        en: 'API clients',
        fr: 'Clients API',
        ar: 'عملاء واجهات البرمجة',
      },
    },
    {
      code: 'database',
      name: {
        en: 'Database clients',
        fr: 'Clients de base de données',
        ar: 'عملاء قواعد البيانات',
      },
    },
    { code: 'security', name: { en: 'Security', fr: 'Sécurité', ar: 'الأمن' } },
    { code: 'design', name: { en: 'Design', fr: 'Design', ar: 'التصميم' } },
    {
      code: 'collaboration',
      name: { en: 'Collaboration', fr: 'Collaboration', ar: 'التعاون' },
    },
    {
      code: 'project-management',
      name: {
        en: 'Project management',
        fr: 'Gestion de projet',
        ar: 'إدارة المشاريع',
      },
    },
    {
      code: 'documentation',
      name: { en: 'Documentation', fr: 'Documentation', ar: 'التوثيق' },
    },
    {
      code: 'ai',
      name: {
        en: 'AI assistants',
        fr: 'Assistants IA',
        ar: 'مساعدو الذكاء الاصطناعي',
      },
    },
    {
      code: 'analytics',
      name: { en: 'Analytics', fr: 'Analytique', ar: 'التحليلات' },
    },
    {
      code: 'productivity',
      name: { en: 'Productivity', fr: 'Productivité', ar: 'الإنتاجية' },
    },
    { code: 'other', name: { en: 'Other', fr: 'Autre', ar: 'أخرى' } },
  ],
  'employment-type': [
    {
      code: 'full-time',
      name: { en: 'Full-time', fr: 'Temps plein', ar: 'دوام كامل' },
    },
    {
      code: 'part-time',
      name: { en: 'Part-time', fr: 'Temps partiel', ar: 'دوام جزئي' },
    },
    {
      code: 'contract',
      name: { en: 'Contract', fr: 'CDD', ar: 'عقد محدّد المدة' },
    },
    {
      code: 'freelance',
      name: { en: 'Freelance', fr: 'Freelance', ar: 'عمل حر' },
    },
    {
      code: 'self-employed',
      name: { en: 'Self-employed', fr: 'Indépendant', ar: 'عمل لِلحساب الخاص' },
    },
    {
      code: 'temporary',
      name: { en: 'Temporary', fr: 'Intérim', ar: 'عمل مؤقت' },
    },
    {
      code: 'internship',
      name: { en: 'Internship', fr: 'Stage', ar: 'تدريب' },
    },
    {
      code: 'apprenticeship',
      name: {
        en: 'Apprenticeship',
        fr: 'Alternance',
        ar: 'تدريب مهني بالتناوب',
      },
    },
    {
      code: 'working-student',
      name: { en: 'Working student', fr: 'Étudiant salarié', ar: 'طالب عامل' },
    },
    {
      code: 'volunteer',
      name: { en: 'Volunteer', fr: 'Bénévolat', ar: 'عمل تطوعي' },
    },
  ],
  'education-level': [
    {
      code: 'secondary',
      name: {
        en: 'Secondary school',
        fr: 'Baccalauréat',
        ar: 'التعليم الثانوي',
      },
    },
    {
      code: 'vocational',
      name: {
        en: 'Vocational training',
        fr: 'Formation professionnelle',
        ar: 'التكوين المهني',
      },
    },
    {
      code: 'associate',
      name: { en: 'Associate degree', fr: 'BTS ou DUT', ar: 'دبلوم تقني' },
    },
    {
      code: 'bachelor',
      name: { en: "Bachelor's degree", fr: 'Licence', ar: 'الإجازة' },
    },
    {
      code: 'master',
      name: { en: "Master's degree", fr: 'Master', ar: 'الماستر' },
    },
    {
      code: 'postgraduate',
      name: {
        en: 'Postgraduate diploma',
        fr: 'Diplôme de troisième cycle',
        ar: 'دبلوم الدراسات العليا',
      },
    },
    {
      code: 'doctorate',
      name: { en: 'Doctorate', fr: 'Doctorat', ar: 'الدكتوراه' },
    },
    {
      code: 'bootcamp',
      name: { en: 'Bootcamp', fr: 'Bootcamp', ar: 'معسكر تدريبي' },
    },
    { code: 'other', name: { en: 'Other', fr: 'Autre', ar: 'أخرى' } },
  ],
  'language-level': [
    {
      code: 'a1',
      name: { en: 'A1 — Beginner', fr: 'A1 — Débutant', ar: 'A1 — مبتدئ' },
    },
    {
      code: 'a2',
      name: {
        en: 'A2 — Elementary',
        fr: 'A2 — Élémentaire',
        ar: 'A2 — ابتدائي',
      },
    },
    {
      code: 'b1',
      name: {
        en: 'B1 — Intermediate',
        fr: 'B1 — Intermédiaire',
        ar: 'B1 — متوسط',
      },
    },
    {
      code: 'b2',
      name: {
        en: 'B2 — Upper intermediate',
        fr: 'B2 — Intermédiaire supérieur',
        ar: 'B2 — فوق المتوسط',
      },
    },
    {
      code: 'c1',
      name: { en: 'C1 — Advanced', fr: 'C1 — Avancé', ar: 'C1 — متقدّم' },
    },
    {
      code: 'c2',
      name: { en: 'C2 — Proficient', fr: 'C2 — Maîtrise', ar: 'C2 — متمكّن' },
    },
    {
      code: 'native',
      name: { en: 'Native', fr: 'Langue maternelle', ar: 'اللغة الأم' },
    },
  ],
  'social-platform': [
    {
      code: 'github',
      name: { en: 'GitHub', fr: 'GitHub', ar: 'GitHub' },
      group: 'code',
      icon: 'github',
    },
    {
      code: 'gitlab',
      name: { en: 'GitLab', fr: 'GitLab', ar: 'GitLab' },
      group: 'code',
      icon: 'gitlab',
    },
    {
      code: 'bitbucket',
      name: { en: 'Bitbucket', fr: 'Bitbucket', ar: 'Bitbucket' },
      group: 'code',
      icon: 'bitbucket',
    },
    {
      code: 'codeberg',
      name: { en: 'Codeberg', fr: 'Codeberg', ar: 'Codeberg' },
      group: 'code',
      icon: 'codeberg',
    },
    {
      code: 'stackoverflow',
      name: {
        en: 'Stack Overflow',
        fr: 'Stack Overflow',
        ar: 'Stack Overflow',
      },
      group: 'community',
      icon: 'stackoverflow',
    },
    {
      code: 'devto',
      name: { en: 'DEV Community', fr: 'DEV Community', ar: 'DEV Community' },
      group: 'community',
      icon: 'devdotto',
    },
    {
      code: 'hashnode',
      name: { en: 'Hashnode', fr: 'Hashnode', ar: 'Hashnode' },
      group: 'community',
      icon: 'hashnode',
    },
    {
      // Lowercase `f`: that is how the organisation writes its own name, and a
      // platform label is a proper noun rather than a sentence.
      //
      // Filed under communities rather than practice: it is where the learning
      // is public and the certifications are shareable, which is the reason a
      // portfolio links to it at all.
      code: 'freecodecamp',
      name: { en: 'freeCodeCamp', fr: 'freeCodeCamp', ar: 'freeCodeCamp' },
      group: 'community',
      icon: 'freecodecamp',
    },
    {
      code: 'medium',
      name: { en: 'Medium', fr: 'Medium', ar: 'Medium' },
      group: 'community',
      icon: 'medium',
    },
    {
      code: 'substack',
      name: { en: 'Substack', fr: 'Substack', ar: 'Substack' },
      group: 'community',
      icon: 'substack',
    },
    {
      code: 'npm',
      name: { en: 'npm', fr: 'npm', ar: 'npm' },
      group: 'registry',
      icon: 'npm',
    },
    {
      code: 'dockerhub',
      name: { en: 'Docker Hub', fr: 'Docker Hub', ar: 'Docker Hub' },
      group: 'registry',
      icon: 'docker',
    },
    {
      code: 'huggingface',
      name: { en: 'Hugging Face', fr: 'Hugging Face', ar: 'Hugging Face' },
      group: 'registry',
      icon: 'huggingface',
    },
    {
      code: 'kaggle',
      name: { en: 'Kaggle', fr: 'Kaggle', ar: 'Kaggle' },
      group: 'registry',
      icon: 'kaggle',
    },
    {
      code: 'leetcode',
      name: { en: 'LeetCode', fr: 'LeetCode', ar: 'LeetCode' },
      group: 'registry',
      icon: 'leetcode',
    },
    {
      code: 'linkedin',
      name: { en: 'LinkedIn', fr: 'LinkedIn', ar: 'LinkedIn' },
      group: 'social',
    },
    {
      code: 'x',
      name: { en: 'X', fr: 'X', ar: 'X' },
      group: 'social',
      icon: 'x',
    },
    {
      code: 'mastodon',
      name: { en: 'Mastodon', fr: 'Mastodon', ar: 'Mastodon' },
      group: 'social',
      icon: 'mastodon',
    },
    {
      code: 'bluesky',
      name: { en: 'Bluesky', fr: 'Bluesky', ar: 'Bluesky' },
      group: 'social',
      icon: 'bluesky',
    },
    {
      code: 'threads',
      name: { en: 'Threads', fr: 'Threads', ar: 'Threads' },
      group: 'social',
      icon: 'threads',
    },
    {
      code: 'facebook',
      name: { en: 'Facebook', fr: 'Facebook', ar: 'Facebook' },
      group: 'social',
      icon: 'facebook',
    },
    {
      code: 'instagram',
      name: { en: 'Instagram', fr: 'Instagram', ar: 'Instagram' },
      group: 'social',
      icon: 'instagram',
    },
    {
      code: 'tiktok',
      name: { en: 'TikTok', fr: 'TikTok', ar: 'TikTok' },
      group: 'social',
      icon: 'tiktok',
    },
    {
      code: 'youtube',
      name: { en: 'YouTube', fr: 'YouTube', ar: 'YouTube' },
      group: 'video',
      icon: 'youtube',
    },
    {
      code: 'twitch',
      name: { en: 'Twitch', fr: 'Twitch', ar: 'Twitch' },
      group: 'video',
      icon: 'twitch',
    },
    {
      code: 'discord',
      name: { en: 'Discord', fr: 'Discord', ar: 'Discord' },
      group: 'chat',
      icon: 'discord',
    },
    {
      code: 'telegram',
      name: { en: 'Telegram', fr: 'Telegram', ar: 'Telegram' },
      group: 'chat',
      icon: 'telegram',
    },
    {
      code: 'reddit',
      name: { en: 'Reddit', fr: 'Reddit', ar: 'Reddit' },
      group: 'chat',
      icon: 'reddit',
    },
    {
      code: 'dribbble',
      name: { en: 'Dribbble', fr: 'Dribbble', ar: 'Dribbble' },
      group: 'design',
      icon: 'dribbble',
    },
    {
      code: 'behance',
      name: { en: 'Behance', fr: 'Behance', ar: 'Behance' },
      group: 'design',
      icon: 'behance',
    },
    {
      code: 'producthunt',
      name: { en: 'Product Hunt', fr: 'Product Hunt', ar: 'Product Hunt' },
      group: 'design',
      icon: 'producthunt',
    },
    {
      code: 'website',
      name: { en: 'Website', fr: 'Site web', ar: 'موقع إلكتروني' },
      group: 'elsewhere',
    },
    {
      code: 'other',
      name: { en: 'Other', fr: 'Autre', ar: 'أخرى' },
      group: 'elsewhere',
    },
  ],
  'social-platform-group': [
    {
      code: 'code',
      name: {
        en: 'Code hosting',
        fr: 'Hébergement de code',
        ar: 'استضافة الكود',
      },
    },
    {
      code: 'community',
      name: {
        en: 'Communities & writing',
        fr: 'Communautés et écriture',
        ar: 'المجتمعات والكتابة',
      },
    },
    {
      code: 'registry',
      name: {
        en: 'Packages, models & practice',
        fr: 'Paquets, modèles et entraînement',
        ar: 'الحزم والنماذج والتمرين',
      },
    },
    {
      code: 'social',
      name: { en: 'Social', fr: 'Réseaux sociaux', ar: 'الشبكات الاجتماعية' },
    },
    {
      code: 'video',
      name: {
        en: 'Video & streaming',
        fr: 'Vidéo et streaming',
        ar: 'الفيديو والبث',
      },
    },
    {
      code: 'chat',
      name: {
        en: 'Chat & forums',
        fr: 'Messagerie et forums',
        ar: 'المحادثة والمنتديات',
      },
    },
    {
      code: 'design',
      name: {
        en: 'Design & product',
        fr: 'Design et produit',
        ar: 'التصميم والمنتج',
      },
    },
    {
      code: 'elsewhere',
      name: { en: 'Elsewhere', fr: 'Ailleurs', ar: 'مواضع أخرى' },
    },
  ],
};
