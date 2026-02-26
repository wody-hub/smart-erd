#!/usr/bin/env node

import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const JAVA_ROOT = 'src/main/java/';
const FRONTEND_ROOT = 'client/src/';
const FRONTEND_UI_EXCEPTION_PREFIX = 'client/src/components/ui/';
const FUNCTION_DOC_RULE = 'DOCS001';
const PARAM_DOC_RULE = 'DOCS002';
const RETURN_DOC_RULE = 'DOCS003';
const FILE_READ_RULE = 'DOCS004';
const REPO_ROOT = detectRepoRoot();

const args = parseArgs(process.argv.slice(2));
const targetFiles = collectTargetFiles(args);

if (targetFiles.length === 0) {
  console.log('[verify-function-docs] No target files found.');
  process.exit(0);
}

const issues = [];

for (const filePath of targetFiles) {
  const content = readFileSafe(filePath);
  if (content == null) {
    issues.push({
      rule: FILE_READ_RULE,
      file: filePath,
      line: 1,
      message: 'Failed to read file content.',
    });
    continue;
  }

  if (isJavaFile(filePath)) {
    issues.push(...validateJavaFile(filePath, content));
    continue;
  }

  if (isFrontendFile(filePath)) {
    issues.push(...(await validateTypeScriptFile(filePath, content)));
  }
}

if (issues.length > 0) {
  console.error('[verify-function-docs] Function documentation violations found:');
  for (const issue of issues) {
    console.error(
      ` - [${issue.rule}] ${issue.file}:${issue.line} ${issue.message}`,
    );
  }
  process.exit(1);
}

console.log(
  `[verify-function-docs] Passed (${targetFiles.length} files checked, no violations).`,
);
process.exit(0);

function parseArgs(argv) {
  let baseRef = null;
  let scanAll = false;
  let staged = false;
  let frontendOnly = false;
  let backendOnly = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--all') {
      scanAll = true;
      continue;
    }
    if (arg === '--staged') {
      staged = true;
      continue;
    }
    if (arg === '--frontend-only') {
      frontendOnly = true;
      continue;
    }
    if (arg === '--backend-only') {
      backendOnly = true;
      continue;
    }
    if (arg === '--base') {
      baseRef = argv[i + 1] ?? null;
      i += 1;
    }
  }

  return {
    baseRef,
    scanAll,
    staged,
    frontendOnly,
    backendOnly,
  };
}

function collectTargetFiles(options) {
  const candidateFiles = options.scanAll
    ? listAllTrackedFiles()
    : listChangedFiles(options);

  return candidateFiles.filter((filePath) =>
    shouldCheckFile(filePath, options.frontendOnly, options.backendOnly),
  );
}

function listAllTrackedFiles() {
  return uniqueLines(runCommand('git ls-files'));
}

function listChangedFiles(options) {
  if (options.staged) {
    const staged = uniqueLines(
      runCommand('git diff --cached --name-only --diff-filter=ACMRTUXB'),
    );
    const untracked = uniqueLines(
      runCommand('git ls-files --others --exclude-standard'),
    );
    return [...new Set([...staged, ...untracked])];
  }

  const tracked = options.baseRef
    ? uniqueLines(
        runCommand(
          `git diff --name-only --diff-filter=ACMRTUXB ${options.baseRef}...HEAD`,
        ),
      )
    : [
        ...uniqueLines(runCommand('git diff --name-only --diff-filter=ACMRTUXB')),
        ...uniqueLines(
          runCommand('git diff --cached --name-only --diff-filter=ACMRTUXB'),
        ),
      ];
  const untracked = uniqueLines(
    runCommand('git ls-files --others --exclude-standard'),
  );
  return [...new Set([...tracked, ...untracked])];
}

function shouldCheckFile(filePath, frontendOnly, backendOnly) {
  if (frontendOnly && !isFrontendFile(filePath)) {
    return false;
  }

  if (backendOnly && !isJavaFile(filePath)) {
    return false;
  }

  if (isFrontendFile(filePath)) {
    return !filePath.startsWith(FRONTEND_UI_EXCEPTION_PREFIX);
  }

  return isJavaFile(filePath);
}

function isJavaFile(filePath) {
  return filePath.startsWith(JAVA_ROOT) && filePath.endsWith('.java');
}

function isFrontendFile(filePath) {
  return (
    filePath.startsWith(FRONTEND_ROOT) &&
    (filePath.endsWith('.ts') || filePath.endsWith('.tsx'))
  );
}

function readFileSafe(filePath) {
  const absolutePath = path.resolve(REPO_ROOT, filePath);
  try {
    return readFileSync(absolutePath, 'utf8');
  } catch (error) {
    return null;
  }
}

function validateJavaFile(filePath, content) {
  const lines = content.split(/\r?\n/);
  const className = path.basename(filePath, '.java');
  const issues = [];

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const rawLine = lines[lineIndex];
    const trimmedLine = rawLine.trim();

    if (!startsWithVisibility(trimmedLine)) {
      continue;
    }
    if (containsTypeDeclaration(trimmedLine)) {
      continue;
    }
    if (!trimmedLine.includes('(')) {
      continue;
    }

    const signatureResult = collectJavaSignature(lines, lineIndex);
    if (!signatureResult) {
      continue;
    }

    const { signature, endLine } = signatureResult;
    if (signature.includes(';') && !signature.includes('{')) {
      lineIndex = endLine;
      continue;
    }
    if (!signature.includes(')')) {
      lineIndex = endLine;
      continue;
    }

    const methodInfo = parseJavaMethodInfo(signature, className);
    if (!methodInfo) {
      lineIndex = endLine;
      continue;
    }

    if (methodInfo.isConstructor) {
      lineIndex = endLine;
      continue;
    }

    const javadocInfo = findJavaDoc(lines, lineIndex);
    if (!javadocInfo) {
      issues.push({
        rule: FUNCTION_DOC_RULE,
        file: filePath,
        line: lineIndex + 1,
        message: `Missing Javadoc for method '${methodInfo.methodName}'.`,
      });
      lineIndex = endLine;
      continue;
    }

    for (const paramName of methodInfo.params) {
      if (!includesParamTag(javadocInfo.text, paramName)) {
        issues.push({
          rule: PARAM_DOC_RULE,
          file: filePath,
          line: lineIndex + 1,
          message: `Missing '@param ${paramName}' in method '${methodInfo.methodName}'.`,
        });
      }
    }

    if (methodInfo.requiresReturnTag && !includesReturnTag(javadocInfo.text)) {
      issues.push({
        rule: RETURN_DOC_RULE,
        file: filePath,
        line: lineIndex + 1,
        message: `Missing '@return' in method '${methodInfo.methodName}'.`,
      });
    }

    lineIndex = endLine;
  }

  return issues;
}

function startsWithVisibility(line) {
  return /^(public|protected|private)\b/.test(line);
}

function containsTypeDeclaration(line) {
  return /\b(class|interface|enum|record)\b/.test(line);
}

function collectJavaSignature(lines, startLine) {
  let signature = lines[startLine].trim();
  let endLine = startLine;
  let openParens = countChar(signature, '(');
  let closeParens = countChar(signature, ')');

  while (
    endLine + 1 < lines.length &&
    !signature.includes('{') &&
    !signature.includes(';') &&
    (openParens > closeParens || !signature.includes(')'))
  ) {
    endLine += 1;
    const nextLine = lines[endLine].trim();
    signature = `${signature} ${nextLine}`;
    openParens += countChar(nextLine, '(');
    closeParens += countChar(nextLine, ')');
  }

  return { signature, endLine };
}

function parseJavaMethodInfo(signature, className) {
  const compact = signature.replace(/\s+/g, ' ').trim();
  if (/\b(if|for|while|switch|catch)\s*\(/.test(compact)) {
    return null;
  }

  const firstParenIndex = compact.indexOf('(');
  const lastParenIndex = compact.lastIndexOf(')');
  if (firstParenIndex < 0 || lastParenIndex < firstParenIndex) {
    return null;
  }

  const beforeParen = compact.slice(0, firstParenIndex).trim();
  const methodNameMatch = beforeParen.match(/([A-Za-z_$][\w$]*)$/);
  if (!methodNameMatch) {
    return null;
  }

  const methodName = methodNameMatch[1];
  const paramsRaw = compact.slice(firstParenIndex + 1, lastParenIndex).trim();
  const params = extractJavaParamNames(paramsRaw);
  const returnType = extractJavaReturnType(beforeParen, methodName);
  const isConstructor = methodName === className;

  return {
    methodName,
    params,
    isConstructor,
    requiresReturnTag: !isConstructor && returnType !== 'void',
  };
}

function extractJavaParamNames(paramsRaw) {
  if (paramsRaw.length === 0) {
    return [];
  }

  return paramsRaw
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((part) =>
      part
        .replace(/@\w+(?:\([^)]*\))?\s*/g, '')
        .replace(/\bfinal\s+/g, '')
        .replace(/\.\.\./g, ' ')
        .trim(),
    )
    .map((part) => {
      const tokens = part.split(/\s+/);
      return tokens[tokens.length - 1]?.trim() ?? '';
    })
    .filter((name) => name.length > 0);
}

function extractJavaReturnType(beforeParen, methodName) {
  let prefix = beforeParen.slice(0, beforeParen.length - methodName.length).trim();
  prefix = prefix.replace(/^public\s+|^protected\s+|^private\s+/, '');
  prefix = prefix.replace(/\b(static|final|synchronized|abstract|default|native|strictfp)\b/g, '');
  prefix = prefix.replace(/@\w+(?:\([^)]*\))?\s*/g, ' ');
  prefix = prefix.replace(/^<[^>]+>\s*/, '');
  const tokens = prefix.trim().split(/\s+/).filter((token) => token.length > 0);
  if (tokens.length === 0) {
    return 'void';
  }
  return tokens[tokens.length - 1];
}

function findJavaDoc(lines, declarationLine) {
  let cursor = declarationLine - 1;

  while (cursor >= 0) {
    const trimmed = lines[cursor].trim();
    if (trimmed.length === 0) {
      cursor -= 1;
      continue;
    }
    if (isAnnotationLikeLine(trimmed)) {
      cursor -= 1;
      continue;
    }
    break;
  }

  if (cursor < 0) {
    return null;
  }
  if (!lines[cursor].trim().endsWith('*/')) {
    return null;
  }

  const endLine = cursor;
  while (cursor >= 0) {
    const trimmed = lines[cursor].trim();
    if (trimmed.startsWith('/**')) {
      return {
        startLine: cursor,
        endLine,
        text: lines.slice(cursor, endLine + 1).join('\n'),
      };
    }
    if (trimmed.startsWith('/*')) {
      return null;
    }
    cursor -= 1;
  }

  return null;
}

function isAnnotationLikeLine(trimmedLine) {
  if (trimmedLine.startsWith('@')) {
    return true;
  }
  if (trimmedLine.endsWith(',')) {
    return true;
  }
  if (/^[\w$.]+\s*=/.test(trimmedLine)) {
    return true;
  }
  return trimmedLine === ')' || trimmedLine === '(';
}

function includesParamTag(javadocText, paramName) {
  const paramPattern = new RegExp(`@param\\s+${escapeRegExp(paramName)}\\b`);
  return paramPattern.test(javadocText);
}

function includesReturnTag(javadocText) {
  return /@return\b/.test(javadocText);
}

async function validateTypeScriptFile(filePath, content) {
  const ts = await loadTypeScript();
  if (!ts) {
    return [];
  }

  const sourceFile = ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

  const issues = [];
  walkTypeScriptNodes(ts, sourceFile, (node, functionName) => {
    if (ts.isConstructorDeclaration(node)) {
      return;
    }

    if (!hasTypeScriptJSDoc(ts, node)) {
      issues.push({
        rule: FUNCTION_DOC_RULE,
        file: filePath,
        line: sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1,
        message: `Missing JSDoc for function '${functionName}'.`,
      });
      return;
    }

    const tags = ts.getJSDocTags(node);
    const paramTags = tags
      .filter((tag) => tag.tagName?.escapedText === 'param')
      .map((tag) => tag.name?.escapedText)
      .filter((name) => typeof name === 'string');

    const parameterNames = node.parameters
      ?.map((param) =>
        param.name && ts.isIdentifier(param.name) ? param.name.text : null,
      )
      .filter((name) => typeof name === 'string');

    for (const paramName of parameterNames ?? []) {
      if (!paramTags.includes(paramName)) {
        issues.push({
          rule: PARAM_DOC_RULE,
          file: filePath,
          line: sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1,
          message: `Missing '@param ${paramName}' in function '${functionName}'.`,
        });
      }
    }

    if (requiresTypeScriptReturnTag(ts, node) && !hasTypeScriptReturnTag(tags)) {
      issues.push({
        rule: RETURN_DOC_RULE,
        file: filePath,
        line: sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1,
        message: `Missing '@returns' in function '${functionName}'.`,
      });
    }
  });

  return issues;
}

async function loadTypeScript() {
  try {
    const modulePath = path.resolve(
      REPO_ROOT,
      'client/node_modules/typescript/lib/typescript.js',
    );
    const tsModule = await import(modulePath);
    return tsModule.default ?? tsModule;
  } catch (firstError) {
    try {
      const tsModule = await import('typescript');
      return tsModule.default ?? tsModule;
    } catch (secondError) {
      console.error(
        '[verify-function-docs] TypeScript module not found. Install client dependencies first.',
      );
      return null;
    }
  }
}

function walkTypeScriptNodes(ts, sourceFile, visitor) {
  const visit = (node) => {
    const target = extractTypeScriptFunctionNode(ts, node);
    if (target) {
      visitor(target.node, target.functionName);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
}

function extractTypeScriptFunctionNode(ts, node) {
  if (ts.isFunctionDeclaration(node) && node.name) {
    return { node, functionName: node.name.text };
  }

  if (ts.isMethodDeclaration(node) && node.name && ts.isIdentifier(node.name)) {
    return { node, functionName: node.name.text };
  }

  if (
    ts.isVariableDeclaration(node) &&
    ts.isIdentifier(node.name) &&
    node.initializer &&
    (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))
  ) {
    return { node: node.initializer, functionName: node.name.text };
  }

  return null;
}

function hasTypeScriptJSDoc(ts, node) {
  const docs = ts.getJSDocCommentsAndTags(node);
  return docs.some((docNode) => docNode.kind === ts.SyntaxKind.JSDoc);
}

function requiresTypeScriptReturnTag(ts, node) {
  if ('type' in node && node.type && node.type.kind === ts.SyntaxKind.VoidKeyword) {
    return false;
  }
  if ('type' in node && node.type && node.type.kind === ts.SyntaxKind.NeverKeyword) {
    return false;
  }
  return true;
}

function hasTypeScriptReturnTag(tags) {
  return tags.some((tag) => {
    const tagName = tag.tagName?.escapedText;
    return tagName === 'returns' || tagName === 'return';
  });
}

function runCommand(command) {
  try {
    return execSync(command, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch (error) {
    return '';
  }
}

function detectRepoRoot() {
  const root = runCommand('git rev-parse --show-toplevel');
  return root.length > 0 ? root : process.cwd();
}

function uniqueLines(text) {
  if (text.length === 0) {
    return [];
  }
  return [...new Set(text.split('\n').map((line) => line.trim()).filter((line) => line.length > 0))];
}

function countChar(text, char) {
  let count = 0;
  for (const current of text) {
    if (current === char) {
      count += 1;
    }
  }
  return count;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
