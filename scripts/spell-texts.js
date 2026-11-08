// Workspace spec 088: printed by `make spell-source`. Read only: the names and descriptions of the book spell lists,
// which live in Mongo, one line per list, for scripts/check-spell-texts.mjs.
const spells = db.getSiblingDB('rmu-spells');
const byList = {};
spells
  .getCollection('spells')
  .find({}, { spellListId: 1, level: 1, name: 1, description: 1 })
  .forEach((spell) => {
    (byList[spell.spellListId] ??= []).push({ level: spell.level, name: spell.name, description: spell.description ?? null });
  });
spells
  .getCollection('spell-lists')
  .find({ code: { $ne: null } }, { code: 1, name: 1, description: 1 })
  .forEach((list) => {
    const entries = (byList[list._id] ?? []).sort((a, b) => a.level - b.level);
    print(`SPELL_LIST ${JSON.stringify({ code: list.code, name: list.name, description: list.description ?? null, spells: entries })}`);
  });
