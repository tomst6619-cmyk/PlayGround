/* ==========================================================================
   DER LETZTE SCHULTAG – Kulissen I: Titel, Klassenzimmer, Flug
   ========================================================================== */
(() => {
'use strict';
const S = window.SG;
const ctx = S.ctx;
const { W, H, clamp, lerp, rand, pick, easeInOut, easeOut, TAU, outlineTxt } = S;
const OUT = S.OUT;

// --------------------------------------------------------------------------
// Klassenzimmer-Grundfläche
// --------------------------------------------------------------------------
function classroomBase(t) {
  const wall = ctx.createLinearGradient(0, 0, 0, 400);
  wall.addColorStop(0, '#dfeccc'); wall.addColorStop(.65, '#cfe2bd'); wall.addColorStop(1, '#c3d8b0');
  ctx.fillStyle = wall; ctx.fillRect(0, 0, W, 402);
  ctx.fillStyle = 'rgba(255,255,255,.05)';
  for (let x = 0; x < W; x += 62) ctx.fillRect(x, 0, 30, 402);
  // Decke
  ctx.fillStyle = '#efe6d2'; ctx.fillRect(0, 0, W, 26);
  ctx.fillStyle = 'rgba(80,60,40,.12)'; ctx.fillRect(0, 24, W, 3);
  // Wainscot
  ctx.fillStyle = '#a6c298'; ctx.fillRect(0, 326, W, 76);
  ctx.fillStyle = '#8aa87e'; ctx.fillRect(0, 326, W, 6);
  ctx.fillStyle = 'rgba(50,70,40,.12)';
  for (let x = 0; x < W; x += 78) ctx.fillRect(x, 334, 2, 68);
  // Boden
  const floor = ctx.createLinearGradient(0, 400, 0, H);
  floor.addColorStop(0, '#d9a066'); floor.addColorStop(.55, '#c98c54'); floor.addColorStop(1, '#a86c3d');
  ctx.fillStyle = floor; ctx.fillRect(0, 400, W, H - 400);
  ctx.strokeStyle = 'rgba(90,50,25,.18)'; ctx.lineWidth = 1.6;
  [414, 434, 460, 492, 530].forEach(y => { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); });
  for (let i = 0; i < 15; i++) {
    const x = i * 82 - 40;
    ctx.beginPath(); ctx.moveTo(480 + (x - 480) * .32, 400); ctx.lineTo(x, H); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(70,40,20,.18)'; ctx.fillRect(0, 398, W, 6);
  // Licht vom Fenster
  ctx.save();
  const beam = ctx.createLinearGradient(790, 100, 520, 540);
  beam.addColorStop(0, 'rgba(255,245,195,.32)'); beam.addColorStop(1, 'rgba(255,245,195,0)');
  ctx.fillStyle = beam;
  ctx.beginPath(); ctx.moveTo(800, 95); ctx.lineTo(955, 95); ctx.lineTo(790, 540); ctx.lineTo(455, 540); ctx.closePath(); ctx.fill();
  ctx.restore();
  // Kreidestaub in der Luft
  ctx.save();
  for (let i = 0; i < 14; i++) {
    const x = 470 + ((i * 97 + t * 12) % 450);
    const y = 110 + ((i * 61 + t * 8) % 310);
    ctx.globalAlpha = .14 + .1 * Math.sin(t * 1.4 + i);
    ctx.fillStyle = '#fffbe8'; ctx.beginPath(); ctx.arc(x, y, 1.4 + (i % 3), 0, TAU); ctx.fill();
  }
  ctx.restore();
}

function drawBackWall() {
  S.drawBlackboard(82, 64, 438, 224, { title: 'MATHE', line1: '3 + 4 = ?', line2: 'Hausaufgaben: keine. (Bald.)' });
  S.drawClock(626, 124, 34);
  S.drawPoster(596, 185, 96, 72, { text: 'BALD FERIEN!' });
  S.drawDoor(18, 184, 72, 150, { sign: '7B' });
  S.drawWindow(790, 84, 158, 246, {});
}

// --------------------------------------------------------------------------
// Titel
// --------------------------------------------------------------------------
function drawTitle() {
  const t = S.time;
  const zoom = 1.02 + Math.sin(t * .3) * .004;
  ctx.save();
  ctx.translate(W / 2, H / 2); ctx.scale(zoom, zoom); ctx.translate(-W / 2, -H / 2);
  classroomBase(t);
  drawBackWall();
  // Uhr tickt
  S.drawClock(626, 124, 34);
  // Kinder
  S.drawSeatedKid(138, 392, { shirt: '#7fb7d9', hair: '#4a3327', s: .92 });
  S.drawSeatedKid(398, 397, { shirt: '#d98a86', hair: '#6b4226', hairStyle: 'ponytail', s: .9 });
  // Lehrer am Fenster, der schon ahnt, was kommt
  S.drawTeacher(774, 442, 1.12, { facing: 1, pose: 'point', look: 1, anger: .08, mouth: 'grin' });
  S.drawBubble('NA?', 792, 250, { size: 20 });
  // Tische
  S.drawDesk(138, 458, 182);
  S.drawDesk(398, 464, 182, {});
  // Papierflieger
  ctx.save();
  ctx.translate(660 + Math.sin(t * .7) * 30, 330 + Math.cos(t * .9) * 12); ctx.rotate(-.3 + Math.sin(t) * .1);
  ctx.fillStyle = '#f8f0dc'; ctx.strokeStyle = OUT; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-24, 0); ctx.lineTo(24, -10); ctx.lineTo(4, 4); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
  ctx.restore();
}

// --------------------------------------------------------------------------
// Akt 1 – Der Blick
// --------------------------------------------------------------------------
function drawAct1() {
  const a = S.a1; if (!a) return;
  const t = S.time;
  const zoom = 1 + a.stare * .028 + (a.phase === 'charge' ? .025 : 0);
  ctx.save();
  ctx.translate(W / 2, H / 2); ctx.scale(zoom, zoom); ctx.translate(-W / 2, -H / 2);

  classroomBase(t);
  drawBackWall();
  if (a.broken) {
    // zerbrochenes Fenster nochmal betonen
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      const ang = i / 6 * TAU;
      ctx.beginPath();
      ctx.moveTo(900 + Math.cos(ang) * 12, 218 + Math.sin(ang) * 10);
      ctx.lineTo(900 + Math.cos(ang) * (40 + i * 9), 218 + Math.sin(ang) * (34 + i * 7)); ctx.stroke();
    }
    ctx.restore();
  }

  // Kinder
  S.drawSeatedKid(138, 392, { shirt: '#7fb7d9', hair: '#4a3327', s: .92, lookBack: a.stare > .55, cheer: false });
  S.drawSeatedKid(398, 397, { shirt: '#d98a86', hair: '#6b4226', hairStyle: 'ponytail', s: .9, lookBack: a.stare > .4 });

  // Lehrer
  let pose = 'stand';
  if (a.phase === 'lesson') pose = a.teacherFacing < 0 ? 'write' : 'point';
  else if (a.phase === 'charge') pose = a.p < .5 ? 'charge' : a.p < .95 ? 'grab' : 'throw';
  const anger = a.phase === 'charge' ? 1 : a.stare;
  S.drawTeacher(a.teacherX, 436, 1.12, {
    facing: a.teacherFacing, pose, anger, look: 1,
    mouth: anger > .55 ? 'o' : 'frown', sweat: anger > .7,
    walk: a.phase === 'charge' ? a.p * 20 : 0
  });

  // Dampf
  if (anger > .55) {
    for (let i = 0; i < 3; i++) {
      const px = a.teacherX - 26 + i * 26;
      const py = 260 - ((t * 28 + i * 22) % 44);
      ctx.globalAlpha = .22 * anger;
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(px + Math.sin(t * 3 + i) * 3, py, 7 + i, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  // Spieler
  if (a.phase === 'lesson' || (a.phase === 'charge' && a.p < .52)) {
    S.drawKid(a.playerX, 454, 1.02, {
      facing: a.stare > .05 ? -1 : 1,
      eyes: a.stare > .05 ? 'wide' : 'open',
      mouth: a.stare > .9 ? 'o' : 'smile',
      sweat: a.stare > .65, shirt: '#ffc145', pants: '#3f88c5', pack: '#d1495b'
    });
  } else {
    ctx.save();
    ctx.translate(a.playerX, a.playerY);
    ctx.rotate(a.spin);
    S.drawKid(0, 0, 1.02, {
      pose: 'fly', eyes: 'wide', mouth: 'o', shirt: '#ffc145', pants: '#3f88c5', pack: '#d1495b', shadow: false
    });
    ctx.restore();
    // Tempo-Striche
    ctx.save(); ctx.globalAlpha = .55; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
    for (let i = 0; i < 4; i++) {
      const y = a.playerY - 50 + i * 30;
      ctx.beginPath(); ctx.moveTo(a.playerX - 70 - i * 14, y); ctx.lineTo(a.playerX - 30 - i * 8, y); ctx.stroke();
    }
    ctx.restore();
  }

  // Tische im Vordergrund
  S.drawDesk(138, 458, 182);
  S.drawDesk(398, 464, 182);

  // Staub / Scherben
  S.drawParticles();

  // Blase
  if (a.bubbleT > 0 && a.bubble) {
    const scale = a.bubbleT > 2.1 ? 1 : Math.min(1, (2.4 - a.bubbleT) * 4);
    ctx.save(); ctx.translate(a.teacherX, 248); ctx.scale(scale, scale);
    S.drawBubble(a.bubble, 0, 0, { size: 17, maxW: 250 });
    ctx.restore();
  }
  ctx.restore();

  if (a.fade > 0) { ctx.fillStyle = `rgba(255,253,244,${a.fade})`; ctx.fillRect(0, 0, W, H); }
}

// --------------------------------------------------------------------------
// Akt 2 – Der Flug
// --------------------------------------------------------------------------
function drawFlightTarget(a, t) {
  const x = a.targetX, y = 462;
  const pulse = 1 + Math.sin(t * 5) * .04;
  ctx.save(); ctx.translate(x, y); ctx.scale(pulse, pulse);
  // Markierung
  ctx.setLineDash([9, 8]); ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.ellipse(0, 4, 88, 18, 0, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
  if (a.type === 'busch') S.drawBush(0, 10, 1.12);
  else if (a.type === 'pool') S.drawPool(0, 10, 1.05);
  else S.drawLeafPile(0, 10, 1.08);
  // Pfeil
  const by = -84 - Math.abs(Math.sin(t * 4)) * 9;
  ctx.fillStyle = '#ffc145'; ctx.strokeStyle = OUT; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(0, by + 15); ctx.lineTo(-13, by); ctx.lineTo(13, by); ctx.closePath(); ctx.fill(); ctx.stroke();
  S.outlineTxt('HIER LANDEN', 0, by - 16, 14, '#fff', OUT, 4);
  ctx.restore();
}

function drawAct2() {
  const a = S.a2; if (!a) return;
  const t = S.time;
  // Himmel
  const sky = ctx.createLinearGradient(0, 0, 0, 460);
  sky.addColorStop(0, '#61b5df'); sky.addColorStop(.55, '#a8dcf0'); sky.addColorStop(1, '#f7ecc7');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, 460);
  S.drawSun(130, 104, 42);
  S.drawCloud(180 + Math.sin(t * .12) * 30, 100, 1.5, .9);
  S.drawCloud(540 + Math.sin(t * .09 + 2) * 40, 70, 1.1, .8);
  S.drawCloud(720 + Math.sin(t * .11 + 4) * 24, 150, .8, .7);
  S.drawBird(300 + Math.sin(t * .7) * 40, 120, 1);
  S.drawBird(350 + Math.sin(t * .7 + 1) * 40, 100, .7);

  // Ferne Stadt
  ctx.fillStyle = 'rgba(120,150,140,.35)';
  for (let i = 0; i < 14; i++) {
    const bx = i * 78 - 20, bh = 30 + (i * 37 % 55);
    ctx.fillRect(bx, 428 - bh, 54, bh);
  }
  // Schulmauer rechts
  ctx.save();
  ctx.fillStyle = '#e7c9a1'; ctx.fillRect(884, 0, 76, 460);
  ctx.fillStyle = '#d8b68b'; ctx.fillRect(884, 0, 12, 460);
  ctx.strokeStyle = 'rgba(120,80,50,.22)'; ctx.lineWidth = 1.5;
  for (let y = 20; y < 460; y += 28) { ctx.beginPath(); ctx.moveTo(884, y); ctx.lineTo(960, y); ctx.stroke(); }
  // zerbrochenes Fenster
  ctx.fillStyle = '#6d9fb3'; ctx.fillRect(898, 76, 50, 100);
  ctx.strokeStyle = '#f2e4c6'; ctx.lineWidth = 8; ctx.strokeRect(898, 76, 50, 100);
  ctx.strokeStyle = '#f2e4c6'; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(923, 76); ctx.lineTo(923, 176); ctx.moveTo(898, 126); ctx.lineTo(948, 126); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 2;
  for (let i = 0; i < 6; i++) {
    const ang = i / 6 * TAU;
    ctx.beginPath(); ctx.moveTo(924, 130); ctx.lineTo(924 + Math.cos(ang) * 24, 130 + Math.sin(ang) * 22); ctx.stroke();
  }
  ctx.restore();

  // Boden
  const grass = ctx.createLinearGradient(0, 450, 0, H);
  grass.addColorStop(0, '#8fc06d'); grass.addColorStop(1, '#5d8f4e');
  ctx.fillStyle = grass; ctx.fillRect(0, 448, W, H - 448);
  ctx.fillStyle = 'rgba(60,100,50,.2)';
  for (let i = 0; i < 20; i++) ctx.fillRect(i * 53, 470 + (i % 3) * 18, 2, 8);
  S.drawFence(0, 300, 462, .9);

  // Ziel
  drawFlightTarget(a, t);

  // Schatten
  if (a.phase === 'flight') {
    const k = clamp((a.y - 190) / 260, 0, 1);
    ctx.save(); ctx.globalAlpha = .2 + k * .15; ctx.fillStyle = '#2d3a2a';
    ctx.beginPath(); ctx.ellipse(a.x, 458, 26 - k * 8, 7 - k * 2, 0, 0, TAU); ctx.fill(); ctx.restore();
  }

  // Spieler
  if (a.phase === 'flight') {
    ctx.save();
    ctx.translate(a.x, a.y);
    ctx.rotate(a.rot * .32 + a.tilt);
    S.drawKid(0, 0, 1.02, {
      pose: 'fly', eyes: 'wide', mouth: 'o', shadow: false,
      shirt: '#ffc145', pants: '#3f88c5', pack: '#d1495b', sweat: true
    });
    ctx.restore();
    // Wind
    ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 2.5;
    for (let i = 0; i < 5; i++) {
      const wx = a.x + 50 + i * 13, wy = a.y + 40 + i * 24;
      ctx.beginPath(); ctx.moveTo(wx, wy); ctx.lineTo(wx + 26, wy); ctx.stroke();
    }
    ctx.restore();
  } else {
    const hurt = a.quality === 'AUA';
    const squash = Math.sin(clamp(a.p * 4, 0, Math.PI)) * .06;
    ctx.save();
    ctx.translate(a.x, 454);
    if (a.quality === 'PERFEKT') ctx.translate(0, -Math.abs(Math.sin(a.p * 8)) * 8);
    ctx.scale(1 + squash, 1 - squash);
    S.drawKid(0, 0, 1.02, {
      pose: hurt ? 'hurt' : 'cheer', eyes: hurt ? 'x' : 'happy', mouth: hurt ? 'frown' : 'grin',
      bandage: hurt, shadow: false, shirt: '#ffc145', pants: '#3f88c5', pack: '#d1495b'
    });
    ctx.restore();
    if (hurt) {
      for (let i = 0; i < 4; i++) {
        const ang = t * 4 + i / 4 * TAU;
        S.circle(a.x + Math.cos(ang) * 34, 350 + Math.sin(ang) * 12, 3, '#ffd76a', OUT, 1.4);
      }
    }
  }

  S.drawParticles();
  if (a.fade > 0) { ctx.fillStyle = `rgba(255,253,244,${a.fade})`; ctx.fillRect(0, 0, W, H); }
}

Object.assign(S, { drawTitle, drawAct1, drawAct2, classroomBase });
})();
