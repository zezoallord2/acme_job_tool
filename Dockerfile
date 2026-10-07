# syntax=docker/dockerfile:1
#
# Acme Jobs — production image.
#
# MODE A (persistent server): this image plus a local volume and a PostgreSQL
# service. No S3 required.
# MODE B (ephemeral / cloud): this image plus an S3-compatible bucket. The
# filesystem is then disposable.
#
# Multi-stage so the runtime layer carries only the standalone server, the worker
# bundle, the Prisma schema and the assets. No compiler, no dev dependencies.

# ---------------------------------------------------------------------------
# deps: installed dependencies and the Prisma schema
# ---------------------------------------------------------------------------
FROM node:20-bookworm-slim AS deps
WORKDIR /app
# openssl is needed by Prisma's query engine; ca-certificates by outbound HTTPS
# (S3, SMTP, AI providers).
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev --no-audit --no-fund \
  && npm cache clean --force

# ---------------------------------------------------------------------------
# builder: the production Next.js build and the worker bundle
# ---------------------------------------------------------------------------
FROM node:20-bookworm-slim AS builder
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
# The build needs devDependencies (typescript, the Next compiler, esbuild).
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1

# `next build` evaluates server components while collecting page data, and the
# health route reads the session secret at import time. `.env` is deliberately
# excluded from the build context, so without these the image build fails with
# "AUTH_SECRET is required in production". These are build-time-only placeholders
# for compilation: real secrets are injected at run time by the orchestrator, and
# `dist/scripts/production-check.js` refuses to run if they are still these.
ENV NODE_ENV=production \
    AUTH_SECRET=build-time-placeholder-not-a-real-secret-000000000000000000000000 \
    KEY_ENCRYPTION_SECRET=build-time-placeholder-not-a-real-secret-111111111111111111111111 \
    BILLING_LINK_SECRET=build-time-placeholder-not-a-real-secret-222222222222222222222222

# `output: "standalone"` in next.config.ts is what produces .next/standalone.
RUN npx prisma generate \
  && npm run build \
  # The worker is bundled to plain JavaScript so the runtime image needs no
  # TypeScript toolchain. Prisma and pg stay external and resolve from node_modules.
  && npx esbuild src/worker/index.ts --bundle --platform=node --target=node20 \
       --external:@prisma/client --external:pg --outfile=dist/worker/index.js \
  # The preflight and integrity CLIs run inside the image too, so a deploy can
  # verify configuration without a TypeScript toolchain or the source tree.
  && npx esbuild scripts/production-check.ts --bundle --platform=node --target=node20 \
       --external:@prisma/client --external:pg --outfile=dist/scripts/production-check.js \
  && npx esbuild scripts/integrity-check.ts --bundle --platform=node --target=node20 \
       --external:@prisma/client --external:pg --outfile=dist/scripts/integrity-check.js

# ---------------------------------------------------------------------------
# runner: the only layer that ships
# ---------------------------------------------------------------------------
FROM node:20-bookworm-slim AS runner
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3100 \
    # Docker sets HOSTNAME to the container id, and the Next standalone server
    # binds to whatever HOSTNAME says. Left alone it binds only to the container
    # hostname, so 127.0.0.1 inside the container -- which is what the compose
    # healthcheck uses -- refuses the connection.
    HOSTNAME=0.0.0.0 \
    # Writable HOME so the Prisma CLI and npm can write their caches while
    # running as the unprivileged `acme` user.
    HOME=/home/acme

RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs acme

# standalone holds server.js plus the pruned node_modules it actually needs.
COPY --from=builder --chown=acme:nodejs /app/.next/standalone ./
# static and public are not inside standalone and must be copied alongside it,
# or CSS, JS chunks, the service worker and the install icons 404.
COPY --from=builder --chown=acme:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=acme:nodejs /app/public ./public
# Migrations ship so a release command can run `prisma migrate deploy` from the
# image without the source tree.
COPY --from=builder --chown=acme:nodejs /app/prisma ./prisma

# The standalone bundle deliberately prunes everything the server does not
# import at runtime, which excludes the Prisma CLI. Without it the image cannot
# run `migrate deploy`, so a fresh deploy fails with "prisma: not found".
#
# It is installed into an isolated directory rather than into /app: running npm
# against the pruned standalone node_modules fails outright, because that tree
# has no lockfile to reconcile against. Copying the builder's whole
# node_modules would work but ships ~500 devDependencies into production.
RUN mkdir -p /opt/prisma-cli /home/acme/.cache/prisma /home/acme/.npm \
  && cd /opt/prisma-cli \
  && npm init -y >/dev/null \
  && npm install --omit=dev --no-audit --no-fund prisma@6.19.3 \
  && ln -sf /opt/prisma-cli/node_modules/.bin/prisma /usr/local/bin/prisma \
  && npm cache clean --force \
  && chown -R acme:nodejs /opt/prisma-cli /home/acme

COPY --from=builder --chown=acme:nodejs /app/dist ./dist
COPY --from=builder --chown=acme:nodejs /app/package.json ./package.json

# The data directory is the mount point for MODE A. In MODE B it stays empty and
# STORAGE_DRIVER=s3 is used instead.
RUN mkdir -p /app/data/uploads /app/data/exports /app/data/logs \
             /app/data/generated /app/data/backups \
  && chown -R acme:nodejs /app/data

USER acme
EXPOSE 3100

# Default to the web process. Compose overrides this for the worker service.
# `npm run start` is `next start`; the standalone server is `node server.js`.
CMD ["node", "server.js"]