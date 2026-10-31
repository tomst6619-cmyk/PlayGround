import { rr, TAU, seeded, heartPath } from './utils.js';

export const WORLD = { w: 2600, h: 1800 };
export const STREET = { top: 780, bottom: 950, walkTop: 742, walkBottom: 988, center: 865 };
export const PARK = { x: 1290, y: 1420, r: 300, plaza: 150 };
export const SPAWN = { x: 1290, y: 1080 };

export const HOUSES = [
  { x: 250, y: 300, w: 360, h: 240, base: 670, wall: '#f2d6b8', roof: '#5c4157', trim: '#fff1dd', door: '#7d4a36', drive: 430 },
  { x: 1090, y: 280, w: 400, h: 250, base: 660, wall: '#cfe1ef', roof: '#3f4f6b', trim: '#f4fbff', door: '#3f5a7a', drive: 1290 },
  { x: 1980, y: 300, w: 370, h: 240, base: 670, wall: '#f5e6b8', roof: '#4c5b4a', trim: '#fff8e4', door: '#5a6b45', drive: 2165 },
  { x: 180, y: 1370, w: 350, h: 220, base: 1720, wall: '#e8d3e9', roof: '#5a4a63', trim: '#fff3ff', door: '#6b4666', drive: 355 },
  { x: 2120, y: 1370, w: 350, h: 220, base: 1720, wall: '#d8e7d3', roof: '#41544e', trim: '#f5fff0', door: '#48604f', drive: 2295 },
];

export const TREES = [
  [120, 250, 1.15], [700, 190, 1.0], [900, 430, 0.9], [1660, 150, 1.1], [1860, 430, 0.95],
  [2500, 250, 1.15], [650, 690, 0.78], [1920, 690, 0.84], [2430, 620, 1.0], [150, 980, 0.9],
  [300, 1210, 1.05], [640, 1180, 1.0], [520, 1700, 1.1], [900, 1755, 0.95], [1800, 1730, 1.0],
  [2430, 1720, 1.1], [2380, 1200, 1.0], [1620, 1180, 0.85], [1030, 1130, 0.8], [1570, 1130, 0.8],
  [1030, 1700, 0.9], [1580, 1695, 0.85],
];

export const LAMPS = [
  [560, 742], [1520, 742], [2320, 742], [430, 988], [1180, 988], [2060, 988], [1000, 1250], [1580, 1250],
];

export const BENCHES = [
  { x: 1060, y: 1300 }, { x: 1520, y: 1300 }, { x: 1060, y: 1560 }, { x: 1520, y: 1560 },
];

export const CARS = [
  { x: 430, y: 700, rot: Math.PI / 2, body: '#d95f6e' },
  { x: 2165, y: 700, rot: Math.PI / 2, body: '#5b8fce' },
  { x: 355, y: 1560, rot: Math.PI / 2, body: '#e0b35a' },
];

export const MAILBOXES = [
  { x: 336, y: 706 }, { x: 1196, y: 700 }, { x: 2262, y: 706 }, { x: 262, y: 1010 }, { x: 2202, y: 1010 },
];

export const HEDGES = [
  { x: 150, y: 690, w: 230, h: 22 }, { x: 1080, y: 652, w: 74, h: 22 }, { x: 1516, y: 652, w: 74, h: 22 },
  { x: 1975, y: 690, w: 112, h: 22 }, { x: 2262, y: 690, w: 78, h: 22 },
  { x: 1120, y: 1082, w: 92, h: 24 }, { x: 1368, y: 1082, w: 92, h: 24 },
];

export const GIFTS = [
  { x: 760, y: 700, hue: '#ff8fb0' },
  { x: 1900, y: 706, hue: '#ffd36e' },
  { x: 820, y: 1680, hue: '#b99bff' },
  { x: 1850, y: 1650, hue: '#7fe0c8' },
];

export const DECOR = [
  { kind: 'hydrant', x: 966, y: 1004 },
  { kind: 'bin', x: 1604, y: 1006 },
  { kind: 'picnic', x: 1128, y: 1660 },
];

/* ---------------------------------------------------------------- ground */

function flowerCluster(g, x, y, rnd, n = 9) {
  for (let i = 0; i < n; i++) {
    const a = rnd() * TAU;
    const r = rnd() * 26;
    g.fillStyle = ['#ffb4c8', '#ffe08a', '#c9b3ff', '#ffd6e6'][Math.floor(rnd() * 4)];
    g.beginPath();
    g.arc(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.6, 1.6 + rnd() * 1.8, 0, TAU);
    g.fill();
  }
  g.fillStyle = 'rgba(60,110,70,0.35)';
  for (let i = 0; i < n; i++) {
    const a = rnd() * TAU;
    const r = rnd() * 28;
    g.fillRect(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.6, 1, 3);
  }
}

export function buildGround() {
  const canvas = document.createElement('canvas');
  canvas.width = WORLD.w;
  canvas.height = WORLD.h;
  const g = canvas.getContext('2d');
  const rnd = seeded(1234567);

  // lawn base
  const grass = g.createLinearGradient(0, 0, 0, WORLD.h);
  grass.addColorStop(0, '#4d7155');
  grass.addColorStop(0.5, '#476b50');
  grass.addColorStop(1, '#3d6048');
  g.fillStyle = grass;
  g.fillRect(0, 0, WORLD.w, WORLD.h);

  // mowing bands
  for (let y = 0; y < WORLD.h; y += 112) {
    g.fillStyle = y % 224 === 0 ? 'rgba(255,255,255,0.018)' : 'rgba(0,0,0,0.015)';
    g.fillRect(0, y, WORLD.w, 112);
  }

  // dirt / moss patches
  for (let i = 0; i < 42; i++) {
    const x = rnd() * WORLD.w;
    const y = rnd() * WORLD.h;
    const r = 30 + rnd() * 80;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, rnd() > 0.5 ? 'rgba(128,140,90,0.09)' : 'rgba(30,54,40,0.1)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.beginPath();
    g.ellipse(x, y, r, r * 0.6, 0, 0, TAU);
    g.fill();
  }

  // grass tufts
  for (let i = 0; i < 9000; i++) {
    const x = rnd() * WORLD.w;
    const y = rnd() * WORLD.h;
    if (y > STREET.top - 20 && y < STREET.walkBottom + 20) continue;
    g.strokeStyle = rnd() > 0.5 ? 'rgba(164,198,140,0.28)' : 'rgba(18,42,30,0.3)';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + (rnd() - 0.5) * 3, y - 3 - rnd() * 4);
    g.stroke();
  }

  // daisies tucked into the lawns
  for (let i = 0; i < 240; i++) {
    const x = rnd() * WORLD.w;
    const y = rnd() * WORLD.h;
    if (y > STREET.walkTop - 10 && y < STREET.walkBottom + 10) continue;
    if (Math.hypot(x - PARK.x, y - PARK.y) < PARK.plaza + 20) continue;
    g.fillStyle = 'rgba(250,246,225,0.75)';
    for (let p = 0; p < 4; p++) {
      const a = (p / 4) * TAU;
      g.beginPath();
      g.arc(x + Math.cos(a) * 1.9, y + Math.sin(a) * 1.3, 1.15, 0, TAU);
      g.fill();
    }
    g.fillStyle = 'rgba(255,214,120,0.9)';
    g.beginPath();
    g.arc(x, y, 0.9, 0, TAU);
    g.fill();
  }

  // park lawn
  const parkGrad = g.createRadialGradient(PARK.x, PARK.y - 60, 40, PARK.x, PARK.y, PARK.r + 20);
  parkGrad.addColorStop(0, '#547c5c');
  parkGrad.addColorStop(1, '#43694f');
  g.fillStyle = parkGrad;
  g.beginPath();
  g.arc(PARK.x, PARK.y, PARK.r + 12, 0, TAU);
  g.fill();
  g.strokeStyle = 'rgba(28,48,36,0.22)';
  g.lineWidth = 10;
  g.beginPath();
  g.arc(PARK.x, PARK.y, PARK.r + 8, 0, TAU);
  g.stroke();

  // park ring path
  g.strokeStyle = 'rgba(72,60,48,0.22)';
  g.lineWidth = 52;
  g.beginPath();
  g.arc(PARK.x, PARK.y, PARK.r - 42, 0, TAU);
  g.stroke();
  g.strokeStyle = '#a89c85';
  g.lineWidth = 46;
  g.beginPath();
  g.arc(PARK.x, PARK.y, PARK.r - 42, 0, TAU);
  g.stroke();
  g.strokeStyle = 'rgba(255,255,255,0.16)';
  g.lineWidth = 2;
  g.beginPath();
  g.arc(PARK.x, PARK.y, PARK.r - 64, 0, TAU);
  g.stroke();

  // path from the street into the park
  g.fillStyle = 'rgba(72,60,48,0.22)';
  g.fillRect(1246, STREET.walkBottom - 2, 88, PARK.y - PARK.r - STREET.walkBottom + 62);
  g.fillStyle = '#a89c85';
  g.fillRect(1252, STREET.walkBottom - 2, 76, PARK.y - PARK.r - STREET.walkBottom + 60);
  g.strokeStyle = 'rgba(70,62,52,0.2)';
  g.lineWidth = 2;
  for (let y = STREET.walkBottom; y < PARK.y - PARK.r + 60; y += 34) {
    g.beginPath();
    g.moveTo(1252, y);
    g.lineTo(1328, y);
    g.stroke();
  }

  // plaza
  const plaza = g.createRadialGradient(PARK.x, PARK.y, 10, PARK.x, PARK.y, PARK.plaza + 14);
  plaza.addColorStop(0, '#bcb19a');
  plaza.addColorStop(0.7, '#ada290');
  plaza.addColorStop(1, '#9a8f7d');
  g.fillStyle = plaza;
  g.beginPath();
  g.arc(PARK.x, PARK.y, PARK.plaza + 14, 0, TAU);
  g.fill();
  g.strokeStyle = 'rgba(70,62,52,0.16)';
  g.lineWidth = 2;
  for (let r = 40; r < PARK.plaza; r += 36) {
    g.beginPath();
    g.arc(PARK.x, PARK.y, r, 0, TAU);
    g.stroke();
  }
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU;
    g.beginPath();
    g.moveTo(PARK.x + Math.cos(a) * 34, PARK.y + Math.sin(a) * 34);
    g.lineTo(PARK.x + Math.cos(a) * (PARK.plaza + 10), PARK.y + Math.sin(a) * (PARK.plaza + 10));
    g.stroke();
  }
  // stone speckle on the plaza
  for (let i = 0; i < 260; i++) {
    const a = rnd() * TAU;
    const r = Math.sqrt(rnd()) * PARK.plaza;
    g.fillStyle = rnd() > 0.5 ? 'rgba(255,255,255,0.08)' : 'rgba(60,52,40,0.1)';
    g.fillRect(PARK.x + Math.cos(a) * r, PARK.y + Math.sin(a) * r, 2, 2);
  }

  // flower beds around the plaza
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * TAU + 0.2;
    flowerCluster(g, PARK.x + Math.cos(a) * (PARK.plaza + 34), PARK.y + Math.sin(a) * (PARK.plaza + 34), rnd, 7);
  }

  // puddles
  for (const [x, y, rx, ry] of [
    [760, 860, 62, 16], [1740, 900, 44, 12], [260, 940, 30, 8], [2180, 760, 38, 10], [1200, 1620, 40, 12],
  ]) {
    const p = g.createLinearGradient(x, y - ry, x, y + ry);
    p.addColorStop(0, 'rgba(150,180,215,0.32)');
    p.addColorStop(1, 'rgba(60,80,120,0.14)');
    g.fillStyle = p;
    g.beginPath();
    g.ellipse(x, y, rx, ry, 0, 0, TAU);
    g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.12)';
    g.lineWidth = 1;
    g.stroke();
  }

  // road
  const road = g.createLinearGradient(0, STREET.top, 0, STREET.bottom);
  road.addColorStop(0, '#3d4454');
  road.addColorStop(0.45, '#363d4c');
  road.addColorStop(1, '#303746');
  g.fillStyle = road;
  g.fillRect(0, STREET.top, WORLD.w, STREET.bottom - STREET.top);

  // asphalt speckle
  for (let i = 0; i < 2400; i++) {
    g.fillStyle = rnd() > 0.5 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.14)';
    g.fillRect(rnd() * WORLD.w, STREET.top + rnd() * (STREET.bottom - STREET.top), 2, 2);
  }

  // tire wear
  g.fillStyle = 'rgba(18,22,32,0.16)';
  g.fillRect(0, 820, WORLD.w, 22);
  g.fillRect(0, 890, WORLD.w, 22);

  // centre line
  g.save();
  g.strokeStyle = 'rgba(240,216,158,0.7)';
  g.lineWidth = 5;
  g.setLineDash([48, 40]);
  g.beginPath();
  g.moveTo(0, STREET.center);
  g.lineTo(WORLD.w, STREET.center);
  g.stroke();
  g.restore();

  // curb + sidewalks
  for (const [top, bottom] of [[STREET.walkTop, STREET.top], [STREET.bottom, STREET.walkBottom]]) {
    g.fillStyle = '#7e8492';
    g.fillRect(0, top, WORLD.w, bottom - top);
    g.fillStyle = 'rgba(255,255,255,0.1)';
    g.fillRect(0, top, WORLD.w, 2);
    g.fillStyle = 'rgba(0,0,0,0.2)';
    g.fillRect(0, bottom - 3, WORLD.w, 3);
    g.strokeStyle = 'rgba(48,52,64,0.35)';
    g.lineWidth = 1.5;
    for (let x = 20; x < WORLD.w; x += 72) {
      g.beginPath();
      g.moveTo(x, top + 4);
      g.lineTo(x, bottom - 4);
      g.stroke();
    }
    g.fillStyle = 'rgba(255,255,255,0.035)';
    for (let x = 20; x < WORLD.w; x += 72) {
      g.fillRect(x + 3, top + 4, 66, (bottom - top) / 2);
    }
  }

  // crosswalk
  for (let x = 1238; x < 1346; x += 24) {
    g.fillStyle = 'rgba(235,238,245,0.5)';
    g.fillRect(x, STREET.top + 8, 13, STREET.bottom - STREET.top - 16);
  }

  // driveways
  for (const h of HOUSES) {
    const isTop = h.base < STREET.top;
    const from = isTop ? h.base - 6 : STREET.walkBottom;
    const to = isTop ? STREET.walkTop : h.base + 4;
    g.fillStyle = '#969ba5';
    g.fillRect(h.drive - 58, from, 116, to - from);
    g.strokeStyle = 'rgba(60,64,78,0.25)';
    g.lineWidth = 1.5;
    for (let y = from + 24; y < to; y += 46) {
      g.beginPath();
      g.moveTo(h.drive - 58, y);
      g.lineTo(h.drive + 58, y);
      g.stroke();
    }
    g.fillStyle = 'rgba(0,0,0,0.12)';
    g.fillRect(h.drive - 58, from, 3, to - from);
    g.fillRect(h.drive + 55, from, 3, to - from);
  }

  // mailbox / garden details
  for (const m of MAILBOXES) flowerCluster(g, m.x, m.y + 16, rnd, 6);

  // house shadows on the lawn
  for (const h of HOUSES) {
    g.fillStyle = 'rgba(14,20,28,0.3)';
    g.beginPath();
    g.ellipse(h.x + h.w / 2, h.base + 8, h.w * 0.62, 28, 0, 0, TAU);
    g.fill();
  }

  // scattered autumn leaves
  for (let i = 0; i < 220; i++) {
    g.fillStyle = ['rgba(190,120,70,0.5)', 'rgba(150,100,60,0.4)', 'rgba(210,160,80,0.35)'][i % 3];
    g.beginPath();
    g.ellipse(rnd() * WORLD.w, rnd() * WORLD.h, 2 + rnd() * 2, 1 + rnd(), rnd() * TAU, 0, TAU);
    g.fill();
  }

  return canvas;
}

/* ----------------------------------------------------------------- props */

export const PROPS = [
  ...HOUSES.map((h) => ({ kind: 'house', ...h })),
  ...TREES.map(([x, y, s]) => ({ kind: 'tree', x, y, s })),
  ...LAMPS.map(([x, y]) => ({ kind: 'lamp', x, y })),
  ...BENCHES.map((b) => ({ kind: 'bench', ...b })),
  ...CARS.map((c) => ({ kind: 'car', ...c })),
  ...MAILBOXES.map((m) => ({ kind: 'mailbox', ...m })),
  ...HEDGES.map((h) => ({ kind: 'hedge', ...h })),
  ...DECOR,
  { kind: 'fountain', x: PARK.x, y: PARK.y },
  { kind: 'sign', x: 1390, y: 1140 },
  ...GIFTS.map((gift, i) => ({ kind: 'gift', ...gift, idx: i })),
];

export function propBaseY(p) {
  switch (p.kind) {
    case 'house': return p.base;
    case 'tree': return p.y;
    case 'lamp': return p.y;
    case 'bench': return p.y + 26;
    case 'car': return p.y + 34;
    case 'mailbox': return p.y + 12;
    case 'hedge': return p.y + p.h;
    case 'fountain': return p.y + 62;
    case 'sign': return p.y + 34;
    case 'gift': return p.y + 14;
    case 'hydrant': return p.y + 4;
    case 'bin': return p.y + 10;
    case 'picnic': return p.y + 20;
    default: return p.y;
  }
}

function drawHouse(ctx, h, t) {
  const { x, y, w, base, wall, roof, trim, door } = h;
  const roofBottom = y + h.h + 8;
  const roofTop = y - 10;
  const cx = x + w / 2;
  const wallTop = base - 130;

  // roof slab
  const roofGrad = ctx.createLinearGradient(x, roofTop, x + w * 0.8, roofBottom);
  roofGrad.addColorStop(0, roof);
  roofGrad.addColorStop(0.55, roof);
  roofGrad.addColorStop(1, '#292435');
  ctx.fillStyle = roofGrad;
  ctx.beginPath();
  ctx.moveTo(x - 22, roofBottom);
  ctx.lineTo(x + w + 22, roofBottom);
  ctx.lineTo(x + w - 28, roofTop);
  ctx.lineTo(x + 28, roofTop);
  ctx.closePath();
  ctx.fill();

  // shingle rows + seams
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = 'rgba(0,0,0,0.2)';
  ctx.lineWidth = 1.5;
  for (let sy = roofTop + 16; sy < roofBottom; sy += 18) {
    ctx.beginPath();
    ctx.moveTo(x - 24, sy);
    ctx.lineTo(x + w + 24, sy);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.12)';
  ctx.lineWidth = 1.2;
  let row = 0;
  for (let sy = roofTop + 16; sy < roofBottom; sy += 18) {
    const off = row % 2 ? 14 : 0;
    for (let vx = x - 24 + off; vx < x + w + 24; vx += 28) {
      ctx.beginPath();
      ctx.moveTo(vx, sy);
      ctx.lineTo(vx, sy + 18);
      ctx.stroke();
    }
    row++;
  }
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  for (let i = 0; i < 8; i++) {
    ctx.fillRect(x + 20 + ((i * 79) % (w - 60)), roofTop + 20 + ((i * 41) % (h.h - 30)), 26, 2);
  }
  ctx.restore();

  // eaves + fascia
  ctx.fillStyle = '#241f2e';
  ctx.fillRect(x - 22, roofBottom - 4, w + 44, 9);
  ctx.fillStyle = trim;
  ctx.fillRect(x - 22, roofBottom + 4, w + 44, 6);
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(x - 22, roofBottom + 9, w + 44, 2);

  // ridge caps
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x + 28, roofTop + 1);
  ctx.lineTo(x + w - 28, roofTop + 1);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + 24, roofTop + 6);
  ctx.lineTo(x - 22, roofBottom);
  ctx.moveTo(x + w - 24, roofTop + 6);
  ctx.lineTo(x + w + 22, roofBottom);
  ctx.stroke();

  // chimney
  const chX = x + w * 0.74;
  ctx.fillStyle = '#5d4352';
  ctx.fillRect(chX, roofTop + 4, 38, 40);
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  ctx.fillRect(chX, roofTop + 4, 9, 40);
  ctx.fillStyle = '#3a2c38';
  ctx.fillRect(chX - 5, roofTop - 4, 48, 10);
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  for (let i = 0; i < 4; i++) ctx.fillRect(chX + 2, roofTop + 12 + i * 8, 34, 1);

  // dormer
  const dw = 82;
  const dh = 62;
  const dx = cx - dw / 2;
  const dy = roofTop + (roofBottom - roofTop) * 0.42;
  ctx.fillStyle = '#201b2a';
  ctx.beginPath();
  ctx.moveTo(dx - 8, dy);
  ctx.lineTo(dx + dw + 8, dy);
  ctx.lineTo(dx + dw, dy - 20);
  ctx.lineTo(dx, dy - 20);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = trim;
  rr(ctx, dx + 5, dy + 2, dw - 10, dh, 3);
  ctx.fill();
  const dg = ctx.createLinearGradient(0, dy + 8, 0, dy + dh);
  dg.addColorStop(0, '#ffe8b6');
  dg.addColorStop(1, '#f6a35e');
  ctx.fillStyle = dg;
  ctx.fillRect(dx + 13, dy + 10, dw - 26, dh - 20);
  ctx.strokeStyle = trim;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx, dy + 10);
  ctx.lineTo(cx, dy + dh - 10);
  ctx.moveTo(dx + 13, dy + dh / 2);
  ctx.lineTo(dx + dw - 13, dy + dh / 2);
  ctx.stroke();

  // front wall
  const wallGrad = ctx.createLinearGradient(0, wallTop, 0, base);
  wallGrad.addColorStop(0, '#fff6e9');
  wallGrad.addColorStop(0.12, wall);
  wallGrad.addColorStop(1, '#a8877f');
  ctx.fillStyle = wall;
  rr(ctx, x + 16, wallTop, w - 32, 130, 3);
  ctx.fill();
  ctx.fillStyle = wallGrad;
  ctx.globalAlpha = 0.5;
  rr(ctx, x + 16, wallTop, w - 32, 130, 3);
  ctx.fill();
  ctx.globalAlpha = 1;

  // siding
  ctx.strokeStyle = 'rgba(70,55,55,0.11)';
  ctx.lineWidth = 1;
  for (let sy = wallTop + 8; sy < base; sy += 9) {
    ctx.beginPath();
    ctx.moveTo(x + 18, sy);
    ctx.lineTo(x + w - 18, sy);
    ctx.stroke();
  }

  // corner boards
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  rr(ctx, x + 16, wallTop, 9, 130, 2);
  ctx.fill();
  rr(ctx, x + w - 25, wallTop, 9, 130, 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(x + 16, base - 7, w - 32, 7);

  // door
  const doorW = 66;
  const doorH = 104;
  const doorX = cx - doorW / 2;
  const doorY = base - doorH;
  ctx.fillStyle = trim;
  rr(ctx, doorX - 7, doorY - 7, doorW + 14, doorH + 7, 5);
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.24)';
  rr(ctx, doorX - 3, doorY - 3, doorW + 6, doorH + 3, 4);
  ctx.fill();
  ctx.fillStyle = door;
  rr(ctx, doorX, doorY, doorW, doorH, 4);
  ctx.fill();
  const doorGlass = ctx.createLinearGradient(0, doorY + 10, 0, doorY + 42);
  doorGlass.addColorStop(0, 'rgba(255,230,180,0.7)');
  doorGlass.addColorStop(1, 'rgba(120,90,70,0.4)');
  ctx.fillStyle = doorGlass;
  rr(ctx, doorX + 9, doorY + 11, doorW - 18, 30, 3);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(doorX + 9, doorY + 26);
  ctx.lineTo(doorX + doorW - 9, doorY + 26);
  ctx.stroke();
  ctx.fillStyle = '#ffd27a';
  ctx.beginPath();
  ctx.arc(doorX + doorW - 13, doorY + doorH * 0.62, 3, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.2)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(doorX + 8, doorY + 78);
  ctx.lineTo(doorX + doorW - 8, doorY + 78);
  ctx.stroke();

  // windows
  const winW = 56;
  const winH = 52;
  const wy = wallTop + 30;
  for (const wx of [x + 42, x + w - 42 - winW]) {
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    rr(ctx, wx - 5, wy - 5, winW + 10, winH + 10, 4);
    ctx.fill();
    ctx.fillStyle = trim;
    rr(ctx, wx - 3, wy - 3, winW + 6, winH + 6, 3);
    ctx.fill();
    const glow = ctx.createLinearGradient(wx, wy, wx, wy + winH);
    glow.addColorStop(0, '#ffebbe');
    glow.addColorStop(0.55, '#ffce85');
    glow.addColorStop(1, '#f79b52');
    ctx.fillStyle = glow;
    ctx.fillRect(wx + 3, wy + 3, winW - 6, winH - 6);
    ctx.strokeStyle = trim;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(wx + winW / 2, wy + 3);
    ctx.lineTo(wx + winW / 2, wy + winH - 3);
    ctx.moveTo(wx + 3, wy + winH / 2);
    ctx.lineTo(wx + winW - 3, wy + winH / 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath();
    ctx.moveTo(wx + 7, wy + winH - 8);
    ctx.lineTo(wx + 21, wy + 7);
    ctx.lineTo(wx + 29, wy + 7);
    ctx.lineTo(wx + 15, wy + winH - 8);
    ctx.closePath();
    ctx.fill();
    // sill
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(wx - 6, wy + winH + 4, winW + 12, 4);
    ctx.fillStyle = trim;
    ctx.fillRect(wx - 6, wy + winH + 1, winW + 12, 4);
    // light bleed
    const bleed = ctx.createRadialGradient(wx + winW / 2, wy + winH / 2, 4, wx + winW / 2, wy + winH / 2, 110);
    bleed.addColorStop(0, 'rgba(255,190,110,0.26)');
    bleed.addColorStop(1, 'rgba(255,190,110,0)');
    ctx.fillStyle = bleed;
    ctx.beginPath();
    ctx.arc(wx + winW / 2, wy + winH / 2, 110, 0, TAU);
    ctx.fill();
  }

  // porch lamp
  ctx.fillStyle = '#ffdf9e';
  ctx.beginPath();
  ctx.arc(cx, wallTop + 12, 4.2, 0, TAU);
  ctx.fill();
  const porch = ctx.createRadialGradient(cx, wallTop + 12, 2, cx, wallTop + 12, 32);
  porch.addColorStop(0, 'rgba(255,214,140,0.55)');
  porch.addColorStop(1, 'rgba(255,214,140,0)');
  ctx.fillStyle = porch;
  ctx.beginPath();
  ctx.arc(cx, wallTop + 12, 32, 0, TAU);
  ctx.fill();

  // steps
  ctx.fillStyle = '#a89f90';
  rr(ctx, doorX - 13, base, doorW + 26, 11, 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  ctx.fillRect(doorX - 13, base, doorW + 26, 3);
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.fillRect(doorX - 13, base + 7, doorW + 26, 4);

  // house number
  ctx.fillStyle = 'rgba(255,255,255,0.72)';
  ctx.font = '800 12px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${Math.round(h.drive / 4)}`, cx, wallTop + 18);

  // foundation bushes
  for (const [bx, br] of [[x + 34, 24], [x + w - 34, 26], [x + w * 0.31, 17]]) {
    ctx.fillStyle = 'rgba(10,18,14,0.25)';
    ctx.beginPath();
    ctx.ellipse(bx, base + 2, br + 4, 8, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#2f4d37';
    ctx.beginPath();
    ctx.arc(bx - br * 0.35, base - br * 0.5, br * 0.65, 0, TAU);
    ctx.arc(bx + br * 0.3, base - br * 0.6, br * 0.6, 0, TAU);
    ctx.arc(bx, base - br * 0.95, br * 0.6, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#3c6044';
    ctx.beginPath();
    ctx.arc(bx - br * 0.25, base - br * 1.1, br * 0.34, 0, TAU);
    ctx.arc(bx + br * 0.35, base - br * 0.75, br * 0.3, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(190,220,160,0.16)';
    ctx.beginPath();
    ctx.arc(bx - br * 0.3, base - br * 1.3, br * 0.18, 0, TAU);
    ctx.fill();
  }

  // warm window bloom
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const wx of [x + 42, x + w - 42 - winW]) {
    const g2 = ctx.createRadialGradient(wx + winW / 2, wy + winH / 2, 6, wx + winW / 2, wy + winH / 2, 140);
    g2.addColorStop(0, 'rgba(255,180,105,0.17)');
    g2.addColorStop(1, 'rgba(255,180,105,0)');
    ctx.fillStyle = g2;
    ctx.beginPath();
    ctx.arc(wx + winW / 2, wy + winH / 2, 140, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function drawTree(ctx, p, t) {
  const s = p.s;
  const sway = Math.sin(t * 0.8 + p.x * 0.01) * 2.6 * s;
  ctx.fillStyle = 'rgba(8,14,18,0.32)';
  ctx.beginPath();
  ctx.ellipse(p.x + 8, p.y + 2, 46 * s, 15 * s, 0, 0, TAU);
  ctx.fill();

  // trunk
  const trunk = ctx.createLinearGradient(p.x - 8 * s, 0, p.x + 8 * s, 0);
  trunk.addColorStop(0, '#3c2a1e');
  trunk.addColorStop(0.4, '#6a4a33');
  trunk.addColorStop(1, '#4a3325');
  ctx.fillStyle = trunk;
  ctx.beginPath();
  ctx.moveTo(p.x - 9 * s, p.y + 1);
  ctx.quadraticCurveTo(p.x - 6 * s, p.y - 30 * s, p.x - 4 * s, p.y - 60 * s);
  ctx.lineTo(p.x + 4 * s, p.y - 60 * s);
  ctx.quadraticCurveTo(p.x + 6 * s, p.y - 30 * s, p.x + 9 * s, p.y + 1);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(p.x - 1 * s, p.y - 8 * s);
  ctx.quadraticCurveTo(p.x - 2 * s, p.y - 34 * s, p.x + 1 * s, p.y - 56 * s);
  ctx.stroke();

  // canopy silhouette
  ctx.fillStyle = '#24402f';
  ctx.beginPath();
  ctx.arc(p.x + sway, p.y - 96 * s, 52 * s, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#2e5039';
  ctx.beginPath();
  ctx.arc(p.x - 26 * s + sway, p.y - 88 * s, 34 * s, 0, TAU);
  ctx.arc(p.x + 28 * s + sway, p.y - 84 * s, 32 * s, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#386044';
  ctx.beginPath();
  ctx.arc(p.x - 14 * s + sway, p.y - 108 * s, 38 * s, 0, TAU);
  ctx.arc(p.x + 26 * s + sway, p.y - 102 * s, 30 * s, 0, TAU);
  ctx.fill();

  // lit crowns
  ctx.fillStyle = '#47774f';
  ctx.beginPath();
  ctx.arc(p.x - 18 * s + sway, p.y - 124 * s, 27 * s, 0, TAU);
  ctx.arc(p.x + 24 * s + sway, p.y - 116 * s, 20 * s, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#548656';
  ctx.beginPath();
  ctx.arc(p.x - 10 * s + sway, p.y - 132 * s, 19 * s, 0, TAU);
  ctx.fill();

  // leaf speckles
  ctx.fillStyle = 'rgba(160,200,140,0.24)';
  for (let i = 0; i < 14; i++) {
    const a = (p.x * 0.7 + i * 2.4) % TAU;
    const r = ((p.y + i * 37) % 30) * s;
    ctx.beginPath();
    ctx.arc(
      p.x + Math.cos(a) * r + sway * 0.6,
      p.y - 118 * s + Math.sin(a) * r * 0.7,
      1.6 * s, 0, TAU,
    );
    ctx.fill();
  }
}

function drawLamp(ctx, p) {
  ctx.fillStyle = 'rgba(10,16,24,0.3)';
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + 2, 20, 7, 0, 0, TAU);
  ctx.fill();

  ctx.fillStyle = '#232a3a';
  rr(ctx, p.x - 7, p.y - 14, 14, 14, 4);
  ctx.fill();
  ctx.fillStyle = '#2d3549';
  rr(ctx, p.x - 3, p.y - 108, 6, 100, 3);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  rr(ctx, p.x - 3, p.y - 108, 2, 96, 2);
  ctx.fill();
  ctx.strokeStyle = '#2d3549';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(p.x, p.y - 104);
  ctx.quadraticCurveTo(p.x + 20, p.y - 112, p.x + 24, p.y - 96);
  ctx.stroke();

  ctx.fillStyle = '#38425c';
  ctx.beginPath();
  ctx.moveTo(p.x + 14, p.y - 96);
  ctx.lineTo(p.x + 34, p.y - 96);
  ctx.lineTo(p.x + 30, p.y - 84);
  ctx.lineTo(p.x + 18, p.y - 84);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ffe6ae';
  ctx.beginPath();
  ctx.ellipse(p.x + 24, p.y - 86, 7, 4, 0, 0, TAU);
  ctx.fill();
}

function drawBench(ctx, p, t) {
  ctx.save();
  const cx = PARK.x;
  const cy = PARK.y;
  const rot = Math.atan2(cy - p.y, cx - p.x) + Math.PI / 2;
  ctx.translate(p.x, p.y);
  ctx.rotate(rot);
  ctx.fillStyle = 'rgba(10,16,20,0.26)';
  ctx.beginPath();
  ctx.ellipse(0, 8, 46, 12, 0, 0, TAU);
  ctx.fill();

  ctx.fillStyle = '#4b3b2e';
  rr(ctx, -38, -2, 7, 14, 2);
  ctx.fill();
  rr(ctx, 31, -2, 7, 14, 2);
  ctx.fill();

  ctx.fillStyle = '#8a6748';
  for (let i = 0; i < 3; i++) {
    rr(ctx, -44, -8 + i * 7, 88, 5, 2);
    ctx.fill();
  }
  ctx.fillStyle = '#9c7752';
  for (let i = 0; i < 2; i++) {
    rr(ctx, -44, -40 + i * 9, 88, 6, 2);
    ctx.fill();
  }
  ctx.fillStyle = '#4b3b2e';
  rr(ctx, -42, -36, 6, 30, 2);
  ctx.fill();
  rr(ctx, 36, -36, 6, 30, 2);
  ctx.fill();
  ctx.restore();
}

function drawCar(ctx, p) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rot);

  ctx.fillStyle = 'rgba(8,12,20,0.34)';
  ctx.beginPath();
  ctx.ellipse(2, 15, 58, 17, 0, 0, TAU);
  ctx.fill();

  // wheels
  ctx.fillStyle = '#15171e';
  for (const [wx, wy] of [[-32, -24], [18, -24], [-32, 18], [18, 18]]) {
    rr(ctx, wx, wy, 16, 9, 3);
    ctx.fill();
  }

  // body
  const body = ctx.createLinearGradient(0, -22, 0, 22);
  body.addColorStop(0, '#ffffff');
  body.addColorStop(0.14, p.body);
  body.addColorStop(0.85, p.body);
  body.addColorStop(1, '#1b1f29');
  ctx.fillStyle = body;
  rr(ctx, -52, -19, 104, 38, 13);
  ctx.fill();

  // cabin
  ctx.fillStyle = '#1a2433';
  rr(ctx, -26, -15, 52, 31, 9);
  ctx.fill();
  ctx.fillStyle = 'rgba(155,200,235,0.62)';
  rr(ctx, -22, -12, 21, 25, 5);
  ctx.fill();
  rr(ctx, 3, -12, 19, 25, 5);
  ctx.fill();
  // window shine
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.moveTo(-18, -10);
  ctx.lineTo(-10, -10);
  ctx.lineTo(-16, 4);
  ctx.lineTo(-22, 4);
  ctx.closePath();
  ctx.fill();

  // lights
  ctx.fillStyle = '#ffe8ae';
  rr(ctx, -55, -14, 5, 9, 2);
  ctx.fill();
  rr(ctx, -55, 5, 5, 9, 2);
  ctx.fill();
  ctx.fillStyle = '#ff9b9b';
  rr(ctx, 50, -14, 5, 9, 2);
  ctx.fill();
  rr(ctx, 50, 5, 5, 9, 2);
  ctx.fill();

  // roof highlight
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  rr(ctx, -46, -16, 92, 5, 2.5);
  ctx.fill();

  ctx.restore();
}

function drawMailbox(ctx, p) {
  ctx.fillStyle = 'rgba(10,14,20,0.24)';
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + 4, 12, 4, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#5a4a3c';
  rr(ctx, p.x - 2, p.y - 26, 4, 28, 2);
  ctx.fill();
  ctx.fillStyle = '#c25a58';
  rr(ctx, p.x - 11, p.y - 34, 22, 14, 6);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  rr(ctx, p.x - 9, p.y - 32, 18, 4, 2);
  ctx.fill();
  ctx.fillStyle = '#e8e2d2';
  rr(ctx, p.x + 9, p.y - 30, 3, 9, 1);
  ctx.fill();
}

function drawHedge(ctx, p) {
  ctx.fillStyle = 'rgba(10,18,14,0.24)';
  ctx.beginPath();
  ctx.ellipse(p.x + p.w / 2, p.y + p.h + 2, p.w / 2 + 6, 8, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#2f4a35';
  rr(ctx, p.x, p.y, p.w, p.h, 8);
  ctx.fill();
  for (let i = 0; i < p.w; i += 17) {
    ctx.fillStyle = i % 34 === 0 ? '#3a5a40' : '#345239';
    ctx.beginPath();
    ctx.arc(p.x + i + 8, p.y + 2, 10 + (i % 3), 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(200,225,170,0.14)';
  for (let i = 0; i < p.w; i += 23) {
    ctx.beginPath();
    ctx.arc(p.x + i + 5, p.y - 1, 5, 0, TAU);
    ctx.fill();
  }
}

function drawFountain(ctx, p, t) {
  const x = p.x;
  const y = p.y;
  ctx.fillStyle = 'rgba(10,16,24,0.28)';
  ctx.beginPath();
  ctx.ellipse(x, y + 52, 122, 34, 0, 0, TAU);
  ctx.fill();

  // basin
  const rim = ctx.createLinearGradient(x, y - 50, x, y + 50);
  rim.addColorStop(0, '#d8d1c1');
  rim.addColorStop(0.5, '#b3aa98');
  rim.addColorStop(1, '#8b8271');
  ctx.fillStyle = rim;
  ctx.beginPath();
  ctx.ellipse(x, y, 118, 52, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#9b9382';
  ctx.beginPath();
  ctx.ellipse(x, y + 4, 106, 44, 0, 0, TAU);
  ctx.fill();

  // water
  const water = ctx.createRadialGradient(x - 20, y - 12, 8, x, y, 100);
  water.addColorStop(0, 'rgba(150,235,230,0.95)');
  water.addColorStop(0.55, 'rgba(62,150,168,0.95)');
  water.addColorStop(1, 'rgba(28,78,104,0.98)');
  ctx.fillStyle = water;
  ctx.beginPath();
  ctx.ellipse(x, y + 4, 98, 39, 0, 0, TAU);
  ctx.fill();

  // ripples
  for (let i = 0; i < 3; i++) {
    const phase = (t * 0.32 + i / 3) % 1;
    ctx.strokeStyle = `rgba(210,255,250,${0.32 * (1 - phase)})`;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(x, y + 4, 26 + phase * 70, 9 + phase * 27, 0, 0, TAU);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(200,255,245,0.5)';
  for (let i = 0; i < 5; i++) {
    const a = t * 0.6 + i * 1.3;
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * (28 + i * 12), y + Math.sin(a) * (10 + i * 5) + 4, 1.6, 0, TAU);
    ctx.fill();
  }

  // pedestal and bowl
  ctx.fillStyle = '#b9b1a0';
  rr(ctx, x - 13, y - 46, 26, 48, 5);
  ctx.fill();
  ctx.fillStyle = '#8f8776';
  rr(ctx, x + 5, y - 46, 8, 48, 4);
  ctx.fill();
  ctx.fillStyle = '#cfc7b6';
  ctx.beginPath();
  ctx.ellipse(x, y - 50, 44, 15, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#8e8675';
  ctx.beginPath();
  ctx.ellipse(x, y - 51, 36, 10, 0, 0, TAU);
  ctx.fill();

  // water jet
  ctx.strokeStyle = 'rgba(190,245,245,0.55)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x, y - 54);
  ctx.quadraticCurveTo(x - 26, y - 96, x - 42, y - 62);
  ctx.moveTo(x, y - 54);
  ctx.quadraticCurveTo(x + 26, y - 96, x + 42, y - 62);
  ctx.stroke();
  ctx.fillStyle = 'rgba(215,255,252,0.75)';
  ctx.beginPath();
  ctx.ellipse(x, y - 58, 5, 8 + Math.sin(t * 4) * 2, 0, 0, TAU);
  ctx.fill();

  // lily pads
  ctx.fillStyle = '#4f8a5b';
  for (const [dx, dy, r] of [[-52, 16, 11], [46, 22, 9]]) {
    ctx.beginPath();
    ctx.arc(x + dx, y + dy, r, 0.4, TAU - 0.4);
    ctx.lineTo(x + dx, y + dy);
    ctx.fill();
  }
}

function drawSign(ctx) {
  ctx.fillStyle = 'rgba(10,14,20,0.24)';
  ctx.beginPath();
  ctx.ellipse(1390, 1166, 46, 9, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#6a5038';
  ctx.fillRect(1360, 1120, 7, 48);
  ctx.fillRect(1414, 1120, 7, 48);
  ctx.fillStyle = '#8a6a49';
  rr(ctx, 1348, 1104, 84, 34, 5);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = '#ffe9c4';
  ctx.font = '700 8px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('BROOKHAVEN', 1390, 1118);
  ctx.font = '600 6.5px "Segoe UI", system-ui, sans-serif';
  ctx.fillStyle = '#d8c7a6';
  ctx.fillText('PARK', 1390, 1128);
}

function drawGift(ctx, p, t) {
  const bob = Math.sin(t * 2 + p.idx) * 3;
  const glow = ctx.createRadialGradient(p.x, p.y - 16 + bob, 2, p.x, p.y - 16 + bob, 42);
  glow.addColorStop(0, 'rgba(255,240,200,0.34)');
  glow.addColorStop(1, 'rgba(255,220,160,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(p.x, p.y - 16 + bob, 42, 0, TAU);
  ctx.fill();

  ctx.fillStyle = 'rgba(10,16,20,0.2)';
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + 2, 16, 5, 0, 0, TAU);
  ctx.fill();

  ctx.strokeStyle = '#4d7a4e';
  ctx.lineWidth = 2;
  for (const dx of [-6, 0, 6]) {
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.quadraticCurveTo(p.x + dx * 0.6, p.y - 16 + bob, p.x + dx, p.y - 28 + bob);
    ctx.stroke();
  }
  for (const [dx, dy, r] of [[-9, -30, 6], [0, -35, 7], [9, -29, 6], [-4, -24, 5], [5, -23, 5]]) {
    ctx.fillStyle = p.hue;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU;
      ctx.beginPath();
      ctx.arc(p.x + dx + Math.cos(a) * r * 0.7, p.y + dy + bob + Math.sin(a) * r * 0.7, r * 0.6, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = '#fff3c4';
    ctx.beginPath();
    ctx.arc(p.x + dx, p.y + dy + bob, r * 0.45, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.arc(p.x + 12, p.y - 34 + bob, 1.6, 0, TAU);
  ctx.fill();
}

function drawHydrant(ctx, p) {
  ctx.fillStyle = 'rgba(10,16,20,0.24)';
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + 2, 13, 5, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#b8483f';
  rr(ctx, p.x - 7, p.y - 26, 14, 26, 5);
  ctx.fill();
  ctx.fillStyle = '#d86055';
  rr(ctx, p.x - 9, p.y - 20, 18, 7, 3);
  ctx.fill();
  ctx.fillStyle = '#8f342e';
  rr(ctx, p.x - 6, p.y - 30, 12, 7, 3);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  rr(ctx, p.x - 5, p.y - 24, 3, 18, 1.5);
  ctx.fill();
}

function drawBin(ctx, p) {
  ctx.fillStyle = 'rgba(10,16,20,0.24)';
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + 3, 17, 6, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#3f5b57';
  rr(ctx, p.x - 14, p.y - 30, 28, 32, 6);
  ctx.fill();
  ctx.fillStyle = '#4f7069';
  rr(ctx, p.x - 16, p.y - 34, 32, 8, 4);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(p.x - 10, p.y - 24);
  ctx.lineTo(p.x - 10, p.y - 4);
  ctx.moveTo(p.x, p.y - 24);
  ctx.lineTo(p.x, p.y - 4);
  ctx.moveTo(p.x + 10, p.y - 24);
  ctx.lineTo(p.x + 10, p.y - 4);
  ctx.stroke();
}

function drawPicnic(ctx, p) {
  ctx.fillStyle = 'rgba(10,16,20,0.2)';
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + 8, 58, 20, 0, 0, TAU);
  ctx.fill();

  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(-0.08);
  // blanket
  ctx.fillStyle = '#d9617a';
  rr(ctx, -54, -26, 108, 52, 8);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.24)';
  for (let x = -44; x < 54; x += 24) {
    for (let y = -20; y < 22; y += 20) {
      ctx.fillRect(x + (y % 40 === 0 ? 12 : 0), y, 12, 10);
    }
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;
  rr(ctx, -54, -26, 108, 52, 8);
  ctx.stroke();

  // basket
  ctx.fillStyle = '#b98b55';
  rr(ctx, 12, -24, 30, 20, 4);
  ctx.fill();
  ctx.fillStyle = '#8d6539';
  rr(ctx, 8, -28, 38, 8, 4);
  ctx.fill();
  ctx.strokeStyle = '#7a552f';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(27, -26, 9, Math.PI, TAU);
  ctx.stroke();

  // plates and fruit
  ctx.fillStyle = '#f3ecdc';
  ctx.beginPath();
  ctx.ellipse(-30, 4, 12, 7, 0, 0, TAU);
  ctx.ellipse(-6, 14, 9, 5, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#e0564e';
  ctx.beginPath();
  ctx.arc(-30, 2, 3.4, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#7fbf62';
  ctx.beginPath();
  ctx.arc(-4, 12, 3, 0, TAU);
  ctx.fill();
  ctx.restore();
}

export function drawProp(ctx, p, t) {
  switch (p.kind) {
    case 'house': return drawHouse(ctx, p, t);
    case 'tree': return drawTree(ctx, p, t);
    case 'lamp': return drawLamp(ctx, p, t);
    case 'bench': return drawBench(ctx, p, t);
    case 'car': return drawCar(ctx, p, t);
    case 'mailbox': return drawMailbox(ctx, p, t);
    case 'hedge': return drawHedge(ctx, p, t);
    case 'fountain': return drawFountain(ctx, p, t);
    case 'sign': return drawSign(ctx, p, t);
    case 'gift': return drawGift(ctx, p, t);
    case 'hydrant': return drawHydrant(ctx, p);
    case 'bin': return drawBin(ctx, p);
    case 'picnic': return drawPicnic(ctx, p);
    default: return undefined;
  }
}

/* ------------------------------------------------------------------ glow */

export function drawLampGlow(ctx, x, y, t) {
  const flicker = 0.94 + Math.sin(t * 5 + x) * 0.04;
  const bx = x + 24;
  const by = y - 86;

  const halo = ctx.createRadialGradient(bx, by, 2, bx, by, 74);
  halo.addColorStop(0, `rgba(255,232,180,${0.5 * flicker})`);
  halo.addColorStop(0.35, `rgba(255,196,120,${0.16 * flicker})`);
  halo.addColorStop(1, 'rgba(255,180,100,0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(bx, by, 74, 0, TAU);
  ctx.fill();

  // warm pool on the pavement
  ctx.save();
  ctx.translate(bx, y - 2);
  ctx.scale(1, 0.42);
  const pool = ctx.createRadialGradient(0, 0, 6, 0, 0, 132);
  pool.addColorStop(0, `rgba(255,204,132,${0.26 * flicker})`);
  pool.addColorStop(0.55, `rgba(255,184,104,${0.11 * flicker})`);
  pool.addColorStop(1, 'rgba(255,180,100,0)');
  ctx.fillStyle = pool;
  ctx.beginPath();
  ctx.arc(0, 0, 132, 0, TAU);
  ctx.fill();
  ctx.restore();
}

export function drawBeacon(ctx, x, y, t, color = '255,140,180') {
  const pulse = 0.5 + Math.sin(t * 2.6) * 0.35;
  const g = ctx.createLinearGradient(0, y - 168, 0, y - 8);
  g.addColorStop(0, `rgba(${color},0)`);
  g.addColorStop(0.35, `rgba(${color},${0.07 + pulse * 0.05})`);
  g.addColorStop(0.82, `rgba(${color},${0.16 + pulse * 0.08})`);
  g.addColorStop(1, `rgba(${color},${0.26 + pulse * 0.1})`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x - 26, y - 8);
  ctx.lineTo(x - 6, y - 168);
  ctx.lineTo(x + 6, y - 168);
  ctx.lineTo(x + 26, y - 8);
  ctx.closePath();
  ctx.fill();

  // ring at their feet
  ctx.strokeStyle = `rgba(${color},${0.32 + pulse * 0.35})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(x, y, 24 + pulse * 9, 8 + pulse * 3, 0, 0, TAU);
  ctx.stroke();

  // floating heart marker
  const hy = y - 150 + Math.sin(t * 2.6) * 6;
  const halo = ctx.createRadialGradient(x, hy, 2, x, hy, 34);
  halo.addColorStop(0, `rgba(${color},${0.4 + pulse * 0.3})`);
  halo.addColorStop(1, `rgba(${color},0)`);
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(x, hy, 34, 0, TAU);
  ctx.fill();
  ctx.fillStyle = `rgba(${color},${0.8 + pulse * 0.2})`;
  heartPath(ctx, x, hy - 8, 1.45);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 1;
  ctx.stroke();
}
