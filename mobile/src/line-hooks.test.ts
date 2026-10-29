import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import ts from 'typescript';

type Rule = 'a' | 'b' | 'c' | 'd';
type Violation = { rule: Rule; file: string; line: number; functionName: string; message: string };

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../..');

function isHookName(name: string): boolean {
  return /^use[A-Z0-9]/.test(name);
}

function hookName(node: ts.CallExpression): string | undefined {
  const callee = node.expression;
  if (ts.isIdentifier(callee) && isHookName(callee.text)) return callee.text;
  if (ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.expression) &&
      callee.expression.text === 'React' && isHookName(callee.name.text)) return callee.name.text;
  return undefined;
}

function functionDisplayName(fn: ts.FunctionLikeDeclaration): string | undefined {
  if (fn.name && ts.isIdentifier(fn.name)) return fn.name.text;
  const parent = fn.parent;
  if (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) return parent.name.text;
  if (ts.isPropertyAssignment(parent) && (ts.isIdentifier(parent.name) || ts.isStringLiteral(parent.name))) return parent.name.text;
  if (ts.isMethodDeclaration(parent) && (ts.isIdentifier(parent.name) || ts.isStringLiteral(parent.name))) return parent.name.text;
  // An anonymous function directly passed to React.memo/forwardRef inherits the
  // component name from the variable receiving the wrapper call.
  if (ts.isCallExpression(parent) && ts.isPropertyAccessExpression(parent.expression) &&
      ts.isIdentifier(parent.expression.expression) && parent.expression.expression.text === 'React' &&
      ['memo', 'forwardRef'].includes(parent.expression.name.text)) {
    const wrapped = parent.parent;
    if (ts.isVariableDeclaration(wrapped) && ts.isIdentifier(wrapped.name)) return wrapped.name.text;
  }
  return undefined;
}

function isComponentOrHook(name: string | undefined): boolean {
  return !!name && (/^[A-Z]/.test(name) || isHookName(name));
}

function isFunction(node: ts.Node): node is ts.FunctionLikeDeclaration {
  return ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node) ||
    ts.isMethodDeclaration(node) || ts.isGetAccessorDeclaration(node) || ts.isSetAccessorDeclaration(node);
}

function isHookCallback(fn: ts.FunctionLikeDeclaration): boolean {
  const call = fn.parent;
  if (!call || !ts.isCallExpression(call) || !call.arguments.includes(fn as ts.Expression)) return false;
  return !!hookName(call);
}

function insideHookArgument(fn: ts.FunctionLikeDeclaration): boolean {
  let current: ts.Node = fn;
  while (current.parent) {
    if (isFunction(current) && current !== fn) {
      // A nested function still belongs to a hook callback when its enclosing
      // function was passed to a hook; continue checking enclosing functions.
    }
    if (isFunction(current) && current !== fn && isHookCallback(current)) return true;
    current = current.parent;
  }
  return isHookCallback(fn);
}

function hookOwner(fn: ts.FunctionLikeDeclaration): ts.FunctionLikeDeclaration | undefined {
  for (let p = fn.parent; p; p = p.parent) {
    if (isFunction(p) && !isHookCallback(p)) return p;
  }
  return undefined;
}

function conditionalAncestor(call: ts.CallExpression, fn: ts.FunctionLikeDeclaration): boolean {
  let child: ts.Node = call;
  for (let p = call.parent; p && p !== fn; child = p, p = p.parent) {
    if (ts.isIfStatement(p) && child !== p.expression) return true;
    if (ts.isConditionalExpression(p) && child !== p.condition) return true;
    if (ts.isBinaryExpression(p) && child === p.right &&
        [ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(p.operatorToken.kind)) return true;
    if (ts.isForStatement(p) || ts.isForInStatement(p) || ts.isForOfStatement(p) ||
        ts.isWhileStatement(p) || ts.isDoStatement(p)) return true;
    if (ts.isCaseClause(p) || ts.isDefaultClause(p)) return true;
    if (ts.isTryStatement(p)) return true;
    if (ts.isCatchClause(p)) return true;
  }
  return false;
}

function hasEarlierReturn(call: ts.CallExpression, fn: ts.FunctionLikeDeclaration): boolean {
  if (!fn.body || !ts.isBlock(fn.body)) return false;
  let found = false;
  const visit = (node: ts.Node): void => {
    if (node !== fn.body && isFunction(node)) return;
    if (ts.isReturnStatement(node) && node.getStart() < call.getStart()) found = true;
    if (found) return;
    ts.forEachChild(node, visit);
  };
  visit(fn.body);
  return found;
}

export function checkHooks(sourceText: string, fileName = 'fixture.tsx'): Violation[] {
  const source = ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.Latest, true,
    fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const violations: Violation[] = [];
  const report = (rule: Rule, node: ts.Node, fnName: string, message: string) => {
    const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
    violations.push({ rule, file: fileName, line: line + 1, functionName: fnName, message });
  };

  const visit = (node: ts.Node, currentFn?: ts.FunctionLikeDeclaration, currentFnName?: string): void => {
    let fn = currentFn;
    let fnName = currentFnName;
    if (isFunction(node)) {
      fn = node;
      fnName = functionDisplayName(node);
    }
    if (ts.isCallExpression(node) && hookName(node)) {
      const name = hookName(node)!;
      if (!fn) report('d', node, '<module>', `Hook ${name} is called at module scope`);
      else {
        if (insideHookArgument(fn)) {
          const owner = hookOwner(fn);
          report('a', node, functionDisplayName(owner!) ?? (owner ? '<anonymous>' : fnName ?? '<anonymous>'), `Hook ${name} is called inside a function passed to a hook`);
        }
        if (conditionalAncestor(node, fn) || hasEarlierReturn(node, fn)) {
          report('b', node, fnName ?? '<anonymous>', `Hook ${name} is conditional or follows an early return`);
        }
        if (!isComponentOrHook(fnName) || fn !== nearestFunction(node)) {
          report('c', node, fnName ?? '<anonymous>', `Hook ${name} is not directly in a component or custom hook body`);
        }
      }
    }
    ts.forEachChild(node, child => visit(child, fn, fnName));
  };
  visit(source);
  return violations;
}

function nearestFunction(node: ts.Node): ts.FunctionLikeDeclaration | undefined {
  for (let p = node.parent; p; p = p.parent) if (isFunction(p)) return p;
  return undefined;
}

function fixture(source: string): Violation[] { return checkHooks(source); }
function rules(violations: Violation[]): Rule[] { return violations.map(v => v.rule); }

test('checker catches hooks called from effect callbacks (the original failure)', () => {
  const found = fixture('function Filter() { useEffect(() => { useReducedMotion(); }, []); return null; }');
  assert.ok(rules(found).includes('a'), JSON.stringify(found));
});

test('checker catches a hook after an early return', () => {
  const found = fixture('function Panel({ ready }) { if (!ready) return null; useValue(); return null; }');
  assert.ok(rules(found).includes('b'), JSON.stringify(found));
});

test('checker catches hooks in conditionals and loops', () => {
  assert.ok(rules(fixture('function Panel({ ok }) { if (ok) useValue(); return null; }')).includes('b'));
  assert.ok(rules(fixture('function Panel() { for (;;) { useValue(); break; } return null; }')).includes('b'));
});

test('checker catches hooks inside event handlers and nested helpers', () => {
  const handler = fixture('function Panel() { return <Button onPress={() => useValue()} />; }');
  assert.ok(rules(handler).includes('c'), JSON.stringify(handler));
  const helper = fixture('function Panel() { function helper() { useValue(); } helper(); return null; }');
  assert.ok(rules(helper).includes('c'), JSON.stringify(helper));
});

test('checker accepts component and custom-hook bodies, including React wrappers', () => {
  const clean = `
    function Panel() { const value = useValue(); return value; }
    function usePanel() { const value = React.useMemo(() => 1, []); return value; }
    const MemoPanel = React.memo(() => { const value = useValue(); return value; });
    const ForwardPanel = React.forwardRef((props, ref) => { const value = useValue(); return value; });
  `;
  assert.deepEqual(fixture(clean), []);
});

test('checker reports every real source violation and lists any intentional exceptions', () => {
  const sourceFiles = [
    ...walk(path.join(repoRoot, 'mobile/src/line')).filter(file => /\.tsx?$/.test(file)),
    path.join(repoRoot, 'mobile/App.tsx'),
    ...walk(path.join(repoRoot, 'client/src/components/line')).filter(file => file.endsWith('.tsx')),
  ];
  const expectedViolations: Array<{ file: string; line: number; rule: Rule; reason: string }> = [];
  const violations = sourceFiles.flatMap(file => checkHooks(readFile(file), path.relative(repoRoot, file)));
  const expectedKeys = new Set(expectedViolations.map(v => `${v.file}:${v.line}:${v.rule}`));
  const actualKeys = new Set(violations.map(v => `${v.file}:${v.line}:${v.rule}`));
  const unexpected = violations.filter(v => !expectedKeys.has(`${v.file}:${v.line}:${v.rule}`));
  const stale = expectedViolations.filter(v => !actualKeys.has(`${v.file}:${v.line}:${v.rule}`));
  assert.deepEqual({ unexpected, stale }, { unexpected: [], stale: [] },
    [...unexpected.map(v => `${v.file}:${v.line} rule ${v.rule}: ${v.message}`), ...stale.map(v => `stale expected violation ${v.file}:${v.line} rule ${v.rule}: ${v.reason}`)].join('\n'));
});

test('historical Discovery source fails rule (a) inside Filter', (t) => {
  let oldSource: string;
  try {
    oldSource = execFileSync('git', ['show', 'a84d1ff^:mobile/src/line/Discovery.tsx'], { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch {
    t.skip('Git history for a84d1ff^ is unavailable; historical regression check skipped.');
    return;
  }
  const found = checkHooks(oldSource, 'mobile/src/line/Discovery.tsx');
  assert.ok(found.some(v => v.rule === 'a' && v.functionName === 'Filter'), JSON.stringify(found, null, 2));
});

function readFile(file: string): string {
  return readFileSync(file, 'utf8');
}

function walk(directory: string): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}
