#!/usr/bin/env node
// Read-only: checks that every literal image path (`images/<folder>/<file>`) in the source of the MFEs and the
// shared lib of the workspace exists in images/ (workspace spec 057). Run it before a release of the assets.
//
// Usage: node scripts/check-code-refs.mjs [workspace dir]   (default: the parent folder of this repository)
//
// Paths built at runtime (`images/items/${id}.png`) are not checked. Stories and tests are skipped: they may use
// made-up examples, and so are comment lines.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const workspace = process.argv[2] ?? join(root, '..');
const repos = readdirSync(workspace).filter((name) => /^rmu-mfe-(?!assets)|^rmu-react-shared-lib$/.test(name));
const PATH = /images\/[a-z0-9-]+\/[A-Za-z0-9._@-]+\.(?:png|jpe?g|webp|svg)/g;

const sources = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const file = join(dir, name);
    if (statSync(file).isDirectory()) return name === 'node_modules' ? [] : sources(file);
    return /\.(tsx?|jsx?)$/.test(name) && !/\.(test|spec|stories)\./.test(name) ? [file] : [];
  });

const missing = [];
for (const repo of repos) {
  const src = join(workspace, repo, 'src');
  if (!existsSync(src)) continue;
  for (const file of sources(src)) {
    const code = readFileSync(file, 'utf8')
      .split('\n')
      .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
      .join('\n');
    for (const path of new Set(code.match(PATH) ?? [])) {
      if (!existsSync(join(root, path))) missing.push(`${relative(workspace, file)}: ${path}`);
    }
  }
}

if (missing.length) {
  console.error(`${missing.length} image paths without a file:`);
  missing.forEach((line) => console.error(`  ${line}`));
  process.exit(1);
}
console.log(`code image paths: ok (${repos.join(', ')})`);
