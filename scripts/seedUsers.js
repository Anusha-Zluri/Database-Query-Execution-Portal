const bcrypt = require('bcrypt');

const { pool } = require('../src/config/db');


const seedUsers = async () => {
  const passwordHash = await bcrypt.hash('password123', 10);

  const users = [
    {
      username: 'dev_user',
      name: 'Developer User',
      email: 'dev@test.com',
      role: 'DEVELOPER',
    },
    {
      username: 'manager_user',
      name: 'Manager User',
      email: 'manager@test.com',
      role: 'MANAGER',
    },
    {
      username: 'admin_user',
      name: 'Admin User',
      email: 'admin@test.com',
      role: 'ADMIN',
    },
    {
      username: 'manager_user2',
      name: 'Manager User 2',
      email: 'manager2@test.com',
      role: 'MANAGER',
    },

  ];

  for (const user of users) {
    await pool.query(
      `
      INSERT INTO users (username, name, email, password_hash, role, is_active)
      VALUES ($1, $2, $3, $4, $5, true)
      ON CONFLICT (email) DO NOTHING
      `,
      [
        user.username,
        user.name,
        user.email,
        passwordHash,
        user.role,
      ]
    );
  }

  console.log('All users seeded successfully');
  process.exit(0);
};

seedUsers().catch(err => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
