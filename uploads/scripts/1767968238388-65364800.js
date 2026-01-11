module.exports = async function ({ db, utils }) {
  const events = db.collection('events');

  await events.insertMany([
    { event_type: 'LOGIN', user_id: 1 },
    { event_type: 'LOGOUT', user_id: 1 },
    { event_type: 'PURCHASE', user_id: 2, amount: 499 }
  ]);

  const docs = await events
    .find({})
    .sort({ _id: -1 })
    .limit(5)
    .toArray();

  return {
    rowCount: docs.length,
    rows: docs
  };
};
