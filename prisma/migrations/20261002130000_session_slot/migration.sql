-- DropIndex
DROP INDEX "ClassSession_scheduleId_startsAt_key";

-- AlterTable
ALTER TABLE "ClassSession" ADD COLUMN     "slotAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "ClassSession_scheduleId_slotAt_key" ON "ClassSession"("scheduleId", "slotAt");

