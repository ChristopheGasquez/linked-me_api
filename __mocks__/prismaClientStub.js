'use strict';

// Minimal CJS stub for generated/prisma/client.
// The real Prisma client uses import.meta.url (ESM-only), which can't be compiled
// in Jest's CommonJS mode. Since PrismaService is always mocked with jest-mock-extended
// in unit tests, this stub only needs to satisfy the class definition.

class PrismaClient {
  constructor(options) {}
}

module.exports = {
  PrismaClient,
  // Prisma namespace: only used for TypeScript casts (removed at runtime)
  Prisma: {},
};
