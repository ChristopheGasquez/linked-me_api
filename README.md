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
| `JWT_ACCESS_EXPIRY` | Access token lifetime (default: `15m`) |
| `JWT_REFRESH_SECRET` | Secret key for refresh tokens |
| `JWT_REFRESH_EXPIRY` | Refresh token lifetime (default: `7d`) |
| `ADMIN_EMAIL` | Initial admin account email |
| `ADMIN_PASSWORD` | Initial admin account password |
| `RESEND_API_KEY` | API key for transactional emails (Resend) |
| `UNVERIFIED_USER_TTL_HOURS` | Hours before unverified accounts are deleted |
| `SWAGGER_ENABLED` | Set to `true` to enable Swagger UI |

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

Swagger is available at `/api` when `SWAGGER_ENABLED=true` (disabled by default).

A Postman collection is available in [`docs/`](docs/) for testing all endpoints.

## Authentication

The API uses **JWT Bearer tokens**. To authenticate:

1. `POST /auth/login` with `email` and `password`
2. Use the returned `access_token` in the `Authorization` header: `Bearer <token>`
3. When the access token expires, call `POST /auth/refresh` with the `refresh_token` to get a new pair
4. `POST /auth/logout` to revoke a refresh token, or `POST /auth/logout-all` to revoke all sessions

Tokens use **rotation**: each refresh invalidates the previous refresh token and issues a new one.

## Rate Limiting

All endpoints are limited to **60 requests per minute** per IP.
Authentication endpoints (`/auth/login`, `/auth/register`) have a stricter limit: **10 requests per 15 minutes** per IP.
`/auth/resend-verification` is limited to **3 requests per hour** per IP. Exceeding these limits returns a `429 Too Many Requests`.

Access control is based on **RBAC** (Role-Based Access Control):
- Each user has one or more **roles** (USER, ADMIN...)
- Each role has **permissions** (e.g. `realm:admin`, `admin:role:read`, `profile:read`)
- Routes are protected by permission-based guards

## Architecture

```
src/
├── auth/           # Authentication (JWT, guards, decorators, permissions)
├── admin/          # Administration
│   ├── roles/      #   Roles + permissions management
│   ├── users/      #   Full user management (with roles)
│   └── maintenance/ #  Cleanup endpoints
├── profiles/       # Public user profiles (limited fields)
├── common/         # Shared utilities (pagination, DTOs)
├── mail/           # Email service (Resend)
├── tasks/          # Scheduled tasks (cron cleanup)
├── prisma/         # PrismaModule (service + connection)
├── app.module.ts   # Root module
└── main.ts         # Bootstrap
```

## Pagination

List endpoints support offset-based pagination with search and filters.

**Query parameters:**

| Parameter | Default | Description |
|-----------|---------|-------------|
| `page` | `1` | Page number |
| `limit` | `20` | Items per page (max 100) |
| `sortBy` | `createdAt` | Sort field |
| `sortOrder` | `desc` | Sort direction (`asc` / `desc`) |
| `search` | — | Text search (depends on endpoint) |

**Response format:**

```json
{
  "data": [...],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8,
    "sortBy": "createdAt",
    "sortOrder": "desc",
    "search": "john",
    "filters": { "role": "ADMIN" }
  }
}
```

Each endpoint may support additional filters (e.g. `role`, `isEmailChecked` for `GET /admin/users`).

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
