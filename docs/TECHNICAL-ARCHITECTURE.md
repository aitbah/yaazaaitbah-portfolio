# Technical Architecture

## Stack

- Frontend: Next.js + TypeScript + Tailwind CSS + shadcn/ui
- Backend: Node.js + Express + TypeScript
- Database: MongoDB
- Environment: Docker + Docker Compose

## General Flow

```text
User → Next.js → Node.js/Express → MongoDB
```

Docker containers: Next.js, Express, MongoDB - see `LOCAL-DEVELOPMENT.md` for the setup that runs today (services, network, volumes, env variables), and `PRODUCTION-DEPLOYMENT.md` for the production stack.

## Expected Project Structure

One npm workspace, three packages. `shared` exists so the validation contract has a
single definition rather than one copy per side of the wire - see `FOLDER-STRUCTURE.md`.

```text
portfolio/
├── shared/                   # @portfolio/shared - the cross-package contract
├── frontend/                 # Next.js + TypeScript
│   └── Dockerfile            # built from the repository root
├── backend/                  # Node.js + Express + TypeScript
│   └── Dockerfile            # built from the repository root
├── package.json              # workspace root: the three packages, shared tooling
├── package-lock.json         # one lockfile for all three
├── docker-compose.yml
├── .dockerignore
├── .env
├── .env.example
├── .gitignore
├── README.md
├── LICENSE
└── docs/
```

`shared` depends on nothing but Zod, and neither application package depends on the
other: the dependency arrows point inward only.

## Responsibilities by Layer

- **Frontend**: rendering, UI, SEO, translation (`next-intl`), API calls.
- **Backend**: business logic, validation, authentication/authorization, centralized response format, returns **codes** (never translated text) - see `API-RULES.md`.
- **MongoDB**: persistence, including multilingual content (language fields in the same document - never separate documents per language) - see `DATABASE.md`.

## Files & Images

Never store files/images directly in MongoDB unless justified - use external/object storage and keep only the URL/identifier in the database.

## Constraint

Never change this architecture without explicit approval.