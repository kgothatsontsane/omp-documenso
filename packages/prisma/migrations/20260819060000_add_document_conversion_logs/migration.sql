-- CreateTable
CREATE TABLE "DocumentConversionLog" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "success" BOOLEAN NOT NULL,
    "transport" TEXT NOT NULL,
    "durationMs" INTEGER,
    "inputBytes" INTEGER,
    "outputBytes" INTEGER,
    "errorCode" TEXT,
    "errorMessage" TEXT,

    CONSTRAINT "DocumentConversionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TriggerUsageRecord" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "taskId" TEXT NOT NULL,
    "runId" TEXT,
    "costInCents" DOUBLE PRECISION NOT NULL,
    "durationMs" INTEGER,

    CONSTRAINT "TriggerUsageRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DocumentConversionLog_createdAt_idx" ON "DocumentConversionLog"("createdAt");

-- CreateIndex
CREATE INDEX "DocumentConversionLog_success_idx" ON "DocumentConversionLog"("success");

-- CreateIndex
CREATE INDEX "DocumentConversionLog_transport_idx" ON "DocumentConversionLog"("transport");

-- CreateIndex
CREATE INDEX "TriggerUsageRecord_createdAt_idx" ON "TriggerUsageRecord"("createdAt");

-- CreateIndex
CREATE INDEX "TriggerUsageRecord_taskId_idx" ON "TriggerUsageRecord"("taskId");