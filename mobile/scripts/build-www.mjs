// Copies the web app into www/ for Capacitor. The app loads the API, university data and
// documents from the live site (see SITE in index.html), so only the page files are bundled.
// It also records whether the Firebase config files are in place, so the app only calls
// Firebase on a platform that has them (calling it without them would crash on Android).
import { mkdir, copyFile, readFile, writeFile, rm, access } from 'node:fs/promises';
const root = new URL('../../', import.meta.url), here = new URL('../', import.meta.url), out = new URL('www/', here);
const has = f => access(new URL(f, here)).then(() => true, () => false);
const push = { android: await has('android/app/google-services.json'), ios: await has('ios/App/App/GoogleService-Info.plist') };
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
for (const f of ['privacy.html', 'terms.html']) await copyFile(new URL(f, root), new URL(f, out));
const html = (await readFile(new URL('index.html', root), 'utf8')).replace('<script>', `<script>window.GG_PUSH=${JSON.stringify(push)};</script>\n<script>`);
await writeFile(new URL('index.html', out), html);
console.log('www/ ready · Firebase push:', JSON.stringify(push));
