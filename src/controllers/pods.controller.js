const podsDAL = require('../dal/pods.dal');

exports.getPods = async (req, res) => {
  try {
    const pods = await podsDAL.getActivePods();
    res.json(pods);
  } catch (err) {
    console.error('Get pods error:', err);
    res.status(500).json({ message: 'Failed to fetch pods' });
  }
};