// pods.controller.js
exports.getPods = async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, name FROM pods WHERE is_active = true ORDER BY name`
  );

  res.json(rows);
};
