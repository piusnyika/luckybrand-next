# Production image for the store. Secrets and the database are supplied at runtime, never built in.
# Built by deploy/docker-compose.yml (context: the project root).
FROM node:24-bookworm-slim AS base
# Prisma's query engine needs OpenSSL, which the slim image leaves out
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# npm ci runs `prisma generate` (postinstall), which needs the schema
COPY prisma ./prisma
RUN npm ci

FROM base AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 BUILD_STANDALONE=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM base AS run
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN useradd --uid 1001 --create-home store
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
# the generated Prisma client and its query engine (the standalone trace can miss the engine binary)
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma/client ./node_modules/@prisma/client
# uploads are mounted here; .next is written to at runtime (image and page caches)
RUN mkdir -p storage/uploads .next/cache && chown -R store:store storage .next
USER store
EXPOSE 3000
CMD ["node", "server.js"]
