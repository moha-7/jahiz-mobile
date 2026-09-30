import "dotenv/config";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { calculateTrip } from "../src/modules/finance/cashflow.engine.js";
import { normalizeDbScalars } from "../src/lib/normalize-db-scalars.js";
import { verifyPostgresRuntimeReceipt } from "../src/lib/postgresql-runtime-safety.js";

const ROLLBACK = Symbol("postgres-staging-smoke-rollback");

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main() {
  const receipt = await verifyPostgresRuntimeReceipt({
    nodeEnv: process.env.NODE_ENV || "staging",
    targetKind: process.env.POSTGRES_TARGET_KIND,
    ack: process.env.POSTGRES_STAGING_ACK,
    url: process.env.POSTGRES_DATABASE_URL,
    receiptPath: process.env.POSTGRES_VERIFICATION_RECEIPT,
  });

  const clientPath = resolve(process.cwd(), "src/generated/postgresql-client/index.js");
  const clientModule: any = await import(pathToFileURL(clientPath).href).catch(() => {
    throw new Error("PostgreSQL Prisma client not generated. Run npm run prisma:postgres:generate first.");
  });
  const prisma = new clientModule.PrismaClient({ datasources: { db: { url: process.env.POSTGRES_DATABASE_URL } } });
  const marker = `staging-smoke-${Date.now()}`;

  try {
    const databaseReceipt = await prisma.migrationReceipt.findUnique({ where: { id: "initial-sqlite-import" } });
    assert(databaseReceipt?.bundleChecksum === receipt.bundleGlobalChecksum, "Database migration marker checksum does not match receipt");
    assert(databaseReceipt?.targetFingerprint === receipt.targetFingerprint, "Database migration marker target does not match receipt");
    try {
      await prisma.$transaction(async (tx: any) => {
        await tx.user.create({
          data: {
            id: `${marker}-user`,
            name: "Staging Smoke",
            email: `${marker}@example.invalid`,
            passwordHash: "not-a-real-login",
            preferredCurrency: "AED",
          }
        });
        await tx.trip.create({
          data: {
            id: `${marker}-trip`,
            userId: `${marker}-user`,
            title: "PostgreSQL staging smoke",
            status: "ACTIVE",
            travelers: 1,
            incomeCurrency: "AED",
            tripCurrency: "AED",
            displayCurrency: "AED",
            exchangeRate: "1.0000000000",
            departureDate: new Date("2026-08-01T00:00:00.000Z"),
            returnDate: new Date("2026-08-05T00:00:00.000Z"),
          }
        });
        await tx.tripFinanceProfile.create({
          data: {
            tripId: `${marker}-trip`,
            startingSavings: "1000.0000",
            supportMoney: "0.0000",
            safetyReserve: "0.0000",
            reserveEnabled: false,
            returnWithZero: true,
          }
        });
        await tx.lifeCost.create({
          data: {
            id: `${marker}-life`, tripId: `${marker}-trip`, title: "Rent", amount: "200.0000", currency: "AED",
            frequency: "ONE_TIME", dueDate: new Date("2026-08-01T00:00:00.000Z")
          }
        });
        await tx.installment.create({
          data: {
            id: `${marker}-inst`, tripId: `${marker}-trip`, title: "Installment", amount: "100.0000", currency: "AED",
            frequency: "ONE_TIME", startDate: new Date("2026-08-01T00:00:00.000Z"), remainingMonths: 1
          }
        });
        await tx.tripCost.create({
          data: {
            id: `${marker}-cost`, tripId: `${marker}-trip`, title: "Hotel", category: "cat-accommodation",
            amount: "500.0000", currency: "AED", frequency: "TRIP_TOTAL", priority: "Must",
            dueDate: new Date("2026-08-01T00:00:00.000Z")
          }
        });

        const readTrip = async () => normalizeDbScalars(await tx.trip.findUniqueOrThrow({
          where: { id: `${marker}-trip` },
          include: { incomes: true, lifeCosts: true, installments: true, tripCosts: true, expenses: true, paymentMarks: true, financeProfile: true }
        })) as any;

        const beforeTrip = await readTrip();
        const before = calculateTrip({
          trip: beforeTrip,
          incomes: beforeTrip.incomes,
          lifeCosts: beforeTrip.lifeCosts,
          installments: beforeTrip.installments,
          tripCosts: beforeTrip.tripCosts,
          expenses: beforeTrip.expenses,
          paymentMarks: beforeTrip.paymentMarks,
        });
        assert(before.cards.available === 700, `Ready Money expected 700, got ${before.cards.available}`);
        assert(before.cards.tripCost === 500, `Trip Plan Cost expected 500, got ${before.cards.tripCost}`);
        assert(before.cards.paid === 0, `Paid expected 0, got ${before.cards.paid}`);
        assert(before.cards.stillToPay === 800, `Still To Pay expected 800, got ${before.cards.stillToPay}`);
        assert(before.cards.totalTrackedOutgoings === 800, `Tracked expected 800, got ${before.cards.totalTrackedOutgoings}`);

        await tx.paymentMark.create({
          data: {
            id: `${marker}-mark`, tripId: `${marker}-trip`, paymentKey: `cost-${marker}-cost-0`, status: "PAID", paidDate: new Date()
          }
        });
        const afterTrip = await readTrip();
        const after = calculateTrip({
          trip: afterTrip,
          incomes: afterTrip.incomes,
          lifeCosts: afterTrip.lifeCosts,
          installments: afterTrip.installments,
          tripCosts: afterTrip.tripCosts,
          expenses: afterTrip.expenses,
          paymentMarks: afterTrip.paymentMarks,
        });
        assert(after.cards.available === before.cards.available, "Mark Paid changed Ready Money");
        assert(after.cards.tripCost === before.cards.tripCost, "Mark Paid changed Trip Plan Cost");
        assert(after.cards.stillNeeded === before.cards.stillNeeded, "Mark Paid changed Need To Save");
        assert(after.details.remaining === before.details.remaining, "Mark Paid changed After-Trip Position");
        assert(after.cards.paid === 500, `Paid expected 500, got ${after.cards.paid}`);
        assert(after.cards.stillToPay === 300, `Still To Pay expected 300, got ${after.cards.stillToPay}`);
        assert(after.cards.paid + after.cards.stillToPay === after.cards.totalTrackedOutgoings, "Payment ledger invariant failed");

        throw ROLLBACK;
      }, { isolationLevel: "Serializable", maxWait: 20_000, timeout: 120_000 });
    } catch (error) {
      if (error !== ROLLBACK) throw error;
    }

    const persisted = await prisma.user.count({ where: { id: `${marker}-user` } });
    assert(persisted === 0, "Smoke-test transaction did not roll back");
    console.log(JSON.stringify({ valid: true, rolledBack: true, checks: [
      "PostgreSQL CRUD", "Decimal-to-number boundary", "Finance summary", "PaymentMark occurrence", "Paid/still partition", "Affordability invariance"
    ] }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error?.stack || error);
  process.exitCode = 1;
});
