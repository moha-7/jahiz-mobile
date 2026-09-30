import "dotenv/config";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";

const receiptArg = process.argv.find((value) => value.startsWith("--receipt="))?.slice(10);
if (!receiptArg) {
  console.error("Usage: npm run db:rollback:sqlite:verify -- --receipt=PATH_TO_BACKUP_RECEIPT");
  process.exit(1);
}
const receiptPath = resolve(receiptArg);
const receipt = JSON.parse(await readFile(receiptPath, "utf8"));
const backup = resolve(receipt.backup);
if (!receipt.valid || !Array.isArray(receipt.files) || !receipt.files.length) throw new Error("SQLite rollback backup receipt is invalid");
for (const file of receipt.files) {
  const bytes = await readFile(resolve(file.backup));
  const hash = createHash("sha256").update(bytes).digest("hex");
  if (hash !== file.sha256) throw new Error(`SQLite rollback backup hash mismatch: ${file.backup}`);
}
const bytes = await readFile(backup);
const actualHash = createHash("sha256").update(bytes).digest("hex");
if (actualHash !== receipt.sha256) throw new Error("Primary SQLite rollback backup hash is invalid");

const prisma = new PrismaClient({ datasources: { db: { url: `file:${backup}` } } });
try {
  const [users, trips, profiles, paymentMarks] = await Promise.all([
    prisma.user.count(), prisma.trip.count(), prisma.tripFinanceProfile.count(), prisma.paymentMark.count()
  ]);
  const missingProfiles = await prisma.trip.count({ where: { financeProfile: null, status: { not: "DELETED" } } });
  if (missingProfiles) throw new Error(`Rollback backup has ${missingProfiles} active trips without TripFinanceProfile`);
  console.log(JSON.stringify({ valid: true, readable: true, receiptPath, backup, sha256: actualHash, counts: { users, trips, profiles, paymentMarks }, missingProfiles }, null, 2));
} finally {
  await prisma.$disconnect();
}
