#!/usr/bin/env node
// Coverage of the translations of the attack table texts (workspace spec 086). The English text of a critical, fumble
// or spell failure entry is its own key in locales/tables_<lng>.json. Reports, per table, how many texts have a
// translation, and the orphan translations: keys no table has any more, usually because its English text was fixed.
// Exits 1 when there are orphans. Usage: node scripts/check-table-texts.mjs [tables dir] [--lng es] [--missing]
// (the tables dir defaults to the rmu-api-attack-tables checkout next to this one; --missing lists untranslated texts).
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPTS = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const option = (name) =>
  args.includes(name) ? args[args.indexOf(name) + 1] : undefined;
const lng = option("--lng") ?? "es";
const tablesDir =
  args.find(
    (arg, index) => !arg.startsWith("--") && args[index - 1] !== "--lng",
  ) ?? join(SCRIPTS, "..", "..", "rmu-api-attack-tables", "tables");
const KINDS = ["critical", "fumble", "spell-failure"];
// Fields that hold the text of an entry: `message` in the criticals, `text` in the fumbles and spell failures.
const TEXT_FIELDS = new Set(["message", "text"]);

if (!existsSync(tablesDir)) {
  console.error(`No tables in ${tablesDir}`);
  process.exit(2);
}
const translations = JSON.parse(
  readFileSync(join(SCRIPTS, "..", "locales", `tables_${lng}.json`), "utf8"),
);

const textsOf = (node, texts = []) => {
  if (Array.isArray(node)) node.forEach((child) => textsOf(child, texts));
  else if (node && typeof node === "object")
    Object.entries(node).forEach(([key, value]) =>
      TEXT_FIELDS.has(key) && typeof value === "string"
        ? value && texts.push(value)
        : textsOf(value, texts),
    );
  return texts;
};

const known = new Set();
let total = 0;
let translated = 0;
for (const kind of KINDS) {
  const dir = join(tablesDir, kind);
  if (!existsSync(dir)) continue;
  for (const file of readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .sort()) {
    const texts = [
      ...new Set(textsOf(JSON.parse(readFileSync(join(dir, file), "utf8")))),
    ];
    if (texts.length === 0) continue;
    texts.forEach((text) => known.add(text));
    const missing = texts.filter((text) => !translations[text]);
    total += texts.length;
    translated += texts.length - missing.length;
    const percent = Math.round(
      (100 * (texts.length - missing.length)) / texts.length,
    );
    console.log(
      `${kind}/${file}: ${texts.length - missing.length}/${texts.length} (${percent} %)`,
    );
    if (args.includes("--missing"))
      missing.forEach((text) => console.log(`  ${JSON.stringify(text)}`));
  }
}

const orphans = Object.keys(translations).filter((text) => !known.has(text));
console.log(
  `total ${lng}: ${translated}/${total} texts (${total ? Math.round((100 * translated) / total) : 0} %)`,
);
if (orphans.length) {
  console.log(`${orphans.length} orphan translations in tables_${lng}.json:`);
  orphans.forEach((text) => console.log(`  ${JSON.stringify(text)}`));
}
process.exit(orphans.length ? 1 : 0);
