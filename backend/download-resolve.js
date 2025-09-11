import express from 'express';
import helmet from 'helmet';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { z } from 'zod';
import { getMainModsManifest } from './mods-manifest.js';

const router = express.Router();
router.use(helmet());

const authSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

const resolveBodySchema = z.object({
  files: z.array(z.string().min(1)).min(1),
  username: z.string().min(1),
  password: z.string().min(1),
});

// helper hashes map from cached manifest
const getIndex = () => {
  const m = getMainModsManifest();
  const idx = new Map();
  for (const f of m.files) idx.set(f.path, f);
  return { manifest: m, index: idx };
};

// 1) Meta-эндпоинт: вернёт, что есть на сервере, и суммарный размер
router.post('/resolve-mods', (req, res) => {
  const parsed = resolveBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid body' });
    return;
  }
  const authOk = authSchema.safeParse({
    username: parsed.data.username,
    password: parsed.data.password,
  }).success && parsed.data.username === 'test' && parsed.data.password === 'test';

  if (!authOk) {
    res.status(403).json({ error: 'Incorrect username or password.' });
    return;
  }

  const { index } = getIndex();

  const available = [];
  const missing = [];
  let totalBytes = 0;

  for (const rel of parsed.data.files) {
    const norm = rel.replaceAll('\\', '/').replace(/^\/+/, '');
    const meta = index.get(norm);
    if (meta) {
      available.push({
        path: meta.path,
        size: meta.size,
        sha256: meta.sha256,
        // client will POST to /download/main-mod with {modName}
        url: '/download/main-mod',
      });
      totalBytes += meta.size;
    } else {
      missing.push(norm);
    }
  }

  res.status(200).json({
    available,
    missing,
    totalBytes,
    totalCount: available.length,
  });
});

// 2) Скачивание из mainMods по одному файлу
router.post('/main-mod', async (req, res) => {
  const parsed = authSchema
    .extend({ modName: z.string().min(1).max(260) })
    .safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json('Invalid body.');
    return;
  }
  const { username, password, modName } = parsed.data;

  if (!(username === 'test' && password === 'test')) {
    res.status(403).json('Incorrect username or password.');
    return;
  }

  const norm = modName.replaceAll('\\', '/').replace(/^\/+/, '');
  const { manifest, index } = getIndex();
  const meta = index.get(norm);
  if (!meta) {
    res.status(404).json('The requested mod does not exist.');
    return;
  }

  const abs = path.resolve(process.cwd(), 'mainMods', norm);
  try {
    const stat = await fs.promises.stat(abs);
    if (!stat.isFile()) {
      res.status(404).json('The requested mod does not exist.');
      return;
    }
  } catch {
    res.status(404).json('The requested mod does not exist.');
    return;
  }

  // Optional quick rehash on serve if mtime differs from cached (safety)
  let shaHex = meta.sha256;
  try {
    const stat = await fs.promises.stat(abs);
    if (stat.mtimeMs !== meta.mtimeMs || stat.size !== meta.size) {
      const hash = crypto.createHash('sha256');
      await new Promise((resolve, reject) => {
        const s = fs.createReadStream(abs);
        s.on('data', (c) => hash.update(c));
        s.on('end', resolve);
        s.on('error', reject);
      });
      shaHex = hash.digest('hex');
    }
  } catch {
    // no-op: fallback to cached
  }

  res.setHeader('ETag', `"sha256-${shaHex}"`);
  res.setHeader('X-Checksum-SHA256', shaHex);
  res.setHeader('Cache-Control', 'no-cache');
  res.download(abs, path.basename(abs));
});

export default router;