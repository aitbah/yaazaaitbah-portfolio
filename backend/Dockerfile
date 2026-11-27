# Local development image; `Dockerfile.prod` is the production one.
# The build context is the repository root, because this package resolves
# `@portfolio/shared` through the workspace.
FROM node:24-alpine

WORKDIR /app

# Dependencies first: source changes don't invalidate this layer. Every
# workspace manifest is needed - the lockfile describes all three.
COPY package.json package-lock.json .npmrc ./
COPY shared/package.json shared/
COPY backend/package.json backend/
COPY frontend/package.json frontend/

# Only this service's workspaces, so the image carries no frontend toolchain.
# Install scripts are skipped: the native binaries this image needs come from
# the lockfile's platform packages, not from building them here.
RUN npm ci --ignore-scripts \
    --include-workspace-root \
    --workspace shared \
    --workspace backend

COPY shared/ shared/
COPY backend/ backend/

# `prepare` was skipped with the install scripts, and the source was not there
# yet in any case.
RUN npm run build --workspace shared

WORKDIR /app/backend

EXPOSE 5000

CMD ["npm", "run", "dev"]
