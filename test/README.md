# Tests

## Strategy

| Layer    | Tool               | Where                                 | What it covers                                                                                                                          |
| -------- | ------------------ | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **Unit** | Vitest             | `src/**/*.spec.ts` (next to the file) | Business logic in isolation: services, guards, JWT strategy, filters, `src/common/` utilities. Prisma, JWT, mail and bcrypt are mocked. |
| **E2E**  | Vitest + Supertest | `test/**/*.e2e-spec.ts`               | The assembled HTTP pipeline on a real PostgreSQL database: routes, guards and permissions, DTO validation, filters, response shapes.    |

**Why controllers, DTOs and modules are not unit-tested:** controllers only delegate to services, and their real behaviour lives in decorators (`@UseGuards`, `@RequirePermissions`, `@Body` + class-validator, pipes) that only run when a real request goes through the Nest pipeline. A unit test calling the method directly would bypass all of it. E2E tests cover them instead.

## Getting started

Prerequisites: PostgreSQL 17 running locally.

```bash
# 1. Create the test database (once)
createdb linked_me_test

# 2. Create your local test env file (once), then adjust DATABASE_URL
cp .env.test.example .env.test

# 3. Run
npm test            # unit tests (no database needed)
npm run test:e2e    # E2E tests
npm run test:cov    # unit + E2E tests, merged coverage report (coverage/) — needs the test database
```

## Architecture

```
test/
  setup/
    global-setup.ts       # once per run: safety check, migrate deploy, truncate, seed
    app.factory.ts        # createTestApp(): full app, production config, mail faked, throttling off
    fake-mail.service.ts  # replaces MailService, records mails and their tokens
    db.ts                 # cleanDatabase(): removes test data, keeps seed data
    auth.helper.ts        # createVerifiedUser, login, loginAsAdmin, bearer, uniqueEmail
    permissions.helper.ts # createUserWithPermissions: user whose only role holds exactly the given permissions
  core/
    route-security.e2e-spec.ts  # route security net (see below)
    auth.e2e-spec.ts            # register, email verification, login & lockout, refresh & sessions, forgot/reset password
    profiles.e2e-spec.ts        # public profile, update (DTO whitelist, cache), password change, account deletion
  setup.e2e-spec.ts       # self-test of the tooling above
  health.e2e-spec.ts
```

## Route security net

`test/core/route-security.e2e-spec.ts` lists **every route of the app** in one of three tables:

| Table                  | Checks                                                                                                                                                                     |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PROTECTED_ROUTES`     | 401 without token · 403 for **each** required permission when it is the only one missing (realm and route permission are both enforced) · access granted with exactly them |
| `AUTHENTICATED_ROUTES` | 401 without token · access granted to a user without any permission                                                                                                        |
| `PUBLIC_ROUTES`        | reachable without token (never 401/403)                                                                                                                                    |

A **route inventory** test compares the tables with the routes actually registered in Express: adding a route without listing it fails the suite.

"Access granted" means the status is neither 401 nor 403. Path params use `999999` and bodies are empty, so 400/404 are expected and fine: Nest runs guards before pipes and handlers, so reaching them proves the guard let the request through. Business behaviour is tested in the domain suites.

**When you add a route:** add one line to the matching table, with the full set of required permissions (class-level realm + method-level permission, since `PermissionsGuard` merges both and requires all of them). Mark it `destructive: true` if the call deletes the calling user.

## Technical choices

- **Real database, not mocks.** E2E tests run against a dedicated PostgreSQL database, so Prisma queries, constraints and cascades are really exercised.
- **Database lifecycle.** Before the run, `global-setup.ts` applies migrations (`prisma migrate deploy`), empties every table (`TRUNCATE … RESTART IDENTITY CASCADE`, except `_prisma_migrations`) and runs the seed. Between suites, `cleanDatabase()` removes what tests created and keeps seed data. `migrate reset` is not used: Prisma blocks it when run by AI agents, and truncating is faster.
- **Safety net.** Since the setup empties the database, it refuses to run unless `DATABASE_URL` points to a **local** host (`localhost`, `127.0.0.1`, `::1`) **and** a database whose name ends with `_test`.
- **Isolated env.** E2E tests load `.env.test` only, never merged with `.env`, so dev values (database, Resend key) cannot leak into tests. In CI there is no `.env.test`: the job's env variables are used.
- **Same pipeline as production.** `src/configure-app.ts` (helmet, CORS, global filter, validation pipe) is shared by `main.ts` and `createTestApp()`.
- **Mail.** `MailService` is replaced by `FakeMailService`: nothing is sent, and tests read verification and reset tokens with `t.mail.lastToken(email, type)`.
- **Throttling disabled.** The throttler is a global `APP_GUARD`, which `overrideGuard()` cannot replace, so the factory overrides the throttler module options with `skipIf: () => true`.
- **Sequential files.** All suites share one database, so files run one after another (`fileParallelism: false`).
- **Unique data.** Use `uniqueEmail()` for every user, so tests never depend on each other's data.

## Writing an E2E test

```ts
import request from 'supertest';
import { createTestApp, type TestApp } from './setup/app.factory.js';
import { bearer, createVerifiedUser } from './setup/auth.helper.js';
import { cleanDatabase } from './setup/db.js';

describe('Profiles (e2e)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
    await cleanDatabase(t.prisma);
  });

  afterAll(() => t.app.close());

  it('GET /profiles/me → 200 for a verified user', async () => {
    const user = await createVerifiedUser(t);

    await request(t.http)
      .get('/profiles/me')
      .set(bearer(user.accessToken))
      .expect(200);
  });
});
```

Conventions:

- One file per domain (`test/core/<domain>.e2e-spec.ts`).
- Never modify the seeded `USER` / `ADMIN` roles: create dedicated roles instead (they are removed by `cleanDatabase()`).
- `POST` routes return **201** unless they declare `@HttpCode` (login creates a session, hence 201).

## Coverage

`npm run test:cov` runs both Vitest projects (unit + E2E) and writes a single merged V8 report to `coverage/`. Unit tests alone cover the services; E2E tests add controllers, DTOs and guards wiring.

Excluded: `main.ts`, `*.module.ts`, `*.mock.ts`, `*.spec.ts`.

## Known bugs

Bugs found by the E2E tests and not fixed yet. Their tests are skipped with an explicit `[KNOWN BUG: …]` label so they stay visible in every report: un-skip them in the fix PR.

| Bug                                                                                                                                                                                                                                                                                                                        | Skipped tests                                                                            |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| **Refresh tokens have no `jti`.** The payload is `{ sub, email }` plus `iat`/`exp` in seconds, so two refresh tokens issued for the same user in the same second are identical: refresh rotation is ineffective, and two devices logging in within the same second share one session (logging out one logs out the other). | `auth.e2e-spec.ts`: `refresh rotates tokens…`, `two logins create two distinct sessions` |
| **Deleted account still authenticated for up to 5 min.** `ProfilesService.remove()` does not invalidate the user cache (unlike `update()`), and `JwtStrategy.validate()` reads the cache before the database: the access token of a deleted account keeps working on protected routes, with its cached permissions.        | `profiles.e2e-spec.ts`: `the access token of a deleted account is rejected`              |

## CI

`.github/workflows/ci.yml` starts a disposable `postgres:17` service container (database `linked_me_test`, destroyed with the job) and runs `npm test` then `npm run test:e2e`. Env values are declared in the workflow: they are fake and public, no secret is needed.
