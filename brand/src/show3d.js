// Behind the phone mock-up: a few clay objects and a soft mint halo that drift with the pointer and scroll.
import * as THREE from 'three';
import { C, environment, lights, paperPlane, stamp, ddayCube, toyGlobe, passport, pebble, capsule, loop, lowPower } from './objects.js';

export default function init(canvas, { reduced, dday }) {
  const low = lowPower();
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !low, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, low ? 1.25 : 1.6));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  environment(renderer, scene); lights(scene);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 80); camera.position.set(0, 0, 18);

  // a glowing mint disc behind the phone
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, uniforms: { uT: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: 'uniform float uT; varying vec2 vUv; void main(){ float d=length(vUv-.5); float a=smoothstep(.5,.0,d)*(.55+.1*sin(uT*.8)); gl_FragColor=vec4(vec3(.078,.859,.729),a*.55); }',
  }));
  halo.position.z = -6; scene.add(halo);

  const items = [
    { o: paperPlane(), at: [-.78, .55, 2], s: .9 },
    { o: toyGlobe(!low), at: [.8, .62, -2], s: .95 },
    { o: stamp(), at: [-.82, -.48, -1], s: .8 },
    { o: ddayCube(dday, document.documentElement.lang === 'en' ? 'DEPARTURE' : '출국'), at: [.78, -.5, 1.5], s: .8, cube: true },
    { o: passport(), at: [-.45, .95, -6], s: .7 },
    { o: pebble(C.mint, .4), at: [.42, -.95, -4], s: 1 },
    { o: capsule(C.soft), at: [.55, 1.0, -7], s: 1 },
  ];
  items.forEach((it, i) => { it.phase = i * 1.3; it.o.scale.setScalar(it.s); scene.add(it.o); });

  let h = 1;
  function layout() {
    const r = canvas.getBoundingClientRect(), w = r.width; h = r.height;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    const narrow = w < 700;
    for (const it of items) {
      const dist = camera.position.z - it.at[2], halfH = Math.tan(THREE.MathUtils.degToRad(15)) * dist, halfW = halfH * camera.aspect;
      it.base = new THREE.Vector3(it.at[0] * halfW * (narrow ? 1.05 : .78), it.at[1] * halfH * .82, it.at[2]);
      it.o.scale.setScalar(it.s * (narrow ? .7 : 1));
    }
    if (reduced) run.once();
  }
  let mx = 0, my = 0, cx = 0, cy = 0;
  addEventListener('pointermove', e => { mx = e.clientX / innerWidth - .5; my = e.clientY / innerHeight - .5; }, { passive: true });
  const run = loop(canvas, (t, dt) => {
    const r = canvas.getBoundingClientRect(), sp = (r.top + r.height / 2 - innerHeight / 2) / innerHeight;
    cx += (mx - cx) * Math.min(1, dt * 3); cy += (my - cy) * Math.min(1, dt * 3);
    halo.material.uniforms.uT.value = t;
    for (const it of items) {
      if (!it.base) continue;
      const k = (it.base.z + 8) / 10;
      it.o.position.set(it.base.x + cx * k * 1.4, it.base.y - cy * k + sp * k * 3 + Math.sin(t * .8 + it.phase) * .2, it.base.z);
      it.o.rotation.y = Math.sin(t * .4 + it.phase) * .4 + cx * .6 + (it.cube ? 0 : t * .15);
      it.o.rotation.x = Math.cos(t * .35 + it.phase) * .15 - sp * .4;
      if (it.o.userData.orbit) it.o.userData.orbit.rotation.z = t * .6;
    }
    renderer.render(scene, camera);
  }, reduced);
  new ResizeObserver(layout).observe(canvas); layout();
  if (reduced) run.once();
}
