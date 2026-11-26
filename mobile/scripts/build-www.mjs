// Copies the web app into www/ for Capacitor. The app loads the API, university data and
// documents from the live site (see SITE in index.html), so only the page files are bundled.
import { mkdir, copyFile, rm } from 'node:fs/promises';
const root = new URL('../../', import.meta.url), out = new URL('../www/', import.meta.url);
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
for (const f of ['index.html', 'privacy.html', 'terms.html']) await copyFile(new URL(f, root), new URL(f, out));
console.log('www/ ready');
