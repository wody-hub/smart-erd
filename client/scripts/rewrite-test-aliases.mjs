import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const tmpRoot = path.resolve('.tmp-test');

/**
 * Recursively collects JavaScript files emitted for unit tests.
 *
 * @param {string} dir
 * @returns {string[]}
 */
function collectJsFiles(dir) {
  if (!existsSync(dir)) {
    return [];
  }

  return readdirSync(dir).flatMap((entry) => {
    const fullPath = path.join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      return collectJsFiles(fullPath);
    }
    return fullPath.endsWith('.js') ? [fullPath] : [];
  });
}

/**
 * Resolves an emitted runtime path for an alias import.
 *
 * @param {string} filePath
 * @param {string} aliasPath
 * @returns {string}
 */
function resolveAliasImport(filePath, aliasPath) {
  const emittedBase = path.join(tmpRoot, 'src', aliasPath);
  const candidates = [`${emittedBase}.js`, `${emittedBase}.json`, path.join(emittedBase, 'index.js')];
  const emittedTarget = candidates.find((candidate) => existsSync(candidate)) ?? `${emittedBase}.js`;
  const relativeTarget = path.relative(path.dirname(filePath), emittedTarget).replaceAll(path.sep, '/');
  return relativeTarget.startsWith('.') ? relativeTarget : `./${relativeTarget}`;
}

/**
 * Normalizes a relative emitted import to an explicit runtime path.
 *
 * @param {string} filePath
 * @param {string} specifier
 * @returns {string}
 */
function resolveRelativeImport(filePath, specifier) {
  const absoluteBase = path.resolve(path.dirname(filePath), specifier);
  const extension = path.extname(specifier);
  if (extension) {
    return specifier;
  }
  const candidates = [`${absoluteBase}.js`, `${absoluteBase}.json`, path.join(absoluteBase, 'index.js')];
  const emittedTarget = candidates.find((candidate) => existsSync(candidate));
  if (!emittedTarget) {
    return specifier;
  }
  const relativeTarget = path.relative(path.dirname(filePath), emittedTarget).replaceAll(path.sep, '/');
  return relativeTarget.startsWith('.') ? relativeTarget : `./${relativeTarget}`;
}

for (const filePath of collectJsFiles(tmpRoot)) {
  const source = readFileSync(filePath, 'utf8');
  const rewrittenAliases = source.replaceAll(/(['"])@\/([^'"]+)\1/g, (_match, quote, aliasPath) => {
    return `${quote}${resolveAliasImport(filePath, aliasPath)}${quote}`;
  });
  const rewritten = rewrittenAliases.replaceAll(
    /(['"])(\.\.?\/[^'"]+)\1/g,
    (_match, quote, relativePath) => {
      return `${quote}${resolveRelativeImport(filePath, relativePath)}${quote}`;
    },
  );
  if (rewritten !== source) {
    writeFileSync(filePath, rewritten);
  }
}
