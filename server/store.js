import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { buildSeed } from './seed.js';

export const VERSION = 2;
// File-backed JSON store: simple, dependency-free, survives restarts. Audit entries are append-only (no API edits them).
export function openStore(file) {
  let data = null;
  try { data = JSON.parse(fs.readFileSync(file, 'utf8')); if (data.version !== VERSION) data = null; } catch { data = null; }
  const fresh = () => ({ ...buildSeed(), version: VERSION });
  if (!data) data = { ...fresh(), secret: crypto.randomBytes(32).toString('hex') };
  const flush = () => {
    if (!file) return;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file + '.tmp', JSON.stringify(data));
    fs.renameSync(file + '.tmp', file);
  };
  flush();
  return { data, save: flush, reset: () => { const secret = data.secret; for (const k of Object.keys(data)) delete data[k]; Object.assign(data, fresh(), { secret }); flush(); } };
}
