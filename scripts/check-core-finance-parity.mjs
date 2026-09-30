import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();
const legacy = resolve(root, 'legacy/safaryaty/shared');
const extracted = resolve(root, 'packages/core-finance/src');
const files = (await readdir(legacy)).filter((file) => /\.(js|d\.ts)$/.test(file)).sort();
const failures = [];

for (const file of files) {
  const [left, right] = await Promise.all([
    readFile(resolve(legacy, file)),
    readFile(resolve(extracted, file)),
  ]);
  const digest = (value) => createHash('sha256').update(value).digest('hex');
  if (digest(left) !== digest(right)) failures.push(file);
}

if (failures.length) {
  console.error(`Core-finance parity failed: ${failures.join(', ')}`);
  process.exit(1);
}

console.log(`Core-finance parity passed for ${files.length} frozen files.`);
