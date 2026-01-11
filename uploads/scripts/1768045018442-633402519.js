module.exports = async function ({ db }) {
  const collection = db.collection('movies');

  await collection.insertMany([
    { title: 'Bug Bash Movie', year: 2026 }
  ]);

  const docs = await collection
    .find({ title: 'Bug Bash Movie' })
    .toArray();

  return {
    rowCount: docs.length,
    rows: docs
  };
};
