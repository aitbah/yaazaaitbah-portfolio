# Project Overview

## Goal

A personal, modern, dynamic, and professional portfolio showcasing the owner's profile, skills, projects, and professional information.

The project includes:
- a **backend**;
- an **administration system** to manage the site's dynamic content.

**Objective:** a clean, maintainable, and scalable portfolio, developed locally with Docker and deployed later to a VPS. The architecture must remain simple and understandable while allowing the project to grow.

## Functional Requirements

**Public part (portfolio)**
- Personal information, skills, projects, professional experience, and contact information.
- One page - the opening, About, Work, Expertise, Experience, Credentials, Contact - plus a page per project for what a card has no room for. Every word of it comes from the admin; nothing is written in the code but the labels around it.
- Rendered on the server from the API and complete without JavaScript; the motion layer (GSAP, ScrollTrigger, SplitText, Lenis) only moves what is already there. See `FRONTEND-RULES.md`, *The public site*.

**Administration**
- Add, edit, delete, and manage projects and any other dynamic content of the site.
- The administration must allow managing all dynamic data and content of the portfolio, not just projects.

**Contact**
- Contact form accessible to visitors; messages are handled by the backend and stored in MongoDB.

## Expected Behaviors

### Language

**English Only at Launch, Multilingual Architecture from the Start.**
- English (`en`) was the only active and available language at launch - all initial content is written in English.
- The i18n/multilingual architecture (routing, translation file structure, data structure) was in place from the beginning, and **French was added on 2026-09-05** - which is what tested it. **Arabic was added on 2026-09-12**, which tested the other half: it is the first locale that reads right to left. English remains the default locale - see [`DATABASE.md`](DATABASE.md#the-default-locale).
- Concretely: adding a language later must only require adding translation JSON files, translated content, and configuration - **never** an architectural refactor. That held for both. Arabic cost one thing beyond configuration, and it was not the architecture: the vendored shadcn components had been taken as shipped, and shipped code is written left to right. See [`FRONTEND-RULES.md`](FRONTEND-RULES.md#reading-direction).

See `FRONTEND-RULES.md` for the technical implementation of this.

### SEO

SEO is confirmed to be in scope, from the start of development. Handled natively by Next.js, and must cover:

- Meta tags (title, description) per page.
- Open Graph tags for social sharing.
- Sitemap and `robots.txt`.
- Semantic HTML structure.
- Clean, server-side indexable rendering.
- Content optimization (headings, descriptions) where relevant.

See `TECHNICAL-ARCHITECTURE.md` / `FRONTEND-RULES.md` for implementation details.

### Domain entities

Identified at this stage: `User`, `Profile`, `SocialLink`, `Project`, `Skill`, `Message`.

Schemas are **not fixed** - design them when implementing each feature (see `DATABASE.md`).
