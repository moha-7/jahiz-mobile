import { prisma } from "../src/lib/prisma.js";
import { financeProfileFromClientTrip, parseTripSnapshot } from "../../shared/trip-finance-profile.js";

const force = process.argv.includes("--force");
const dryRun = process.argv.includes("--dry-run");

function checksum(profile: { startingSavings?: number; supportMoney?: number; safetyReserve?: number }) {
  return Math.round((Number(profile.startingSavings || 0) + Number(profile.supportMoney || 0) + Number(profile.safetyReserve || 0)) * 100) / 100;
}

async function main() {
  const trips = await prisma.trip.findMany({
    select: { id: true, title: true, notes: true, financeProfile: true },
    orderBy: { createdAt: "asc" }
  });

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;
  let legacyDrift = 0;
  let sourceChecksum = 0;

  for (const trip of trips) {
    try {
      const snapshot = parseTripSnapshot(trip.notes);
      const legacyProfile = financeProfileFromClientTrip(snapshot.trip || {});
      const legacyChecksum = checksum(legacyProfile);

      if (trip.financeProfile && !force) {
        const existingChecksum = checksum(trip.financeProfile);
        sourceChecksum += existingChecksum;
        if (Math.abs(existingChecksum - legacyChecksum) >= 0.001) legacyDrift += 1;
        skipped += 1;
        continue;
      }

      const profile = legacyProfile;
      sourceChecksum += legacyChecksum;

      if (!dryRun) {
        await prisma.tripFinanceProfile.upsert({
          where: { tripId: trip.id },
          create: { tripId: trip.id, ...profile, normalizedAt: new Date() },
          update: { ...profile, normalizedAt: new Date() }
        });
      }
      if (trip.financeProfile) updated += 1;
      else created += 1;
    } catch (error) {
      failed += 1;
      console.error(`[finance-profile] ${trip.id} ${trip.title}:`, error);
    }
  }

  let targetChecksum = sourceChecksum;
  let profilesAfter = trips.filter((trip) => trip.financeProfile).length + (dryRun ? created : 0);
  let missingAfter = dryRun ? 0 : trips.length;

  if (!dryRun) {
    const profiles = await prisma.tripFinanceProfile.findMany({
      where: { tripId: { in: trips.map((trip) => trip.id) } },
      select: { tripId: true, startingSavings: true, supportMoney: true, safetyReserve: true }
    });
    profilesAfter = profiles.length;
    missingAfter = Math.max(0, trips.length - profiles.length);
    targetChecksum = profiles.reduce((sum, profile) => sum + checksum(profile), 0);
  }

  const summary = {
    dryRun,
    force,
    scanned: trips.length,
    created,
    updated,
    skipped,
    failed,
    legacyDrift,
    profilesAfter,
    missingAfter,
    sourceChecksum: Math.round(sourceChecksum * 100) / 100,
    targetChecksum: Math.round(targetChecksum * 100) / 100,
    checksumMatch: Math.abs(sourceChecksum - targetChecksum) < 0.001
  };
  console.log(JSON.stringify(summary, null, 2));
  if (failed || missingAfter || !summary.checksumMatch) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
