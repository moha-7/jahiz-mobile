import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const repoRoot = process.cwd();

const profilePath = path.join(
  repoRoot,
  'apps',
  'mobile',
  'src',
  'features',
  'profile',
  'profile-screen.tsx',
);

const themePath = path.join(
  repoRoot,
  'apps',
  'mobile',
  'src',
  'providers',
  'theme-provider.tsx',
);

const profile = fs.readFileSync(
  profilePath,
  'utf8',
);

const theme = fs.readFileSync(
  themePath,
  'utf8',
);

test(
  'Profile hero identity never hard-codes dark-only text colors',
  () => {
    assert.doesNotMatch(
      profile,
      /color:\s*'#F8FAFC'/,
    );

    assert.doesNotMatch(
      profile,
      /color:\s*'#AFC0D1'/,
    );
  },
);

test(
  'Profile hero identity uses theme-aware hero tokens',
  () => {
    assert.match(
      profile,
      /color:\s*palette\.heroText/,
    );

    const secondaryUses = [
      ...profile.matchAll(
        /color:\s*palette\.heroSecondary/g,
      ),
    ];

    assert.ok(
      secondaryUses.length >= 2,
      'Back and email should both use heroSecondary.',
    );
  },
);

test(
  'Light and Dark palettes both define readable Profile hero colors',
  () => {
    for (const marker of [
      "heroText: '#0D2238'",
      "heroSecondary: '#58708A'",
      "heroText: '#F7F9FB'",
      "heroSecondary: '#A8B3C1'",
    ]) {
      assert.ok(
        theme.includes(marker),
        `Missing theme marker: ${marker}`,
      );
    }
  },
);