import assert from 'node:assert/strict';
import {
  readFileSync,
} from 'node:fs';
import test from 'node:test';

function read(path: string): string {
  return readFileSync(
    path,
    'utf8',
  ).replaceAll(
    '\r\n',
    '\n',
  );
}

function bottomPaddingFor(
  source: string,
): number {
  const match =
    source.match(
      /bottomPadding=\{(\d+)\}/,
    );

  assert.ok(
    match,
    'Expected an explicit JzCollapsibleScreen bottomPadding.',
  );

  return Number(match[1]);
}

test('shared collapsible screen reserves safe area + full floating tab height + visual gap', () => {
  const source =
    read(
      'apps/mobile/src/components/jz-collapsible-screen.tsx',
    );

  assert.match(
    source,
    /const TAB_BAR_MAX_HEIGHT = 72;/,
  );

  assert.match(
    source,
    /const TAB_BAR_VERTICAL_GAP = 22;/,
  );

  assert.match(
    source,
    /insets\.bottom\s*\+\s*TAB_BAR_MAX_HEIGHT\s*\+\s*TAB_BAR_VERTICAL_GAP/,
  );

  assert.match(
    source,
    /paddingBottom:\s*resolvedBottomPadding/,
  );

  assert.match(
    source,
    /scrollIndicatorInsets=\{\{\s*bottom:\s*resolvedBottomPadding/,
  );
});

test('primary tab screens keep explicit bottom padding above the shared minimum', () => {
  const cases = [
    {
      path: 'apps/mobile/src/features/today/today-screen.tsx',
      minimum: 136,
    },
    {
      path: 'apps/mobile/src/features/plan/plan-screen.tsx',
      minimum: 136,
    },
    {
      path: 'apps/mobile/src/features/moves/moves-screen.tsx',
      minimum: 136,
    },
    {
      path: 'apps/mobile/src/features/payments/payments-screen.tsx',
      minimum: 136,
    },
  ];

  for (const item of cases) {
    const padding =
      bottomPaddingFor(
        read(item.path),
      );

    assert.ok(
      padding >= item.minimum,
      `${item.path} bottom padding ${padding} fell below ${item.minimum}.`,
    );
  }
});

test('create-trip fixed footer remains outside the scroll view and owns the bottom safe area', () => {
  const source =
    read(
      'apps/mobile/src/components/screen.tsx',
    );

  const scrollClose =
    source.indexOf(
      '</Animated.ScrollView>',
    );

  const footerBranch =
    source.indexOf(
      '{showFooter ? (',
    );

  assert.ok(
    scrollClose >= 0,
  );

  assert.ok(
    footerBranch > scrollClose,
    'Fixed footer must remain outside the scroll view.',
  );

  assert.match(
    source,
    /<SafeAreaView\s*[\s\S]*?edges=\{\['bottom'\]\}[\s\S]*?\{fixedFooter\}/,
  );
});
