# Jahiz M7F.2.4C — Runtime UX Stabilization

## Evidence-based layout decision

Real-device screenshots initially suggested that the floating tab bar or create-trip footer might overlap the final content.

The exact-source audit showed that the current local runtime already has two independent layout protections:

1. `JzCollapsibleScreen` computes bottom clearance as the maximum of the screen-specific padding and:

   `safe-area bottom + 72px floating tab maximum height + 22px visual gap`

2. `Screen` renders create-trip `fixedFooter` outside the scroll view and wraps it in a bottom `SafeAreaView`.

Current primary tab call sites also provide explicit large bottom padding:

- Today: 188
- Plan: 188
- Moves: 136
- Payments: 224

Because the current layout contract is already safe, M7F.2.4C intentionally does not add more bottom padding. Adding another layer would create oversized empty space and could regress the approved layout.

A static regression test now protects this contract.

## Actual copy defect

The exact-source audit confirmed several English count strings that are grammatically wrong when their count is exactly one, including examples equivalent to:

- `1 actions`
- `1 obligations`
- `1 estimates`
- `1 days`

The earlier M7F.2.4A.1 fix correctly removed dangling interpolation braces; this is a separate pluralization concern.

## Plural token

English messages can now use:

`[[plural:count|item|items]]`

The translator resolves the bracket token from the named numeric value before normal `{name}` interpolation. The syntax deliberately avoids doubled braces so plural selection stays separate from the existing interpolation contract.

Examples:

- `1 day`
- `8 days`
- `1 action`
- `3 actions`
- `1 estimate`
- `5 estimates`

The token is intentionally lightweight and deterministic. It does not change financial calculations or data.

## Scope

Changed:

- `packages/i18n/src/index.ts`
- pluralization regression test
- bottom-inset contract regression test
- this document

Unchanged:

- finance engine
- trip workspace data
- persistence format
- Shadow authority
- server authority
- tab-bar dimensions
- create-trip footer layout
- Arabic product copy

Arabic wording is left unchanged in this milestone because Arabic plural grammar needs its own product-copy pass rather than applying English singular/plural rules.
