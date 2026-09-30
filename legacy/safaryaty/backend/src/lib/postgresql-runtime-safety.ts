import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export const POSTGRES_STAGING_ACK = "SAFARYATY_POSTGRES_STAGING_VERIFIED";

export function postgresTargetFingerprint(rawUrl: string) {
  const parsed = new URL(rawUrl);
  const identity = {
    protocol: parsed.protocol.replace(":", ""),
    host: parsed.hostname,
    port: parsed.port || "5432",
    database: parsed.pathname.replace(/^\//, ""),
    schema: parsed.searchParams.get("schema") || "public",
  };
  return createHash("sha256").update(JSON.stringify(identity)).digest("hex");
}

export async function verifyPostgresRuntimeReceipt(input: {
  nodeEnv: string;
  targetKind?: string;
  ack?: string;
  url?: string;
  receiptPath?: string;
}) {
  const errors: string[] = [];
  if (input.nodeEnv === "production") errors.push("PostgreSQL production runtime is blocked in v4.29.51");
  if (input.targetKind !== "staging") errors.push("POSTGRES_TARGET_KIND must equal staging");
  if (input.ack !== POSTGRES_STAGING_ACK) errors.push(`POSTGRES_STAGING_ACK must equal ${POSTGRES_STAGING_ACK}`);
  if (!input.url) errors.push("POSTGRES_DATABASE_URL is required");
  if (!input.receiptPath) errors.push("POSTGRES_VERIFICATION_RECEIPT is required");
  if (errors.length) throw new Error(`PostgreSQL runtime safety gate blocked:\n- ${errors.join("\n- ")}`);

  const receiptPath = resolve(input.receiptPath!);
  const receipt = JSON.parse(await readFile(receiptPath, "utf8"));
  if (!receipt.valid || !receipt.runtimeAllowed) errors.push("Verification receipt does not allow runtime");
  if (receipt.targetFingerprint !== postgresTargetFingerprint(input.url!)) errors.push("Verification receipt does not match POSTGRES_DATABASE_URL");
  if (!/^[a-f0-9]{64}$/i.test(String(receipt.bundleGlobalChecksum || ""))) errors.push("Verification receipt has an invalid bundle checksum");
  if (receipt.actualGlobalChecksum !== receipt.bundleGlobalChecksum) errors.push("Verification receipt checksum parity is not proven");
  if (errors.length) throw new Error(`PostgreSQL runtime safety gate blocked:\n- ${errors.join("\n- ")}`);
  return receipt;
}
