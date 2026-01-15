module.exports = async function ({ db }) {
  if (!db || typeof db.collection !== 'function') {
    throw new Error("The 'db' object passed to the sandbox is invalid or missing the collection method.");
  }

  const col = db.collection('movies');

  await col.insertOne({
    title: 'Bug Bash Fixed',
    year: 2026,
    status: 'Success'
  });

  const docs = await col.find({ title: 'Bug Bash Fixed' }).toArray();

  return {
    rowCount: docs.length,
    rows: docs
  };
};
