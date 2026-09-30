import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { TABLE_SPECS, buildManifest, compareManifest } from "./lib/migration-bundle.mjs";

const bundleArg = process.argv.find((arg) => arg.startsWith("--bundle="));
if (!bundleArg) {
  console.error("Usage: npm run db:migration:bundle:verify -- --bundle=path/to/bundle");
  process.exit(1);
}
const bundleDir = resolve(bundleArg.slice("--bundle=".length));

async function main() {
  const expected = JSON.parse(await readFile(resolve(bundleDir, "manifest.json"), "utf8"));
  const data = {};
  for (const spec of TABLE_SPECS) data[spec.name] = JSON.parse(await readFile(resolve(bundleDir, `${spec.name}.json`), "utf8"));
  const actual = buildManifest(data, {
    appVersion: expected.appVersion,
    sourceProvider: expected.sourceProvider,
    sessionsIncluded: expected.sessionsIncluded,
    exportedAt: expected.exportedAt,
  });
  const errors = [...compareManifest(expected, actual), ...(actual.relationValidation.errors || [])];
  console.log(JSON.stringify({ bundleDir, valid: errors.length === 0, errors, globalChecksum: actual.globalChecksum, tables: actual.tables }, null, 2));
  if (errors.length) process.exitCode = 1;
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
