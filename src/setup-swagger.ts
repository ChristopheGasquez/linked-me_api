import { INestApplication } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder, OpenAPIObject } from '@nestjs/swagger';
import { AuthModule } from './core/auth/auth.module.js';
import { ProfilesModule } from './core/profiles/profiles.module.js';
import { AdminModule } from './core/admin/admin.module.js';
import { AuditModule } from './core/audit/audit.module.js';
import { TasksModule } from './core/tasks/tasks.module.js';
import { ResponseCodes } from './common/constants/response-codes.js';
import { AuditAction } from './core/audit/audit-actions.constants.js';

const SWAGGER_SECTIONS = [
  { label: 'Global API', path: '/docs', description: 'All endpoints' },
  {
    label: 'Core API',
    path: '/docs/core',
    description: 'Auth, profiles, administration, audit, tasks',
  },
  {
    label: 'Constants',
    path: '/docs/constants',
    description: 'Response codes and shared constants',
  },
];

type OperationExtensions = {
  tags?: string[];
  description?: string;
  'x-required-permissions'?: string[];
  'x-class-permissions'?: string[];
};

function swaggerNav(currentPath: string): string {
  const links = SWAGGER_SECTIONS.filter((s) => s.path !== currentPath)
    .map((s) => `- **[${s.label}](${s.path})** — ${s.description}`)
    .join('\n');
  return `\n\n## Documentation sections\n${links}`;
}

function injectPermissionsInDescriptions(document: OpenAPIObject): void {
  for (const pathItem of Object.values(document.paths)) {
    for (const operation of Object.values(
      pathItem as Record<string, OperationExtensions>,
    )) {
      const perms = operation['x-required-permissions'];
      if (perms?.length) {
        operation.description =
          (operation.description ?? '') +
          `\n\n**Required permissions:** \`${perms.join('`, `')}\``;
      }
    }
  }
}

function injectRealmPermissionsInTags(document: OpenAPIObject): void {
  const HTTP_METHODS = [
    'get',
    'post',
    'put',
    'patch',
    'delete',
    'options',
    'head',
    'trace',
  ];
  const tagRealms = new Map<string, Set<string>>();

  for (const pathItem of Object.values(document.paths)) {
    const pathItemRealms =
      (pathItem as OperationExtensions)['x-class-permissions'] ?? [];
    for (const [method, operation] of Object.entries(
      pathItem as Record<string, OperationExtensions>,
    )) {
      if (!HTTP_METHODS.includes(method)) continue;
      const opRealms = operation['x-class-permissions'] ?? [];
      const allRealms = [...new Set([...pathItemRealms, ...opRealms])];
      const tags = operation.tags ?? [];
      for (const tag of tags) {
        if (!tagRealms.has(tag)) tagRealms.set(tag, new Set());
        allRealms.forEach((p) => tagRealms.get(tag)!.add(p));
      }
    }
  }

  document.tags ??= [];
  for (const [tagName, realms] of tagRealms) {
    if (realms.size === 0) continue;
    const realmNote = `**Required realm:** \`${[...realms].join('`, `')}\``;
    const existing = document.tags.find((t) => t.name === tagName);
    if (existing) {
      existing.description = (existing.description ?? '') + '\n\n' + realmNote;
    } else {
      document.tags.push({ name: tagName, description: realmNote });
    }
  }
}

function buildDocument(
  app: INestApplication,
  document: OpenAPIObject,
): OpenAPIObject {
  injectPermissionsInDescriptions(document);
  injectRealmPermissionsInTags(document);
  return document;
}

export function setupSwagger(app: INestApplication): void {
  // Global doc — all endpoints
  const globalDocument = buildDocument(
    app,
    SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('linked-me API')
        .setDescription(
          'linked-me platform API — full documentation' +
            '\n\n## Spec\n- [OpenAPI JSON](/docs-json)\n- [OpenAPI YAML](/docs-yaml)' +
            swaggerNav('/docs'),
        )
        .setVersion('1.0')
        .addBearerAuth()
        .build(),
    ),
  );
  SwaggerModule.setup('docs', app, globalDocument);

  // Core doc — auth, profiles, admin, audit, tasks
  const coreDocument = buildDocument(
    app,
    SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('linked-me — Core API')
        .setDescription(
          'Auth, profiles, administration, audit, tasks' +
            swaggerNav('/docs/core'),
        )
        .setVersion('1.0')
        .addBearerAuth()
        .build(),
      {
        include: [
          AuthModule,
          ProfilesModule,
          AdminModule,
          AuditModule,
          TasksModule,
        ],
        // AdminModule has no controller of its own: scan its imported
        // modules (AdminRolesModule, AdminUsersModule) too
        deepScanRoutes: true,
      },
    ),
  );
  SwaggerModule.setup('docs/core', app, coreDocument);

  // Constants doc — response codes and shared constants
  const constantsDocument = buildDocument(
    app,
    SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('linked-me — Constants')
        .setDescription(
          'Response codes and shared constants for client-side i18n' +
            swaggerNav('/docs/constants'),
        )
        .setVersion('1.0')
        .build(),
    ),
  );
  constantsDocument.paths = {};
  constantsDocument.components = {
    schemas: {
      ResponseCodes: {
        description: 'Machine-readable response codes for client-side i18n',
        type: 'object',
        properties: Object.fromEntries(
          Object.entries(ResponseCodes).map(([key, value]) => [
            key,
            { type: 'string', example: value },
          ]),
        ),
      },
      AuditAction: {
        description: 'Audit log actions (GET /admin/audit-logs)',
        type: 'string',
        enum: Object.values(AuditAction),
      },
    },
  };
  SwaggerModule.setup('docs/constants', app, constantsDocument);

  // Future apps: add a new buildDocument + SwaggerModule.setup('docs/<app>', ...) here
}
