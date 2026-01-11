module.exports = async function ({ mongo }) {
  await mongo.insertMany('movies', [
    { title: 'Bug Bash Movie', year: 2026 }
  ]);

  const docs = await mongo.find('movies', {
    title: 'Bug Bash Movie'
  });

  return {
    rowCount: docs.length,
    rows: docs
  };
};
