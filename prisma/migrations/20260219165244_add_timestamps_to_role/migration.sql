/*
  Warnings:

  - Added the required column `updatedAt` to the `roles` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "roles" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Remove the default from updatedAt (managed by Prisma @updatedAt)
ALTER TABLE "roles" ALTER COLUMN "updatedAt" DROP DEFAULT;
