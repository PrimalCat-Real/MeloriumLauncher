const express = require('express');
const helmet = require('helmet');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(express.json());

const pool = new Pool({
  host: process.env.PG_HOST,
  port: process.env.PG_PORT,
  database: process.env.PG_DATABASE,
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD
});

app.post('/login', async (req, res) => {
  const { login, password } = req.body;

  if (!login || !password) {
    return res.status(400).json({ error: 'Missing login or password' });
  }

  try {
    const query = `
      SELECT uuid, user_password, is_active, access_token 
      FROM adm.adm_user_v 
      WHERE user_login = $1
    `;
    const result = await pool.query(query, [login]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const valid = await bcrypt.compare(password, user.user_password);
    if (!valid) {
        return res.status(401).json({ error: 'Invalid login or password' });
    }

    if (!user.is_active) {
        return res.status(403).json({ is_active: false, error: 'Account not activated' });
    }

    res.json({
      uuid: user.uuid,
      is_active: user.is_active,
      accessToken: user.access_token
    });
  } catch (err) {
    console.error('DB error:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
