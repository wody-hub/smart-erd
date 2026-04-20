import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const clientRoot = path.resolve(scriptDir, '..');
const tmpRoot = path.join(clientRoot, '.tmp-test');
const unitTestRoot = path.join(tmpRoot, 'test', 'unit');
const tscBin = path.join(clientRoot, 'node_modules', 'typescript', 'bin', 'tsc');

/**
 * Executes a command in the client root and exits on failure.
 *
 * @param {string} command
 * @param {string[]} args
 */
function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: clientRoot,
    stdio: 'inherit',
  });

  if (typeof result.status === 'number') {
    if (result.status !== 0) {
      process.exit(result.status);
    }
    return;
  }

  process.exit(1);
}

/**
 * Recursively collects emitted unit test files.
 *
 * @param {string} dir
 * @returns {string[]}
 */
function collectUnitTestFiles(dir) {
  if (!existsSync(dir)) {
    return [];
  }

  return readdirSync(dir, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name))
    .flatMap((entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        return collectUnitTestFiles(fullPath);
      }
      if (entry.isFile() && fullPath.endsWith('.test.js')) {
        return [fullPath];
      }
      return [];
    });
}

rmSync(tmpRoot, { recursive: true, force: true });
run(process.execPath, [tscBin, '-p', path.join(clientRoot, 'tsconfig.test.json')]);
run(process.execPath, [path.join(scriptDir, 'rewrite-test-aliases.mjs')]);

const unitTestFiles = collectUnitTestFiles(unitTestRoot);
if (unitTestFiles.length === 0) {
  console.error(`No emitted unit tests found under ${unitTestRoot}`);
  process.exit(1);
}

run(process.execPath, ['--test', ...unitTestFiles]);
