import {
  existsSync,
  readdirSync,
  readFileSync,
} from 'node:fs';
import {
  extname,
  join,
  relative,
} from 'node:path';

const projectRoot = process.cwd();

const sourceRoots = [
  'apps/mobile/src',
  'packages/i18n/src',
  'packages/ui/src',
  'packages/design-tokens/src',
];

const supportedExtensions = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
]);

const suspiciousPatterns = [
  {
    label: 'Unicode replacement character',
    pattern: /\uFFFD/u,
  },
  {
    label: 'common UTF-8 mojibake',
    pattern: /(?:Ã.|Â.|Ø.|Ù.|ðŸ|â€|â€™|ï»¿)/u,
  },
];

function collectFiles(directory) {
  const files = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const fullPath = join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...collectFiles(fullPath));
      continue;
    }

    if (
      entry.isFile() &&
      supportedExtensions.has(extname(entry.name).toLowerCase())
    ) {
      files.push(fullPath);
    }
  }

  return files;
}

const problems = [];

for (const sourceRoot of sourceRoots) {
  const absoluteRoot = join(projectRoot, sourceRoot);

  if (!existsSync(absoluteRoot)) {
    continue;
  }

  for (const filePath of collectFiles(absoluteRoot)) {
    const content = readFileSync(filePath, 'utf8');
    const lines = content.split(/\r?\n/u);

    for (const { label, pattern } of suspiciousPatterns) {
      lines.forEach((line, index) => {
        if (pattern.test(line)) {
          problems.push({
            file: relative(projectRoot, filePath),
            line: index + 1,
            label,
            preview: line.trim().slice(0, 160),
          });
        }

        pattern.lastIndex = 0;
      });
    }
  }
}

if (problems.length > 0) {
  console.error('Source encoding check failed.');

  for (const problem of problems) {
    console.error(
      `- ${problem.file}:${problem.line} [${problem.label}] ${problem.preview}`,
    );
  }

  process.exit(1);
}

console.log('Source encoding check passed.');
