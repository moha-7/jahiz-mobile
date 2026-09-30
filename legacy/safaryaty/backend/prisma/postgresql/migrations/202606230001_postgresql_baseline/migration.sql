-- Safaryaty v4.29.50 PostgreSQL baseline.
-- Apply only to an empty PostgreSQL database after validating the migration bundle.

CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN', 'SUPER_ADMIN');
CREATE TYPE "Plan" AS ENUM ('FREE', 'PRO', 'BUSINESS');
CREATE TYPE "TripStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED', 'DELETED');
CREATE TYPE "Frequency" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY', 'ONE_TIME', 'TRIP_TOTAL');
CREATE TYPE "PaymentStatus" AS ENUM ('UNPAID', 'PAID');
CREATE TYPE "SuggestionStatus" AS ENUM ('PENDING', 'ACCEPTED', 'IGNORED');
CREATE TYPE "SourceType" AS ENUM ('MANUAL', 'SUGGESTION', 'PRESET', 'SYSTEM');

CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "authProvider" TEXT NOT NULL DEFAULT 'password',
  "googleId" TEXT,
  "emailVerified" BOOLEAN NOT NULL DEFAULT FALSE,
  "profileImage" TEXT,
  "countryOfResidence" TEXT,
  "nationality" TEXT,
  "preferredCurrency" CHAR(3) NOT NULL DEFAULT 'AED',
  "preferredLanguage" TEXT NOT NULL DEFAULT 'en',
  "travelFrequency" TEXT,
  "travelPurpose" TEXT,
  "defaultTravelStyle" TEXT NOT NULL DEFAULT 'Balanced',
  "role" "Role" NOT NULL DEFAULT 'USER',
  "plan" "Plan" NOT NULL DEFAULT 'FREE',
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "User_preferredCurrency_check" CHECK ("preferredCurrency" ~ '^[A-Z]{3}$')
);

CREATE TABLE "Session" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "userAgent" TEXT,
  "ipAddress" TEXT,
  "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  "revokedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Session_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "Trip" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "status" "TripStatus" NOT NULL DEFAULT 'DRAFT',
  "fromCountry" TEXT,
  "fromAirport" TEXT,
  "toCountry" TEXT,
  "toAirport" TEXT,
  "departureDate" DATE,
  "returnDate" DATE,
  "travelers" INTEGER NOT NULL DEFAULT 1,
  "incomeCurrency" CHAR(3) NOT NULL DEFAULT 'AED',
  "tripCurrency" CHAR(3) NOT NULL DEFAULT 'AED',
  "displayCurrency" CHAR(3),
  "exchangeRate" DECIMAL(20,10) NOT NULL DEFAULT 1,
  "rateMode" TEXT NOT NULL DEFAULT 'MANUAL',
  "travelStyle" TEXT NOT NULL DEFAULT 'Balanced',
  "notes" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "Trip_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Trip_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Trip_travelers_check" CHECK ("travelers" > 0),
  CONSTRAINT "Trip_exchangeRate_check" CHECK ("exchangeRate" > 0),
  CONSTRAINT "Trip_date_order_check" CHECK ("departureDate" IS NULL OR "returnDate" IS NULL OR "returnDate" >= "departureDate"),
  CONSTRAINT "Trip_incomeCurrency_check" CHECK ("incomeCurrency" ~ '^[A-Z]{3}$'),
  CONSTRAINT "Trip_tripCurrency_check" CHECK ("tripCurrency" ~ '^[A-Z]{3}$'),
  CONSTRAINT "Trip_displayCurrency_check" CHECK ("displayCurrency" IS NULL OR "displayCurrency" ~ '^[A-Z]{3}$')
);

CREATE TABLE "TripFinanceProfile" (
  "tripId" TEXT NOT NULL,
  "startingSavings" DECIMAL(19,4) NOT NULL DEFAULT 0,
  "supportMoney" DECIMAL(19,4) NOT NULL DEFAULT 0,
  "safetyReserve" DECIMAL(19,4) NOT NULL DEFAULT 0,
  "reserveEnabled" BOOLEAN NOT NULL DEFAULT FALSE,
  "returnWithZero" BOOLEAN NOT NULL DEFAULT TRUE,
  "rateBookJson" TEXT,
  "schemaVersion" INTEGER NOT NULL DEFAULT 1,
  "normalizedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "TripFinanceProfile_pkey" PRIMARY KEY ("tripId"),
  CONSTRAINT "TripFinanceProfile_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "TripFinanceProfile_startingSavings_check" CHECK ("startingSavings" >= 0),
  CONSTRAINT "TripFinanceProfile_supportMoney_check" CHECK ("supportMoney" >= 0),
  CONSTRAINT "TripFinanceProfile_safetyReserve_check" CHECK ("safetyReserve" >= 0),
  CONSTRAINT "TripFinanceProfile_schemaVersion_check" CHECK ("schemaVersion" >= 1)
);

CREATE TABLE "Income" (
  "id" TEXT NOT NULL,
  "tripId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "amount" DECIMAL(19,4) NOT NULL,
  "currency" CHAR(3) NOT NULL,
  "frequency" "Frequency" NOT NULL DEFAULT 'MONTHLY',
  "startDate" DATE,
  "endDate" DATE,
  "expectedDate" DATE,
  "source" "SourceType" NOT NULL DEFAULT 'MANUAL',
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "Income_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Income_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Income_amount_check" CHECK ("amount" >= 0),
  CONSTRAINT "Income_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$'),
  CONSTRAINT "Income_date_order_check" CHECK ("startDate" IS NULL OR "endDate" IS NULL OR "endDate" >= "startDate")
);

CREATE TABLE "LifeCost" (
  "id" TEXT NOT NULL,
  "tripId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "category" TEXT,
  "amount" DECIMAL(19,4) NOT NULL,
  "currency" CHAR(3) NOT NULL,
  "frequency" "Frequency" NOT NULL DEFAULT 'MONTHLY',
  "startDate" DATE,
  "endDate" DATE,
  "dueDate" DATE,
  "source" "SourceType" NOT NULL DEFAULT 'MANUAL',
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "LifeCost_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LifeCost_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "LifeCost_amount_check" CHECK ("amount" >= 0),
  CONSTRAINT "LifeCost_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$'),
  CONSTRAINT "LifeCost_date_order_check" CHECK ("startDate" IS NULL OR "endDate" IS NULL OR "endDate" >= "startDate")
);

CREATE TABLE "Installment" (
  "id" TEXT NOT NULL,
  "tripId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "amount" DECIMAL(19,4) NOT NULL,
  "currency" CHAR(3) NOT NULL,
  "frequency" "Frequency" NOT NULL DEFAULT 'MONTHLY',
  "startDate" DATE,
  "endDate" DATE,
  "remainingMonths" INTEGER,
  "status" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
  "paidDate" TIMESTAMPTZ(3),
  "source" "SourceType" NOT NULL DEFAULT 'MANUAL',
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "Installment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Installment_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Installment_amount_check" CHECK ("amount" >= 0),
  CONSTRAINT "Installment_remainingMonths_check" CHECK ("remainingMonths" IS NULL OR "remainingMonths" >= 0),
  CONSTRAINT "Installment_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$'),
  CONSTRAINT "Installment_date_order_check" CHECK ("startDate" IS NULL OR "endDate" IS NULL OR "endDate" >= "startDate")
);

CREATE TABLE "TripCost" (
  "id" TEXT NOT NULL,
  "tripId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "amount" DECIMAL(19,4) NOT NULL,
  "currency" CHAR(3) NOT NULL,
  "timing" TEXT,
  "frequency" "Frequency" NOT NULL DEFAULT 'TRIP_TOTAL',
  "priority" TEXT,
  "status" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
  "dueDate" DATE,
  "paidDate" TIMESTAMPTZ(3),
  "source" "SourceType" NOT NULL DEFAULT 'MANUAL',
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "TripCost_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TripCost_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "TripCost_amount_check" CHECK ("amount" >= 0),
  CONSTRAINT "TripCost_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$')
);

CREATE TABLE "Expense" (
  "id" TEXT NOT NULL,
  "tripId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "amount" DECIMAL(19,4) NOT NULL,
  "currency" CHAR(3) NOT NULL,
  "amountBase" DECIMAL(19,4) NOT NULL,
  "date" DATE NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "Expense_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Expense_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Expense_amount_check" CHECK ("amount" >= 0),
  CONSTRAINT "Expense_amountBase_check" CHECK ("amountBase" >= 0),
  CONSTRAINT "Expense_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$')
);

CREATE TABLE "PresetSuggestion" (
  "id" TEXT NOT NULL,
  "tripId" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "currentAmount" DECIMAL(19,4) NOT NULL,
  "suggestedAmount" DECIMAL(19,4) NOT NULL,
  "currency" CHAR(3) NOT NULL,
  "difference" DECIMAL(19,4) NOT NULL,
  "message" TEXT NOT NULL,
  "status" "SuggestionStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "PresetSuggestion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PresetSuggestion_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PresetSuggestion_currentAmount_check" CHECK ("currentAmount" >= 0),
  CONSTRAINT "PresetSuggestion_suggestedAmount_check" CHECK ("suggestedAmount" >= 0),
  CONSTRAINT "PresetSuggestion_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$')
);

CREATE TABLE "PaymentMark" (
  "id" TEXT NOT NULL,
  "tripId" TEXT NOT NULL,
  "paymentKey" TEXT NOT NULL,
  "status" "PaymentStatus" NOT NULL DEFAULT 'PAID',
  "paidDate" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "PaymentMark_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PaymentMark_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PaymentMark_paymentKey_check" CHECK (length(trim("paymentKey")) > 0)
);

CREATE TABLE "ExternalDataSnapshot" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "resourceType" TEXT NOT NULL,
  "resourceKey" TEXT NOT NULL,
  "payloadJson" TEXT NOT NULL,
  "sourceAsOf" TIMESTAMPTZ(3),
  "fetchedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMPTZ(3),
  "confidence" TEXT NOT NULL DEFAULT 'medium',
  "stale" BOOLEAN NOT NULL DEFAULT FALSE,
  "version" TEXT,
  "lastError" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "ExternalDataSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");

CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");
CREATE INDEX "Session_userId_idx" ON "Session"("userId");
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");
CREATE INDEX "Session_userId_revokedAt_expiresAt_idx" ON "Session"("userId", "revokedAt", "expiresAt");

CREATE INDEX "Trip_userId_status_idx" ON "Trip"("userId", "status");
CREATE INDEX "Trip_userId_status_updatedAt_idx" ON "Trip"("userId", "status", "updatedAt");
CREATE INDEX "Trip_toCountry_departureDate_idx" ON "Trip"("toCountry", "departureDate");

CREATE INDEX "TripFinanceProfile_normalizedAt_idx" ON "TripFinanceProfile"("normalizedAt");
CREATE INDEX "TripFinanceProfile_schemaVersion_idx" ON "TripFinanceProfile"("schemaVersion");

CREATE INDEX "Income_tripId_idx" ON "Income"("tripId");
CREATE INDEX "Income_tripId_expectedDate_idx" ON "Income"("tripId", "expectedDate");

CREATE INDEX "LifeCost_tripId_idx" ON "LifeCost"("tripId");
CREATE INDEX "LifeCost_tripId_dueDate_idx" ON "LifeCost"("tripId", "dueDate");
CREATE INDEX "LifeCost_tripId_category_idx" ON "LifeCost"("tripId", "category");

CREATE INDEX "Installment_tripId_idx" ON "Installment"("tripId");
CREATE INDEX "Installment_tripId_status_endDate_idx" ON "Installment"("tripId", "status", "endDate");

CREATE INDEX "TripCost_tripId_idx" ON "TripCost"("tripId");
CREATE INDEX "TripCost_tripId_status_dueDate_idx" ON "TripCost"("tripId", "status", "dueDate");
CREATE INDEX "TripCost_tripId_category_idx" ON "TripCost"("tripId", "category");

CREATE INDEX "Expense_tripId_idx" ON "Expense"("tripId");
CREATE INDEX "Expense_tripId_date_idx" ON "Expense"("tripId", "date");
CREATE INDEX "Expense_tripId_category_idx" ON "Expense"("tripId", "category");

CREATE INDEX "PresetSuggestion_tripId_status_idx" ON "PresetSuggestion"("tripId", "status");
CREATE INDEX "PresetSuggestion_tripId_category_status_idx" ON "PresetSuggestion"("tripId", "category", "status");

CREATE UNIQUE INDEX "PaymentMark_tripId_paymentKey_key" ON "PaymentMark"("tripId", "paymentKey");
CREATE INDEX "PaymentMark_tripId_status_idx" ON "PaymentMark"("tripId", "status");
CREATE INDEX "PaymentMark_tripId_updatedAt_idx" ON "PaymentMark"("tripId", "updatedAt");

CREATE UNIQUE INDEX "ExternalDataSnapshot_provider_resourceType_resourceKey_key"
  ON "ExternalDataSnapshot"("provider", "resourceType", "resourceKey");
CREATE INDEX "ExternalDataSnapshot_resourceType_resourceKey_idx"
  ON "ExternalDataSnapshot"("resourceType", "resourceKey");
CREATE INDEX "ExternalDataSnapshot_expiresAt_idx" ON "ExternalDataSnapshot"("expiresAt");
CREATE INDEX "ExternalDataSnapshot_provider_stale_expiresAt_idx"
  ON "ExternalDataSnapshot"("provider", "stale", "expiresAt");
