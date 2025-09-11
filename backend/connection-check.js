export const connectionCheck = (req, res) => {
  const SERVER_NAME = process.env.SERVER_NAME || 'main';
  res.json({ ok: true, server: SERVER_NAME, timestamp: Date.now() });
};