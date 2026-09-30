-- v4.29.39: persistent external-data snapshot foundation
CREATE TABLE "ExternalDataSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceKey" TEXT NOT NULL,
    "payloadJson" TEXT NOT NULL,
    "sourceAsOf" DATETIME,
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME,
    "confidence" TEXT NOT NULL DEFAULT 'medium',
    "stale" BOOLEAN NOT NULL DEFAULT false,
    "version" TEXT,
    "lastError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "ExternalDataSnapshot_provider_resourceType_resourceKey_key" ON "ExternalDataSnapshot"("provider", "resourceType", "resourceKey");
CREATE INDEX "ExternalDataSnapshot_resourceType_resourceKey_idx" ON "ExternalDataSnapshot"("resourceType", "resourceKey");
CREATE INDEX "ExternalDataSnapshot_expiresAt_idx" ON "ExternalDataSnapshot"("expiresAt");
