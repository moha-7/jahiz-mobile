import fs from 'node:fs';
import path from 'node:path';
import {
  fileURLToPath,
  pathToFileURL,
} from 'node:url';

function isRelativeSpecifier(
  specifier,
) {
  return (
    specifier.startsWith('./') ||
    specifier.startsWith('../')
  );
}

function hasExtension(
  specifier,
) {
  return path.extname(specifier) !== '';
}

export async function resolve(
  specifier,
  context,
  nextResolve,
) {
  try {
    return await nextResolve(
      specifier,
      context,
    );
  } catch (error) {
    if (
      error?.code !==
        'ERR_MODULE_NOT_FOUND' ||
      !context.parentURL ||
      !isRelativeSpecifier(
        specifier,
      ) ||
      hasExtension(
        specifier,
      )
    ) {
      throw error;
    }

    const baseUrl =
      new URL(
        specifier,
        context.parentURL,
      );

    const basePath =
      fileURLToPath(baseUrl);

    for (const extension of [
      '.ts',
      '.tsx',
    ]) {
      const candidate =
        `${basePath}${extension}`;

      if (fs.existsSync(candidate)) {
        return {
          url:
            pathToFileURL(
              candidate,
            ).href,
          shortCircuit: true,
        };
      }
    }

    throw error;
  }
}
