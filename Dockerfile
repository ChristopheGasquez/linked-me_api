# ── Étape 1 : Installation des dépendances ──────────────────
FROM node:22-slim AS deps

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ── Étape 2 : Build de l'application ────────────────────────
FROM node:22-slim AS builder

WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Génère le client Prisma puis compile NestJS
RUN npx prisma generate && npm run build

# ── Étape 3 : Image finale (production) ─────────────────────
FROM node:22-slim AS runner

# OpenSSL nécessaire pour Prisma
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copie uniquement ce qui est nécessaire pour tourner
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/generated ./generated
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "dist/main.js"]
