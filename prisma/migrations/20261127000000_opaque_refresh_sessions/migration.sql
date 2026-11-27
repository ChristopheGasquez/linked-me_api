-- Existing JWT refresh tokens cannot be converted: every user logs in again
DELETE FROM "refresh_tokens";

-- AlterTable
ALTER TABLE "refresh_tokens" DROP COLUMN "token",
ADD COLUMN     "previousTokenHash" CHAR(64),
ADD COLUMN     "rotatedAt" TIMESTAMP(3),
ADD COLUMN     "tokenHash" CHAR(64) NOT NULL;
