// Hero: a mint stage with rolling hills, drifting light motes and clay objects floating at different depths.
// Pointer moves the camera a little (parallax); scrolling lifts the objects away.
import * as THREE from 'three';
import { C, environment, lights, paperPlane, passport, stamp, ddayCube, toyGlobe, pebble, capsule, loop, isDark, lowPower } from './objects.js';

export default function init(canvas, { reduced, dday }) {
  const low = lowPower();
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !low, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, low ? 1.5 : 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  const scene = new THREE.Scene();
  environment(renderer, scene); lights(scene);
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 120);
  camera.position.set(0, 0.3, 17);
  const fog = new THREE.Fog(C.stage, 15, 34); scene.fog = fog;

  /* hills: a wide displaced plane, mint gradient fading into the fog */
  const hillU = { uTime: { value: 0 }, uA: { value: new THREE.Color(0xbfeee4) }, uB: { value: new THREE.Color(0xf4fbf9) }, uFog: { value: new THREE.Color(C.stage) }, uNear: { value: fog.near }, uFar: { value: fog.far } };
  const hills = new THREE.Mesh(new THREE.PlaneGeometry(90, 40, low ? 90 : 180, low ? 40 : 80), new THREE.ShaderMaterial({
    uniforms: hillU, transparent: true,   // fogs itself (three's fog uniforms would override the dark-mode colour)
    vertexShader: `uniform float uTime; varying float vH; varying vec2 vUv; varying float vFogDepth;
      void main(){ vUv=uv; vec3 p=position;
        float h=sin(p.x*.18+uTime*.25)*.9+sin(p.x*.41-p.y*.22+uTime*.18)*.45+cos(p.y*.35+uTime*.12)*.6;
        p.z+=h; vH=h; vec4 mv=modelViewMatrix*vec4(p,1.); vFogDepth=-mv.z; gl_Position=projectionMatrix*mv; }`,
    fragmentShader: `uniform vec3 uA; uniform vec3 uB; uniform vec3 uFog; uniform float uNear; uniform float uFar; varying float vH; varying vec2 vUv; varying float vFogDepth;
      void main(){ float k=smoothstep(-1.4,1.6,vH); vec3 c=mix(uA,uB,k*.85+vUv.y*.15);
        float glint=smoothstep(.85,1.,sin(vUv.x*60.+vH*3.)*.5+.5)*.05; c+=glint;
        float f=smoothstep(uNear,uFar,vFogDepth); gl_FragColor=vec4(mix(c,uFog,f),1.);
        #include <colorspace_fragment>
      }`,
  }));
  hills.rotation.x = -Math.PI / 2.25; hills.position.set(0, -5.6, -8); scene.add(hills);

  /* light motes */
  const N = low ? 120 : 280, pos = new Float32Array(N * 3), seed = new Float32Array(N);
  for (let i = 0; i < N; i++) { pos[i * 3] = (Math.random() - .5) * 30; pos[i * 3 + 1] = (Math.random() - .5) * 16; pos[i * 3 + 2] = -Math.random() * 18 + 4; seed[i] = Math.random(); }
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); pg.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
  const motesU = { uTime: { value: 0 }, uPx: { value: renderer.getPixelRatio() }, uColor: { value: new THREE.Color(0xffffff) } };
  const motes = new THREE.Points(pg, new THREE.ShaderMaterial({
    uniforms: motesU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `uniform float uTime; uniform float uPx; attribute float seed; varying float vA;
      void main(){ vec3 p=position; p.y=mod(p.y+uTime*(.25+seed*.35)+8.,16.)-8.; p.x+=sin(uTime*.3+seed*20.)*.4;
        vec4 mv=modelViewMatrix*vec4(p,1.); gl_PointSize=(6.+seed*10.)*uPx*(10./-mv.z); vA=.25+.55*sin(uTime*.8+seed*30.)*.5+.3; gl_Position=projectionMatrix*mv; }`,
    fragmentShader: `uniform vec3 uColor; varying float vA; void main(){ float d=length(gl_PointCoord-.5); float a=smoothstep(.5,0.,d); gl_FragColor=vec4(uColor,a*vA*.8); }`,
  }));
  scene.add(motes);

  /* floating objects; x/y are fractions of the visible half-width/height so the headline stays clear */
  const items = [
    { o: paperPlane(), wide: [-.62, .36, 2.2], tall: [-.42, .64, 1.2], s: 1.25, spin: [0, .25, 0] },
    { o: passport(), wide: [.64, .3, -1.2], tall: [.52, .66, -2.5], s: 1.05, spin: [0, .3, 0] },
    { o: stamp(), wide: [-.7, -.44, .4], tall: [-.55, -.6, -.5], s: .95, spin: [0, .35, 0] },
    { o: ddayCube(dday, document.documentElement.lang === 'en' ? 'DEPARTURE' : '출국'), wide: [.6, -.5, 1.6], tall: [.48, -.56, .6], s: 1, spin: [.1, .3, 0], cube: true },
    { o: toyGlobe(!low), wide: [.34, .6, -7], tall: [-.2, .74, -8], s: 1.2, spin: [0, .15, 0] },
    { o: pebble(C.mint, .45), wide: [-.32, -.82, -3], tall: [.1, -.9, -3], s: 1, spin: [0, 0, 0] },
    { o: capsule(C.soft), wide: [.9, .82, -9], tall: [.9, .3, -10], s: 1.2, spin: [.2, .2, .2] },
    { o: pebble(C.navy2, .32), wide: [-.9, .9, -8], tall: [-.9, .2, -9], s: 1, spin: [0, 0, 0] },
    { o: capsule(C.mint), wide: [.05, -.95, 4], tall: [-.05, -.98, 3], s: .7, spin: [.3, .2, .4] },
  ];
  items.forEach((it, i) => { it.phase = i * 1.7; it.o.scale.setScalar(it.s); scene.add(it.o); });

  let w = 1, h = 1, aspect = 1;
  function layout() {
    const r = canvas.parentElement.getBoundingClientRect(); w = r.width; h = r.height; aspect = w / h;
    renderer.setSize(w, h, false); camera.aspect = aspect; camera.updateProjectionMatrix();
    motesU.uPx.value = renderer.getPixelRatio();
    const tall = aspect < .85, shrink = tall ? Math.max(.62, aspect) : Math.min(1, .8 + aspect * .12);
    for (const it of items) {
      const [fx, fy, z] = tall ? it.tall : it.wide;
      const dist = camera.position.z - z, halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * dist, halfW = halfH * aspect;
      it.base = new THREE.Vector3(fx * halfW, fy * halfH, z);
      it.o.scale.setScalar(it.s * shrink);
    }
    if (reduced) run.once();
  }
  function colors() {
    const dark = isDark();
    fog.color.set(dark ? 0x0b1a1c : C.stage); hillU.uFog.value.copy(fog.color);
    hillU.uA.value.set(dark ? 0x0c2422 : 0xbfeee4); hillU.uB.value.set(dark ? 0x10302c : 0xf4fbf9);
    motesU.uColor.value.set(dark ? 0x7ff0dc : 0xffffff);
    if (reduced) run.once();
  }

  let mx = 0, my = 0, cx = 0, cy = 0;
  addEventListener('pointermove', e => { mx = e.clientX / innerWidth - .5; my = e.clientY / innerHeight - .5; }, { passive: true });
  const run = loop(canvas, (t, dt) => {
    const sp = Math.min(1.2, Math.max(0, scrollY / Math.max(1, h)));
    cx += (mx - cx) * Math.min(1, dt * 3); cy += (my - cy) * Math.min(1, dt * 3);
    camera.position.x = cx * 1.6; camera.position.y = .3 - cy * 1.1; camera.lookAt(0, 0, 0);
    hillU.uTime.value = t; motesU.uTime.value = t;
    for (const it of items) {
      if (!it.base) continue;
      const depth = (it.base.z + 10) / 12;                       // nearer objects move more
      it.o.position.set(it.base.x - cx * depth * .8, it.base.y + Math.sin(t * .9 + it.phase) * .22 + sp * (2.5 + depth * 3), it.base.z);
      it.o.rotation.x = Math.sin(t * .5 + it.phase) * .12 + it.spin[0] * t * .4 + sp * .6;
      it.o.rotation.y = it.spin[1] * t + Math.sin(t * .4 + it.phase) * .2 + cx * .4;
      it.o.rotation.z = Math.cos(t * .45 + it.phase) * .08 + it.spin[2] * t * .3;
      if (it.cube) it.o.rotation.y = Math.sin(t * .5) * .35 + cx * .5;   // keep the D-day face readable
      if (it.o.userData.orbit) it.o.userData.orbit.rotation.z = t * .6;
    }
    renderer.render(scene, camera);
  }, reduced);
  new ResizeObserver(layout).observe(canvas.parentElement); layout();
  colors(); matchMedia('(prefers-color-scheme: dark)').addEventListener('change', colors);
  if (reduced) run.once();
}
