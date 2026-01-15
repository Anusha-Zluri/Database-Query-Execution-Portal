const { pool } = require('../config/db');

async function getActivePods() {
  const { rows } = await pool.query(
    `
    SELECT id, name
    FROM pods
    WHERE is_active = true
    ORDER BY name
    `
  );

  return rows;
}

module.exports = {
  getActivePods
};