// Workspace spec 086: printed by `make data-keys`. Read only.
// Read only: every key-shaped string value of every collection (workspace spec 086).
const found = new Set();
const KEY = /^[A-Za-z0-9][\w.-]{0,80}$/;
const walk = (v) => {
  if (typeof v === 'string') {
    if (KEY.test(v)) found.add(v);
  } else if (Array.isArray(v)) v.forEach(walk);
  else if (v && typeof v === 'object' && !(v instanceof Date) && v._bsontype === undefined)
    Object.values(v).forEach(walk);
};
for (const { name } of db.adminCommand({ listDatabases: 1 }).databases) {
  if (['admin', 'local', 'config'].includes(name)) continue;
  const d = db.getSiblingDB(name);
  for (const c of d.getCollectionNames()) d.getCollection(c).find().forEach(walk);
}
print('DATA_STRINGS ' + JSON.stringify([...found]));
