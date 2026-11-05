ARG NODE_IMAGE_VERSION="22.23.4-alpine"
# pnpm 12 ships a native Rust binary that crashes under QEMU (x86 builds on Apple Silicon
# without Rosetta); pnpm 10 is plain JS. package.json declares engines.pnpm 12.x, which
# pnpm 10 refuses, so the node -e lines below remove it inside the image only.
ARG PNPM_VERSION="10"
# Keep in sync with the prisma/@prisma/* versions in package.json
ARG PRISMA_VERSION="7.10.0"

# Install dependencies only when needed
# deps + builder run on the build host's native architecture (no QEMU: esbuild/Turbopack crash
# under emulation). Only the runner stage uses the target platform.
FROM --platform=$BUILDPLATFORM node:${NODE_IMAGE_VERSION} AS deps
ARG PNPM_VERSION

# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# Workspace packages (@umami/api-client, @umami/mcp) must be present for a frozen install.
COPY packages/api-client/package.json ./packages/api-client/
COPY packages/mcp/package.json ./packages/mcp/
COPY packages/mcp/bin ./packages/mcp/bin/
RUN node -e "const f=require('fs'),p=JSON.parse(f.readFileSync('package.json'));delete (p.engines||{}).pnpm;f.writeFileSync('package.json',JSON.stringify(p,null,2))"
RUN npm install -g pnpm@${PNPM_VERSION}

# Also fetch the target platform's native optional deps (sharp etc.): the build runs on the host's
# architecture, but .next/standalone must work on the target one.
ARG TARGETARCH
RUN TARGET_CPU=$([ "$TARGETARCH" = "amd64" ] && echo x64 || echo "$TARGETARCH") \
    && printf 'strictDepBuilds: false\nsupportedArchitectures:\n  os: [current]\n  cpu: [current, %s]\n  libc: [current, musl]\n' "$TARGET_CPU" >> pnpm-workspace.yaml

RUN pnpm install --frozen-lockfile

# Rebuild the source code only when needed
FROM --platform=$BUILDPLATFORM node:${NODE_IMAGE_VERSION} AS builder
ARG PNPM_VERSION
WORKDIR /app
# build:openapi shells out to pnpm, so the builder stage needs it too
RUN npm install -g pnpm@${PNPM_VERSION}
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/api-client/node_modules ./packages/api-client/node_modules
COPY --from=deps /app/packages/mcp/node_modules ./packages/mcp/node_modules
COPY . .
RUN node -e "const f=require('fs'),p=JSON.parse(f.readFileSync('package.json'));delete (p.engines||{}).pnpm;f.writeFileSync('package.json',JSON.stringify(p,null,2))"
COPY docker/proxy.ts ./src

ARG BASE_PATH

ENV BASE_PATH=$BASE_PATH
ENV NEXT_TELEMETRY_DISABLED=1
# One page-data worker: three parallel ones get OOM-killed in Docker Desktop's default VM.
ENV NEXT_BUILD_CPUS=1
ENV DATABASE_URL="postgresql://user:pass@localhost:5432/dummy"

ARG SKIP_BUILD_GEO
ENV SKIP_BUILD_GEO=$SKIP_BUILD_GEO

# pnpm/npm-run-all can report success when Next is OOM-killed, so assert the output exists.
RUN pnpm build:docker && test -f .next/standalone/server.js

# Production image, copy all the files and run next
FROM node:${NODE_IMAGE_VERSION} AS runner
WORKDIR /app

ARG NODE_OPTIONS
ARG PNPM_VERSION
ARG PRISMA_VERSION

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS=$NODE_OPTIONS

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
# Bootstrap pnpm with the bundled npm, then remove npm in the same layer so the
# vulnerable packages vendored inside the npm CLI are not shipped in the final
# image. pnpm is the only package manager needed at build and runtime.
RUN set -x \
    && apk add --no-cache curl libc6-compat \
    && npm install -g pnpm@${PNPM_VERSION} \
    && rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx

RUN echo {} > package.json

RUN printf "allowBuilds:\n  '@prisma/engines': true\n  prisma: false\nverifyDepsBeforeRun: false\n" > pnpm-workspace.yaml

# Script dependencies
RUN pnpm add npm-run-all dotenv chalk semver \
    prisma@${PRISMA_VERSION} \
    @prisma/client@${PRISMA_VERSION} \
    @prisma/adapter-pg@${PRISMA_VERSION}

# Assert the @prisma/engines postinstall actually downloaded the engine
# binaries. If pnpm blocked the build script (e.g. allowBuilds not honored by
# the installed pnpm version), prisma would try to download engines at runtime
# as the non-root user and fail with a permissions error.
RUN ls node_modules/.pnpm/@prisma+engines@${PRISMA_VERSION}/node_modules/@prisma/engines/*engine* \
    || (echo "ERROR: Prisma engine binaries missing - @prisma/engines postinstall was blocked" && exit 1)

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/generated ./generated

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV HOSTNAME=0.0.0.0
ENV PORT=3000

CMD ["sh", "scripts/start-docker.sh"]
