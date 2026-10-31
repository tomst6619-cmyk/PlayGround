import * as THREE from '../vendor/three.module.js';
import { clamp, lerp, rand } from './config.js';

const $ = (id) => document.getElementById(id);

/* ------------------------------------------------------------------ *
 *  GYM SURGE — a first-person school sports size-shift trial.
 *  Boys shrink under the surge and burn out fast. Girls grow and
 *  hold the court longer. Collect orbs, hold the surge, beat the clock.
 * ------------------------------------------------------------------ */

const canvas = $('scene');
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance',
});
const gl = renderer.getContext();
const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
const gpuName = debugInfo ? String(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)) : '';
const SOFTWARE_RENDERER = /swiftshader|llvmpipe|software|mesa offscreen/i.test(gpuName) || navigator.webdriver;
const IS_MOBILE = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
  (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
const LOW_GFX = IS_MOBILE || SOFTWARE_RENDERER;
const PIXEL_SCALE = SOFTWARE_RENDERER ? 0.85 : (IS_MOBILE ? 1.15 : Math.min(window.devicePixelRatio || 1, 1.8));

renderer.setPixelRatio(PIXEL_SCALE);
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.shadowMap.enabled = !LOW_GFX;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x080d16);
scene.fog = new THREE.FogExp2(0x080d16, 0.011);

const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.05, 120);
camera.rotation.order = 'YXZ';
scene.add(camera);

const clock = { t: 0 };
let last = performance.now();

/* ------------------------------------------------------------------ *
 *  procedural textures
 * ------------------------------------------------------------------ */

function makeWoodTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#a97a45';
  g.fillRect(0, 0, 512, 512);
  for (let row = 0; row < 8; row++) {
    const y = row * 64;
    const base = 132 + Math.random() * 30;
    g.fillStyle = `rgb(${Math.round(base + 48)}, ${Math.round(base - 12)}, ${Math.round(base - 66)})`;
    g.fillRect(0, y, 512, 62);
    for (let i = 0; i < 26; i++) {
      const gy = y + 4 + Math.random() * 54;
      g.strokeStyle = `rgba(${Math.random() < .5 ? '70,40,16' : '230,190,130'}, ${rand(.04, .16)})`;
      g.lineWidth = rand(.5, 1.6);
      g.beginPath();
      g.moveTo(0, gy);
      for (let x = 0; x <= 512; x += 32) g.lineTo(x, gy + Math.sin(x * .05 + i) * rand(.5, 2.4));
      g.stroke();
    }
    g.fillStyle = 'rgba(54, 31, 12, .42)';
    g.fillRect(0, y + 61, 512, 3);
  }
  for (let i = 0; i < 16; i++) {
    g.fillStyle = `rgba(70, 40, 16, ${rand(.05, .16)})`;
    g.beginPath();
    g.ellipse(rand(0, 512), rand(0, 512), rand(4, 18), rand(2, 7), rand(0, Math.PI), 0, Math.PI * 2);
    g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 6);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return tex;
}

function makeGlowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(.2, 'rgba(255,244,214,.9)');
  grd.addColorStop(.46, 'rgba(255,196,110,.34)');
  grd.addColorStop(.76, 'rgba(255,150,60,.07)');
  grd.addColorStop(1, 'rgba(255,140,50,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeBannerTexture(title, sub, bg, fg, accent) {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, 1024, 512);
  const grd = g.createLinearGradient(0, 0, 0, 512);
  grd.addColorStop(0, 'rgba(255,255,255,.07)');
  grd.addColorStop(.5, 'rgba(255,255,255,0)');
  grd.addColorStop(1, 'rgba(0,0,0,.3)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 1024, 512);
  g.strokeStyle = accent;
  g.lineWidth = 10;
  g.globalAlpha = .55;
  g.strokeRect(24, 24, 976, 464);
  g.globalAlpha = 1;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = fg;
  g.shadowColor = accent;
  g.shadowBlur = 34;
  g.font = '900 150px "Arial Black", Arial, sans-serif';
  g.fillText(title, 512, 232);
  g.shadowBlur = 0;
  g.fillStyle = accent;
  g.font = '700 44px "Arial Narrow", Arial, sans-serif';
  g.letterSpacing = '10px';
  g.fillText(sub, 512, 380);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
  return mat;
}

function makeBoardTexture() {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#05080d';
  g.fillRect(0, 0, 1024, 256);
  g.strokeStyle = 'rgba(255,170,90,.4)';
  g.lineWidth = 6;
  g.strokeRect(12, 12, 1000, 232);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = '#ffb15e';
  g.shadowColor = '#ff7a1a';
  g.shadowBlur = 24;
  g.font = '900 92px "Courier New", monospace';
  g.fillText('ST. MERCY GYM', 512, 100);
  g.fillStyle = '#9fc3ff';
  g.font = '700 42px "Courier New", monospace';
  g.fillText('SIZE-SHIFT TRIAL  //  LIVE', 512, 180);
  g.shadowBlur = 0;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
}

const woodTex = makeWoodTexture();
const glowTex = makeGlowTexture();

/* ------------------------------------------------------------------ *
 *  materials
 * ------------------------------------------------------------------ */

const mats = {
  wood: new THREE.MeshStandardMaterial({ map: woodTex, roughness: .78, metalness: .02 }),
  wall: new THREE.MeshStandardMaterial({ color: 0xcfc9ba, roughness: .96 }),
  panel: new THREE.MeshStandardMaterial({ color: 0x1b2a41, roughness: .82, metalness: .08 }),
  panelLight: new THREE.MeshStandardMaterial({ color: 0x263c5c, roughness: .8 }),
  metal: new THREE.MeshStandardMaterial({ color: 0x59616d, roughness: .42, metalness: .7 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x0a0f17, roughness: .9 }),
  white: new THREE.MeshStandardMaterial({ color: 0xece6d7, roughness: .76 }),
  line: new THREE.MeshBasicMaterial({ color: 0xece5d3 }),
  seatBlue: new THREE.MeshStandardMaterial({ color: 0x244a86, roughness: .82 }),
  seatOrange: new THREE.MeshStandardMaterial({ color: 0x8a4523, roughness: .82 }),
  courtBlue: new THREE.MeshStandardMaterial({ color: 0x2b5aa8, roughness: .7, emissive: 0x08152c, emissiveIntensity: .5 }),
  courtOrange: new THREE.MeshStandardMaterial({ color: 0xc25c24, roughness: .7, emissive: 0x2a0d02, emissiveIntensity: .5 }),
  hoop: new THREE.MeshStandardMaterial({ color: 0xd9642a, roughness: .55, metalness: .3 }),
  ball: new THREE.MeshStandardMaterial({ color: 0xb45522, roughness: .85 }),
  cone: new THREE.MeshStandardMaterial({ color: 0xd76525, roughness: .8 }),
  black: new THREE.MeshStandardMaterial({ color: 0x05070b, roughness: .95 }),
};

const skinTones = [0xd8a77c, 0xb97e52, 0xe3b892, 0x8d5a3a, 0xc48d62, 0xf0c7a3];
const hairTones = [0x2b1b12, 0x16110d, 0x5b3a20, 0x8a6a48, 0x1e1e22, 0x3d2416];
const teamColor = (side) => (side === 'boy' ? 0x3f7bd9 : 0xe2703a);
const teamGlow = (side) => (side === 'boy' ? 0x6ea8ff : 0xffa45e);

/* ------------------------------------------------------------------ *
 *  gym world
 * ------------------------------------------------------------------ */

const world = new THREE.Group();
scene.add(world);

function box(w, h, d, mat, x, y, z, parent = world) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

function addCourtLine(w, d, x, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.014, d), mats.line);
  m.position.set(x, 0.018, z);
  world.add(m);
}

function addRingBand(rIn, rOut, z, start, length) {
  const geo = new THREE.RingGeometry(rIn, rOut, 64, 1, start, length);
  const m = new THREE.Mesh(geo, mats.line);
  m.rotation.x = -Math.PI / 2;
  m.position.set(0, 0.019, z);
  world.add(m);
}

function buildGym() {
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(24.4, 34.4), mats.wood);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = !LOW_GFX;
  world.add(floor);

  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(24.4, 34.4), mats.dark);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = 7.4;
  world.add(ceiling);

  // walls
  box(0.3, 7.4, 34.4, mats.wall, -12.2, 3.7, 0);
  box(0.3, 7.4, 34.4, mats.wall, 12.2, 3.7, 0);
  box(24.4, 7.4, 0.3, mats.wall, 0, 3.7, -17.2);
  box(24.4, 7.4, 0.3, mats.wall, 0, 3.7, 17.2);

  // wainscot + rail
  for (const s of [-1, 1]) {
    box(0.1, 2.3, 33.6, mats.panel, s * 12.02, 1.15, 0);
    box(0.16, 0.09, 33.6, mats.metal, s * 11.96, 2.34, 0);
  }
  box(23.8, 2.3, 0.1, mats.panel, 0, 1.15, -17.02);
  box(23.8, 2.3, 0.1, mats.panel, 0, 1.15, 17.02);
  box(23.8, 0.09, 0.16, mats.metal, 0, 2.34, -16.96);
  box(23.8, 0.09, 0.16, mats.metal, 0, 2.34, 16.96);

  // window banks with evening light
  const windowMat = new THREE.MeshBasicMaterial({ color: 0x93b4e8, toneMapped: false });
  const windowGlowMat = new THREE.MeshBasicMaterial({ color: 0x45618c, toneMapped: false });
  for (const s of [-1, 1]) {
    for (const z of [-11, -4, 3, 10]) {
      const frame = box(0.08, 2.2, 2.7, mats.panelLight, s * 11.99, 4.85, z);
      frame.rotation.y = 0;
      const glass = box(0.04, 1.85, 2.35, windowGlowMat, s * 11.93, 4.85, z);
      glass.material = windowMat;
      // mullions
      box(0.06, 1.85, 0.07, mats.metal, s * 11.9, 4.85, z);
      box(0.06, 0.07, 2.35, mats.metal, s * 11.9, 4.85, z);
    }
  }

  // ceiling trusses
  for (const z of [-13, -6.5, 0, 6.5, 13]) {
    box(24.4, 0.16, 0.16, mats.metal, 0, 6.95, z);
    box(0.14, 0.5, 0.14, mats.dark, -8, 6.65, z);
    box(0.14, 0.5, 0.14, mats.dark, 8, 6.65, z);
  }

  // hanging lamps
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xfff0cf, toneMapped: false });
  for (const x of [-4.4, 4.4]) {
    for (const z of [-9, -3, 3, 9]) {
      const rod = box(0.04, 0.75, 0.04, mats.metal, x, 6.5, z);
      rod.castShadow = false;
      box(0.78, 0.16, 0.78, mats.metal, x, 6.15, z);
      const disc = new THREE.Mesh(new THREE.CircleGeometry(0.34, 20), lampMat);
      disc.rotation.x = Math.PI / 2;
      disc.position.set(x, 6.05, z);
      world.add(disc);
    }
  }

  // court lines
  addCourtLine(17, 0.09, 0, 13);
  addCourtLine(17, 0.09, 0, -13);
  addCourtLine(0.09, 26, 8.5, 0);
  addCourtLine(0.09, 26, -8.5, 0);
  addCourtLine(17, 0.09, 0, 0);
  addRingBand(1.68, 1.78, 0, 0, Math.PI * 2);
  for (const zEnd of [-13, 13]) {
    const sign = Math.sign(zEnd);
    addCourtLine(4.8, 0.09, 0, zEnd - sign * 5.7);
    addCourtLine(0.09, 5.7, 2.4, zEnd - sign * 2.85);
    addCourtLine(0.09, 5.7, -2.4, zEnd - sign * 2.85);
    addRingBand(1.72, 1.81, zEnd - sign * 5.7, sign > 0 ? 0 : Math.PI, Math.PI);
    // three point arc
    addRingBand(6.08, 6.17, zEnd, sign > 0 ? 0 : Math.PI, Math.PI);
  }

  // center glow
  const glowPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(7, 7),
    new THREE.MeshBasicMaterial({
      map: glowTex, color: 0xffa24d, transparent: true, opacity: .11,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    }),
  );
  glowPlane.rotation.x = -Math.PI / 2;
  glowPlane.position.y = 0.026;
  world.add(glowPlane);
  world.userData.centerGlow = glowPlane;

  // bleachers
  for (const s of [-1, 1]) {
    for (let row = 0; row < 4; row++) {
      const x = s * (9.1 + row * 0.78);
      const y = 0.18 + row * 0.37;
      box(1.18, 0.37, 13.2, row % 2 ? mats.seatOrange : mats.seatBlue, x, y, 0);
      box(0.08, 0.62, 13.2, mats.metal, x - s * 0.58, y - 0.18, 0);
    }
    box(0.14, 2.9, 13.4, mats.panel, s * 12.0, 1.55, 0);
    box(0.1, 0.1, 13.4, mats.metal, s * 11.92, 3.0, 0);
  }

  // seated spectators
  for (let i = 0; i < 8; i++) {
    const side = i % 2 ? 1 : -1;
    const row = 1 + (i % 2);
    const x = side * (9.1 + row * 0.78);
    const y = 0.18 + row * 0.37;
    const z = -5.2 + (i * 1.55) % 10.4;
    const shirt = new THREE.MeshStandardMaterial({
      color: side > 0 ? 0xb35a2a : 0x2b5294, roughness: .9,
    });
    box(0.34, 0.5, 0.24, shirt, x, y + 0.52, z);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), new THREE.MeshStandardMaterial({ color: skinTones[i % skinTones.length], roughness: .9 }));
    head.position.set(x, y + 0.92, z);
    world.add(head);
  }

  // hoops
  for (const sign of [-1, 1]) {
    const zPole = sign * 16.1;
    const zBoard = sign * 13.65;
    box(0.17, 3.5, 0.17, mats.metal, 0, 1.75, zPole);
    box(0.5, 0.14, 2.9, mats.metal, 0, 3.48, zPole - sign * 1.35);
    box(1.85, 1.05, 0.07, mats.white, 0, 3.3, zBoard);
    box(1.05, 0.52, 0.02, mats.courtOrange, 0, 3.08, zBoard - sign * 0.045);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.23, 0.022, 8, 24), mats.hoop);
    rim.rotation.x = Math.PI / 2;
    rim.position.set(0, 3.02, zBoard - sign * 0.3);
    world.add(rim);
    const net = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.13, 0.36, 10, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xece6d7, wireframe: true, transparent: true, opacity: .38 }),
    );
    net.position.set(0, 2.82, zBoard - sign * 0.3);
    world.add(net);
  }

  // banners
  const bannerBoys = makeBannerTexture('BOYS', 'SHRINK TEAM', '#0d1c36', '#dbe8ff', '#4d8dff');
  const bannerGirls = makeBannerTexture('GIRLS', 'GROW TEAM', '#2a1207', '#ffe4c8', '#ff8a3d');
  const bannerGym = makeBannerTexture('ST. MERCY', 'SPORTS HALL', '#0b1424', '#e8f0ff', '#6b9bff');
  const bannerSurge = makeBannerTexture('GYM SURGE', 'HOLD THE LINE', '#241005', '#ffe6cf', '#ff8a3d');

  const bBoys = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 2.2), bannerBoys);
  bBoys.position.set(-12.0, 5.0, 0);
  bBoys.rotation.y = Math.PI / 2;
  world.add(bBoys);

  const bGirls = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 2.2), bannerGirls);
  bGirls.position.set(12.0, 5.0, 0);
  bGirls.rotation.y = -Math.PI / 2;
  world.add(bGirls);

  const bGym = new THREE.Mesh(new THREE.PlaneGeometry(6.6, 2.2), bannerGym);
  bGym.position.set(0, 4.85, 17.02);
  bGym.rotation.y = Math.PI;
  world.add(bGym);

  const bSurge = new THREE.Mesh(new THREE.PlaneGeometry(6.6, 2.2), bannerSurge);
  bSurge.position.set(0, 4.85, -17.02);
  world.add(bSurge);

  const board = new THREE.Mesh(new THREE.PlaneGeometry(7.4, 1.85), makeBoardTexture());
  board.position.set(0, 6.5, -17.01);
  world.add(board);

  // props
  for (const [x, z] of [[-6.8, -10.5], [6.8, 10.5], [7.4, -4.2]]) {
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), mats.ball);
    ball.position.set(x, 0.14, z);
    ball.castShadow = !LOW_GFX;
    world.add(ball);
  }
  for (const [x, z] of [[-7.6, 7.4], [7.6, -7.4], [-7.4, -3.2], [7.2, 3.4]]) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.5, 10), mats.cone);
    cone.position.set(x, 0.25, z);
    cone.castShadow = !LOW_GFX;
    world.add(cone);
  }
  // benches
  for (const s of [-1, 1]) {
    box(0.5, 0.12, 2.6, mats.white, s * 8.0, 0.48, -8.6);
    box(0.08, 0.42, 0.08, mats.metal, s * 8.0, 0.24, -9.7);
    box(0.08, 0.42, 0.08, mats.metal, s * 8.0, 0.24, -7.5);
  }

  // ceiling light pools
  const hemi = new THREE.HemisphereLight(0xcfe0ff, 0x2a1f16, 1.05);
  scene.add(hemi);
  const ambient = new THREE.AmbientLight(0xffffff, 0.11);
  scene.add(ambient);
  const sun = new THREE.DirectionalLight(0xffe5c2, 1.25);
  sun.position.set(9, 14, 8);
  sun.castShadow = !LOW_GFX;
  if (!LOW_GFX) {
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -18;
    sun.shadow.camera.right = 18;
    sun.shadow.camera.top = 20;
    sun.shadow.camera.bottom = -20;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 40;
    sun.shadow.bias = -0.0012;
  }
  scene.add(sun);
  for (const z of [-8, 0, 8]) {
    const lamp = new THREE.PointLight(0xffefd0, 52, 22, 2);
    lamp.position.set(0, 5.9, z);
    scene.add(lamp);
  }
  scene.add(new THREE.PointLight(0x7da2ff, 24, 24, 2).translateX(-9).translateY(6));
  scene.add(new THREE.PointLight(0xff9d57, 18, 24, 2).translateX(9).translateY(6));
}

buildGym();

/* ------------------------------------------------------------------ *
 *  energy orbs
 * ------------------------------------------------------------------ */

const orbRoot = new THREE.Group();
scene.add(orbRoot);
const orbCoreMat = new THREE.MeshBasicMaterial({ color: 0xffd36a, toneMapped: false });
const orbs = [];

function createOrb(i) {
  const group = new THREE.Group();
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), orbCoreMat);
  group.add(core);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex, color: 0xffb14f, transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false, opacity: .75, toneMapped: false,
  }));
  glow.scale.set(1.15, 1.15, 1);
  group.add(glow);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.25, 0.012, 6, 26),
    new THREE.MeshBasicMaterial({ color: 0xffc16b, transparent: true, opacity: .4, toneMapped: false }),
  );
  ring.rotation.x = Math.PI / 2;
  group.add(ring);
  group.userData = {
    active: true, respawn: 0, phase: rand(0, Math.PI * 2),
    baseY: 1.02, ring, core, glow,
  };
  orbRoot.add(group);
  orbs.push(group);
  placeOrb(group, i);
  return group;
}

function placeOrb(group, avoid = true) {
  let x = 0;
  let z = 0;
  for (let tries = 0; tries < 12; tries++) {
    x = rand(-7.5, 7.5);
    z = rand(-12.1, 12.1);
    const nearPlayer = state && Math.hypot(x - state.pos.x, z - state.pos.z) < 2.2;
    if (!avoid || !nearPlayer) break;
  }
  group.position.set(x, group.userData.baseY, z);
}

function resetOrbs() {
  for (const orb of orbs) {
    orb.userData.active = true;
    orb.userData.respawn = 0;
    orb.visible = true;
    placeOrb(orb);
  }
}

function updateOrbs(dt) {
  const t = clock.t;
  for (const orb of orbs) {
    const d = orb.userData;
    if (!d.active) {
      d.respawn -= dt;
      if (d.respawn <= 0) {
        d.active = true;
        orb.visible = true;
        placeOrb(orb);
      }
      continue;
    }
    const bob = Math.sin(t * 2.2 + d.phase) * 0.14;
    orb.position.y = d.baseY + bob;
    d.ring.rotation.z += dt * 1.7;
    d.ring.rotation.x = Math.PI / 2 + Math.sin(t * 1.4 + d.phase) * 0.22;
    const pulse = 1 + Math.sin(t * 3.4 + d.phase) * 0.1;
    d.glow.scale.set(1.15 * pulse, 1.15 * pulse, 1);
    d.core.scale.setScalar(0.9 + pulse * 0.12);

    if (state.mode === 'playing' && !state.caught) {
      const dist = Math.hypot(orb.position.x - state.pos.x, orb.position.z - state.pos.z);
      if (dist < 1.15) collectOrb(orb);
    }
  }
}

function collectOrb(orb) {
  const d = orb.userData;
  if (!d.active) return;
  d.active = false;
  d.respawn = rand(1.6, 2.8);
  orb.visible = false;
  state.charge = clamp(state.charge + 27, 0, 100);
  state.orbs++;
  audio.chime();
  showHint('CHARGE +27', 0.7);
  // little burst ring on the floor
  const burst = new THREE.Mesh(
    new THREE.RingGeometry(0.2, 0.28, 24),
    new THREE.MeshBasicMaterial({ color: 0xffc16b, transparent: true, opacity: .8, side: THREE.DoubleSide, toneMapped: false }),
  );
  burst.rotation.x = -Math.PI / 2;
  burst.position.set(orb.position.x, 0.06, orb.position.z);
  scene.add(burst);
  setTimeout(() => {
    burst.geometry.dispose();
    burst.material.dispose();
    scene.remove(burst);
  }, 450);
}

/* ------------------------------------------------------------------ *
 *  athletes (background NPCs)
 * ------------------------------------------------------------------ */

const npcs = [];
const npcRoot = new THREE.Group();
scene.add(npcRoot);

function makeCharacter(side, index) {
  const group = new THREE.Group();
  const color = teamColor(side);
  const jersey = new THREE.MeshStandardMaterial({
    color, roughness: .78, metalness: .03, emissive: color, emissiveIntensity: 0,
  });
  const shorts = new THREE.MeshStandardMaterial({ color: side === 'boy' ? 0x121a28 : 0x24151a, roughness: .9 });
  const skinMat = new THREE.MeshStandardMaterial({ color: skinTones[index % skinTones.length], roughness: .86 });
  const hairMat = new THREE.MeshStandardMaterial({ color: hairTones[index % hairTones.length], roughness: .96 });
  const shoeMat = new THREE.MeshStandardMaterial({ color: 0xece9df, roughness: .7 });

  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.62, 10), jersey);
  torso.position.y = 1.16;
  torso.castShadow = !LOW_GFX;
  group.add(torso);

  const hips = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.19, 0.24, 10), shorts);
  hips.position.y = 0.79;
  group.add(hips);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.06, 0.12, 8), skinMat);
  neck.position.y = 1.5;
  group.add(neck);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.155, 14, 12), skinMat);
  head.position.y = 1.66;
  head.scale.set(0.94, 1.02, 0.94);
  head.castShadow = !LOW_GFX;
  group.add(head);

  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.162, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), hairMat);
  hair.position.y = 1.68;
  hair.scale.set(1, 0.86, 1);
  group.add(hair);

  if (side === 'girl') {
    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.035, 0.42, 7), hairMat);
    tail.position.set(0, 1.52, -0.16);
    tail.rotation.x = 0.45;
    group.add(tail);
  } else {
    const fringe = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.045, 0.1), hairMat);
    fringe.position.set(0, 1.77, 0.1);
    group.add(fringe);
  }

  // chest stripe
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.035, 0.02), mats.white);
  stripe.position.set(0, 1.22, 0.205);
  group.add(stripe);

  const legL = new THREE.Group();
  const legR = new THREE.Group();
  for (const [leg, x] of [[legL, -0.105], [legR, 0.105]]) {
    leg.position.set(x, 0.79, 0);
    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.064, 0.4, 8), skinMat);
    thigh.position.y = -0.2;
    thigh.castShadow = !LOW_GFX;
    const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.05, 0.36, 8), skinMat);
    shin.position.y = -0.56;
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.115, 0.09, 0.21), shoeMat);
    shoe.position.set(0, -0.77, 0.04);
    leg.add(thigh, shin, shoe);
    group.add(leg);
  }

  const armL = new THREE.Group();
  const armR = new THREE.Group();
  for (const [arm, x] of [[armL, -0.255], [armR, 0.255]]) {
    arm.position.set(x, 1.38, 0);
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.06, 0.24, 8), jersey);
    sleeve.position.y = -0.1;
    const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.045, 0.3, 8), skinMat);
    forearm.position.y = -0.36;
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.056, 8, 6), skinMat);
    hand.position.y = -0.53;
    arm.add(sleeve, forearm, hand);
    group.add(arm);
  }

  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex, color: teamGlow(side), transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0, toneMapped: false,
  }));
  glow.position.y = 1.15;
  glow.scale.set(1.7, 2.0, 1);
  group.add(glow);

  const flash = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex, color: 0xfff3d2, transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0, toneMapped: false,
  }));
  flash.position.y = 1.1;
  flash.scale.set(2.0, 2.4, 1);
  group.add(flash);

  npcRoot.add(group);

  const baseScale = side === 'boy' ? rand(.95, 1.02) : rand(1.06, 1.13);
  const c = {
    side, group, jersey, glow, flash, legL, legR, armL, armR,
    baseScale, size: 1, intensity: 0, charge: 100, surging: false,
    cooldown: 0, rest: rand(.2, 2.4), flashT: 0,
    phase: rand(0, Math.PI * 2),
    rx: rand(3.1, 6.2), rz: rand(2.8, 5.6),
    speed: rand(.28, .55) * (index % 2 ? 1 : -1),
    offset: rand(0, Math.PI * 2),
    drain: side === 'boy' ? 25 : 14,
  };
  group.scale.setScalar(baseScale);
  npcs.push(c);
  return c;
}

function resetNPCs() {
  for (const c of npcs) {
    c.charge = 100;
    c.surging = false;
    c.cooldown = 0;
    c.rest = rand(.4, 2.6);
    c.intensity = 0;
    c.size = 1;
    c.flashT = 0;
    c.group.scale.setScalar(c.baseScale);
  }
}

function updateNPCs(dt) {
  const t = clock.t;
  for (const c of npcs) {
    if (state.mode === 'paused') continue;
    if (c.cooldown > 0) {
      c.cooldown -= dt;
      c.surging = false;
      c.intensity = lerp(c.intensity, 0, 1 - Math.exp(-dt * 5));
      if (c.cooldown <= 0) {
        c.charge = 100;
        c.rest = rand(.6, 2.2);
      }
    } else if (!c.surging) {
      c.rest -= dt;
      c.intensity = lerp(c.intensity, 0, 1 - Math.exp(-dt * 3.4));
      if (c.rest <= 0) {
        c.surging = true;
        c.intensity = 0;
      }
    }
    if (c.surging) {
      c.charge -= c.drain * dt;
      c.intensity = lerp(c.intensity, 1, 1 - Math.exp(-dt * 1.5));
      if (c.charge <= 0) {
        c.charge = 0;
        c.surging = false;
        c.cooldown = rand(1.5, 2.4);
        c.flashT = 1;
        c.intensity = 0;
      }
    }

    const moveFactor = c.surging ? 0.32 : 1;
    c.phase += c.speed * dt * moveFactor;
    const x = Math.cos(c.phase) * c.rx;
    const z = Math.sin(c.phase) * c.rz;
    c.group.position.set(x, 0, z);
    const dx = -Math.sin(c.phase) * c.rx * Math.sign(c.speed);
    const dz = Math.cos(c.phase) * c.rz * Math.sign(c.speed);
    c.group.rotation.y = Math.atan2(dx, dz);

    const swing = Math.sin(t * (c.surging ? 15 : 8.5) + c.offset) * (c.surging ? 0.22 : 0.5);
    c.legL.rotation.x = swing;
    c.legR.rotation.x = -swing;
    c.armL.rotation.x = -swing * 0.75;
    c.armR.rotation.x = swing * 0.75;

    const target = c.side === 'boy' ? 1 - 0.3 * c.intensity : 1 + 0.42 * c.intensity;
    c.size = lerp(c.size, target, 1 - Math.exp(-dt * 5.5));
    c.group.scale.setScalar(c.baseScale * c.size);
    c.jersey.emissiveIntensity = c.intensity * 1.1 + c.flashT * 2.2;
    c.glow.material.opacity = c.intensity * 0.42;
    c.glow.scale.set(1.7 + c.intensity * 0.6, 2.0 + c.intensity * 0.7, 1);

    if (c.flashT > 0) {
      c.flashT = Math.max(0, c.flashT - dt * 1.7);
      c.flash.material.opacity = c.flashT * 0.9;
      const s = 2.2 + (1 - c.flashT) * 1.8;
      c.flash.scale.set(s, s * 1.15, 1);
    } else {
      c.flash.material.opacity = 0;
    }
  }
}

// six athletes: three boys, three girls
for (let i = 0; i < 3; i++) makeCharacter('boy', i);
for (let i = 0; i < 3; i++) makeCharacter('girl', i + 3);

/* ------------------------------------------------------------------ *
 *  player first-person rig
 * ------------------------------------------------------------------ */

const view = new THREE.Group();
camera.add(view);
const viewSkin = new THREE.MeshStandardMaterial({ color: 0xe0b08a, roughness: .82 });
const viewSleeve = new THREE.MeshStandardMaterial({
  color: 0xe2703a, roughness: .75, emissive: 0xe2703a, emissiveIntensity: 0,
});
const viewHands = new THREE.Group();

for (const side of [-1, 1]) {
  const arm = new THREE.Group();
  arm.position.set(side * 0.16, -0.34, -0.58);
  arm.rotation.set(0.95, side * 0.08, -side * 0.5);
  const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.025, 0.11, 8), viewSleeve);
  sleeve.position.y = -0.055;
  const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.023, 0.02, 0.16, 8), viewSkin);
  forearm.position.y = -0.17;
  const hand = new THREE.Mesh(new THREE.SphereGeometry(0.032, 9, 7), viewSkin);
  hand.scale.set(0.9, 1.1, 0.9);
  hand.position.y = -0.27;
  arm.add(sleeve, forearm, hand);
  viewHands.add(arm);
}
view.add(viewHands);
viewHands.visible = false;

const orbMesh = new THREE.Mesh(
  new THREE.SphereGeometry(0.045, 16, 12),
  new THREE.MeshBasicMaterial({ color: 0xffd36a, toneMapped: false }),
);
orbMesh.position.set(0, -0.28, -0.84);
view.add(orbMesh);

const orbGlow = new THREE.Sprite(new THREE.SpriteMaterial({
  map: glowTex, color: 0xffb14f, transparent: true,
  blending: THREE.AdditiveBlending, depthWrite: false, opacity: .55, toneMapped: false,
}));
orbGlow.position.copy(orbMesh.position);
orbGlow.scale.set(0.38, 0.38, 1);
view.add(orbGlow);

const orbRing = new THREE.Mesh(
  new THREE.TorusGeometry(0.105, 0.006, 6, 24),
  new THREE.MeshBasicMaterial({ color: 0xffc98a, transparent: true, opacity: .4, toneMapped: false }),
);
orbRing.position.copy(orbMesh.position);
view.add(orbRing);

const orbLight = new THREE.PointLight(0xffa24d, 0.9, 2.6, 2);
orbLight.position.copy(orbMesh.position);
view.add(orbLight);
view.visible = false;

function setViewSide(side) {
  const col = teamColor(side);
  viewSleeve.color.setHex(col);
  viewSleeve.emissive.setHex(col);
  viewSleeve.emissiveIntensity = 0;
}

/* ------------------------------------------------------------------ *
 *  audio
 * ------------------------------------------------------------------ */

class GymAudio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.humGain = null;
    this.humOsc = null;
    this.muted = false;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : .55;
      this.master.connect(this.ctx.destination);

      // surge hum
      this.humGain = this.ctx.createGain();
      this.humGain.gain.value = 0;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 520;
      this.humOsc = this.ctx.createOscillator();
      this.humOsc.type = 'sawtooth';
      this.humOsc.frequency.value = 62;
      this.humOsc.connect(filter);
      filter.connect(this.humGain);
      this.humGain.connect(this.master);
      this.humOsc.start();

      // room tone
      const amb = this.ctx.createGain();
      amb.gain.value = .035;
      const ambOsc = this.ctx.createOscillator();
      ambOsc.type = 'sine';
      ambOsc.frequency.value = 48;
      ambOsc.connect(amb);
      amb.connect(this.master);
      ambOsc.start();
    } catch {
      this.ctx = null;
    }
  }

  tone(freq, dur, type, vol, slide = 0) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || .12, t + .012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + dur + .02);
  }

  setSurge(active, intensity) {
    if (!this.ctx || !this.humGain) return;
    const t = this.ctx.currentTime;
    this.humGain.gain.setTargetAtTime(active ? .035 + intensity * .05 : 0, t, .08);
    this.humOsc.frequency.setTargetAtTime(58 + intensity * 95, t, .1);
  }

  chime() {
    this.tone(880, .12, 'sine', .06);
    setTimeout(() => this.tone(1320, .16, 'sine', .05), 55);
  }

  burnout() {
    this.tone(320, .45, 'sawtooth', .09, -270);
    setTimeout(() => this.tone(90, .35, 'square', .05, -40), 80);
  }

  start() {
    this.tone(330, .1, 'square', .05);
    setTimeout(() => this.tone(440, .12, 'square', .05), 110);
    setTimeout(() => this.tone(660, .18, 'square', .06), 230);
  }

  end() {
    this.tone(660, .16, 'triangle', .06, -120);
    setTimeout(() => this.tone(440, .22, 'triangle', .05, -120), 150);
    setTimeout(() => this.tone(330, .28, 'triangle', .04, -80), 330);
  }

  toggle() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : .55;
    return this.muted;
  }
}

const audio = new GymAudio();

/* ------------------------------------------------------------------ *
 *  player state + UI
 * ------------------------------------------------------------------ */

const state = {
  mode: 'menu',
  side: 'girl',
  pos: new THREE.Vector3(0, 0, 10.5),
  yaw: 0,
  pitch: 0.02,
  charge: 100,
  surgeHeld: false,
  lockout: false,
  holdTime: 0,
  intensity: 0,
  size: 1,
  score: 0,
  elapsed: 0,
  burnouts: 0,
  orbs: 0,
  peakSize: 1,
  cooldown: 0,
  flash: 0,
  burnoutLabel: 0,
  shake: 0,
  bob: 0,
  moving: false,
  muted: false,
  hintUntil: 0,
  hintText: '',
  hintNext: 0,
  over: false,
};

const ui = {
  hud: $('hud'),
  start: $('startScreen'),
  pause: $('pauseScreen'),
  end: $('endScreen'),
  score: $('score'),
  clock: $('clock'),
  timer: $('timer'),
  sideBadge: $('sideBadge'),
  charge: $('charge'),
  chargeWrap: $('chargeWrap'),
  height: $('heightReadout'),
  hint: $('hint'),
  burnout: $('burnout'),
  flash: $('flash'),
  joystick: $('joystick'),
  stick: $('stick'),
  holdBtn: $('holdBtn'),
  muteBtn: $('muteBtn'),
  endSub: $('endSub'),
  statScore: $('statScore'),
  statSize: $('statSize'),
  statBurn: $('statBurn'),
  bestLine: $('bestLine'),
  pauseSoundBtn: $('pauseSoundBtn'),
};

const keys = { forward: false, back: false, left: false, right: false };
const joy = { x: 0, y: 0, id: null };
const look = { id: null, x: 0, y: 0 };

function formatTime(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function showHint(text, seconds = 2.4) {
  ui.hint.textContent = text;
  ui.hint.classList.add('show');
  state.hintText = text;
  state.hintUntil = clock.t + seconds;
}

function hideHint() {
  ui.hint.classList.remove('show');
  state.hintText = '';
}

function setScreen(screen) {
  for (const s of [ui.start, ui.pause, ui.end]) s.classList.add('hidden');
  ui.hud.classList.add('hidden');
  ui.hud.setAttribute('aria-hidden', 'true');
  if (screen) screen.classList.remove('hidden');
}

function showHud() {
  ui.hud.classList.remove('hidden');
  ui.hud.setAttribute('aria-hidden', 'false');
}

function updateSideUI() {
  ui.sideBadge.textContent = state.side === 'boy' ? 'SPORT BOYS' : 'SPORT GIRLS';
  ui.sideBadge.classList.toggle('boy', state.side === 'boy');
  setViewSide(state.side);
}

function selectSide(side) {
  state.side = side;
  document.querySelectorAll('.side-card').forEach((card) => {
    card.classList.toggle('selected', card.dataset.side === side);
  });
  updateSideUI();
}

/* ------------------------------------------------------------------ *
 *  run lifecycle
 * ------------------------------------------------------------------ */

function startRun() {
  audio.init();
  state.mode = 'playing';
  state.pos.set(0, 0, 10.5);
  state.yaw = 0;
  state.pitch = 0.02;
  state.charge = 100;
  state.surgeHeld = false;
  state.lockout = false;
  state.holdTime = 0;
  state.intensity = 0;
  state.size = 1;
  state.score = 0;
  state.elapsed = 0;
  state.burnouts = 0;
  state.orbs = 0;
  state.peakSize = 1;
  state.cooldown = 0;
  state.flash = 0;
  state.burnoutLabel = 0;
  state.shake = 0;
  state.bob = 0;
  state.moving = false;
  state.over = false;
  state.hintUntil = 0;
  state.hintNext = 0;
  state.hintText = '';
  keys.forward = keys.back = keys.left = keys.right = false;
  joy.x = joy.y = 0;
  ui.stick.style.transform = 'translate(0,0)';
  ui.joystick.classList.remove('active');
  ui.holdBtn.classList.remove('active');
  view.visible = true;
  resetNPCs();
  resetOrbs();
  updateSideUI();
  setScreen(null);
  showHud();
  showHint('COLLECT ORBS  ·  HOLD TO SURGE', 3.4);
  audio.start();
  last = performance.now();
}

function pauseGame() {
  if (state.mode !== 'playing') return;
  state.mode = 'paused';
  state.surgeHeld = false;
  state.lockout = false;
  ui.holdBtn.classList.remove('active');
  setScreen(ui.pause);
  audio.setSurge(false, 0);
  ui.pauseSoundBtn.textContent = `Sound: ${audio.muted ? 'off' : 'on'}`;
}

function resumeGame() {
  if (state.mode !== 'paused') return;
  state.mode = 'playing';
  setScreen(null);
  showHud();
  last = performance.now();
}

function endRun() {
  if (state.mode !== 'playing') return;
  state.mode = 'over';
  state.surgeHeld = false;
  state.lockout = false;
  ui.holdBtn.classList.remove('active');
  audio.setSurge(false, 0);
  audio.end();
  setScreen(ui.end);
  view.visible = false;

  const score = state.score;
  const isBoy = state.side === 'boy';
  const bestKey = isBoy ? 'gymSurgeBestBoy' : 'gymSurgeBestGirl';
  let best = 0;
  try { best = parseFloat(localStorage.getItem(bestKey) || '0') || 0; } catch { best = 0; }
  const isBest = score > best;
  if (isBest) {
    try { localStorage.setItem(bestKey, score.toFixed(1)); } catch { /* private mode */ }
  }
  const rank = score >= 35 ? 'LEGEND' : score >= 26 ? 'ALL-STAR' : score >= 18 ? 'VARSITY' : score >= 10 ? 'STARTER' : 'ROOKIE';
  const shift = isBoy ? (1 - state.peakSize) * 100 : (state.peakSize - 1) * 100;
  const shiftText = `${shift >= 0 ? (isBoy ? '-' : '+') : (isBoy ? '+' : '-')}${Math.abs(shift).toFixed(0)}%`;

  ui.endSub.textContent = `${rank} · ${isBoy ? 'shrink' : 'grow'} trial complete.`;
  ui.statScore.textContent = `${score.toFixed(1)}s`;
  ui.statSize.textContent = shiftText;
  ui.statBurn.textContent = String(state.burnouts);
  ui.bestLine.textContent = isBest ? 'NEW PERSONAL BEST' : `BEST ${best.toFixed(1)}s`;
}

function returnToMenu() {
  state.mode = 'menu';
  state.surgeHeld = false;
  state.lockout = false;
  state.intensity = 0;
  state.holdTime = 0;
  state.cooldown = 0;
  state.flash = 0;
  state.burnoutLabel = 0;
  state.shake = 0;
  keys.forward = keys.back = keys.left = keys.right = false;
  joy.x = joy.y = 0;
  ui.stick.style.transform = 'translate(0,0)';
  ui.joystick.classList.remove('active');
  ui.holdBtn.classList.remove('active');
  audio.setSurge(false, 0);
  view.visible = false;
  setScreen(ui.start);
  camera.rotation.set(0, 0, 0);
}

function burnout() {
  state.charge = 0;
  state.surgeHeld = false;
  state.lockout = true;
  state.holdTime = 0;
  state.intensity = 0;
  state.size = 1;
  state.cooldown = 1.35;
  state.burnouts++;
  state.flash = 1;
  state.shake = 1;
  state.burnoutLabel = 1.1;
  state.bob = 0;
  audio.burnout();
  showHint('THE SURGE BURNED OUT — RELEASE, THEN GRAB AN ORB', 2.2);
  ui.holdBtn.classList.remove('active');
  spawnBurst(state.pos.x, 1.1, state.pos.z);
}

let burstBatches = [];
function spawnBurst(x, y, z) {
  const group = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: 0xffe0b0, transparent: true, opacity: .9, toneMapped: false });
  for (let i = 0; i < 10; i++) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(rand(.02, .045), 6, 5), mat.clone());
    const a = rand(0, Math.PI * 2);
    const r = rand(.2, .7);
    s.position.set(Math.cos(a) * r, y + rand(-.4, .8), Math.sin(a) * r);
    s.userData.vel = new THREE.Vector3(Math.cos(a) * rand(.6, 2), rand(.8, 2.4), Math.sin(a) * rand(.6, 2));
    group.add(s);
  }
  group.position.set(x, 0, z);
  scene.add(group);
  burstBatches.push({ group, life: 1 });
}

function updateBursts(dt) {
  for (let i = burstBatches.length - 1; i >= 0; i--) {
    const b = burstBatches[i];
    b.life -= dt * 1.5;
    for (const s of b.group.children) {
      s.position.addScaledVector(s.userData.vel, dt);
      s.userData.vel.y -= dt * 2.4;
      s.material.opacity = Math.max(0, b.life);
    }
    if (b.life <= 0) {
      for (const s of b.group.children) { s.geometry.dispose(); s.material.dispose(); }
      scene.remove(b.group);
      burstBatches.splice(i, 1);
    }
  }
}

/* ------------------------------------------------------------------ *
 *  input
 * ------------------------------------------------------------------ */

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (state.mode === 'playing') { pauseGame(); e.preventDefault(); }
    else if (state.mode === 'paused') { resumeGame(); e.preventDefault(); }
    return;
  }
  if (state.mode === 'menu' && (e.code === 'Enter' || e.code === 'Space')) {
    startRun();
    e.preventDefault();
    return;
  }
  if (state.mode !== 'playing') return;
  if (e.code === 'Space') {
    if (!e.repeat) {
      state.surgeHeld = true;
      ui.holdBtn.classList.add('active');
    }
    e.preventDefault();
    return;
  }
  if (e.code === 'KeyM') { toggleMute(); return; }
  if (e.code === 'ArrowUp' || e.code === 'KeyW') { keys.forward = true; e.preventDefault(); }
  else if (e.code === 'ArrowDown' || e.code === 'KeyS') { keys.back = true; e.preventDefault(); }
  else if (e.code === 'ArrowLeft' || e.code === 'KeyA') { keys.left = true; e.preventDefault(); }
  else if (e.code === 'ArrowRight' || e.code === 'KeyD') { keys.right = true; e.preventDefault(); }
});

window.addEventListener('keyup', (e) => {
  if (e.code === 'Space') {
    state.surgeHeld = false;
    state.lockout = false;
    ui.holdBtn.classList.remove('active');
    return;
  }
  if (e.code === 'ArrowUp' || e.code === 'KeyW') keys.forward = false;
  else if (e.code === 'ArrowDown' || e.code === 'KeyS') keys.back = false;
  else if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = false;
  else if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = false;
});

function updateJoy(e) {
  const rect = ui.joystick.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  let dx = e.clientX - cx;
  let dy = e.clientY - cy;
  const max = rect.width * 0.36;
  const len = Math.hypot(dx, dy);
  if (len > max) {
    dx = (dx / len) * max;
    dy = (dy / len) * max;
  }
  ui.stick.style.transform = `translate(${dx}px, ${dy}px)`;
  joy.x = dx / max;
  joy.y = dy / max;
}

ui.joystick.addEventListener('pointerdown', (e) => {
  if (state.mode !== 'playing') return;
  e.preventDefault();
  joy.id = e.pointerId;
  ui.joystick.setPointerCapture(e.pointerId);
  ui.joystick.classList.add('active');
  updateJoy(e);
});
ui.joystick.addEventListener('pointermove', (e) => {
  if (e.pointerId !== joy.id) return;
  e.preventDefault();
  updateJoy(e);
});
function endJoy(e) {
  if (e.pointerId !== joy.id) return;
  joy.id = null;
  joy.x = joy.y = 0;
  ui.stick.style.transform = 'translate(0,0)';
  ui.joystick.classList.remove('active');
}
ui.joystick.addEventListener('pointerup', endJoy);
ui.joystick.addEventListener('pointercancel', endJoy);

canvas.addEventListener('pointerdown', (e) => {
  if (state.mode !== 'playing') return;
  if (look.id !== null) return;
  look.id = e.pointerId;
  look.x = e.clientX;
  look.y = e.clientY;
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (e.pointerId !== look.id) return;
  const dx = e.clientX - look.x;
  const dy = e.clientY - look.y;
  look.x = e.clientX;
  look.y = e.clientY;
  const sens = e.pointerType === 'touch' ? 0.0042 : 0.0025;
  state.yaw -= dx * sens;
  state.pitch = clamp(state.pitch - dy * sens, -1.15, 1.1);
});
function endLook(e) {
  if (e.pointerId !== look.id) return;
  look.id = null;
}
canvas.addEventListener('pointerup', endLook);
canvas.addEventListener('pointercancel', endLook);
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

function setHold(active, e) {
  if (state.mode !== 'playing') return;
  if (active) {
    if (state.lockout) return;
    state.surgeHeld = true;
    ui.holdBtn.classList.add('active');
    if (e && ui.holdBtn.setPointerCapture) {
      try { ui.holdBtn.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    }
  } else {
    state.surgeHeld = false;
    state.lockout = false;
    ui.holdBtn.classList.remove('active');
  }
}
ui.holdBtn.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  setHold(true, e);
});
ui.holdBtn.addEventListener('pointerup', (e) => { e.preventDefault(); setHold(false); });
ui.holdBtn.addEventListener('pointercancel', () => setHold(false));
ui.holdBtn.addEventListener('pointerleave', (e) => { if (e.buttons) setHold(false); });

function toggleMute() {
  const muted = audio.toggle();
  state.muted = muted;
  ui.muteBtn.textContent = muted ? 'OFF' : 'SND';
  ui.pauseSoundBtn.textContent = `Sound: ${muted ? 'off' : 'on'}`;
}

ui.muteBtn.addEventListener('click', toggleMute);
ui.pauseSoundBtn.addEventListener('click', toggleMute);

$('pauseBtn').addEventListener('click', pauseGame);
$('resumeBtn').addEventListener('click', resumeGame);
$('restartBtn').addEventListener('click', startRun);
$('changeSideBtn').addEventListener('click', returnToMenu);
$('againBtn').addEventListener('click', startRun);
$('endSideBtn').addEventListener('click', returnToMenu);
$('startBtn').addEventListener('click', startRun);

document.querySelectorAll('.side-card').forEach((card) => {
  card.addEventListener('click', () => selectSide(card.dataset.side));
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight, false);
});

/* ------------------------------------------------------------------ *
 *  update
 * ------------------------------------------------------------------ */

function updatePlayer(dt) {
  state.elapsed += dt;
  if (state.elapsed >= 60) {
    state.elapsed = 60;
    updateHud();
    endRun();
    return;
  }

  if (state.cooldown > 0) state.cooldown = Math.max(0, state.cooldown - dt);

  const wants = state.surgeHeld && !state.lockout && state.cooldown <= 0;
  const surging = wants && state.charge > 0;

  if (surging) {
    const drain = state.side === 'boy' ? 27 : 15;
    state.charge = Math.max(0, state.charge - drain * dt);
    state.holdTime += dt;
    state.intensity = clamp(state.holdTime / 3.4, 0, 1);
    state.score += dt * (1 + state.intensity * 0.45);
    if (state.charge <= 0) {
      burnout();
    }
  } else {
    state.holdTime = Math.max(0, state.holdTime - dt * 2.4);
    state.intensity = clamp(state.holdTime / 3.4, 0, 1);
    if (state.cooldown <= 0) state.charge = clamp(state.charge + 2.4 * dt, 0, 100);
  }

  const targetSize = state.side === 'boy' ? 1 - 0.32 * state.intensity : 1 + 0.45 * state.intensity;
  state.size = lerp(state.size, targetSize, 1 - Math.exp(-dt * 8));
  if (state.cooldown > 0) state.size = lerp(state.size, 1, 1 - Math.exp(-dt * 14));
  if (state.side === 'boy') state.peakSize = Math.min(state.peakSize, state.size);
  else state.peakSize = Math.max(state.peakSize, state.size);

  // movement
  const f = (keys.forward ? 1 : 0) - (keys.back ? 1 : 0) - joy.y;
  const r = (keys.right ? 1 : 0) - (keys.left ? 1 : 0) + joy.x;
  const len = Math.hypot(f, r);
  const nf = len > 1 ? f / len : f;
  const nr = len > 1 ? r / len : r;
  state.moving = len > 0.08;
  if (state.moving) {
    const speed = 4.55 * (surging ? 0.88 : 1) * (state.cooldown > 0 ? 0.8 : 1);
    const dx = (-Math.sin(state.yaw) * nf + Math.cos(state.yaw) * nr) * speed * dt;
    const dz = (-Math.cos(state.yaw) * nf - Math.sin(state.yaw) * nr) * speed * dt;
    state.pos.x = clamp(state.pos.x + dx, -8.15, 8.15);
    state.pos.z = clamp(state.pos.z + dz, -12.55, 12.55);
    state.bob += dt * speed * 1.8;
  } else {
    state.bob += dt * 1.2;
  }

  // decay effects
  state.flash = Math.max(0, state.flash - dt * 2.6);
  state.shake = Math.max(0, state.shake - dt * 2.4);
  state.burnoutLabel = Math.max(0, state.burnoutLabel - dt);

  // hints
  const timeLeft = 60 - state.elapsed;
  if (state.cooldown > 0) {
    if (clock.t > state.hintNext) {
      showHint('OUTFIT RESET — RELEASE, THEN GRAB AN ORB', 1.3);
      state.hintNext = clock.t + 1.6;
    }
  } else if (!surging && state.charge < 24) {
    if (clock.t > state.hintNext) {
      showHint('CHARGE LOW — FIND A GLOWING ORB', 1.8);
      state.hintNext = clock.t + 2.6;
    }
  } else if (timeLeft <= 10 && timeLeft > 0) {
    if (clock.t > state.hintNext) {
      showHint('TEN SECONDS — HOLD THE SURGE', 2.0);
      state.hintNext = clock.t + 3;
    }
  } else if (surging && state.intensity > 0.82 && clock.t > state.hintNext) {
    showHint(state.side === 'boy' ? 'SHRINKING FAST — WATCH THE CHARGE' : 'GROWING — KEEP THE SURGE ALIVE', 1.5);
    state.hintNext = clock.t + 4;
  }

  if (state.hintUntil && clock.t > state.hintUntil) {
    hideHint();
    state.hintUntil = 0;
  }

  audio.setSurge(surging, state.intensity);
}

function updateCamera(dt) {
  if (state.mode === 'menu') {
    const t = clock.t;
    camera.position.set(Math.sin(t * .14) * 2.4, 2.65 + Math.sin(t * .22) * .08, 11.4);
    camera.lookAt(0, 1.35, 0);
    camera.fov = 68;
    camera.updateProjectionMatrix();
    return;
  }
  if (state.mode === 'playing' || state.mode === 'paused' || state.mode === 'over') {
    const bob = state.moving ? Math.sin(state.bob * 2) * 0.02 : Math.sin(clock.t * 1.4) * 0.006;
    const eye = 1.66 * state.size + bob;
    const shake = state.shake * 0.05;
    camera.position.set(state.pos.x, eye, state.pos.z);
    camera.rotation.set(
      state.pitch + (Math.random() - .5) * shake,
      state.yaw + (Math.random() - .5) * shake,
      (Math.random() - .5) * shake * .6 + (state.moving ? -Math.sin(state.bob) * 0.006 : 0),
    );
    camera.fov = 72;
    camera.updateProjectionMatrix();
  }
}

function updateViewModel(dt) {
  if (!view.visible) return;
  const t = clock.t;
  const surge = state.mode === 'playing' && state.intensity;
  const dead = state.cooldown > 0;
  const pulse = 1 + Math.sin(t * 7) * .06;
  const scale = (dead ? .4 : .75 + surge * .65) * pulse;
  orbMesh.scale.setScalar(scale);
  orbGlow.scale.set(.32 + surge * .28, .32 + surge * .28, 1);
  orbGlow.material.opacity = dead ? .1 : .4 + surge * .45;
  orbRing.scale.setScalar(1 + surge * .35);
  orbRing.rotation.z += dt * (1.5 + surge * 5);
  orbRing.rotation.x = Math.sin(t * 1.2) * .3;
  orbRing.material.opacity = dead ? .08 : .3 + surge * .3;
  orbLight.intensity = dead ? .08 : .45 + surge * .9;
  viewSleeve.emissiveIntensity = surge * .85;
  view.position.set(
    Math.sin(t * (10 + surge * 12)) * .006 * (surge + .2),
    Math.sin(t * 9) * .005 * (surge + .2) - (state.moving ? Math.abs(Math.sin(state.bob)) * .008 : 0),
    0,
  );
  if (dead) {
    view.position.x += (Math.random() - .5) * .012;
    view.position.y += (Math.random() - .5) * .012;
  }
}

function updateHud() {
  ui.score.textContent = state.score.toFixed(1);
  const left = Math.max(0, 60 - state.elapsed);
  ui.clock.textContent = formatTime(left);
  ui.timer.classList.toggle('low', left <= 10);
  const chargePct = clamp(state.charge, 0, 100);
  ui.charge.style.width = `${chargePct}%`;
  ui.chargeWrap.classList.toggle('low', chargePct < 24);
  ui.chargeWrap.classList.toggle('burn', state.cooldown > 0);
  ui.height.textContent = `${state.size.toFixed(2)}×`;
  ui.burnout.classList.toggle('show', state.burnoutLabel > 0);
  ui.flash.style.opacity = String(clamp(state.flash * .8, 0, .8));
}

/* ------------------------------------------------------------------ *
 *  main loop
 * ------------------------------------------------------------------ */

function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  clock.t += dt;

  if (state.mode === 'playing') {
    updatePlayer(dt);
    if (state.mode !== 'playing') {
      // run ended inside updatePlayer
      updateOrbs(dt);
      updateNPCs(dt);
      updateBursts(dt);
      updateCamera(dt);
      updateViewModel(dt);
      updateHud();
      renderer.render(scene, camera);
      requestAnimationFrame(frame);
      return;
    }
  }

  if (state.mode !== 'paused') {
    updateOrbs(dt);
    updateNPCs(dt);
    updateBursts(dt);
  }
  if (state.mode === 'menu') {
    const g = world.userData.centerGlow;
    if (g) {
      g.material.opacity = .08 + Math.sin(clock.t * 1.6) * .025;
      g.rotation.z += dt * .06;
    }
  }
  updateCamera(dt);
  updateViewModel(dt);
  updateHud();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

/* ------------------------------------------------------------------ *
 *  boot
 * ------------------------------------------------------------------ */

selectSide('girl');
for (let i = 0; i < 14; i++) createOrb(i);
setScreen(ui.start);
ui.muteBtn.textContent = 'SND';
view.visible = false;
camera.position.set(0, 2.65, 11.4);
camera.lookAt(0, 1.35, 0);
renderer.render(scene, camera);
requestAnimationFrame(frame);

window.__GYM_SURGE__ = {
  state,
  npcs,
  orbs,
  camera,
  renderer,
  scene,
  get mode() { return state.mode; },
  get gpuName() { return gpuName; },
  get lowGfx() { return LOW_GFX; },
  select(side) { selectSide(side); },
  start(side) { if (side) selectSide(side); startRun(); },
  end() { endRun(); },
};
