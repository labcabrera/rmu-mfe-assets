#!/usr/bin/env node
// Lists the keys whose Spanish text is the English one, which usually means a missing translation (spec 056, B-05).
// Compares every pair locales/<namespace>_en.json / locales/<namespace>_es.json, leaving out
// scripts/check-locales-allowlist.json.
// Exits 1 when it finds any. Usage: node scripts/check-locales.mjs
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPTS = dirname(fileURLToPath(import.meta.url));
const LOCALES = join(SCRIPTS, '..', 'locales');

// Keys whose text is the same in both languages on purpose (proper nouns, words spelt the same, codes and
// interpolations), by namespace.
const ALLOWED = JSON.parse(readFileSync(join(SCRIPTS, 'check-locales-allowlist.json'), 'utf8'));

const read = (file) => JSON.parse(readFileSync(join(LOCALES, file), 'utf8'));

let found = 0;
for (const file of readdirSync(LOCALES).filter((name) => name.endsWith('_en.json')).sort()) {
  const namespace = file.slice(0, -'_en.json'.length);
  const esFile = `${namespace}_es.json`;
  if (!existsSync(join(LOCALES, esFile))) continue;
  const en = read(file);
  const es = read(esFile);
  const allowed = new Set(ALLOWED[namespace] ?? []);
  const same = Object.keys(es).filter(
    (key) => typeof es[key] === 'string' && es[key] !== '' && es[key] === en[key] && !allowed.has(key)
  );
  if (same.length === 0) {
    console.log(`${namespace}: ok`);
    continue;
  }
  found += same.length;
  console.log(`${namespace}: ${same.length} keys with the English text in ${esFile}`);
  for (const key of same) console.log(`  ${key}: ${JSON.stringify(es[key])}`);
}

process.exit(found > 0 ? 1 : 0);
