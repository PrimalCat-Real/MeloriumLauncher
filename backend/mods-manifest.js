import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import fg from 'fast-glob';

// Cached state
let cached = {
  generatedAt: '',
  dirHash: '',
  required: [],
  optional: [],
};
let requiredRoot = '';
let optionalRoot = '';

const toPosix = (p) => p.split(path.sep).join('/');

const sha256File = async (absPath) => {
  const hash = crypto.createHash('sha256');
  await new Promise((resolve, reject) => {
    const s = fs.createReadStream(absPath);
    s.on('data', (c) => hash.update(c));
    s.on('end', resolve);
    s.on('error', reject);
  });
  return hash.digest('hex');
};

const buildList = async (rootDir, ignore = []) => {
  const exists = await fs.promises
    .access(rootDir, fs.constants.F_OK)
    .then(() => true)
    .catch(() => false);
  if (!exists) return [];

  const rels = await fg(['**/*.jar'], {
    cwd: rootDir,
    onlyFiles: true,
    dot: false,
    ignore,
    followSymbolicLinks: false,
  });

  const files = [];
  for (const rel of rels) {
    const relPosix = toPosix(rel);
    const abs = path.resolve(rootDir, rel);
    const st = await fs.promises.stat(abs);
    const sha = await sha256File(abs);
    files.push({ path: relPosix, size: st.size, mtimeMs: st.mtimeMs, sha256: sha });
  }
  files.sort((a, b) => a.path.localeCompare(b.path));
  return files;
};

const computeDirHash = (required, optional) => {
  const hasher = crypto.createHash('sha256');
  // Tag groups to avoid collisions
  for (const f of required) {
    hasher.update(Buffer.from('R', 'utf8'));
    hasher.update(Buffer.from(f.path, 'utf8'));
    hasher.update(Buffer.from([0x00]));
    hasher.update(Buffer.from(String(f.size), 'utf8'));
    hasher.update(Buffer.from([0x00]));
    hasher.update(Buffer.from(f.sha256, 'hex'));
  }
  for (const f of optional) {
    hasher.update(Buffer.from('O', 'utf8'));
    hasher.update(Buffer.from(f.path, 'utf8'));
    hasher.update(Buffer.from([0x00]));
    hasher.update(Buffer.from(String(f.size), 'utf8'));
    hasher.update(Buffer.from([0x00]));
    hasher.update(Buffer.from(f.sha256, 'hex'));
  }
  return hasher.digest('hex');
};

export const initModsManifests = async (opts = {}) => {
  requiredRoot = opts.requiredDir ?? path.resolve(process.cwd(), 'mainMods');
  optionalRoot = opts.optionalDir ?? path.resolve(process.cwd(), 'mods');

  const required = await buildList(requiredRoot, Array.isArray(opts.ignoreRequired) ? opts.ignoreRequired : undefined);
  const optional = await buildList(optionalRoot, Array.isArray(opts.ignoreOptional) ? opts.ignoreOptional : undefined);

  const dirHash = computeDirHash(required, optional);
  cached = {
    generatedAt: new Date().toISOString(),
    dirHash,
    required,
    optional,
  };
};

export const getModsManifest = () => cached;

export const getIndexForResolve = () => {
  const reqIdx = new Map();
  const optIdx = new Map();
  for (const f of cached.required) reqIdx.set(f.path, f);
  for (const f of cached.optional) optIdx.set(f.path, f);
  return {
    requiredRoot,
    optionalRoot,
    requiredIndex: reqIdx,
    optionalIndex: optIdx,
  };
};
