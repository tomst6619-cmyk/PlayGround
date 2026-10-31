/* ==========================================================================
   DER LETZTE SCHULTAG – Kulissen II: Tod-Trank, Ferien, Bildschirm
   ========================================================================== */
(() => {
'use strict';
const S = window.SG;
const ctx = S.ctx;
const { W, H, clamp, lerp, rand, easeOut, TAU, outlineTxt } = S;
const OUT = S.OUT;
const canvas = S.canvas;

// --------------------------------------------------------------------------
// Akt 3 – Der Tod-Trank
// --------------------------------------------------------------------------
function drawSchoolWall(t) {
  const wall = ctx.createLinearGradient(0, 55, 0, 430);
  wall.addColorStop(0, '#eccfa6'); wall.addColorStop(.6, '#e2bf92'); wall.addColorStop(1, '#d6ad7c');
  ctx.fillStyle = wall; ctx.fillRect(0, 48, W, 384);
  // Himmel oben
  const sky = ctx.createLinearGradient(0, 0, 0, 70);
  sky.addColorStop(0, '#f6b26b'); sky.addColorStop(1, '#ffd9a0');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, 52);
  // Ziegel
  ctx.strokeStyle = 'rgba(120,75,45,.14)'; ctx.lineWidth = 1.4;
  for (let y = 66; y < 430; y += 24) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    const off = ((y / 24) | 0) % 2 ? 24 : 0;
    for (let x = off; x < W; x += 52) {
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 24); ctx.stroke();
    }
  }
  // Schatten unten
  ctx.fillStyle = 'rgba(90,55,30,.14)'; ctx.fillRect(0, 420, W, 14);
  // Efeu
  ctx.strokeStyle = '#4c956c'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(22, 430); ctx.bezierCurveTo(50, 340, 16, 260, 58, 160); ctx.stroke();
  for (let i = 0; i < 12; i++) {
    const lx = 28 + (i * 37) % 44, ly = 180 + i * 19;
    ctx.fillStyle = i % 2 ? '#4c956c' : '#5aa878';
    ctx.beginPath(); ctx.ellipse(lx, ly, 9, 5, i * .7, 0, TAU); ctx.fill();
  }
  // Schulschild
  S.fillRR(84, 74, 246, 38, 6, '#f8f0dc', OUT, 3);
  S.txt('GESAMTSCHULE AM MÜLLERWEG', 207, 99, { size: 12, align: 'center', color: OUT });
  // Uhr
  S.drawClock(290, 150, 26, { spin: S.a3 && S.a3.bell ? S.time * 7 : 0 });
  // kleine Fenster
  [[92, 160], [410, 160]].forEach(([x, y], idx) => {
    S.fillRR(x, y, 78, 92, 3, '#8fb7a2', OUT, 3);
    S.fillRR(x + 4, y + 4, 70, 84, 2, '#476b5c', null);
    S.fillRR(x + 39, y + 4, 3, 84, 0, '#f2e4c6', null);
    S.fillRR(x + 4, y + 45, 70, 3, 0, '#f2e4c6', null);
    if (S.a3 && S.a3.kids) {
      const bob = Math.sin(S.time * 5 + idx) * 3;
      S.circle(x + 39, y + 66 + bob, 8, '#f0bd87', OUT, 2);
      S.line(x + 28, y + 88, x + 50, y + 88, '#e4572e', 6);
      S.circle(x + 34, y + 64 + bob, 1.6, OUT); S.circle(x + 44, y + 64 + bob, 1.6, OUT);
      ctx.beginPath(); ctx.arc(x + 39, y + 69 + bob, 4, .2, Math.PI - .2); ctx.strokeStyle = OUT; ctx.lineWidth = 1.6; ctx.stroke();
    }
  });
}

function drawBigWindow(a, t) {
  const x = 486, y = 88, w = 300, h = 270;
  // Rahmen außen
  S.fillRR(x - 12, y - 12, w + 24, h + 34, 4, '#f2e4c6', OUT, 4);
  // Innenraum
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  const inside = ctx.createLinearGradient(0, y, 0, y + h);
  inside.addColorStop(0, '#47685a'); inside.addColorStop(1, '#2f4a40');
  ctx.fillStyle = inside; ctx.fillRect(x, y, w, h);
  // Tafel im Hintergrund
  S.fillRR(x + 40, y + 30, 200, 90, 4, '#2c5a48', null);
  S.txt('MATHE', x + 60, y + 68, { size: 20, color: 'rgba(245,243,225,.55)', font: S.CHALK });
  // Lehrer
  if (!a.fell) {
    const shakeX = a.phase === 'wrong' ? Math.sin(a.p * 50) * 3 : 0;
    const green = a.phase === 'drink' && a.p > .9;
    let pose = 'shrug';
    if (a.phase === 'drink') pose = 'drink';
    if (a.phase === 'wrong') pose = 'drink';
    S.drawTeacher(648 + shakeX, 438, 1.16, {
      pose, facing: 1, look: 0, green,
      eyes: green && a.p > 1.1 ? 'x' : 'open',
      mouth: green ? 'o' : a.phase === 'wrong' ? 'o' : 'grin',
      anger: a.phase === 'wrong' ? .8 : .1,
      sweat: a.phase === 'wrong',
      walk: 0, shadow: false
    });
    // Kaffe- / Saftwolke
    if (a.phase === 'wrong' && a.chosen) {
      if (a.chosen.id === 'kaffee') {
        ctx.globalAlpha = .35;
        for (let i = 0; i < 5; i++) S.circle(620 + i * 16, 250 - ((a.p * 50 + i * 13) % 50), 8, '#fff', null);
        ctx.globalAlpha = 1;
      } else {
        ctx.globalAlpha = .4;
        for (let i = 0; i < 5; i++) S.circle(632 + Math.sin(i * 2 + a.p * 4) * 16, 272 - a.p * 20 - i * 7, 11, '#b98ad6', null);
        ctx.globalAlpha = 1;
      }
    }
  } else {
    // Umgekippt: liegt jetzt quer auf der Fensterbank.
    const fall = clamp((a.p - 1.55) / .4, 0, 1);
    ctx.save();
    ctx.translate(590, 352);
    ctx.rotate(1.15 * easeOut(fall));
    S.drawTeacher(0, 0, 1.16, {
      pose: 'shrug', facing: 1, look: 0, green: true,
      eyes: 'x', mouth: 'o', anger: 0, walk: 0, shadow: false
    });
    ctx.restore();
  }
  // Fensterkreuz
  S.fillRR(x + w / 2 - 5, y, 10, h, 0, '#f2e4c6', OUT, 2.4);
  S.fillRR(x, y + h * .42 - 4, w, 8, 0, '#f2e4c6', OUT, 2.4);
  // Glasscherben am Rand
  ctx.fillStyle = 'rgba(220,250,255,.65)';
  ctx.beginPath(); ctx.moveTo(x + w - 4, y + 14); ctx.lineTo(x + w - 22, y + 30); ctx.lineTo(x + w - 4, y + 44); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x + w - 8, y + h - 4); ctx.lineTo(x + w - 32, y + h - 22); ctx.lineTo(x + w - 8, y + h - 36); ctx.closePath(); ctx.fill();
  ctx.restore();
  // Fensterbank
  S.fillRR(x - 24, y + h + 12, w + 48, 18, 5, '#e6d2ae', OUT, 3);
  S.fillRR(x - 24, y + h + 30, w + 48, 8, 3, '#c9ae87', OUT, 2);
  // Risse
  ctx.strokeStyle = 'rgba(90,60,35,.35)'; ctx.lineWidth = 1.7;
  ctx.beginPath(); ctx.moveTo(x - 6, y + 40); ctx.lineTo(x + 24, y + 56); ctx.lineTo(x + 10, y + 92); ctx.stroke();
}

function drawAct3() {
  const a = S.a3; if (!a) return;
  const t = S.time;

  drawSchoolWall(t);

  // Boden
  const ground = ctx.createLinearGradient(0, 430, 0, H);
  ground.addColorStop(0, '#83b565'); ground.addColorStop(1, '#5d8f4e');
  ctx.fillStyle = ground; ctx.fillRect(0, 430, W, H - 430);
  ctx.fillStyle = 'rgba(60,100,50,.16)';
  for (let i = 0; i < 20; i++) ctx.fillRect(i * 51, 458 + (i % 3) * 20, 2, 9);

  drawBigWindow(a, t);

  // Flaschen
  const mouthX = 668, mouthY = 278;
  a.bottles.forEach((b, i) => {
    if (a.chosen && a.chosen.id === b.id && (a.phase === 'drink' || a.phase === 'wrong')) return;
    const bob = a.phase === 'choice' ? Math.sin(t * 2.2 + i * 1.7) * 2 : 0;
    const isHover = S.hoverBottle && S.hoverBottle.id === b.id && a.phase === 'choice';
    S.drawBottle(b.x, 366 + bob, b.label, b.color, { skull: b.skull, scale: isHover ? 1.12 : 1, glow: isHover ? 1 : (b.skull ? .35 + Math.sin(t * 3) * .15 : 0) });
    if (a.phase === 'choice') {
      const tagY = 392 + bob;
      ctx.save();
      if (isHover) { ctx.translate(0, -3); }
      S.fillRR(b.x - 46, tagY - 16, 92, 22, 6, isHover ? '#ffc145' : 'rgba(255,250,240,.94)', OUT, 2);
      S.txt(b.label, b.x, tagY, { size: 9, align: 'center', color: OUT });
      ctx.restore();
      if (b.skull) {
        ctx.save(); ctx.globalAlpha = .45 + Math.sin(t * 4) * .2;
        S.txt('☠', b.x + 34, tagY - 2, { size: 12, align: 'center', color: '#2f6c4a' });
        ctx.restore();
      }
    }
  });

  // Flasche am Mund – und danach fällt sie runter
  if (a.chosen && (a.phase === 'drink' || a.phase === 'wrong')) {
    const b = a.chosen;
    const k = clamp(a.p / .5, 0, 1);
    if (a.p <= 1.45) {
      const bx = lerp(b.x, mouthX, k), by = lerp(366, mouthY + 20, k);
      S.drawBottle(bx, by, b.label, b.color, { skull: b.skull, scale: .95, tilt: k * 1.35 });
    } else {
      const f = clamp((a.p - 1.45) / .7, 0, 1);
      const bx = lerp(mouthX, 770, f), by = lerp(mouthY + 20, 366, f * f);
      S.drawBottle(bx, by, b.label, b.color, { skull: b.skull, scale: .95, tilt: 1.35 + f * 3.4 });
    }
  }

  // Geist
  if (a.ghost) {
    const rise = clamp((a.p - 2.15) / 1.3, 0, 1);
    const gy = 330 - 165 * easeOut(rise);
    S.drawGhost(652, gy, .92, { time: t, phase: 1 });
    if (a.p > 2.8) {
      ctx.save(); ctx.globalAlpha = .85;
      S.drawBubble('TSCHÜSS!', 652, Math.max(gy - 120, 88), { size: 15, maxW: 130 });
      ctx.restore();
    }
  }

  // Kind im Busch
  S.drawBush(858, 506, 1.25);
  S.drawKid(858, 508, .95, {
    pose: 'sit', facing: -1, eyes: 'happy', mouth: 'grin', bandage: true,
    shirt: '#ffc145', pants: '#3f88c5', pack: '#d1495b', shadow: false
  });
  // Vordere Buschblätter
  ctx.save(); ctx.globalAlpha = .95;
  S.drawBush(858, 528, .95);
  ctx.restore();
  // Sterne um den Kopf
  for (let i = 0; i < 4; i++) {
    const ang = t * 2.4 + i / 4 * TAU;
    S.circle(858 + Math.cos(ang) * 38, 402 + Math.sin(ang) * 12, 3, '#ffd76a', OUT, 1.2);
  }

  // Glockenschall
  if (a.bell) {
    ctx.save(); ctx.globalAlpha = .65;
    for (let i = 0; i < 3; i++) {
      const r = 30 + ((t * 90 + i * 40) % 130);
      ctx.strokeStyle = '#ffd76a'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(290, 150, r, -.6, .6); ctx.stroke();
    }
    ctx.restore();
  }

  S.drawParticles();
  if (a.fade > 0) { ctx.fillStyle = `rgba(255,250,232,${a.fade})`; ctx.fillRect(0, 0, W, H); }
}

// --------------------------------------------------------------------------
// Akt 4 – Ferien
// --------------------------------------------------------------------------
function drawAct4() {
  const a = S.a4; if (!a) return;
  const t = S.time;
  const cam = a.cam;

  // Himmel
  const sky = ctx.createLinearGradient(0, 0, 0, 470);
  sky.addColorStop(0, '#7b6ca8'); sky.addColorStop(.42, '#f2a65a'); sky.addColorStop(.78, '#ffcf7d'); sky.addColorStop(1, '#ffe9b0');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, 470);
  S.drawSun(760, 150, 52, '#ffd76a');
  S.drawCloud(160 + Math.sin(t * .1) * 20, 100, 1.4, .75);
  S.drawCloud(480 + Math.sin(t * .08 + 2) * 30, 70, 1.1, .65);
  S.drawCloud(900 + Math.sin(t * .12 + 4) * 18, 130, .9, .55);

  // Ferne Hügel
  ctx.save();
  ctx.translate(-cam * .12, 0);
  ctx.fillStyle = 'rgba(90,110,90,.35)';
  ctx.beginPath(); ctx.moveTo(-100, 440);
  for (let i = 0; i < 9; i++) { ctx.quadraticCurveTo(i * 180 + 90, 340 - (i % 3) * 30, i * 180 + 180, 440); }
  ctx.lineTo(1600, 480); ctx.lineTo(-100, 480); ctx.closePath(); ctx.fill();
  ctx.restore();

  // Boden
  const ground = ctx.createLinearGradient(0, 450, 0, H);
  ground.addColorStop(0, '#8fc06d'); ground.addColorStop(1, '#5d8f4e');
  ctx.fillStyle = ground; ctx.fillRect(0, 452, W, H - 452);
  ctx.fillStyle = 'rgba(240,214,150,.55)'; ctx.fillRect(0, 468, W, 44);
  ctx.fillStyle = 'rgba(120,90,50,.18)';
  for (let i = 0; i < 16; i++) ctx.fillRect(i * 77, 480 + (i % 2) * 7, 26, 3);

  ctx.save();
  ctx.translate(-cam, 0);

  // Schule
  S.drawSchoolBuilding(16, 470, 560, 320, { sign: 'SCHULE', cols: 4, rows: 2, cheer: true });
  ctx.fillStyle = 'rgba(255,225,150,.55)';
  ctx.beginPath(); ctx.moveTo(282, 470); ctx.lineTo(320, 470); ctx.lineTo(366, 372); ctx.lineTo(330, 372); ctx.closePath(); ctx.fill();

  // Bäume & Zaun
  S.drawTree(690, 470, 1.05);
  S.drawTree(1110, 468, .9);
  S.drawTree(1540, 470, 1.1);
  S.drawFence(620, 1780, 470, .85);

  // Tor
  S.drawGate(1852, 470, 1.1);

  // Geist (folgt)
  if (a.distance < .94) {
    S.drawGhost(a.playerX - 210, 330, .82, { time: t, phase: 2 });
  }

  // Kinder
  a.kids.forEach((k, i) => {
    const wx = a.playerX + k.off;
    if (wx < cam - 80 || wx > cam + W + 80) return;
    const bob = Math.abs(Math.sin(a.walk * .9 + k.phase)) * 5;
    const jump = a.phase === 'gate' ? Math.abs(Math.sin(t * 7 + k.phase)) * 26 : 0;
    S.drawKid(wx, 476 - bob - jump, k.s, {
      pose: 'run', walk: a.walk + k.phase, time: t,
      shirt: k.shirt, pants: k.pants, hair: k.hair, hairStyle: k.hairStyle,
      skin: k.skin, eyes: 'happy', mouth: 'grin', shadow: false
    });
  });

  // Spieler
  const jump = a.phase === 'gate' ? Math.abs(Math.sin(t * 7)) * 30 : 0;
  S.drawKid(a.playerX, 477 - jump, 1.05, {
    pose: 'run', walk: a.walk, time: t, eyes: 'happy', mouth: 'grin',
    bandage: true, shirt: '#ffc145', pants: '#3f88c5', pack: '#d1495b'
  });

  // Speedlines
  if (a.phase === 'run' && (S.input.run || a.tap > .01)) {
    ctx.save(); ctx.globalAlpha = .5; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.4;
    for (let i = 0; i < 4; i++) {
      const ly = 390 + i * 24;
      ctx.beginPath(); ctx.moveTo(a.playerX - 90 - i * 18, ly); ctx.lineTo(a.playerX - 42 - i * 8, ly); ctx.stroke();
    }
    ctx.restore();
  }

  // Ferien-Schild am Tor
  if (a.phase === 'gate') {
    const gy = 185 + Math.sin(t * 3) * 6;
    S.outlineTxt('FERIEN!', 470, gy, 68, '#ffd76a', OUT, 9);
    // Konfetti-Bögen
    ctx.save(); ctx.globalAlpha = .45;
    for (let i = 0; i < 3; i++) {
      ctx.strokeStyle = ['#e4572e', '#3f88c5', '#4c956c'][i]; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(470, gy, 150 + i * 20, Math.PI * 1.08, Math.PI * 1.92); ctx.stroke();
    }
    ctx.restore();
  }

  ctx.restore(); // Kamera

  S.drawParticles();
}

// --------------------------------------------------------------------------
// Bildschirm
// --------------------------------------------------------------------------
function render() {
  const sx = canvas.width / W, sy = canvas.height / H;
  ctx.setTransform(sx, 0, 0, sy, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.save();
  if (S.shake > 0 && !S.reduceMotion) {
    ctx.translate(rand(-1, 1) * S.shake, rand(-1, 1) * S.shake);
  }
  if (S.scene === 'title') S.drawTitle();
  else if (S.scene === 'act1') S.drawAct1();
  else if (S.scene === 'act2') S.drawAct2();
  else if (S.scene === 'act3') drawAct3();
  else if (S.scene === 'act4' || S.scene === 'end') drawAct4();
  ctx.restore();

  S.drawFloaters();
  if (S.flash > 0) {
    ctx.fillStyle = `rgba(255,252,240,${clamp(S.flash, 0, 1)})`;
    ctx.fillRect(0, 0, W, H);
  }
}

Object.assign(S, { drawAct3, drawAct4, render });
})();
