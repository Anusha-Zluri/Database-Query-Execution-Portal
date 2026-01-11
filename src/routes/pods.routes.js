const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.json({ message: 'pods list placeholder' });
});

module.exports = router;
