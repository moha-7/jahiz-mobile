-- Safaryaty v4.29.51 operational cutover receipt.
-- Safe to apply after the v4.29.50 PostgreSQL baseline.

CREATE TABLE "MigrationReceipt" (
  "id" TEXT NOT NULL,
  "bundleChecksum" TEXT NOT NULL,
  "targetFingerprint" TEXT NOT NULL,
  "appVersion" TEXT,
  "sessionsIncluded" BOOLEAN NOT NULL DEFAULT FALSE,
  "verifiedAt" TIMESTAMPTZ(3) NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MigrationReceipt_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MigrationReceipt_bundleChecksum_check" CHECK ("bundleChecksum" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "MigrationReceipt_targetFingerprint_check" CHECK ("targetFingerprint" ~ '^[a-f0-9]{64}$')
);

CREATE UNIQUE INDEX "MigrationReceipt_bundleChecksum_key" ON "MigrationReceipt"("bundleChecksum");
CREATE INDEX "MigrationReceipt_verifiedAt_idx" ON "MigrationReceipt"("verifiedAt");
