#!/usr/bin/env node
// Workspace spec 090: locales/skill-text_{en,es}.json has a description for every system skill, none for a skill that no
// longer exists, and both languages have the same paragraphs. `make check-skill-texts` writes the ids from the local Mongo.
// Usage: node scripts/check-skill-texts.mjs <file with one skill id per line>
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const LOCALES = join(dirname(fileURLToPath(import.meta.url)), '..', 'locales');
const idsFile = process.argv[2];
if (!idsFile || !existsSync(idsFile)) {
  console.error('No ids file: run `make check-skill-texts` (needs the local stack)');
  process.exit(2);
}
const ids = readFileSync(idsFile, 'utf8').split('\n').filter(Boolean);
const read = (lng) => JSON.parse(readFileSync(join(LOCALES, `skill-text_${lng}.json`), 'utf8'));
const [en, es] = [read('en'), read('es')];
const paragraphs = (text) => text.split('\n').length;

const problems = [
  ...ids.filter((id) => !en[id]).map((id) => `${id}: no English description`),
  ...ids.filter((id) => !es[id]).map((id) => `${id}: no Spanish description`),
  ...Object.keys(en).filter((id) => !ids.includes(id)).map((id) => `${id}: orphan description`),
  ...ids
    .filter((id) => en[id] && es[id] && paragraphs(en[id]) !== paragraphs(es[id]))
    .map((id) => `${id}: ${paragraphs(en[id])} paragraphs in English, ${paragraphs(es[id])} in Spanish`),
];
problems.forEach((problem) => console.log(problem));
console.log(problems.length ? `${problems.length} problems` : `skill-text: ${ids.length} skills ok`);
process.exit(problems.length ? 1 : 0);
