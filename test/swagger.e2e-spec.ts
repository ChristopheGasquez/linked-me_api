import request from 'supertest';
import { ResponseCodes } from '../src/common/constants/response-codes.js';
import { Permissions } from '../src/core/auth/permissions.constants.js';
import { AuditAction } from '../src/core/audit/audit-actions.constants.js';
import { createTestApp, type TestApp } from './setup/app.factory.js';

type OpenApiDoc = {
  paths: Record<string, Record<string, { description?: string }>>;
  tags?: { name: string; description?: string }[];
  components?: { schemas?: Record<string, any> };
};

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'];

/** "/admin/roles/{id}" and "/admin/roles/:id" → "/admin/roles/:param" */
const pattern = (path: string) =>
  path.replace(/\/(\{[^}]+\}|:[^/]+)/g, '/:param');

/** "GET /admin/roles/:param" for every operation of the document. */
const operationsOf = (doc: OpenApiDoc) =>
  Object.entries(doc.paths).flatMap(([path, item]) =>
    Object.keys(item)
      .filter((m) => HTTP_METHODS.includes(m))
      .map((m) => `${m.toUpperCase()} ${pattern(path)}`),
  );

describe('Swagger docs (e2e)', () => {
  let t: TestApp;
  let global: OpenApiDoc;
  let core: OpenApiDoc;
  let constants: OpenApiDoc;

  const fetchDoc = async (url: string) =>
    (await request(t.http).get(url).expect(200)).body as OpenApiDoc;

  beforeAll(async () => {
    t = await createTestApp({ swagger: true });
    [global, core, constants] = await Promise.all([
      fetchDoc('/docs-json'),
      fetchDoc('/docs/core-json'),
      fetchDoc('/docs/constants-json'),
    ]);
  });

  afterAll(() => t.app.close());

  it('serves the Swagger UI pages', async () => {
    for (const url of ['/docs', '/docs/core', '/docs/constants']) {
      const res = await request(t.http).get(url).redirects(1);
      expect(res.status).toBe(200);
      expect(res.text).toContain('swagger');
    }
  });

  // ─────────────────────────────────────────────────────────────
  // /docs/constants — the front builds its i18n from it
  // ─────────────────────────────────────────────────────────────
  describe('/docs/constants', () => {
    it('exposes every response code with its value', () => {
      const schema = constants.components?.schemas?.ResponseCodes;

      expect(schema).toBeDefined();
      expect(schema.properties).toEqual(
        Object.fromEntries(
          Object.entries(ResponseCodes).map(([key, value]) => [
            key,
            { type: 'string', example: value },
          ]),
        ),
      );
    });

    it('exposes every audit action', () => {
      expect(constants.components?.schemas?.AuditAction).toMatchObject({
        type: 'string',
        enum: Object.values(AuditAction),
      });
    });

    it('contains no endpoint', () => {
      expect(constants.paths).toEqual({});
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Audit actions — the front checks its list against the enum
  // ─────────────────────────────────────────────────────────────
  describe('AuditAction enum', () => {
    const ref = { $ref: '#/components/schemas/AuditAction' };

    it('is a shared schema listing every audit action', () => {
      for (const doc of [global, core]) {
        expect(doc.components?.schemas?.AuditAction).toEqual({
          type: 'string',
          enum: Object.values(AuditAction),
        });
      }
    });

    it('is referenced by the "action" query param of GET /admin/audit-logs', () => {
      const operation = core.paths['/admin/audit-logs'].get as {
        parameters: { name: string; in: string; schema?: unknown }[];
      };
      const param = operation.parameters.find(
        (p) => p.name === 'action' && p.in === 'query',
      );

      expect(param?.schema).toEqual(ref);
    });

    it('is referenced by the "action" field of AuditLogResponseDto', () => {
      expect(
        core.components?.schemas?.AuditLogResponseDto.properties.action,
      ).toEqual({ allOf: [ref] });
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Permissions injected into the docs
  // ─────────────────────────────────────────────────────────────
  describe('permissions', () => {
    it('adds the route permissions to the operation description', () => {
      const op = global.paths['/admin/users/{id}'].delete;

      expect(op.description).toContain(
        `**Required permissions:** \`${Permissions.REALM_ADMIN}\`, \`${Permissions.ADMIN_USER_DELETE}\``,
      );
    });

    it('adds the class-level permissions to the operation description', () => {
      const op = global.paths['/admin/audit-logs'].get;

      expect(op.description).toContain(
        `**Required permissions:** \`${Permissions.REALM_AUDIT}\`, \`${Permissions.AUDIT_LOG_READ}\``,
      );
    });

    it('does not add a permissions note to routes without route permission', () => {
      const op = global.paths['/auth/login'].post;

      expect(op.description ?? '').not.toContain('Required permissions');
    });

    it.each([
      ['Admin / Users', Permissions.REALM_ADMIN],
      ['Admin / Roles', Permissions.REALM_ADMIN],
      ['Profiles', Permissions.REALM_PROFILE],
      ['Tasks', Permissions.REALM_TASK],
      ['Admin — Audit', Permissions.REALM_AUDIT],
    ])('adds the realm to the "%s" tag', (tagName, realm) => {
      const tag = global.tags?.find((t) => t.name === tagName);

      expect(tag?.description).toContain(`**Required realm:** \`${realm}\``);
    });

    it('only lists realms in the tag, not class-level permissions', () => {
      const tag = global.tags?.find((t) => t.name === 'Admin — Audit');

      expect(tag?.description).not.toContain(Permissions.AUDIT_LOG_READ);
    });

    it('does not add a realm to the "Auth" tag (no class-level permission)', () => {
      const tag = global.tags?.find((t) => t.name === 'Auth');

      expect(tag?.description ?? '').not.toContain('Required realm');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Completeness
  // ─────────────────────────────────────────────────────────────
  describe('completeness', () => {
    /** Every route registered in Express, except the Swagger routes themselves. */
    const appRoutes = () =>
      t.app
        .getHttpAdapter()
        .getInstance()
        .router.stack.filter((layer: any) => layer.route)
        .flatMap((layer: any) =>
          Object.keys(layer.route.methods).map(
            (m) => `${m.toUpperCase()} ${pattern(layer.route.path)}`,
          ),
        )
        .filter((route: string) => !/ \/docs(\/|-|$)/.test(route));

    it('/docs documents every route of the app', () => {
      expect([...operationsOf(global)].sort()).toEqual(
        [...new Set(appRoutes())].sort(),
      );
    });

    it('/docs/core documents every core route (auth, profiles, admin, audit, tasks) and only them', () => {
      const coreRoutes = appRoutes().filter((route: string) =>
        /^\w+ \/(auth|profiles|admin|tasks)(\/|$)/.test(route),
      );

      expect([...operationsOf(core)].sort()).toEqual(
        [...new Set(coreRoutes)].sort(),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Success responses — the front reads `code` from the examples
  // ─────────────────────────────────────────────────────────────
  describe('success responses', () => {
    type Operation = {
      responses?: Record<
        string,
        { content?: Record<string, { schema?: { $ref?: string } }> }
      >;
    };

    /** "GET /auth/me" → schema name, for every 2xx response with a $ref. */
    const successSchemas = () =>
      Object.entries(global.paths).flatMap(([path, item]) =>
        Object.entries(item as Record<string, Operation>)
          .filter(([m]) => HTTP_METHODS.includes(m))
          .flatMap(([method, op]) =>
            Object.entries(op.responses ?? {})
              .filter(([status]) => status.startsWith('2'))
              .map(([, res]) => res.content?.['application/json']?.schema?.$ref)
              .filter((ref): ref is string => !!ref)
              .map((ref) => ({
                route: `${method.toUpperCase()} ${path}`,
                schema: ref.split('/').pop()!,
              })),
          ),
      );

    it('GET / is documented under the "Health" tag with HealthResponseDto', () => {
      const operation = global.paths['/']?.get as { tags?: string[] };

      expect(operation.tags).toEqual(['Health']);
      expect(successSchemas()).toContainEqual({
        route: 'GET /',
        schema: 'HealthResponseDto',
      });
    });

    it('no route documents the generic MessageResponseDto as its success response', () => {
      const generic = successSchemas()
        .filter(({ schema }) => schema === 'MessageResponseDto')
        .map(({ route }) => route);

      expect(generic).toEqual([]);
    });

    it('every success "code" example is an existing response code', () => {
      const codes = new Set<string>(Object.values(ResponseCodes));
      const schemas = global.components?.schemas ?? {};

      const invalid = successSchemas()
        .map(({ route, schema }) => ({
          route,
          example: schemas[schema]?.properties?.code?.example as
            | string
            | undefined,
        }))
        .filter(({ example }) => example !== undefined && !codes.has(example));

      expect(invalid).toEqual([]);
    });

    it('success responses with a "code" do not share the same example', () => {
      const schemas = global.components?.schemas ?? {};
      const byCode = new Map<string, Set<string>>();
      for (const { schema } of successSchemas()) {
        const code = schemas[schema]?.properties?.code?.example;
        if (code) byCode.set(code, (byCode.get(code) ?? new Set()).add(schema));
      }

      const shared = [...byCode].filter(([, s]) => s.size > 1);
      expect(shared).toEqual([]);
    });
  });
});
