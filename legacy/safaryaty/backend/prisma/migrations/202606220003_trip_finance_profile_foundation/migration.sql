-- v4.29.49: normalized one-to-one finance profile foundation.
-- Legacy Trip.notes remains readable during the dual-read / dual-write transition.
CREATE TABLE "TripFinanceProfile" (
    "tripId" TEXT NOT NULL PRIMARY KEY,
    "startingSavings" REAL NOT NULL DEFAULT 0,
    "supportMoney" REAL NOT NULL DEFAULT 0,
    "safetyReserve" REAL NOT NULL DEFAULT 0,
    "reserveEnabled" BOOLEAN NOT NULL DEFAULT false,
    "returnWithZero" BOOLEAN NOT NULL DEFAULT true,
    "rateBookJson" TEXT,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "normalizedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TripFinanceProfile_tripId_fkey"
      FOREIGN KEY ("tripId") REFERENCES "Trip" ("id")
      ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "TripFinanceProfile_normalizedAt_idx"
ON "TripFinanceProfile"("normalizedAt");
