#!/usr/bin/env node
// Workspace spec 086, phase 3: the keys of common that only one MFE uses go to that MFE's namespace
// (locales/<mfe>_{en,es}.json), which the MFE loads when it mounts (MfeRoot `namespace`). The shell finds them through
// `fallbackNS`, so no t() call changes.
//
// A repo "uses" a key when its sources hold it as a string literal ('key', "key", `key`), or a template that starts
// with a prefix of it (`difficulty-${x}` uses every difficulty-* key); plural suffixes (_one, _other…) count as the
// base key. The APIs count too: a key they mention (an error code, a status, a result) reaches every MFE as data, so it
// stays in common. So does a key that the database holds as a value (a skill, race or status id shown by any MFE):
// scripts/data-keys.json lists them, written from the local Mongo by `make data-keys` (scripts/data-strings.js). A key
// nobody mentions stays in common as well.
//
// Usage (needs the workspace checkouts next to this one):
//   node scripts/split-locales.mjs           dry run: what would move
//   node scripts/split-locales.mjs --write   moves the keys
//   node scripts/split-locales.mjs --check   fails when a key of an MFE namespace is used by another repo or the data
//   node scripts/split-locales.mjs --data-strings <file>   writes data-keys.json from the strings the database holds
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPTS = dirname(fileURLToPath(import.meta.url));
const LOCALES = join(SCRIPTS, '..', 'locales');
const WORKSPACE = join(SCRIPTS, '..', '..');
const LANGUAGES = ['en', 'es'];
// MFEs with a namespace of their own. The shell is always loaded and items is small, so both stay in common.
const SPLIT = ['core', 'strategic', 'tactical', 'npcs', 'spells'];
const SOURCE_DIRS = ['src', 'tables', 'scripts', 'data'];
const EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json']);
const SKIP = new Set(['node_modules', 'dist', 'coverage', 'build', '.git']);
const PLURAL = /_(zero|one|two|few|many|other)$/;
const KEY_LIKE = /^[A-Za-z0-9][\w.-]*$/;

const DATA_KEYS = join(SCRIPTS, 'data-keys.json');
const mode = process.argv.includes('--write') ? 'write' : process.argv.includes('--check') ? 'check' : 'dry';

const repos = readdirSync(WORKSPACE)
  .filter((name) => /^rmu-(mfe|api)-/.test(name) || name === 'rmu-react-shared-lib')
  .filter((name) => name !== 'rmu-mfe-assets' && statSync(join(WORKSPACE, name)).isDirectory())
  .sort();

const filesOf = (dir, files = []) => {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) filesOf(path, files);
    else if (EXTENSIONS.has(extname(name))) files.push(path);
  }
  return files;
};

/** The string literals and template prefixes of a repo's sources. */
const scan = (repo) => {
  const literals = new Set();
  const prefixes = new Set();
  for (const sub of SOURCE_DIRS) {
    const dir = join(WORKSPACE, repo, sub);
    if (!existsSync(dir)) continue;
    for (const file of filesOf(dir)) {
      const text = readFileSync(file, 'utf8');
      // Key-shaped tokens right after a quote, so that an apostrophe in a text cannot pair the quotes wrongly. A token
      // closed by its quote is a literal; one followed by `${` (a template) is a prefix, and so is a literal ending in
      // '-' or '_' ('prefix-' + value, labelPrefix="prefix-").
      for (const match of text.matchAll(/(?<=['"`])([A-Za-z0-9][\w.-]*)(['"`]|\$\{)/g)) {
        const [, token, end] = match;
        if (end === '${' || /[-_]$/.test(token)) {
          if (token.length >= 3) prefixes.add(token);
        } else literals.add(token);
      }
    }
  }
  return { literals, prefixes: [...prefixes] };
};

const allKeys = () =>
  new Set(
    readdirSync(LOCALES)
      .filter((name) => name.endsWith('_en.json') && !name.startsWith('tables_') && !name.startsWith('spell-names_'))
      .flatMap((name) => Object.keys(JSON.parse(readFileSync(join(LOCALES, name), 'utf8')))),
  );

if (process.argv.includes('--data-strings')) {
  const strings = new Set(JSON.parse(readFileSync(process.argv[process.argv.indexOf('--data-strings') + 1], 'utf8')));
  const keys = [...allKeys()].filter((key) => strings.has(key) || strings.has(key.replace(PLURAL, ''))).sort();
  writeFileSync(DATA_KEYS, `${JSON.stringify(keys, null, 2)}\n`);
  console.log(`data-keys.json: ${keys.length} keys the database holds`);
  process.exit(0);
}
const dataKeys = new Set(existsSync(DATA_KEYS) ? JSON.parse(readFileSync(DATA_KEYS, 'utf8')) : []);

const owner = (repo) => repo.replace(/^rmu-(mfe|api)-/, '').replace('rmu-react-shared-lib', 'lib');
const usage = new Map(repos.map((repo) => [repo, scan(repo)]));

/** Repos whose sources mention `key`; `data` when the database holds it. */
const usersOf = (key) => {
  const base = key.replace(PLURAL, '');
  const data = dataKeys.has(key) || dataKeys.has(base) ? ['data'] : [];
  return [...data, ...repos].filter((repo) => {
    if (repo === 'data') return true;
    const { literals, prefixes } = usage.get(repo);
    return literals.has(key) || literals.has(base) || prefixes.some((prefix) => key.startsWith(prefix));
  });
};

const read = (namespace, lng) => {
  const file = join(LOCALES, `${namespace}_${lng}.json`);
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
};
const write = (namespace, lng, data) => {
  const sorted = Object.fromEntries(
    Object.keys(data)
      .sort()
      .map((key) => [key, data[key]]),
  );
  writeFileSync(join(LOCALES, `${namespace}_${lng}.json`), `${JSON.stringify(sorted, null, 2)}\n`);
};

if (mode === 'check') {
  let errors = 0;
  for (const namespace of SPLIT) {
    for (const key of Object.keys(read(namespace, 'en'))) {
      const others = usersOf(key).filter((repo) => owner(repo) !== namespace);
      if (others.length) {
        errors++;
        console.log(`${namespace}: ${key} is also used by ${others.join(', ')} (move it to common)`);
      }
    }
  }
  console.log(errors ? `${errors} keys in the wrong namespace` : `${SPLIT.join(', ')}: ok`);
  process.exit(errors ? 1 : 0);
}

const common = Object.fromEntries(LANGUAGES.map((lng) => [lng, read('common', lng)]));
const moves = Object.fromEntries(SPLIT.map((namespace) => [namespace, []]));
// Keys also in items or traits stay in common: those namespaces are loaded from the start and come first.
const loaded = new Set([...Object.keys(read('items', 'en')), ...Object.keys(read('traits', 'en'))]);
for (const key of Object.keys(common.en)) {
  if (loaded.has(key)) continue;
  const users = usersOf(key);
  if (users.length === 1 && SPLIT.includes(owner(users[0])) && users[0].startsWith('rmu-mfe-')) {
    moves[owner(users[0])].push(key);
  }
}

const bytes = (data) => Buffer.byteLength(JSON.stringify(data, null, 2));
const total = Object.values(moves).reduce((sum, keys) => sum + keys.length, 0);
for (const [namespace, keys] of Object.entries(moves)) {
  const part = Object.fromEntries(keys.map((key) => [key, common.es[key]]));
  console.log(`${namespace}: ${keys.length} keys, ${Math.round(bytes(part) / 1024)} KB (es)`);
}
console.log(`common: ${Object.keys(common.en).length} → ${Object.keys(common.en).length - total} keys`);

// Keys of an MFE namespace that another repo or the data uses now go back to common.
const back = Object.fromEntries(
  SPLIT.map((namespace) => [
    namespace,
    Object.keys(read(namespace, 'en')).filter((key) => usersOf(key).some((repo) => owner(repo) !== namespace)),
  ]),
);
for (const [namespace, keys] of Object.entries(back))
  if (keys.length) console.log(`${namespace}: ${keys.length} keys back to common`);

if (mode === 'write') {
  for (const lng of LANGUAGES) {
    for (const [namespace, keys] of Object.entries(moves)) {
      const target = read(namespace, lng);
      for (const key of back[namespace]) {
        common[lng][key] = target[key];
        delete target[key];
      }
      for (const key of keys) {
        target[key] = common[lng][key];
        delete common[lng][key];
      }
      write(namespace, lng, target);
    }
    write('common', lng, common[lng]);
  }
  // The keys allowed to keep the English text in Spanish follow their key.
  const allowlistFile = join(SCRIPTS, 'check-locales-allowlist.json');
  const allowlist = JSON.parse(readFileSync(allowlistFile, 'utf8'));
  for (const [namespace, keys] of Object.entries(back)) {
    const returned = (allowlist[namespace] ?? []).filter((key) => keys.includes(key));
    if (returned.length === 0) continue;
    allowlist[namespace] = allowlist[namespace].filter((key) => !returned.includes(key));
    allowlist.common = [...new Set([...(allowlist.common ?? []), ...returned])].sort();
  }
  for (const [namespace, keys] of Object.entries(moves)) {
    const moved = (allowlist.common ?? []).filter((key) => keys.includes(key));
    if (moved.length === 0) continue;
    allowlist.common = allowlist.common.filter((key) => !moved.includes(key));
    allowlist[namespace] = [...new Set([...(allowlist[namespace] ?? []), ...moved])].sort();
  }
  writeFileSync(allowlistFile, `${JSON.stringify(allowlist, null, 2)}\n`);
  console.log('written');
}
