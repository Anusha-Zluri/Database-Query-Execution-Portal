const jwt = require('jsonwebtoken');
const { loginUser } = require('../services/auth.service');
const jwtConfig = require('../config/jwt');

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await loginUser(email, password);

    const token = jwt.sign(user, jwtConfig.secret, {
      expiresIn: jwtConfig.expiresIn,
    });

    res.json({ token });
  } catch (err) {
    res.status(401).json({ message: err.message });
  }
};

const me = async (req, res) => {
  res.json({
    id: req.user.id,
    email: req.user.email,
    role: req.user.role,
  });
};

module.exports = {
  login,
  me,
};
