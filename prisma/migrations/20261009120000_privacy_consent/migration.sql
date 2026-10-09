-- AlterTable
ALTER TABLE "StudentProfile" ADD COLUMN     "guardianConsentAt" TIMESTAMP(3),
ADD COLUMN     "guardianConsentById" TEXT,
ADD COLUMN     "guardianConsentMethod" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "policyAcceptedAt" TIMESTAMP(3),
ADD COLUMN     "policyVersion" TEXT;

