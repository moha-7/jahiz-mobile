import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const repoRoot = process.cwd();
const appRoot = path.join(
  repoRoot,
  'apps',
  'mobile',
  'src',
  'app',
);
const planPath = path.join(
  repoRoot,
  'apps',
  'mobile',
  'src',
  'features',
  'plan',
  'plan-screen.tsx',
);

function walk(directory) {
  return fs.readdirSync(
    directory,
    {
      withFileTypes: true,
    },
  ).flatMap((entry) => {
    const fullPath = path.join(
      directory,
      entry.name,
    );

    return entry.isDirectory()
      ? walk(fullPath)
      : [fullPath];
  });
}

function routeFromFile(filePath) {
  const relative = path
    .relative(
      appRoot,
      filePath,
    )
    .replaceAll('\\', '/');

  if (
    !relative.endsWith('.tsx') ||
    relative.endsWith('/_layout.tsx') ||
    relative === '_layout.tsx'
  ) {
    return null;
  }

  const segments = relative
    .replace(/\.tsx$/, '')
    .split('/')
    .filter(
      (segment) =>
        !(
          segment.startsWith('(') &&
          segment.endsWith(')')
        ),
    );

  if (
    segments.at(-1) === 'index'
  ) {
    segments.pop();
  }

  return segments.length === 0
    ? '/'
    : `/${segments.join('/')}`;
}

const registeredRoutes = new Set(
  walk(appRoot)
    .map(routeFromFile)
    .filter(Boolean),
);

const planSource = fs.readFileSync(
  planPath,
  'utf8',
);

const nextStepMatch =
  /const nextStep(?:\s*:\s*PlanNextStep)?\s*=/.exec(
    planSource,
  );
const nextStepStart =
  nextStepMatch?.index ?? -1;
const nextStepEnd =
  planSource.indexOf(
    'const hero =',
    nextStepStart,
  );

assert.ok(
  nextStepStart >= 0 &&
    nextStepEnd > nextStepStart,
  'Plan nextStep source block must exist.',
);

const nextStepSource =
  planSource.slice(
    nextStepStart,
    nextStepEnd,
  );

const hrefs = [
  ...nextStepSource.matchAll(
    /href:\s*'([^']+)'/g,
  ),
].map(
  (match) => match[1],
);

test(
  'every literal Plan next-step href maps to a registered Expo Router route',
  () => {
    assert.ok(
      hrefs.length > 0,
      'Expected Plan next-step hrefs.',
    );

    for (const href of hrefs) {
      assert.ok(
        registeredRoutes.has(href),
        `Unregistered Plan next-step href: ${href}`,
      );
    }
  },
);

test(
  'completed Review plan targets the Today index route instead of nonexistent /today',
  () => {
    assert.match(
      nextStepSource,
      /title:\s*t\('reviewPlan'\)[\s\S]*?href:\s*'\/',[\s\S]*?focus:\s*'today'/,
    );

    assert.doesNotMatch(
      nextStepSource,
      /href:\s*'\/today'/,
    );
  },
);