# Production image for the Silora Academy app. Also used by the "migrate" and "worker"
# services in deploy/compose.yaml.
FROM node:24-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM base AS build
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Browser error alerts are baked in at build time (the DSN is public by design).
ARG NEXT_PUBLIC_SENTRY_DSN=""
ARG NEXT_PUBLIC_SENTRY_ENVIRONMENT="production"
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate && npm run build && npm prune --omit=dev

FROM base AS runner
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/package.json /app/next.config.ts ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/.next ./.next
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/prisma ./prisma
COPY --from=build --chown=node:node /app/scripts/worker.mjs /app/scripts/create-admin.mjs ./scripts/
USER node
EXPOSE 3000
CMD ["npx", "next", "start"]
