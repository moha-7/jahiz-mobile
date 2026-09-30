export function normalizeRecurringAmountDigits(
  value: string,
): string {
  const arabicIndic =
    '\u0660\u0661\u0662\u0663\u0664\u0665\u0666\u0667\u0668\u0669';

  const easternArabic =
    '\u06F0\u06F1\u06F2\u06F3\u06F4\u06F5\u06F6\u06F7\u06F8\u06F9';

  return [...value]
    .map((character) => {
      const arabicIndex =
        arabicIndic.indexOf(
          character,
        );

      if (arabicIndex >= 0) {
        return String(
          arabicIndex,
        );
      }

      const easternIndex =
        easternArabic.indexOf(
          character,
        );

      if (easternIndex >= 0) {
        return String(
          easternIndex,
        );
      }

      return character;
    })
    .join('');
}

function normalizeSeparators(
  value: string,
): string | null {
  let normalized =
    normalizeRecurringAmountDigits(
      value,
    )
      .trim()
      .replace(
        /[\s\u00A0\u202F]/g,
        '',
      )
      .replace(
        /\u066C/g,
        ',',
      )
      .replace(
        /\u066B/g,
        '.',
      );

  if (
    !normalized ||
    normalized.includes('-') ||
    !/^[0-9.,]+$/.test(
      normalized,
    )
  ) {
    return null;
  }

  const commaCount =
    (
      normalized.match(
        /,/g,
      ) ?? []
    ).length;

  const dotCount =
    (
      normalized.match(
        /\./g,
      ) ?? []
    ).length;

  if (
    commaCount > 0 &&
    dotCount > 0
  ) {
    const lastComma =
      normalized.lastIndexOf(',');

    const lastDot =
      normalized.lastIndexOf('.');

    if (lastComma > lastDot) {
      normalized =
        normalized
          .replace(
            /\./g,
            '',
          );

      const decimalIndex =
        normalized.lastIndexOf(',');

      normalized =
        normalized
          .slice(
            0,
            decimalIndex,
          )
          .replace(
            /,/g,
            '',
          ) +
        '.' +
        normalized
          .slice(
            decimalIndex + 1,
          )
          .replace(
            /,/g,
            '',
          );
    } else {
      normalized =
        normalized.replace(
          /,/g,
          '',
        );
    }
  } else if (
    commaCount > 0
  ) {
    const looksGrouped =
      /^\d{1,3}(,\d{3})+$/.test(
        normalized,
      );

    if (looksGrouped) {
      normalized =
        normalized.replace(
          /,/g,
          '',
        );
    } else {
      const decimalIndex =
        normalized.lastIndexOf(',');

      normalized =
        normalized
          .slice(
            0,
            decimalIndex,
          )
          .replace(
            /,/g,
            '',
          ) +
        '.' +
        normalized
          .slice(
            decimalIndex + 1,
          )
          .replace(
            /,/g,
            '',
          );
    }
  } else if (
    dotCount > 1
  ) {
    const looksGrouped =
      /^\d{1,3}(\.\d{3})+$/.test(
        normalized,
      );

    if (looksGrouped) {
      normalized =
        normalized.replace(
          /\./g,
          '',
        );
    } else {
      const decimalIndex =
        normalized.lastIndexOf('.');

      normalized =
        normalized
          .slice(
            0,
            decimalIndex,
          )
          .replace(
            /\./g,
            '',
          ) +
        '.' +
        normalized
          .slice(
            decimalIndex + 1,
          )
          .replace(
            /\./g,
            '',
          );
    }
  }

  if (
    !/^\d+(?:\.\d*)?$/.test(
      normalized,
    )
  ) {
    return null;
  }

  return normalized;
}

export function parseRecurringCommitmentAmount(
  value: string,
): number | null {
  const normalized =
    normalizeSeparators(
      value,
    );

  if (!normalized) {
    return null;
  }

  const parsed =
    Number(normalized);

  if (
    !Number.isFinite(parsed) ||
    parsed <= 0
  ) {
    return null;
  }

  return (
    Math.round(
      parsed * 100,
    ) / 100
  );
}
