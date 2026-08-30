-- Performance indexes: reduce full-table scans on hot query paths.
-- Envelope.templateId is filtered in the documents list and getStats.
CREATE INDEX "Envelope_templateId_idx" ON "Envelope"("templateId");

-- UserSecurityAuditLog is queried per user (login/audit page) and grows with auth events.
CREATE INDEX "UserSecurityAuditLog_userId_createdAt_idx" ON "UserSecurityAuditLog"("userId", "createdAt");

-- BackgroundJob cron sweep polls by status/submittedAt.
CREATE INDEX "BackgroundJob_status_submittedAt_idx" ON "BackgroundJob"("status", "submittedAt");
CREATE INDEX "BackgroundJob_jobId_status_idx" ON "BackgroundJob"("jobId", "status");

-- BackgroundJobTask lookups by job and by pending status.
CREATE INDEX "BackgroundJobTask_jobId_idx" ON "BackgroundJobTask"("jobId");
CREATE INDEX "BackgroundJobTask_status_idx" ON "BackgroundJobTask"("status");

-- WebhookCall retries/lookups by webhook.
CREATE INDEX "WebhookCall_webhookId_status_createdAt_idx" ON "WebhookCall"("webhookId", "status", "createdAt");