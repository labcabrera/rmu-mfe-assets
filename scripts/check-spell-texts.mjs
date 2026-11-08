#!/usr/bin/env node
// Coverage of the translations of the book spells (workspace spec 088). The names live in locales/spell-names_es.json,
// keyed by the English name; the descriptions in locales/spell-text/<list code>_es.json, keyed by `level-<n>` and
// `description` (the one of the list). The English comes from Mongo: `make spell-source` writes it to a temporary file.
//
// Reports the coverage, and fails on orphans (translations of names, lists or levels that no longer exist) and on
// lists whose English changed since they were translated (scripts/spell-text-hashes.json).
//
// Usage: node scripts/check-spell-texts.mjs <source file> [--missing] [--init] [--update-hashes]
//   --missing        lists the texts without translation
//   --init           creates the empty files of the lists that have none
//   --update-hashes  records the English of the lists translated, once reviewed
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPTS = dirname(fileURLToPath(import.meta.url));
const LOCALES = join(SCRIPTS, '..', 'locales');
const HASHES = join(SCRIPTS, 'spell-text-hashes.json');
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const sourceFile = args.find((arg) => !arg.startsWith('--'));

if (!sourceFile || !existsSync(sourceFile)) {
  console.error('No source file: run `make spell-source` (needs the local stack)');
  process.exit(2);
}
const lists = readFileSync(sourceFile, 'utf8')
  .split('\n')
  .filter(Boolean)
  .map((line) => JSON.parse(line));
const textFile = (code, lng) => join(LOCALES, 'spell-text', `${code}_${lng}.json`);
const read = (file) => JSON.parse(readFileSync(file, 'utf8'));
const english = (list) =>
  JSON.stringify([list.description, list.spells.map((spell) => [spell.level, spell.description])]);
const hash = (text) => createHash('sha256').update(text).digest('hex').slice(0, 16);

if (flag('--init')) {
  mkdirSync(join(LOCALES, 'spell-text'), { recursive: true });
  for (const list of lists)
    for (const lng of ['en', 'es']) if (!existsSync(textFile(list.code, lng))) writeFileSync(textFile(list.code, lng), '{}\n');
}

let errors = 0;
const error = (message) => {
  errors++;
  console.log(message);
};

// Names
const names = read(join(LOCALES, 'spell-names_es.json'));
const known = new Set(lists.flatMap((list) => [list.name, ...list.spells.map((spell) => spell.name)]));
const missingNames = [...known].filter((name) => !names[name]);
console.log(`names: ${known.size - missingNames.length}/${known.size}`);
if (flag('--missing')) missingNames.forEach((name) => console.log(`  ${JSON.stringify(name)}`));
for (const name of Object.keys(names)) if (!known.has(name)) error(`orphan name: ${JSON.stringify(name)}`);

// Descriptions
const hashes = existsSync(HASHES) ? read(HASHES) : {};
let total = 0;
let translated = 0;
for (const list of lists) {
  const file = textFile(list.code, 'es');
  if (!existsSync(file)) {
    error(`${list.code}: no file (run with --init)`);
    continue;
  }
  const texts = read(file);
  const expected = new Map(
    list.spells.filter((spell) => spell.description).map((spell) => [`level-${spell.level}`, spell.description]),
  );
  if (list.description) expected.set('description', list.description);
  const missing = [...expected.keys()].filter((key) => !texts[key]);
  total += expected.size;
  translated += expected.size - missing.length;
  for (const key of Object.keys(texts)) if (!expected.has(key)) error(`${list.code}: orphan ${key}`);
  if (flag('--missing')) missing.forEach((key) => console.log(`  ${list.code} ${key}`));
  if (Object.keys(texts).length === 0) continue;
  if (flag('--update-hashes')) hashes[list.code] = hash(english(list));
  else if (hashes[list.code] !== hash(english(list))) error(`${list.code}: the English changed since it was translated`);
}
console.log(`descriptions: ${translated}/${total} (${total ? Math.round((100 * translated) / total) : 0} %)`);
if (flag('--update-hashes')) {
  const sorted = Object.fromEntries(Object.keys(hashes).sort().map((code) => [code, hashes[code]]));
  writeFileSync(HASHES, `${JSON.stringify(sorted, null, 2)}\n`);
}
process.exit(errors ? 1 : 0);
