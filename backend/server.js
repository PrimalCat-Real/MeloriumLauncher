import express from 'express';
import helmet  from 'helmet';
import { loginRoute } from './auth.js';
import { ipWhitelist } from './ip-whitelist.js';
import { getMeloriumConfig } from './config.js';
import modDownloadRouter from './mods.js';
import { connectionCheck } from './connection-check.js';
import { startMcPoller, getServerStatusHandler } from './mc-status.js';
import { initMainModsManifest, getMainModsManifest } from './mods-manifest.js';
import path from 'path';
import cors from 'cors'; 
import downloadResolveRouter from './download-resolve.js';
const app = express();
const PORT = process.env.PORT || 8000;

app.use(cors({
  origin: [
      "http://localhost:3000",
      "http://tauri.localhost", // Tauri dev
      "tauri://localhost",      // Tauri prod
  ],
  credentials: true,        
}));



app.use(helmet());
app.use(express.json());


await initMainModsManifest({
  dir: path.resolve(process.cwd(), 'mainMods'),
  // ignore: ['**/*.log','**/*.tmp','cache/**'], // optional override
});

startMcPoller({ host: '127.0.0.1', port: 25566, intervalMs: 10000, timeoutMs: 5000 });

app.get('/get-server-status', getServerStatusHandler);
app.use('/optional-download', modDownloadRouter);
app.get('/config', getMeloriumConfig);
app.post('/login', loginRoute);
app.post('/ipWhitelist', ipWhitelist);
app.get('/check-connect', connectionCheck);

app.get('/mods-manifest', (_req, res) => {
  const manifest = getModsManifest();
  res.setHeader('ETag', `"sha256-${manifest.dirHash}"`);
  res.setHeader('Cache-Control', 'no-cache');
  res.status(200).json(manifest);
});

// Downloads and resolver
app.use('/download', downloadResolveRouter);       // /download/resolve-mods, /download/main-mod
app.use('/optional-download', optionalDownloadRouter); // /optional-download/mod

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
