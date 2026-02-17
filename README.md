# linked-me API

![Node](https://img.shields.io/badge/node-22+-339933?logo=node.js&logoColor=white)
![NestJS](https://img.shields.io/badge/NestJS-11-E0234E?logo=nestjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-4169E1?logo=postgresql&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-7-2D3748?logo=prisma&logoColor=white)
![Railway](https://img.shields.io/badge/deploy-Railway-0B0D0E?logo=railway&logoColor=white)

API REST pour la plateforme linked-me.

## Getting started

### Prerequisite

- Node.js 22+
- PostgreSQL 17

### Installation

```bash
npm install
```

### Configuration

Copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
```

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection URL |
| `JWT_SECRET` | Secret key for JWT tokens |
| `ADMIN_EMAIL` | Initial admin account email |
| `ADMIN_PASSWORD` | Initial admin account password |

### Database

```bash
# Apply migrations
npx prisma migrate dev

# Generate Prisma client (also included in npm run build)
npx prisma generate

# Seed the database (roles, permissions, admin)
npx prisma db seed
```

### Run

```bash
# Development (watch mode)
npm run start:dev

# Production
npm run build
npm run start:prod
```

## Scripts

| Script | Description |
|--------|-------------|
| `npm run build` | Generate Prisma client + compile TypeScript |
| `npm run start:dev` | Start server in watch mode |
| `npm run start:prod` | Start compiled build |
| `npm run prisma:migrate` | Create/apply a migration |
| `npm run prisma:seed` | Seed database (upsert roles, permissions, admin) |
| `npm run prisma:reset` | Full database reset + re-seed |

## API Documentation

Swagger is available in development at `/api` (disabled in production).

## Authentication

The API uses **JWT Bearer tokens**. To authenticate:

1. `POST /auth/login` with `email` and `password`
2. Use the returned `access_token` in the `Authorization` header: `Bearer <token>`

Access control is based on **RBAC** (Role-Based Access Control):
- Each user has one or more **roles** (USER, ADMIN...)
- Each role has **permissions** (e.g. `user:read`, `role:manage`)
- Routes are protected by permission-based guards

## Architecture

```
src/
├── auth/           # Authentication (JWT, guards, decorators, permissions)
├── admin/          # Administration (roles, permissions, users)
├── users/          # User profile management
├── prisma/         # PrismaModule (service + connection)
├── app.module.ts   # Root module
└── main.ts         # Bootstrap
```

## Deployment

Deployed on **Railway** via push to `master`.

- Build: `npm run build`
- Start: migrations + seed + server (automatic)
- Config: `railway.toml`

## Git flow

- `master` — production (protected, merge via PR only)
- `develop` — integration
- `feature/*` — feature branches from develop

## Author

**Christophe Gasquez** — [GitHub](https://github.com/ChristopheGasquez)
