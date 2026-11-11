import assert from 'node:assert/strict';
import {readdirSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import {test} from 'node:test';

function sourceFiles(root: string): string[] {
  return readdirSync(root, {withFileTypes:true}).flatMap(entry => {
    const path = join(root, entry.name);
    return entry.isDirectory() ? sourceFiles(path) : /\.(tsx?|json)$/.test(path) ? [path] : [];
  });
}
test('native and shared market copy uses weather hedging language', () => {
  const disallowed = new RegExp(['insur' + 'ance', 'wed' + 'ding'].join('|'), 'i');
  for (const path of [...sourceFiles(new URL('.', import.meta.url).pathname), ...sourceFiles(new URL('../../shared/pm-amm', import.meta.url).pathname)]) {
    assert.doesNotMatch(readFileSync(path, 'utf8'), disallowed, path);
  }
});
