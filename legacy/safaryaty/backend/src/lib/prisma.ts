import { PrismaClient as SQLitePrismaClient } from "@prisma/client";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { env } from "../config/env.js";
import { normalizeDbScalars } from "./normalize-db-scalars.js";
import { verifyPostgresRuntimeReceipt } from "./postgresql-runtime-safety.js";

function extendWithNumericDecimals<T extends { $extends: Function }>(client: T) {
  return client.$extends({
    query: {
      $allModels: {
        async $allOperations({ args, query }: any) {
          const result = await query(args);
          return normalizeDbScalars(result);
        }
      }
    }
  });
}

async function createRuntimeClient() {
  if (env.DATABASE_PROVIDER === "sqlite") {
    return new SQLitePrismaClient({
      log: env.NODE_ENV === "development" ? ["warn", "error"] : ["error"]
    });
  }

  const receipt = await verifyPostgresRuntimeReceipt({
    nodeEnv: env.NODE_ENV,
    targetKind: env.POSTGRES_TARGET_KIND,
    ack: env.POSTGRES_STAGING_ACK,
    url: env.POSTGRES_DATABASE_URL,
    receiptPath: env.POSTGRES_VERIFICATION_RECEIPT,
  });

  const generatedClientPath = resolve(process.cwd(), "src/generated/postgresql-client/index.js");
  const clientModule: any = await import(pathToFileURL(generatedClientPath).href).catch(() => {
    throw new Error("PostgreSQL Prisma client is missing. Run npm run prisma:postgres:generate first.");
  });
  const rawClient = new clientModule.PrismaClient({
    datasources: { db: { url: env.POSTGRES_DATABASE_URL! } },
    log: env.NODE_ENV === "development" ? ["warn", "error"] : ["error"]
  });
  const marker = await rawClient.migrationReceipt.findUnique({ where: { id: "initial-sqlite-import" } });
  if (!marker || marker.bundleChecksum !== receipt.bundleGlobalChecksum || marker.targetFingerprint !== receipt.targetFingerprint) {
    await rawClient.$disconnect();
    throw new Error("PostgreSQL runtime blocked: database migration marker does not match the verification receipt");
  }
  return extendWithNumericDecimals(rawClient);
}

export const databaseProvider = env.DATABASE_PROVIDER;
export const prisma = await createRuntimeClient() as unknown as SQLitePrismaClient;
