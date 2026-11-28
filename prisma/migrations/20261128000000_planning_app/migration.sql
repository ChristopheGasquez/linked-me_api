-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "planning";

-- CreateTable
CREATE TABLE "planning"."plannings" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "firstDay" SMALLINT NOT NULL,
    "dayCount" SMALLINT NOT NULL,
    "startMinute" SMALLINT NOT NULL,
    "endMinute" SMALLINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plannings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "planning"."categories" (
    "id" UUID NOT NULL,
    "planningId" UUID NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "color" SMALLINT NOT NULL,
    "position" SMALLINT NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "planning"."events" (
    "id" UUID NOT NULL,
    "planningId" UUID NOT NULL,
    "categoryId" UUID,
    "day" SMALLINT NOT NULL,
    "startMinute" SMALLINT NOT NULL,
    "endMinute" SMALLINT NOT NULL,
    "title" VARCHAR(100) NOT NULL,
    "location" VARCHAR(200),
    "description" VARCHAR(2000),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "plannings_ownerId_createdAt_idx" ON "planning"."plannings"("ownerId", "createdAt");

-- CreateIndex
CREATE INDEX "categories_planningId_idx" ON "planning"."categories"("planningId");

-- CreateIndex
CREATE INDEX "events_planningId_idx" ON "planning"."events"("planningId");

-- CreateIndex
CREATE INDEX "events_categoryId_idx" ON "planning"."events"("categoryId");

-- AddForeignKey
ALTER TABLE "planning"."categories" ADD CONSTRAINT "categories_planningId_fkey" FOREIGN KEY ("planningId") REFERENCES "planning"."plannings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planning"."events" ADD CONSTRAINT "events_planningId_fkey" FOREIGN KEY ("planningId") REFERENCES "planning"."plannings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planning"."events" ADD CONSTRAINT "events_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "planning"."categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

