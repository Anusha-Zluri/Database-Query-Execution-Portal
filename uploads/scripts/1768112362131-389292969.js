module.exports = async function ({ db }) {
  // 1. Select the collection (Table)
  const col = db.collection('movies');

  // 2. Perform the Insert
  const insertResult = await col.insertOne({
    title: 'Final Bug Fix Movie',
    year: 2026,
    status: 'Approved',
    executedAt: new Date()
  });

  // 3. Find the record we just created
  // Note: We use .toArray() because 'find' returns a cursor
  const docs = await col.find({ title: 'Final Bug Fix Movie' }).toArray();

  // 4. Return the exact format your runner expects
  return {
    rowCount: docs.length,
    rows: docs
  };
};
