import "dotenv/config";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { POSTGRES_STAGING_ACK, targetFingerprint } from "./lib/postgresql-cutover.mjs";

const receiptArg = process.argv.find((value) => value.startsWith("--receipt="));
const rawReceiptPath = receiptArg ? receiptArg.slice("--receipt=".length) : (process.env.POSTGRES_VERIFICATION_RECEIPT || "");
if (!rawReceiptPath || !process.env.POSTGRES_DATABASE_URL) {
  console.error("POSTGRES_VERIFICATION_RECEIPT and POSTGRES_DATABASE_URL are required");
  process.exit(1);
}
const receiptPath = resolve(rawReceiptPath);
const receipt = JSON.parse(await readFile(receiptPath, "utf8"));
const errors = [];
if (!receipt.valid || !receipt.runtimeAllowed) errors.push("Receipt does not allow runtime");
if (receipt.targetFingerprint !== targetFingerprint(process.env.POSTGRES_DATABASE_URL)) errors.push("Receipt target fingerprint does not match POSTGRES_DATABASE_URL");
if (process.env.POSTGRES_TARGET_KIND !== "staging") errors.push("POSTGRES_TARGET_KIND must equal staging");
if (process.env.POSTGRES_STAGING_ACK !== POSTGRES_STAGING_ACK) errors.push("POSTGRES_STAGING_ACK is invalid");
if (!/^[a-f0-9]{64}$/i.test(String(receipt.bundleGlobalChecksum || ""))) errors.push("Receipt bundle checksum is invalid");

console.log(JSON.stringify({ valid: errors.length === 0, errors, receiptPath, targetFingerprint: receipt.targetFingerprint, bundleGlobalChecksum: receipt.bundleGlobalChecksum }, null, 2));
if (errors.length) process.exitCode = 1;
