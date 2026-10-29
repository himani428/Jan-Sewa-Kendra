import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { createApp } from '../server/app.js';

export const tmpFile = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'jansewa-')), 'store.json');
export async function start(file = tmpFile()) {
  const { app } = createApp({ file, staticDir: '/nonexistent' });
  const server = await new Promise((r) => { const s = app.listen(0, () => r(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const j = async (p, { method = 'GET', body, token } = {}) => {
    const r = await fetch(base + p, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const text = await r.text(); let data; try { data = JSON.parse(text); } catch { data = text; }
    return { status: r.status, data };
  };
  const login = async (id = 'officer') => (await j('/api/login', { method: 'POST', body: { id, password: 'Jansewa@123' } })).data.token;
  return { base, j, login, file, close: () => new Promise((r) => server.close(r)) };
}
