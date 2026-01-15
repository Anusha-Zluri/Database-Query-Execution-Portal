module.exports = async function ({ db, utils }) {
  await db.query(
    `
    INSERT INTO events (event_name)
    VALUES ($1), ($2)
    `,
    ['user_login', 'user_logout']
  );

  const result = await db.query(
    `
    SELECT id, event_name, created_at
    FROM events
    ORDER BY id DESC
    LIMIT 5
    `
  );

  return {
    rowCount: result.rowCount,
    rows: result.rows
  };
};
