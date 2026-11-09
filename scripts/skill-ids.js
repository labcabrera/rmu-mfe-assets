// Workspace spec 090: prints the id of every system skill, for check-skill-texts.mjs. Read only.
db.getSiblingDB('rmu-core').getCollection('skills').find({ entitySource: 'system' }, { _id: 1 }).forEach((skill) => print(`SKILL ${skill._id}`));
