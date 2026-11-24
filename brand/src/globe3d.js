// Deep-navy globe: land as mint dots (from the public 1:110m world map, baked at build time),
// a neon rim, and flight arcs from Seoul to host-university cities that appear in the app.
import * as THREE from 'three';
import { loop, lowPower } from './objects.js';

const SEOUL = [37.57, 126.98];
// host cities the app knows (CITY_KO in the app's index.html)
const CITIES = [
  [47.61, -122.33], [42.36, -71.06], [37.77, -122.42], [40.71, -74.01], [41.88, -87.63], [30.27, -97.74], [43.65, -79.38], [49.28, -123.12],
  [45.5, -73.57], [1.35, 103.82], [35.68, 139.69], [34.69, 135.5], [22.32, 114.17], [39.9, 116.4], [31.23, 121.47], [25.03, 121.57],
  [51.51, -0.13], [55.95, -3.19], [48.86, 2.35], [52.37, 4.9], [52.52, 13.4], [48.14, 11.58], [55.68, 12.57], [59.33, 18.07],
  [60.17, 24.94], [47.38, 8.54], [48.21, 16.37], [40.42, -3.7], [41.39, 2.17], [45.46, 9.19], [-33.87, 151.21], [-27.47, 153.03],
];
const v3 = (lat, lng, r = 1) => {
  const phi = (90 - lat) * Math.PI / 180, th = (lng + 180) * Math.PI / 180;
  return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(th), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(th));
};

export default function init(canvas, { reduced, land }) {
  const low = lowPower();
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, low ? 1.5 : 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50); camera.position.set(0, 0, 5.1);
  const globe = new THREE.Group(); scene.add(globe);
  const px = renderer.getPixelRatio();

  // ocean sphere with a mint fresnel rim
  globe.add(new THREE.Mesh(new THREE.SphereGeometry(1, 64, 48), new THREE.ShaderMaterial({
    vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vN=normalize(normalMatrix*normal); vec4 mv=modelViewMatrix*vec4(position,1.); vV=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }',
    fragmentShader: 'varying vec3 vN; varying vec3 vV; void main(){ float f=pow(1.-max(dot(vN,vV),0.),2.6); vec3 base=mix(vec3(.004,.153,.263),vec3(.043,.227,.361),vN.y*.5+.5); gl_FragColor=vec4(base+vec3(.078,.859,.729)*f*.55,1.); }',
  })));
  // outer glow
  const atm = new THREE.Mesh(new THREE.SphereGeometry(1.22, 64, 48), new THREE.ShaderMaterial({
    side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vN=normalize(normalMatrix*normal); vec4 mv=modelViewMatrix*vec4(position,1.); vV=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }',
    fragmentShader: 'varying vec3 vN; varying vec3 vV; void main(){ float f=pow(max(dot(vN,vV),0.),3.2); gl_FragColor=vec4(.078,.859,.729,f*.9); }',
  }));
  scene.add(atm);

  // land dots
  const step = low ? 2 : 1, pts = [];
  for (let i = 0; i < land.length; i += 2 * step) pts.push(v3(land[i] / 10, land[i + 1] / 10, 1.004));
  const lg = new THREE.BufferGeometry().setFromPoints(pts);
  globe.add(new THREE.Points(lg, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, uniforms: { uPx: { value: px } },
    vertexShader: 'uniform float uPx; varying float vF; void main(){ vec4 mv=modelViewMatrix*vec4(position,1.); vec3 n=normalize(normalMatrix*position); vF=smoothstep(-.15,.45,n.z); gl_PointSize=2.6*uPx; gl_Position=projectionMatrix*mv; }',
    fragmentShader: 'varying float vF; void main(){ float d=length(gl_PointCoord-.5); if(d>.5) discard; gl_FragColor=vec4(.42,.95,.86,(.25+.65*vF)*smoothstep(.5,.2,d)); }',
  })));

  // cities and Seoul
  const cityPos = CITIES.slice(0, low ? 18 : CITIES.length).map(([a, b]) => v3(a, b, 1.01));
  const seoul = v3(...SEOUL, 1.01);
  const dotGeo = new THREE.BufferGeometry().setFromPoints([seoul, ...cityPos]);
  const sizes = new Float32Array(cityPos.length + 1).fill(1); sizes[0] = 2.2; dotGeo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
  const dotU = { uT: { value: 0 }, uPx: { value: px } };
  globe.add(new THREE.Points(dotGeo, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: dotU,
    vertexShader: 'uniform float uPx; uniform float uT; attribute float size; varying float vF; void main(){ vec4 mv=modelViewMatrix*vec4(position,1.); vec3 n=normalize(normalMatrix*position); vF=smoothstep(-.1,.3,n.z); gl_PointSize=(7.+size*5.+sin(uT*2.+position.x*9.)*1.5)*uPx; gl_Position=projectionMatrix*mv; }',
    fragmentShader: 'varying float vF; void main(){ float d=length(gl_PointCoord-.5); float a=smoothstep(.5,.0,d); gl_FragColor=vec4(vec3(.078,.859,.729)+a*a*.6,a*vF); }',
  })));

  // arcs: great-circle paths lifted off the surface, with a bright pulse travelling from Seoul
  const arcU = { uT: { value: 0 } };
  const arcMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: arcU,
    vertexShader: 'attribute float off; varying vec2 vUv; varying float vOff; void main(){ vUv=uv; vOff=off; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: `uniform float uT; varying vec2 vUv; varying float vOff;
      void main(){ float head=fract(uT*.18+vOff); float x=vUv.x; float trail=smoothstep(head-.35,head,x)*step(x,head);
        float a=.16+trail*.95; gl_FragColor=vec4(vec3(.078,.859,.729)+trail*.35,a); }`,
  });
  const a0 = seoul.clone().normalize();
  cityPos.forEach((c, i) => {
    const b = c.clone().normalize(), ang = a0.angleTo(b), lift = .05 + ang * .1, path = [];
    for (let k = 0; k <= 48; k++) { const t = k / 48; const p = a0.clone().lerp(b, t).normalize(); const q = new THREE.Vector3().copy(a0).multiplyScalar(Math.sin((1 - t) * ang)).add(b.clone().multiplyScalar(Math.sin(t * ang))).divideScalar(Math.sin(ang) || 1); path.push((ang > .01 ? q : p).multiplyScalar(1.01 + Math.sin(Math.PI * t) * lift)); }
    const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(path), 64, low ? .005 : .0038, 5, false);
    geo.setAttribute('off', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count).fill((i * .137) % 1), 1));
    globe.add(new THREE.Mesh(geo, arcMat));
  });

  // turn the globe so Seoul faces the viewer, tilted toward the northern hemisphere
  const sv = v3(...SEOUL), baseY = -Math.atan2(sv.x, sv.z) + .35;   // Seoul a little left of centre so the arcs sweep across
  globe.rotation.set(.42, baseY, 0);

  let mx = 0, my = 0, cx = 0, cy = 0;
  addEventListener('pointermove', e => { mx = e.clientX / innerWidth - .5; my = e.clientY / innerHeight - .5; }, { passive: true });
  function layout() { const r = canvas.getBoundingClientRect(); renderer.setSize(r.width, r.height, false); camera.aspect = r.width / r.height; camera.updateProjectionMatrix(); if (reduced) run.once(); }
  const run = loop(canvas, (t, dt) => {
    cx += (mx - cx) * Math.min(1, dt * 2.5); cy += (my - cy) * Math.min(1, dt * 2.5);
    globe.rotation.y = baseY + Math.sin(t * .12) * .9 + cx * .5;
    globe.rotation.x = .42 + cy * .25;
    arcU.uT.value = t; dotU.uT.value = t;
    renderer.render(scene, camera);
  }, reduced);
  new ResizeObserver(layout).observe(canvas); layout();
  if (reduced) { arcU.uT.value = 2.5; run.once(); }
}
