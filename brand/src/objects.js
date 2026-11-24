// Clay and glass objects built in code (no .glb files): paper plane, passport, visa stamp, D-day cube, toy globe.
// Colours are the app's current tokens: blue #2F6FED / #2459C9, navy #191F28 / #1D2840, soft blue #EEF3FE.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export const C = { blue: 0x2f6fed, primary: 0x2459c9, ink: 0x2459c9, soft: 0xeef3fe, stage: 0xeef3fe, navy: 0x191f28, navy2: 0x1d2840, white: 0xffffff };

export const clay = (color, o = {}) => new THREE.MeshPhysicalMaterial({
  color, roughness: 0.48, metalness: 0, clearcoat: 0.55, clearcoatRoughness: 0.32, sheen: 0.5, sheenRoughness: 0.7, sheenColor: new THREE.Color(0xffffff), ...o,
});
export const glass = (color, rich) => rich
  ? new THREE.MeshPhysicalMaterial({ color, roughness: 0.08, metalness: 0, transmission: 1, thickness: 1.1, ior: 1.35, clearcoat: 1, attenuationColor: new THREE.Color(color), attenuationDistance: 2.4 })
  : new THREE.MeshPhysicalMaterial({ color, roughness: 0.15, transparent: true, opacity: 0.55, clearcoat: 1 });

export function environment(renderer, scene) {
  const pm = new THREE.PMREMGenerator(renderer);
  const env = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = env; pm.dispose();
  return env;
}
export function lights(scene, strength = 1) {
  scene.add(new THREE.HemisphereLight(0xffffff, 0xcadafb, 0.9 * strength));
  const key = new THREE.DirectionalLight(0xffffff, 1.7 * strength); key.position.set(5, 8, 7); scene.add(key);
  const rim = new THREE.DirectionalLight(0xcadafb, 0.9 * strength); rim.position.set(-6, -2, -5); scene.add(rim);
}

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
const FONT = "800 {s}px 'Plus Jakarta Sans','Pretendard Variable',system-ui,sans-serif";

/* paper plane: the app icon's plane, folded into two wings and a keel */
export function paperPlane() {
  const g = new THREE.Group();
  const tri = (pts, depth) => {
    const s = new THREE.Shape(); s.moveTo(...pts[0]); pts.slice(1).forEach(p => s.lineTo(...p)); s.closePath();
    const geo = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 4, curveSegments: 4 });
    geo.translate(0, 0, -depth / 2); return geo;
  };
  const wingMat = clay(C.blue), keelMat = clay(C.primary);
  const wing = tri([[1.7, 0], [-1.3, 1.25], [-0.8, 0]], 0.05);
  const L = new THREE.Mesh(wing, wingMat); L.rotation.x = Math.PI / 2 - 0.32; g.add(L);
  const R = new THREE.Mesh(wing, wingMat); R.rotation.x = -(Math.PI / 2 - 0.32); g.add(R);
  const keel = new THREE.Mesh(tri([[1.55, 0], [-0.95, 0], [-0.65, -0.55]], 0.05), keelMat); g.add(keel);
  g.rotation.set(0.25, -0.5, 0.18);
  const wrap = new THREE.Group(); wrap.add(g); return wrap;
}

/* passport: navy clay booklet with a blue globe emblem */
export function passport(label = 'PASSPORT') {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new RoundedBoxGeometry(1.5, 2.05, 0.26, 5, 0.1), clay(C.navy2, { roughness: 0.6, clearcoat: 0.25, envMapIntensity: 0.18, sheen: 0 }));
  g.add(body);
  const pages = new THREE.Mesh(new RoundedBoxGeometry(1.36, 1.93, 0.2, 3, 0.06), clay(0xf2f4f6)); pages.position.set(0.09, 0, 0); g.add(pages);
  const em = new THREE.Group(); const emMat = clay(C.blue, { emissive: new THREE.Color(C.blue), emissiveIntensity: 0.12 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.045, 12, 48), emMat); em.add(ring);
  const m1 = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.03, 8, 48), emMat); m1.scale.x = 0.45; em.add(m1);
  const eq = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.68, 12), emMat); eq.rotation.z = Math.PI / 2; em.add(eq);
  em.position.set(0, 0.2, 0.15); g.add(em);
  const back = em.clone(); back.position.z = -0.15; g.add(back);   // the emblem shows from either side while it turns
  const tex = canvasTex(512, 128, (x, w, h) => { x.fillStyle = 'rgba(238,243,254,.92)'; x.font = FONT.replace('{s}', 64); x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(label, w / 2, h / 2 + 4); });
  const lbl = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.25), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
  lbl.position.set(0, -0.48, 0.135); g.add(lbl);
  const lbl2 = lbl.clone(); lbl2.rotation.y = Math.PI; lbl2.position.z = -0.135; g.add(lbl2);
  g.rotation.set(-0.15, 0.45, -0.12);
  const wrap = new THREE.Group(); wrap.add(g); return wrap;
}

/* rubber visa stamp: blue knob, navy handle, a face that prints VISA ✓ */
export function stamp() {
  const g = new THREE.Group();
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.42, 32, 24), clay(C.blue)); knob.position.y = 1.05; g.add(knob);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.26, 0.7, 32), clay(C.navy2, { envMapIntensity: 0.2, clearcoat: 0.25, sheen: 0 })); neck.position.y = 0.55; g.add(neck);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.82, 0.86, 0.32, 48), clay(C.navy, { envMapIntensity: 0.18, clearcoat: 0.25, sheen: 0 })); base.position.y = 0.06; g.add(base);
  const face = new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.78, 0.08, 48), clay(C.soft)); face.position.y = -0.14; g.add(face);
  const tex = canvasTex(512, 512, (x, w) => {
    x.strokeStyle = '#2F6FED'; x.lineWidth = 26; x.beginPath(); x.arc(w / 2, w / 2, w / 2 - 40, 0, Math.PI * 2); x.stroke();
    x.lineWidth = 8; x.beginPath(); x.arc(w / 2, w / 2, w / 2 - 78, 0, Math.PI * 2); x.stroke();
    x.fillStyle = '#2459C9'; x.font = FONT.replace('{s}', 120); x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('VISA', w / 2, w / 2 - 30);
    x.strokeStyle = '#2459C9'; x.lineWidth = 26; x.lineCap = 'round'; x.lineJoin = 'round'; x.beginPath(); x.moveTo(w / 2 - 70, w / 2 + 70); x.lineTo(w / 2 - 15, w / 2 + 120); x.lineTo(w / 2 + 80, w / 2 + 40); x.stroke();
  });
  tex.wrapS = THREE.RepeatWrapping; tex.repeat.x = -1; tex.offset.x = 1;   // seen from below, so mirror it to read VISA
  const print = new THREE.Mesh(new THREE.CircleGeometry(0.74, 48), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
  print.rotation.x = Math.PI / 2; print.position.y = -0.185; g.add(print);
  g.rotation.set(0.9, 0.3, -0.5);
  const wrap = new THREE.Group(); wrap.add(g); return wrap;
}

/* D-day cube: white clay with the live countdown on its face */
export function ddayCube(days, word = '출국') {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new RoundedBoxGeometry(1.5, 1.5, 1.5, 6, 0.3), clay(C.white, { roughness: 0.42 })));
  const tex = canvasTex(512, 512, (x, w) => {
    x.fillStyle = '#191F28'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.font = FONT.replace('{s}', 170); x.fillText(`D-${days}`, w / 2, w / 2 - 20);
    x.fillStyle = '#2F6FED'; x.font = FONT.replace('{s}', 64); x.fillText(word, w / 2, w / 2 + 120);
  });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(1.18, 1.18), new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false }));
  face.position.z = 0.752; g.add(face);
  const top = new THREE.Mesh(new THREE.CircleGeometry(0.16, 32), clay(C.blue)); top.rotation.x = -Math.PI / 2; top.position.y = 0.752; g.add(top);
  g.rotation.set(0.32, -0.55, 0.06);
  const wrap = new THREE.Group(); wrap.add(g); return wrap;
}

/* toy globe: soft blue ball with navy meridians and a blue orbit ring */
export function toyGlobe(rich) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), rich ? glass(0xcadafb, true) : clay(C.soft)));
  const line = clay(C.navy2, { roughness: 0.6, envMapIntensity: 0.2, sheen: 0 });
  for (let i = 0; i < 3; i++) { const m = new THREE.Mesh(new THREE.TorusGeometry(1.005, 0.018, 8, 96), line); m.rotation.y = i * Math.PI / 3; g.add(m); }
  for (const y of [-0.5, 0, 0.5]) { const r = Math.sqrt(1 - y * y) + 0.005; const m = new THREE.Mesh(new THREE.TorusGeometry(r, 0.016, 8, 96), line); m.rotation.x = Math.PI / 2; m.position.y = y; g.add(m); }
  const orbit = new THREE.Mesh(new THREE.TorusGeometry(1.45, 0.06, 16, 120), clay(C.blue)); orbit.rotation.set(1.2, 0.3, 0); g.add(orbit);
  const moon = new THREE.Mesh(new THREE.SphereGeometry(0.16, 24, 16), clay(C.primary)); moon.position.set(1.45, 0, 0); orbit.add(moon);
  g.rotation.z = 0.35;
  const wrap = new THREE.Group(); wrap.add(g); wrap.userData.orbit = orbit; return wrap;
}

export const pebble = (color, r = 0.4) => new THREE.Mesh(new THREE.SphereGeometry(r, 32, 24), clay(color));
export const capsule = (color) => { const m = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.7, 8, 24), clay(color)); m.rotation.z = 0.9; return m; };

/* run a render loop only while the canvas is on screen and the tab is visible */
export function loop(canvas, frame, reduced) {
  let on = false, raf = 0, last = performance.now();
  const tick = t => { const dt = Math.min(0.05, (t - last) / 1000); last = t; frame(t / 1000, dt); if (on) raf = requestAnimationFrame(tick); };
  const start = () => { if (on || reduced) return; on = true; last = performance.now(); raf = requestAnimationFrame(tick); };
  const stop = () => { on = false; cancelAnimationFrame(raf); };
  new IntersectionObserver(es => (es[0].isIntersecting && !document.hidden ? start() : stop()), { rootMargin: '100px' }).observe(canvas);
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : canvas.getBoundingClientRect().bottom > 0 && start()));
  frame(0, 0);
  return { start, stop, once: () => frame(performance.now() / 1000, 0) };
}
export const isDark = () => document.documentElement.dataset.theme === 'dark' || (document.documentElement.dataset.theme !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
export const lowPower = () => matchMedia('(max-width: 760px)').matches || (navigator.hardwareConcurrency || 8) <= 4 || matchMedia('(pointer: coarse)').matches;
