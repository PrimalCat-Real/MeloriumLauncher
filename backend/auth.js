import bcrypt from 'bcrypt';
import { Pool } from 'pg';
import * as Sentry from "@sentry/browser";
// const login_data = [{
//     username: "PrimalCat",
//     uuid: "1f4f3e3e-3b7d-4e1f-9f9f-1234567890ab",
//     user_password: "$2a$10$AcbJbA0pvOg/ZcRWh4OgM.RoITSKnuzA2hpxtGCjOhvHCw3LgxIoK",
//     is_active: true,
//     tokens: 1000
// }]

const pool = new Pool({
  host: '83.136.235.8',
  port: 5432,
  database: 'melorium',
  user: 'melorium',
  password: 'Rhaidm4Bs_isd',
});

export const loginRoute = async (req, res) => {
  const { login, password } = req.body;

  if (!login || !password) {
    return res.status(400).json({ error: 'Missing login or password' });
  }

  try {
    const result = await pool.query('SELECT * FROM adm.adm_server_user_v WHERE username = $1', [login]);
    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    // if (!user.is_active) {
    //   return res.status(403).json({ is_active: false, error: 'Account not activated' });
    // }
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid login or password' });
    }

    res.json({
      uuid: user.uuid,
      is_active: user.is_active,
      tokens: 0 // user.tokens, // TODO: Implement token system
    });
  } catch (error) {
    Sentry.captureException(error);
    console.error('Database query failed', error);
    return res.status(500).json({ error: 'Database query failed' });
  }
};
