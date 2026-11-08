#!/usr/bin/env node
// Checks the pairs locales/<namespace>_en.json / locales/<namespace>_es.json (workspace spec 056, B-05, and spec 086):
// - every key is in both languages;
// - the keys are sorted, so that two branches adding keys rarely touch the same lines (`--fix` sorts them);
// - no Spanish text is the English one, which usually means a missing translation, leaving out
//   scripts/check-locales-allowlist.json;
// - a key lives in one namespace only (for now a warning: common wins, the other copy is never read).
// `tables` (spec 086) is keyed by the English text of the attack tables, and its English file is empty on purpose.
// Exits 1 on any error. Usage: node scripts/check-locales.mjs [--fix]
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPTS = dirname(fileURLToPath(import.meta.url));
const LOCALES = join(SCRIPTS, '..', 'locales');
const FIX = process.argv.includes('--fix');

// Keys whose text is the same in both languages on purpose (proper nouns, words spelt the same, codes and
// interpolations), by namespace.
const ALLOWED = JSON.parse(readFileSync(join(SCRIPTS, 'check-locales-allowlist.json'), 'utf8'));
// Namespaces keyed by the English text itself: the English file has no keys, only the translations do.
const KEYED_BY_TEXT = new Set(['tables']);

const read = (file) => JSON.parse(readFileSync(join(LOCALES, file), 'utf8'));
const format = (data) => `${JSON.stringify(data, null, 2)}\n`;
const sorted = (data) => Object.fromEntries(Object.keys(data).sort().map((key) => [key, data[key]]));

let errors = 0;
const error = (message) => {
  errors++;
  console.log(message);
};

const namespaces = readdirSync(LOCALES)
  .filter((name) => name.endsWith('_en.json'))
  .map((name) => name.slice(0, -'_en.json'.length))
  .filter((namespace) => existsSync(join(LOCALES, `${namespace}_es.json`)))
  .sort();

const owners = new Map();
for (const namespace of namespaces) {
  const files = [`${namespace}_en.json`, `${namespace}_es.json`];
  for (const file of files) {
    const text = readFileSync(join(LOCALES, file), 'utf8');
    const expected = format(sorted(JSON.parse(text)));
    if (text === expected) continue;
    if (FIX) {
      writeFileSync(join(LOCALES, file), expected);
      console.log(`${file}: sorted`);
    } else error(`${file}: keys not sorted (run with --fix)`);
  }
  const [en, es] = files.map(read);
  if (!KEYED_BY_TEXT.has(namespace)) {
    const onlyEn = Object.keys(en).filter((key) => !(key in es));
    const onlyEs = Object.keys(es).filter((key) => !(key in en));
    if (onlyEn.length) error(`${namespace}: ${onlyEn.length} keys missing in Spanish: ${onlyEn.join(', ')}`);
    if (onlyEs.length) error(`${namespace}: ${onlyEs.length} keys missing in English: ${onlyEs.join(', ')}`);
    for (const key of Object.keys(en)) owners.set(key, [...(owners.get(key) ?? []), namespace]);
  }
  const allowed = new Set(ALLOWED[namespace] ?? []);
  const same = Object.keys(es).filter(
    (key) => typeof es[key] === 'string' && es[key] !== '' && es[key] === en[key] && !allowed.has(key)
  );
  if (same.length) {
    error(`${namespace}: ${same.length} keys with the English text in ${namespace}_es.json`);
    for (const key of same) console.log(`  ${key}: ${JSON.stringify(es[key])}`);
  }
}

const repeated = [...owners].filter(([, where]) => where.length > 1);
if (repeated.length) {
  console.log(`warning: ${repeated.length} keys in more than one namespace (common wins):`);
  for (const [key, where] of repeated) console.log(`  ${key}: ${where.join(', ')}`);
}

console.log(errors ? `${errors} problems` : `${namespaces.join(', ')}: ok`);
process.exit(errors ? 1 : 0);
