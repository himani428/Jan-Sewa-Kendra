import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const { app } = createApp({ file: process.env.DATA_FILE || path.join(root, 'data', 'store.json') });
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`जनसेवा AI → http://localhost:${PORT}`));
