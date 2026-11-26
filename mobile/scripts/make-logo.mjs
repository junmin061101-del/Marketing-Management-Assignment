// Makes every logo file from the designer's logo (a rounded tile on a transparent background):
//   node scripts/make-logo.mjs <logo.png>        (run in mobile/, then `npm run assets` for the iOS/Android sizes)
// Outputs
//   ../logo.png, ../icon-180.png, ../favicon-32.png   web app: splash/top bar logo, home-screen icon, tab icon
//   ../brand/public/logo.png, ../brand/public/apple-touch-icon.png   brand site
//   assets/icon-only.png         full square icon (iOS rounds the corners itself, so no transparency)
//   assets/icon-foreground.png   Android adaptive icon front layer (logo kept inside the 66% safe zone)
//   assets/icon-background.png   Android adaptive icon back layer (the logo's own gradient)
//   assets/splash.png, assets/splash-dark.png   launch screens
//   release/screens/play-icon-512.png             Google Play listing icon
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';

const src = process.argv[2];
if (!src) { console.error('usage: node scripts/make-logo.mjs <logo.png>'); process.exit(1); }
const here = p => new URL('../' + p, import.meta.url).pathname, root = p => new URL('../../' + p, import.meta.url).pathname;

// 1. find the tile: the box of clearly opaque, coloured pixels (drops faint specks around it)
const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height, px = (x, y) => data.subarray((y * W + x) * 4, (y * W + x) * 4 + 4);
let x0 = W, y0 = H, x1 = 0, y1 = 0;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const [r, g, b, a] = px(x, y);
  if (a > 200 && Math.max(r, g, b) - Math.min(r, g, b) > 60) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
}
const side = Math.max(x1 - x0, y1 - y0) + 1, cx = (x0 + x1) >> 1, cy = (y0 + y1) >> 1;
const left = Math.max(0, cx - (side >> 1)), top = Math.max(0, cy - (side >> 1));
const tile = await sharp(src).extract({ left, top, width: Math.min(side, W - left), height: Math.min(side, H - top) })
  .resize(1024, 1024, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
// clean edge: anything nearly transparent becomes fully transparent
const t = await sharp(tile).raw().toBuffer({ resolveWithObject: true });
for (let i = 3; i < t.data.length; i += 4) if (t.data[i] < 40) t.data[i] = 0;
const clean = await sharp(t.data, { raw: t.info }).png().toBuffer();

// 2. the tile's own gradient, sampled just inside its four corners, as a full square (fills the rounded corners)
const sample = async (x, y) => { const d = await sharp(clean).extract({ left: x, top: y, width: 8, height: 8 }).resize(1, 1).removeAlpha().raw().toBuffer(); return [d[0], d[1], d[2]]; };
const [tl, tr, bl, br] = [await sample(150, 150), await sample(866, 150), await sample(150, 866), await sample(866, 866)];
// k stretches the gradient like the tile drawn at 1/k of the square, so the tile's edge melts into it
const gradient = k => { const g = Buffer.alloc(1024 * 1024 * 4);
  for (let y = 0; y < 1024; y++) for (let x = 0; x < 1024; x++) {
    const u = .5 + (x / 1023 - .5) * k, v = .5 + (y / 1023 - .5) * k, i = (y * 1024 + x) * 4;
    for (let c = 0; c < 3; c++) g[i + c] = Math.max(0, Math.min(255, Math.round((tl[c] * (1 - u) + tr[c] * u) * (1 - v) + (bl[c] * (1 - u) + br[c] * u) * v)));
    g[i + 3] = 255;
  }
  return sharp(g, { raw: { width: 1024, height: 1024, channels: 4 } }).png().toBuffer(); };
// the tile with its rim faded out, so on the adaptive icon it melts into the background instead of showing an edge
const fade = await sharp(Buffer.from('<svg width="1024" height="1024"><rect x="34" y="34" width="956" height="956" rx="200" fill="#fff"/></svg>')).blur(18).png().toBuffer();
const soft = await sharp(clean).composite([{ input: fade, blend: 'dest-in' }]).png().toBuffer();
const FG = 620;  // adaptive icon artwork size (Android shows roughly the middle 61%)
const bg = await gradient(1024 / 1120), bgAdaptive = await gradient(1024 / FG);
const full = await sharp(bg).composite([{ input: await sharp(clean).resize(1120, 1120).extract({ left: 48, top: 48, width: 1024, height: 1024 }).toBuffer() }]).flatten().png().toBuffer();

await mkdir(here('release/screens'), { recursive: true });
await sharp(clean).resize(256, 256).png({ palette: true, quality: 90, compressionLevel: 9 }).toFile(root('logo.png'));  // 2× of the 120 px splash logo
await sharp(clean).resize(512, 512).png({ palette: true, quality: 90, compressionLevel: 9 }).toFile(root('brand/public/logo.png'));
await sharp(full).resize(180, 180).toFile(root('icon-180.png'));
await sharp(full).resize(180, 180).toFile(root('brand/public/apple-touch-icon.png'));
await sharp(clean).resize(32, 32).toFile(root('favicon-32.png'));
await sharp(full).toFile(here('assets/icon-only.png'));
await sharp(bgAdaptive).toFile(here('assets/icon-background.png'));
// adaptive icon: Android masks the outer third, so the tile's artwork goes in the middle 60%
await sharp({ create: { width: 1024, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite([{ input: await sharp(soft).resize(FG, FG).toBuffer(), gravity: 'center' }]).png().toFile(here('assets/icon-foreground.png'));
for (const [name, color] of [['splash.png', '#F2F4F6'], ['splash-dark.png', '#17181C']])
  await sharp({ create: { width: 2732, height: 2732, channels: 4, background: color } })
    .composite([{ input: await sharp(clean).resize(560, 560).toBuffer(), gravity: 'center' }]).png().toFile(here('assets/' + name));
await sharp(full).resize(512, 512).toFile(here('release/screens/play-icon-512.png'));
console.log('logo files written · tile box', { x0, y0, x1, y1 }, 'gradient corners', { tl, tr, bl, br });
