module.exports = async function () {
  const collection = db.collection('movies');

  await collection.insertMany([
    { title: 'Bug Bash Movie', year: 2026 }
  ]);

  const docs = await collection.find({}).toArray();

  return {
    rowCount: docs.length,
    rows: docs
  };
};
