/* ==========================================================================
   DER LETZTE SCHULTAG – Figuren
   ========================================================================== */
(() => {
'use strict';
const S = window.SG;
const ctx = S.ctx;
const OUT = S.OUT, DISPLAY = S.DISPLAY;

// --------------------------------------------------------------------------
// Schülerin / Schüler
// --------------------------------------------------------------------------
function drawKid(x, y, s = 1, o = {}) {
  const t = o.time ?? S.time;
  const facing = o.facing ?? 1;
  const pose = o.pose ?? 'stand';
  const walk = o.walk ?? 0;
  const skin = o.skin ?? '#f0bd87';
  const shirt = o.shirt ?? '#f4b942';
  const pants = o.pants ?? '#3f6fb5';
  const hair = o.hair ?? '#553a29';
  const shoe = o.shoe ?? '#2c2433';
  const pack = o.pack ?? '#d1495b';
  const lw = o.lw ?? 2.8;

  ctx.save();
  ctx.translate(x, y);
  if (facing < 0) ctx.scale(-1, 1);
  ctx.scale(s, s);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';

  if (o.shadow !== false) {
    ctx.save(); ctx.scale(1 / (s || 1), 1 / (s || 1));
    ctx.fillStyle = 'rgba(20,14,28,.17)';
    ctx.beginPath(); ctx.ellipse(0, 2, 30 * s, 7 * s, 0, 0, S.TAU); ctx.fill();
    ctx.restore();
  }

  const bob = pose === 'run' ? Math.abs(Math.sin(walk * 9)) * 3.5
    : pose === 'cheer' ? Math.abs(Math.sin(t * 6 + (o.phase || 0))) * 9
    : pose === 'hurt' ? 1.5 : Math.sin(t * 2.2 + (o.phase || 0)) * 1.1;
  ctx.translate(0, -bob);

  const limb = (x1, y1, x2, y2, color, w) => {
    S.line(x1, y1, x2, y2, OUT, w + 2.5);
    S.line(x1, y1, x2, y2, color, w);
  };

  // Rucksack
  if (o.backpack !== false) {
    S.fillRR(-29, -90, 22, 43, 8, pack, OUT, lw);
    S.fillRR(-25, -82, 14, 9, 4, 'rgba(255,255,255,.35)', null);
    S.line(-8, -80, 1, -61, OUT, 2.4);
    S.fillRR(-31, -78, 5, 15, 2.5, '#b23a4c', OUT, 1.6);
  }

  const swing = pose === 'run' ? Math.sin(walk * 9) * 14 : 0;
  const legColor = o.shorts ? skin : pants;

  if (pose === 'sit') {
    limb(-8, -44, -1, -18, legColor, 11);
    limb(8, -44, 22, -20, legColor, 11);
    S.fillRR(-4, -21, 18, 7, 3, shoe, OUT, 1.8);
    S.fillRR(19, -23, 18, 7, 3, shoe, OUT, 1.8);
  } else {
    limb(-8, -44, -9 - swing, -4, legColor, 11);
    limb(8, -44, 10 + swing, -4, legColor, 11);
    S.fillRR(-18 - swing, -8, 19, 8, 4, shoe, OUT, 1.8);
    S.fillRR(4 + swing, -8, 19, 8, 4, shoe, OUT, 1.8);
  }

  // Oberkörper neigt sich beim Rennen nach vorn
  const lean = pose === 'run' ? .085 : 0;
  if (lean) { ctx.save(); ctx.translate(0, -45); ctx.rotate(lean); ctx.translate(0, 45); }

  // Körper
  S.fillRR(-20, -92, 41, 52, 13, shirt, OUT, lw);
  if (o.stripe) {
    ctx.save(); S.rr(-20, -92, 41, 52, 13); ctx.clip();
    ctx.fillStyle = o.stripe;
    for (let i = 0; i < 5; i++) ctx.fillRect(-22, -84 + i * 11, 46, 5);
    ctx.restore();
  }
  // Kragen
  ctx.fillStyle = '#fff8ea';
  ctx.beginPath(); ctx.moveTo(-6, -91); ctx.lineTo(3, -82); ctx.lineTo(12, -91); ctx.closePath(); ctx.fill();

  // Arme
  let lh = [-27, -58], rh = [27, -58];
  if (pose === 'run') {
    const sw = Math.sin(walk * 9) * 16;
    lh = [-8 - sw, -66]; rh = [8 + sw, -66];
  } else if (pose === 'fly' || pose === 'hurt') {
    lh = [-37, -85]; rh = [39, -88];
  } else if (pose === 'cheer') {
    lh = [-30, -118]; rh = [31, -119];
  } else if (pose === 'point') {
    lh = [-24, -58]; rh = [52, -92];
  } else if (pose === 'wave') {
    lh = [-26, -58]; rh = [30, -119];
  }
  limb(-17, -84, lh[0], lh[1], shirt, 9);
  limb(17, -84, rh[0], rh[1], shirt, 9);
  S.circle(lh[0], lh[1], 5.6, skin, OUT, 2);
  S.circle(rh[0], rh[1], 5.6, skin, OUT, 2);

  // Kopf
  const hx = 3, hy = -113;
  S.circle(hx, hy, 22.5, skin, OUT, lw);
  S.circle(hx - 20, hy + 3, 5, skin, OUT, 2);

  // Haare
  ctx.save();
  ctx.beginPath(); ctx.arc(hx, hy, 22.5, 0, S.TAU); ctx.clip();
  ctx.fillStyle = hair;
  ctx.beginPath(); ctx.ellipse(hx, hy - 15, 25, 15, -.08, 0, S.TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(hx - 8, hy - 8, 15, 10, -.5, 0, S.TAU); ctx.fill();
  if (o.hairStyle === 'curly') {
    for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(hx - 18 + i * 9, hy - 18 + (i % 2) * 5, 7, 0, S.TAU); ctx.fill(); }
  }
  ctx.restore();
  if (o.hairStyle === 'ponytail') {
    S.circle(hx - 25, hy - 6, 9, hair, OUT, 2.4);
    S.circle(hx - 29, hy + 5, 7, hair, OUT, 2.2);
  }
  if (o.hairStyle === 'cap') {
    S.fillRR(hx - 24, hy - 24, 44, 15, 7, o.capColor ?? '#3f88c5', OUT, 2.4);
    S.fillRR(hx + 14, hy - 16, 20, 6, 3, o.capColor ?? '#3f88c5', OUT, 2.2);
  }

  // Gesicht
  const eyes = o.eyes ?? 'open';
  const ex1 = hx + 7, ex2 = hx + 17, ey = hy - 1;
  if (eyes === 'x') {
    for (const ex of [ex1, ex2]) { S.line(ex - 4, ey - 4, ex + 4, ey + 4, OUT, 2.6); S.line(ex + 4, ey - 4, ex - 4, ey + 4, OUT, 2.6); }
  } else if (eyes === 'happy') {
    ctx.beginPath(); ctx.arc(ex1, ey + 2, 4.5, Math.PI * 1.1, Math.PI * 1.9); ctx.strokeStyle = OUT; ctx.lineWidth = 2.4; ctx.stroke();
    ctx.beginPath(); ctx.arc(ex2, ey + 2, 4.5, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
  } else if (eyes === 'wide' || eyes === 'shock') {
    S.circle(ex1, ey, 5.6, '#fff', OUT, 2); S.circle(ex2, ey, 5.6, '#fff', OUT, 2);
    S.circle(ex1 + 1.3, ey + .4, 2.2, OUT); S.circle(ex2 + 1.3, ey + .4, 2.2, OUT);
  } else if (eyes === 'angry') {
    S.circle(ex1, ey + .5, 2.5, OUT); S.circle(ex2, ey + .5, 2.5, OUT);
    S.line(ex1 - 5, ey - 6, ex1 + 4, ey - 3, OUT, 2.6);
    S.line(ex2 + 5, ey - 6, ex2 - 4, ey - 3, OUT, 2.6);
  } else {
    S.circle(ex1, ey, 2.5, OUT); S.circle(ex2, ey, 2.5, OUT);
    S.circle(ex1 - .8, ey - .8, .8, '#fff'); S.circle(ex2 - .8, ey - .8, .8, '#fff');
  }

  const mouth = o.mouth ?? 'smile';
  if (mouth === 'smile' || mouth === 'grin') {
    ctx.beginPath(); ctx.moveTo(hx + 5, hy + 8); ctx.quadraticCurveTo(hx + 12, hy + 15, hx + 19, hy + 7);
    ctx.strokeStyle = OUT; ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.stroke();
  } else if (mouth === 'o' || mouth === 'shock') {
    S.circle(hx + 12, hy + 11, 4, '#7b3440', OUT, 2);
  } else if (mouth === 'frown') {
    ctx.beginPath(); ctx.moveTo(hx + 5, hy + 13); ctx.quadraticCurveTo(hx + 12, hy + 6, hx + 19, hy + 13);
    ctx.strokeStyle = OUT; ctx.lineWidth = 2.4; ctx.stroke();
  } else {
    S.line(hx + 6, hy + 11, hx + 18, hy + 11, OUT, 2.2);
  }

  if (o.blush) {
    ctx.fillStyle = 'rgba(228,87,46,.32)';
    ctx.beginPath(); ctx.ellipse(hx + 3, hy + 7, 5, 3, 0, 0, S.TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(hx + 20, hy + 7, 5, 3, 0, 0, S.TAU); ctx.fill();
  }
  if (o.sweat) {
    ctx.fillStyle = '#8fd8ef'; ctx.strokeStyle = OUT; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(hx + 24, hy - 9); ctx.quadraticCurveTo(hx + 29, hy - 1, hx + 24, hy + 2);
    ctx.quadraticCurveTo(hx + 19, hy - 1, hx + 24, hy - 9); ctx.fill(); ctx.stroke();
  }
  if (o.bandage) {
    ctx.save(); ctx.translate(hx + 4, hy - 11); ctx.rotate(-.25);
    S.fillRR(-13, -5, 27, 10, 3, '#fff8ea', OUT, 2);
    S.line(-2, -3, -2, 3, '#e4572e', 2); S.line(-5, 0, 1, 0, '#e4572e', 2);
    ctx.restore();
  }
  if (lean) ctx.restore();
  ctx.restore();
}

// --------------------------------------------------------------------------
// Herr Müller
// --------------------------------------------------------------------------
function drawTeacher(x, y, s = 1.12, o = {}) {
  const t = o.time ?? S.time;
  const facing = o.facing ?? 1;
  const pose = o.pose ?? 'stand';
  const anger = o.anger ?? 0;
  const skin = o.green ? '#9fd6a4' : (o.pale ? '#efd3b0' : '#efc59a');
  const cardigan = o.cardigan ?? '#8c6047';
  const cardiganDark = '#744b37';
  const shirt = '#f4e7cd';
  const tie = '#c8392f';
  const lw = 3;

  ctx.save();
  ctx.translate(x, y);
  if (facing < 0) ctx.scale(-1, 1);
  ctx.scale(s, s);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';

  if (o.shadow !== false) {
    ctx.fillStyle = 'rgba(20,14,28,.18)';
    ctx.beginPath(); ctx.ellipse(0, 2, 36, 8, 0, 0, S.TAU); ctx.fill();
  }

  const walk = o.walk ?? 0;
  const run = pose === 'charge';
  const bob = run ? Math.abs(Math.sin(walk * 10)) * 4 : Math.sin(t * 1.8) * .9;
  ctx.translate(0, -bob);

  const limb = (x1, y1, x2, y2, color, w) => {
    S.line(x1, y1, x2, y2, OUT, w + 3);
    S.line(x1, y1, x2, y2, color, w);
  };

  // Beine
  const swing = run ? Math.sin(walk * 10) * 19 : 0;
  limb(-10, -50, -13 - swing, -4, '#4c423c', 13);
  limb(10, -50, 13 + swing, -4, '#4c423c', 13);
  S.fillRR(-26 - swing, -9, 24, 10, 4, '#2c2433', OUT, 2);
  S.fillRR(3 + swing, -9, 24, 10, 4, '#2c2433', OUT, 2);

  // Körper
  S.fillRR(-28, -135, 57, 91, 19, cardigan, OUT, lw);
  // Bauch
  ctx.fillStyle = cardiganDark;
  ctx.beginPath(); ctx.ellipse(3, -78, 23, 29, 0, 0, S.TAU); ctx.fill();
  // Hemd
  ctx.fillStyle = shirt;
  ctx.beginPath(); ctx.moveTo(-8, -134); ctx.lineTo(4, -106); ctx.lineTo(16, -134); ctx.closePath(); ctx.fill();
  // Krawatte
  ctx.fillStyle = tie;
  ctx.beginPath(); ctx.moveTo(3, -123); ctx.lineTo(10, -116); ctx.lineTo(7, -94); ctx.lineTo(1, -94); ctx.lineTo(-2, -116); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = OUT; ctx.lineWidth = 1.6; ctx.stroke();
  // Knöpfe
  for (let i = 0; i < 3; i++) S.circle(15, -101 + i * 16, 2.5, '#e8d5b8', OUT, 1.4);
  // Tasche + Flasche
  S.fillRR(-22, -88, 20, 16, 4, cardiganDark, OUT, 2);
  S.fillRR(-19, -104, 9, 18, 3, '#5fcf72', OUT, 1.8);
  S.fillRR(-19, -108, 9, 5, 2, '#3b8d4d', OUT, 1.6);

  // Arme
  let lh = [-31, -78], rh = [32, -78];
  if (pose === 'write') { lh = [-34, -92]; rh = [43, -145]; }
  else if (pose === 'charge') { lh = [-38, -100]; rh = [38, -104]; }
  else if (pose === 'grab') { lh = [-20, -100]; rh = [58, -104]; }
  else if (pose === 'throw') { lh = [-30, -90]; rh = [58, -142]; }
  else if (pose === 'drink') { lh = [-26, -80]; rh = [22, -154]; }
  else if (pose === 'point') { lh = [-30, -80]; rh = [55, -132]; }
  else if (pose === 'shrug') { lh = [-40, -112]; rh = [42, -112]; }

  limb(-23, -124, lh[0], lh[1], cardigan, 13);
  limb(23, -124, rh[0], rh[1], cardigan, 13);
  S.circle(lh[0], lh[1], 7, skin, OUT, 2.2);
  S.circle(rh[0], rh[1], 7, skin, OUT, 2.2);

  if (pose === 'write') {
    S.line(rh[0], rh[1] - 7, rh[0] + 10, rh[1] - 19, '#fff8ea', 4);
    S.line(rh[0] + 10, rh[1] - 19, rh[0] + 11, rh[1] - 23, '#fff8ea', 3);
  }

  // Kopf
  const hx = 4, hy = -161;
  S.fillRR(-5, -145, 19, 15, 6, skin, OUT, 2.5);
  S.circle(hx, hy, 28, skin, OUT, lw);
  S.circle(hx - 27, hy + 4, 6, skin, OUT, 2.2);
  S.circle(hx + 27, hy + 4, 6, skin, OUT, 2.2);

  // Glatze + Seitenhaare
  ctx.fillStyle = '#7d736b';
  ctx.beginPath(); ctx.ellipse(hx - 24, hy - 6, 7, 13, -.22, 0, S.TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(hx + 25, hy - 5, 7, 12, .22, 0, S.TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.25)';
  ctx.beginPath(); ctx.ellipse(hx - 5, hy - 17, 12, 6, -.3, 0, S.TAU); ctx.fill();

  if (o.ghostly) ctx.globalAlpha = .75;
  // Brille
  S.circle(hx + 9, hy - 2, 8, 'rgba(255,255,255,.55)', OUT, 2.6);
  S.circle(hx + 23, hy - 2, 8, 'rgba(255,255,255,.55)', OUT, 2.6);
  S.line(hx + 17, hy - 2, hx + 15, hy - 2, OUT, 2.2);
  S.line(hx + 1, hy - 4, hx - 5, hy - 7, OUT, 2.2);
  S.line(hx + 31, hy - 4, hx + 36, hy - 8, OUT, 2.2);

  // Augen
  const eyesX = o.eyes === 'x';
  if (eyesX) {
    for (const ex of [hx + 9, hx + 23]) { S.line(ex - 5, hy - 7, ex + 5, hy + 3, OUT, 2.8); S.line(ex + 5, hy - 7, ex - 5, hy + 3, OUT, 2.8); }
  } else {
    S.circle(hx + 10, hy - 1, 2.8, OUT);
    S.circle(hx + 22, hy - 1, 2.8, OUT);
    if (o.look !== undefined) {
      ctx.fillStyle = OUT;
      ctx.beginPath(); ctx.arc(hx + 10 + o.look * 2, hy - 1, 2.8, 0, S.TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(hx + 22 + o.look * 2, hy - 1, 2.8, 0, S.TAU); ctx.fill();
    }
  }

  // Brauen
  S.line(hx + 3, hy - 12 - anger * 2, hx + 14, hy - 9 + anger * 4, '#5c4d43', 4);
  S.line(hx + 28, hy - 9 + anger * 4, hx + 18, hy - 12 - anger * 2, '#5c4d43', 4);

  // Nase
  ctx.fillStyle = skin; ctx.strokeStyle = OUT; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(hx + 17, hy + 7, 6, 4.5, .2, 0, S.TAU); ctx.fill(); ctx.stroke();

  // Schnauzer
  ctx.fillStyle = '#6d5b4d';
  ctx.beginPath(); ctx.ellipse(hx + 9, hy + 14, 8, 4, -.15, 0, S.TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(hx + 20, hy + 14, 8, 4, .15, 0, S.TAU); ctx.fill();

  // Mund
  if (o.mouth === 'o') S.circle(hx + 15, hy + 23, 4.5, '#7b3440', OUT, 2);
  else if (o.mouth === 'grin') {
    ctx.beginPath(); ctx.moveTo(hx + 5, hy + 21); ctx.quadraticCurveTo(hx + 15, hy + 28, hx + 26, hy + 20);
    ctx.strokeStyle = OUT; ctx.lineWidth = 2.4; ctx.stroke();
  } else {
    ctx.beginPath(); ctx.moveTo(hx + 6, hy + 23); ctx.quadraticCurveTo(hx + 15, hy + 18, hx + 25, hy + 23);
    ctx.strokeStyle = OUT; ctx.lineWidth = 2.4; ctx.stroke();
  }

  if (anger > .25) {
    ctx.fillStyle = `rgba(228,87,46,${.16 + anger * .24})`;
    ctx.beginPath(); ctx.ellipse(hx + 2, hy + 9, 7, 4, 0, 0, S.TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(hx + 29, hy + 9, 7, 4, 0, 0, S.TAU); ctx.fill();
  }
  if (o.sweat) {
    S.circle(hx + 30, hy - 17, 3.6, '#8fd8ef', OUT, 1.4);
    S.circle(hx + 34, hy - 8, 2.4, '#8fd8ef', OUT, 1.2);
  }
  ctx.restore();
}

// --------------------------------------------------------------------------
// Geist (Herr Müller, jetzt ohne Termine)
// --------------------------------------------------------------------------
function drawGhost(x, y, s = 1, o = {}) {
  const t = o.time ?? S.time;
  ctx.save();
  ctx.translate(x, y + Math.sin(t * 2 + (o.phase || 0)) * 8);
  ctx.scale(s, s);
  ctx.globalAlpha = o.alpha ?? .9;

  const glow = ctx.createRadialGradient(0, -50, 8, 0, -50, 70);
  glow.addColorStop(0, 'rgba(210,240,255,.45)'); glow.addColorStop(1, 'rgba(210,240,255,0)');
  ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(0, -50, 70, 0, S.TAU); ctx.fill();

  ctx.beginPath();
  ctx.moveTo(-40, 0);
  ctx.bezierCurveTo(-50, -34, -42, -90, 0, -96);
  ctx.bezierCurveTo(42, -90, 50, -34, 40, 0);
  ctx.lineTo(29, -8); ctx.lineTo(20, 0); ctx.lineTo(10, -9); ctx.lineTo(0, 0);
  ctx.lineTo(-10, -9); ctx.lineTo(-20, 0); ctx.lineTo(-29, -8);
  ctx.closePath();
  ctx.fillStyle = '#e9f6ff'; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = '#6a7d99'; ctx.stroke();

  // Arme
  S.line(-37, -56, -50, -76 + Math.sin(t * 3) * 4, '#e9f6ff', 8);
  S.line(37, -56, 51, -74 + Math.cos(t * 3) * 4, '#e9f6ff', 8);

  // Gesicht
  S.circle(-12, -58, 4, '#38445c'); S.circle(13, -58, 4, '#38445c');
  ctx.beginPath(); ctx.ellipse(1, -40, 6, 8, 0, 0, S.TAU); ctx.fillStyle = '#38445c'; ctx.fill();
  ctx.fillStyle = 'rgba(120,170,210,.25)';
  ctx.beginPath(); ctx.ellipse(-18, -70, 10, 6, -.4, 0, S.TAU); ctx.fill();

  // Heiligenschein
  ctx.strokeStyle = '#ffd76a'; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.ellipse(0, -112, 24, 7, 0, 0, S.TAU); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,215,106,.35)'; ctx.lineWidth = 10;
  ctx.beginPath(); ctx.ellipse(0, -112, 24, 7, 0, 0, S.TAU); ctx.stroke();
  ctx.restore();
}

// --------------------------------------------------------------------------
// Sprechblase
// --------------------------------------------------------------------------
function drawBubble(text, x, y, o = {}) {
  const size = o.size ?? 18;
  const font = `800 ${size}px ${DISPLAY}`;
  const maxW = o.maxW ?? 230;
  const lines = S.wrap(text, maxW, font);
  ctx.save(); ctx.font = font;
  let w = 0;
  for (const l of lines) w = Math.max(w, ctx.measureText(l).width);
  w = Math.min(maxW, w) + 28;
  const h = lines.length * (size + 5) + 20;
  const bx = x - w / 2, by = y - h - 16;
  S.fillRR(bx + 4, by + 5, w, h, 12, 'rgba(20,14,28,.18)', null);
  S.fillRR(bx, by, w, h, 12, '#fffaf0', OUT, 3);
  ctx.beginPath();
  ctx.moveTo(x - 9, by + h - 2); ctx.lineTo(x + 2, by + h + 13); ctx.lineTo(x + 13, by + h - 2);
  ctx.fillStyle = '#fffaf0'; ctx.fill();
  ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.stroke();
  ctx.fillStyle = '#fffaf0'; ctx.fillRect(x - 9, by + h - 5, 22, 6);
  ctx.fillStyle = OUT;
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  lines.forEach((l, i) => ctx.fillText(l, x, by + 12 + i * (size + 5)));
  ctx.restore();
}

Object.assign(S, { drawKid, drawTeacher, drawGhost, drawBubble });
})();
