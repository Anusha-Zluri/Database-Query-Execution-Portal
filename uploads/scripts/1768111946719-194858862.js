module.exports = async function ({ mongo }) {
  // We specify 'movies' here because that's the collection name in your screenshot
  const collectionName = 'movies';

  await mongo.insertOne(collectionName, {
    title: 'Gemini Bug Bash',
    year: 2026,
    plot: 'Integration successful'
  });

  const docs = await mongo.find(collectionName, {
    title: 'Gemini Bug Bash'
  });

  return {
    rowCount: docs.length,
    rows: docs
  };
};
