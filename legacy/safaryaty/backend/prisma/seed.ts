import { prisma } from "../src/lib/prisma.js";
import { hashPassword } from "../src/utils/crypto.js";
import { env } from "../src/config/env.js";

const email = "demo@safaryaty.local";
const existing = await prisma.user.findUnique({ where: { email } });

if (!existing) {
  await prisma.user.create({
    data: {
      name: "Demo Traveler",
      email,
      passwordHash: await hashPassword("demo12345"),
      countryOfResidence: "United Arab Emirates",
      nationality: "Egypt",
      preferredCurrency: "AED",
      preferredLanguage: "en",
      travelFrequency: "sometimes",
      travelPurpose: "Family Visit",
      defaultTravelStyle: "Balanced",
      plan: "PRO"
    }
  });
}

const adminEmail = env.ADMIN_EMAIL || "admin@example.local";
const adminPassword = env.ADMIN_PASSWORD || "CHANGE_ME_DEV_ONLY";
const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });
if (!existingAdmin) {
  await prisma.user.create({
    data: {
      name: "Safaryaty Admin",
      email: adminEmail,
      passwordHash: await hashPassword(adminPassword),
      countryOfResidence: "United Arab Emirates",
      nationality: "Egypt",
      preferredCurrency: "AED",
      preferredLanguage: "en",
      travelFrequency: "sometimes",
      travelPurpose: "Business Trip",
      defaultTravelStyle: "Balanced",
      role: "ADMIN",
      plan: "PRO"
    }
  });
}

console.log(`Seed completed. Demo login: demo@safaryaty.local / demo12345. Admin login: ${adminEmail} / ${adminPassword}`);
await prisma.$disconnect();
