import { QueryClient } from 'craftping';

let cache = { online: false, onlinePlayers: 0, maxPlayers: 0 };

export const startMcPoller = ({
  host = '127.0.0.1',
  port = 25565,       // Query-порт, указанный в server.properties → query.port
  intervalMs = 30000,
  timeoutMs = 5000,   // таймаут (ms) для запроса
} = {}) => {
  const client = new QueryClient();

  const poll = async () => {
    try {
      const res = await client.queryBasic(host, port, AbortSignal.timeout(timeoutMs));
      cache = {
        online: true,
        onlinePlayers: Number(res?.numplayers ?? 0),
        maxPlayers: Number(res?.maxplayers ?? 0),
      };
    } catch {
      cache = { online: false, onlinePlayers: 0, maxPlayers: 0 };
    }
  };

  poll();
  const timer = setInterval(poll, intervalMs);
  return () => clearInterval(timer);
};

export const getServerStatusHandler = (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({
    status: cache.online ? 'online' : 'offline',
    players: { online: cache.onlinePlayers, max: cache.maxPlayers },
  });
};