/* ==========================================================================
   DER LETZTE SCHULTAG – Requisiten & Kulissen
   ========================================================================== */
(() => {
'use strict';
const S = window.SG;
const ctx = S.ctx;
const OUT = S.OUT, DISPLAY = S.DISPLAY;
const CHALK = '"Comic Sans MS", "Chalkboard SE", "Trebuchet MS", sans-serif';

// --------------------------------------------------------------------------
// Sitzender Schüler (hinter dem Tisch)
// --------------------------------------------------------------------------
function drawSeatedKid(x, yHead, o = {}) {
  const t = o.time ?? S.time;
  const shirt = o.shirt ?? '#7fb7d9';
  const skin = o.skin ?? '#eebd8f';
  const hair = o.hair ?? '#4a3327';
  ctx.save(); ctx.translate(x, yHead); ctx.scale(o.s ?? .92, o.s ?? .92);
  // Körper
  S.fillRR(-20, 16, 44, 62, 13, shirt, OUT, 2.8);
  // Arme auf dem Tisch
  S.line(-17, 34, -5, 58, shirt, 9); S.line(21, 34, 9, 58, shirt, 9);
  S.circle(-3, 59, 5.5, skin, OUT, 2); S.circle(7, 59, 5.5, skin, OUT, 2);
  // Kopf
  S.circle(3, 0, 21, skin, OUT, 2.8);
  S.circle(-16, 3, 4.5, skin, OUT, 1.8);
  ctx.save(); ctx.beginPath(); ctx.arc(3, 0, 21, 0, S.TAU); ctx.clip();
  ctx.fillStyle = hair; ctx.beginPath(); ctx.ellipse(3, -14, 23, 14, -.1, 0, S.TAU); ctx.fill();
  ctx.restore();
  // Augen (von hinten/seitlich)
  S.circle(10, -1, 2.2, OUT); S.circle(19, -1, 2.2, OUT);
  if (o.lookBack) {
    ctx.fillStyle = OUT; ctx.beginPath(); ctx.arc(8, 1, 2.2, 0, S.TAU); ctx.fill();
  }
  // Mund
  ctx.beginPath(); ctx.arc(14, 8, 5, .2, Math.PI - .2); ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.stroke();
  if (o.cheer) {
    S.line(-17, 32, -25, 5 + Math.sin(t * 8) * 4, shirt, 8);
    S.line(21, 32, 29, 5 + Math.cos(t * 8) * 4, shirt, 8);
  }
  ctx.restore();
}

// --------------------------------------------------------------------------
// Schultisch
// --------------------------------------------------------------------------
function drawDesk(x, yTop, w = 180, o = {}) {
  const wood = o.wood ?? '#b97a45';
  const woodDark = '#8d5529';
  // Beine
  S.fillRR(x - w / 2 + 12, yTop + 12, 13, 82, 4, woodDark, OUT, 2.4);
  S.fillRR(x + w / 2 - 25, yTop + 12, 13, 82, 4, woodDark, OUT, 2.4);
  // Front
  S.fillRR(x - w / 2 + 7, yTop + 12, w - 14, 58, 5, wood, OUT, 3);
  ctx.fillStyle = 'rgba(255,255,255,.10)'; ctx.fillRect(x - w / 2 + 14, yTop + 20, w - 28, 7);
  // Platte
  S.fillRR(x - w / 2, yTop, w, 16, 5, '#d29a5e', OUT, 3);
  ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.fillRect(x - w / 2 + 6, yTop + 4, w - 12, 3);
  // Gekritzel
  S.txt('MÜLLER', x + 30, yTop + 51, { size: 10, color: 'rgba(70,40,20,.35)', font: CHALK, weight: 700 });
  S.txt('♡', x - 34, yTop + 50, { size: 15, color: 'rgba(180,50,40,.4)', font: CHALK });
  // Stift
  S.line(x - w / 2 + 26, yTop - 3, x - w / 2 + 66, yTop - 4, '#e4572e', 5);
  S.circle(x - w / 2 + 26, yTop - 3, 2.5, '#f4c2a1', OUT, 1.2);
}

// --------------------------------------------------------------------------
// Tafel
// --------------------------------------------------------------------------
function drawBlackboard(x, y, w, h, o = {}) {
  // Rahmen
  S.fillRR(x - 12, y - 12, w + 24, h + 24, 7, '#8b5a35', OUT, 3.5);
  S.fillRR(x, y, w, h, 3, '#2c5a48', null);
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, 'rgba(255,255,255,.07)'); g.addColorStop(.5, 'rgba(0,0,0,.06)'); g.addColorStop(1, 'rgba(255,255,255,.04)');
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  // Kreide
  ctx.save();
  ctx.font = `700 42px ${CHALK}`; ctx.fillStyle = 'rgba(245,243,225,.92)';
  ctx.fillText(o.title ?? 'MATHE', x + 30, y + 60);
  ctx.font = `700 26px ${CHALK}`;
  ctx.fillText(o.line1 ?? '3 + 4 = ?', x + 34, y + 112);
  ctx.font = `700 15px ${CHALK}`; ctx.fillStyle = 'rgba(245,243,225,.55)';
  ctx.fillText(o.line2 ?? 'Hausaufgaben: keine. (Bald.)', x + 34, y + 154);
  // kleiner Tod-Trank
  if (o.doodle !== false) {
    const bx = x + w - 74, by = y + h - 34;
    ctx.strokeStyle = 'rgba(245,243,225,.7)'; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.moveTo(bx - 8, by - 34); ctx.lineTo(bx - 8, by - 20); ctx.lineTo(bx - 16, by - 14);
    ctx.lineTo(bx - 16, by); ctx.lineTo(bx + 16, by); ctx.lineTo(bx + 16, by - 14); ctx.lineTo(bx + 8, by - 20); ctx.lineTo(bx + 8, by - 34); ctx.stroke();
    ctx.beginPath(); ctx.arc(bx, by - 14, 6, 0, S.TAU); ctx.stroke();
    ctx.beginPath(); ctx.arc(bx - 2, by - 16, 1.4, 0, S.TAU); ctx.arc(bx + 4, by - 16, 1.4, 0, S.TAU); ctx.fillStyle = 'rgba(245,243,225,.7)'; ctx.fill();
    ctx.font = `700 11px ${CHALK}`; ctx.fillText('TOD-TRANK?', bx - 34, by + 16);
  }
  ctx.restore();
  // Ablage
  S.fillRR(x - 16, y + h + 10, w + 32, 12, 4, '#8b5a35', OUT, 2.5);
  S.fillRR(x + 34, y + h + 3, 26, 6, 2, '#f4e7cd', null);
  S.fillRR(x + 74, y + h + 4, 10, 5, 2, '#ffc145', null);
  S.fillRR(x + w - 90, y + h - 2, 34, 16, 3, '#5d6d7e', OUT, 2);
  S.fillRR(x + w - 86, y + h + 2, 26, 7, 2, '#e8e2d4', null);
}

// --------------------------------------------------------------------------
// Uhr
// --------------------------------------------------------------------------
function drawClock(x, y, r, o = {}) {
  const spin = o.spin ?? 0;
  S.circle(x, y, r + 5, '#8b5a35', OUT, 3);
  S.circle(x, y, r, '#f8f0dc', OUT, 2.4);
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * S.TAU;
    S.line(x + Math.cos(a) * (r - 9), y + Math.sin(a) * (r - 9), x + Math.cos(a) * (r - 4), y + Math.sin(a) * (r - 4), OUT, i % 3 ? 1.4 : 2.6);
  }
  const hour = -Math.PI / 2 + (11 + 59 / 60) / 12 * S.TAU + spin;
  const minute = -Math.PI / 2 + (59 / 60) * S.TAU + spin * 12;
  S.line(x, y, x + Math.cos(hour) * r * .5, y + Math.sin(hour) * r * .5, OUT, 4.5);
  S.line(x, y, x + Math.cos(minute) * r * .72, y + Math.sin(minute) * r * .72, OUT, 2.6);
  S.line(x, y, x + Math.cos(minute + 2.1) * r * .78, y + Math.sin(minute + 2.1) * r * .78, '#d1495b', 1.5);
  S.circle(x, y, 3.4, '#d1495b', OUT, 1.4);
  if (o.bell) {
    S.circle(x, y - r - 9, 4, '#ffc145', OUT, 1.6);
  }
}

// --------------------------------------------------------------------------
// Fenster (mit Aussicht auf Ferien)
// --------------------------------------------------------------------------
function drawWindow(x, y, w, h, o = {}) {
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  const sky = ctx.createLinearGradient(0, y, 0, y + h);
  sky.addColorStop(0, '#8fd4ed'); sky.addColorStop(.62, '#c9ebf2'); sky.addColorStop(1, '#f9ecc4');
  ctx.fillStyle = sky; ctx.fillRect(x, y, w, h);
  // Sonne
  ctx.fillStyle = 'rgba(255,232,150,.9)'; ctx.beginPath(); ctx.arc(x + w * .78, y + h * .2, 19, 0, S.TAU); ctx.fill();
  // Wolken
  drawCloud(x + w * .2, y + h * .2, .7, .9);
  drawCloud(x + w * .63, y + h * .34, .5, .7);
  // Schulhof
  ctx.fillStyle = '#9bc57a'; ctx.fillRect(x, y + h * .72, w, h * .28);
  ctx.fillStyle = '#7fa95f'; ctx.fillRect(x, y + h * .85, w, h * .15);
  // Baum
  ctx.fillStyle = '#8b5a35'; ctx.fillRect(x + w * .18, y + h * .6, 6, h * .22);
  ctx.fillStyle = '#4c956c'; ctx.beginPath(); ctx.arc(x + w * .2, y + h * .58, 18, 0, S.TAU); ctx.fill();
  // Kinder
  ctx.fillStyle = '#e4572e'; ctx.beginPath(); ctx.arc(x + w * .68, y + h * .84, 4, 0, S.TAU); ctx.fill();
  ctx.fillStyle = '#3f88c5'; ctx.beginPath(); ctx.arc(x + w * .78, y + h * .87, 3.5, 0, S.TAU); ctx.fill();
  ctx.restore();

  // Rahmen (nur als Balken, damit die Aussicht sichtbar bleibt)
  S.fillRR(x - 10, y - 10, w + 20, 14, 4, '#f2e4c6', OUT, 3);
  S.fillRR(x - 10, y + h - 4, w + 20, 14, 4, '#f2e4c6', OUT, 3);
  S.fillRR(x - 10, y - 2, 14, h + 4, 0, '#f2e4c6', OUT, 3);
  S.fillRR(x + w - 4, y - 2, 14, h + 4, 0, '#f2e4c6', OUT, 3);
  ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h);
  // Sprossen
  S.fillRR(x + w / 2 - 4, y, 8, h, 0, '#f2e4c6', OUT, 2);
  S.fillRR(x, y + h * .43 - 4, w, 8, 0, '#f2e4c6', OUT, 2);
  // Fensterbank
  S.fillRR(x - 16, y + h + 6, w + 32, 13, 4, '#e6d2ae', OUT, 3);
  // Vorhänge
  ctx.fillStyle = 'rgba(228,87,46,.78)';
  ctx.beginPath(); ctx.moveTo(x - 6, y - 6); ctx.quadraticCurveTo(x + 20, y + 40, x - 2, y + h); ctx.lineTo(x - 6, y + h); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x + w + 6, y - 6); ctx.quadraticCurveTo(x + w - 20, y + 40, x + w + 2, y + h); ctx.lineTo(x + w + 6, y + h); ctx.closePath(); ctx.fill();
  S.line(x - 6, y - 6, x - 2, y + h, OUT, 1.4); S.line(x + w + 6, y - 6, x + w + 2, y + h, OUT, 1.4);

  if (o.broken) {
    // Einschlagloch mit Rissen
    const cx = x + w * .7, cy = y + h * .42;
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,.15)';
    ctx.beginPath();
    for (let i = 0; i < 16; i++) {
      const a = i / 16 * S.TAU, rad = i % 2 ? 30 : 54;
      ctx[i ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * rad, cy + Math.sin(a) * rad * .8);
    }
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 2.2;
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * S.TAU + .2;
      ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * 20, cy + Math.sin(a) * 16);
      ctx.lineTo(cx + Math.cos(a) * (70 + (i % 3) * 22), cy + Math.sin(a) * (55 + (i % 2) * 22)); ctx.stroke();
    }
    ctx.restore();
    // Glasscherben im Rahmen
    ctx.fillStyle = 'rgba(210,245,255,.8)';
    ctx.beginPath(); ctx.moveTo(x + w * .55, y + 2); ctx.lineTo(x + w * .62, y + 18); ctx.lineTo(x + w * .58, y + 30); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x + w, y + h * .18); ctx.lineTo(x + w - 16, y + h * .24); ctx.lineTo(x + w, y + h * .32); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

// --------------------------------------------------------------------------
// Kleinigkeiten im Klassenzimmer
// --------------------------------------------------------------------------
function drawDoor(x, y, w, h, o = {}) {
  S.fillRR(x - 5, y - 5, w + 10, h + 5, 3, '#8b5a35', OUT, 3);
  S.fillRR(x, y, w, h, 2, '#c98c54', null);
  S.fillRR(x + 9, y + 12, w - 18, h * .38, 3, null, OUT, 2);
  S.fillRR(x + 9, y + h * .55, w - 18, h * .32, 3, null, OUT, 2);
  S.circle(x + w - 13, y + h * .52, 3.6, '#ffc145', OUT, 1.6);
  if (o.sign) {
    S.fillRR(x + 7, y - 26, w - 14, 20, 3, '#f4e7cd', OUT, 2);
    S.txt(o.sign, x + w / 2, y - 11, { size: 12, align: 'center', color: OUT });
  }
}
function drawPoster(x, y, w, h, o = {}) {
  S.fillRR(x, y, w, h, 3, '#f8f0dc', OUT, 2.4);
  ctx.save(); ctx.beginPath(); S.rr(x, y, w, h, 3); ctx.clip();
  ctx.fillStyle = '#ffd76a'; ctx.beginPath(); ctx.arc(x + w / 2, y + h * .38, 16, 0, S.TAU); ctx.fill();
  for (let i = 0; i < 8; i++) { const a = i / 8 * S.TAU; S.line(x + w / 2 + Math.cos(a) * 22, y + h * .38 + Math.sin(a) * 22, x + w / 2 + Math.cos(a) * 30, y + h * .38 + Math.sin(a) * 30, '#ffd76a', 3); }
  S.txt(o.text ?? 'BALD FERIEN!', x + w / 2, y + h - 14, { size: 10, align: 'center', color: OUT, font: DISPLAY });
  ctx.restore();
}
function drawCloud(x, y, s = 1, alpha = 1) {
  ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(x, y, 18 * s, 0, S.TAU);
  ctx.arc(x + 20 * s, y - 8 * s, 22 * s, 0, S.TAU);
  ctx.arc(x + 46 * s, y, 17 * s, 0, S.TAU);
  ctx.rect(x, y - 3 * s, 47 * s, 20 * s);
  ctx.fill(); ctx.restore();
}
function drawSun(x, y, r, color = '#ffd76a') {
  ctx.save();
  ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, S.TAU); ctx.fill();
  ctx.globalAlpha = .25;
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * S.TAU + S.time * .04;
    S.line(x + Math.cos(a) * r * 1.15, y + Math.sin(a) * r * 1.15, x + Math.cos(a) * r * 1.6, y + Math.sin(a) * r * 1.6, color, 3);
  }
  ctx.restore();
}
function drawTree(x, y, s = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  S.fillRR(-7, -80, 14, 82, 4, '#7d5233', OUT, 2.4);
  S.circle(0, -104, 38, '#4c956c', OUT, 2.6);
  S.circle(-28, -86, 25, '#5aa878', OUT, 2.4);
  S.circle(28, -86, 27, '#3f8560', OUT, 2.4);
  S.circle(4, -126, 24, '#69b786', OUT, 2.2);
  ctx.restore();
}
function drawBush(x, y, s = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  S.circle(0, -20, 30, '#4c956c', OUT, 2.8);
  S.circle(-36, -9, 23, '#3f8560', OUT, 2.6);
  S.circle(36, -8, 24, '#5aa878', OUT, 2.6);
  S.circle(-18, -38, 18, '#69b786', OUT, 2.2);
  S.circle(20, -34, 16, '#58a874', OUT, 2.2);
  ctx.restore();
}
function drawLeafPile(x, y, s = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = '#d98f3d';
  ctx.beginPath(); ctx.ellipse(0, -8, 58, 24, 0, 0, S.TAU); ctx.fill();
  ctx.fillStyle = '#e8a94e'; ctx.beginPath(); ctx.ellipse(-22, -18, 34, 18, -.2, 0, S.TAU); ctx.fill();
  ctx.fillStyle = '#c6742c'; ctx.beginPath(); ctx.ellipse(24, -16, 32, 16, .2, 0, S.TAU); ctx.fill();
  for (let i = 0; i < 8; i++) {
    ctx.save(); ctx.translate(-46 + i * 13, -20 - (i % 3) * 7); ctx.rotate(i * .8);
    ctx.fillStyle = ['#e8a94e', '#c6742c', '#f0c26c'][i % 3];
    ctx.beginPath(); ctx.ellipse(0, 0, 6, 3, 0, 0, S.TAU); ctx.fill(); ctx.restore();
  }
  ctx.restore();
}
function drawPool(x, y, s = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  S.fillRR(-62, -24, 124, 28, 12, '#3f88c5', OUT, 3);
  S.fillRR(-54, -20, 108, 20, 9, '#8fd8ef', null);
  ctx.strokeStyle = 'rgba(255,255,255,.65)'; ctx.lineWidth = 2.4;
  for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(-20 + i * 26, -12, 12, 4, 0, 0, S.TAU); ctx.stroke(); }
  S.fillRR(-66, -2, 132, 10, 5, '#e4572e', OUT, 2.2);
  ctx.restore();
}
function drawFence(x1, x2, y, s = 1) {
  ctx.save();
  ctx.strokeStyle = '#7d8d6a'; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(x1, y - 34 * s); ctx.lineTo(x2, y - 34 * s); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x1, y - 14 * s); ctx.lineTo(x2, y - 14 * s); ctx.stroke();
  for (let x = x1; x <= x2; x += 46 * s) {
    S.fillRR(x - 3, y - 48 * s, 6, 50 * s, 2, '#8d9b78', OUT, 1.6);
    S.circle(x, y - 51 * s, 4.5 * s, '#8d9b78', OUT, 1.6);
  }
  ctx.restore();
}
function drawGate(x, y, s = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  // Pfosten
  S.fillRR(-92, -180, 18, 184, 5, '#4c956c', OUT, 3);
  S.fillRR(74, -180, 18, 184, 5, '#4c956c', OUT, 3);
  // Bogen
  ctx.strokeStyle = '#4c956c'; ctx.lineWidth = 18; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-84, -176); ctx.quadraticCurveTo(0, -238, 84, -176); ctx.stroke();
  ctx.strokeStyle = OUT; ctx.lineWidth = 2.4;
  ctx.beginPath(); ctx.moveTo(-84, -176); ctx.quadraticCurveTo(0, -238, 84, -176); ctx.stroke();
  // Schild
  S.fillRR(-74, -234, 148, 42, 8, '#f8f0dc', OUT, 3);
  S.txt('FERIEN!', 0, -207, { size: 25, align: 'center', color: '#d1495b', font: DISPLAY });
  // Flatterband
  for (let i = -80; i < 80; i += 20) {
    ctx.fillStyle = i % 40 === 0 ? '#e4572e' : '#ffc145';
    ctx.beginPath(); ctx.moveTo(i, -176); ctx.lineTo(i + 14, -176); ctx.lineTo(i + 7, -160); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}
function drawSchoolBuilding(x, baseY, w = 620, h = 330, o = {}) {
  ctx.save();
  // Hauptgebäude
  S.fillRR(x, baseY - h, w, h, 6, o.color ?? '#e7c9a1', OUT, 3.5);
  // Dach
  ctx.fillStyle = '#a7553d'; ctx.strokeStyle = OUT; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(x - 24, baseY - h); ctx.lineTo(x + w * .18, baseY - h - 54); ctx.lineTo(x + w * .82, baseY - h - 54); ctx.lineTo(x + w + 24, baseY - h); ctx.closePath(); ctx.fill(); ctx.stroke();
  // Ziegel
  ctx.strokeStyle = 'rgba(70,30,25,.18)'; ctx.lineWidth = 1.4;
  for (let i = 0; i < 5; i++) S.line(x + 30 + i * (w / 6), baseY - h - 42, x + 90 + i * (w / 6), baseY - h - 6, 'rgba(70,30,25,.18)', 1.2);
  // Fenster
  const cols = o.cols ?? 5, rows = o.rows ?? 2;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const wx = x + 44 + c * ((w - 88) / cols), wy = baseY - h + 42 + r * 108;
      const ww = (w - 88) / cols - 26, wh = 72;
      S.fillRR(wx, wy, ww, wh, 3, '#8fd4ed', OUT, 2.6);
      S.fillRR(wx + ww / 2 - 2, wy, 4, wh, 0, '#f2e4c6', OUT, 1.4);
      S.fillRR(wx, wy + wh / 2 - 2, ww, 4, 0, '#f2e4c6', OUT, 1.4);
      if (o.cheer && (r + c) % 2 === 0) {
        S.circle(wx + ww / 2, wy + wh - 14, 5, '#f0bd87', OUT, 1.6);
        S.line(wx + ww / 2 - 5, wy + wh - 4, wx + ww / 2 + 5, wy + wh - 4, '#f0bd87', 3);
      }
    }
  }
  // Tür
  const dx = x + w * .5 - 38;
  S.fillRR(dx, baseY - 112, 76, 112, 4, '#8b5a35', OUT, 3);
  S.fillRR(dx + 10, baseY - 102, 56, 92, 2, '#5b3a26', null);
  S.fillRR(dx + 18, baseY - 94, 40, 30, 2, 'rgba(255,214,120,.55)', null);
  S.circle(dx + 60, baseY - 52, 3.4, '#ffc145', OUT, 1.4);
  // Schild
  S.fillRR(x + w * .5 - 92, baseY - h - 20, 184, 36, 6, '#f8f0dc', OUT, 3);
  S.txt(o.sign ?? 'SCHULE', x + w * .5, baseY - h + 6, { size: 22, align: 'center', color: OUT, font: DISPLAY });
  // Risse / Efeu
  ctx.strokeStyle = 'rgba(90,60,40,.25)'; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(x + 24, baseY - h + 10); ctx.lineTo(x + 44, baseY - h + 48); ctx.lineTo(x + 30, baseY - h + 86); ctx.stroke();
  ctx.restore();
}
function drawBird(x, y, s = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.strokeStyle = OUT; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-9, 0); ctx.quadraticCurveTo(-4, -6, 0, 0); ctx.quadraticCurveTo(4, -6, 9, 0); ctx.stroke();
  ctx.restore();
}

// --------------------------------------------------------------------------
// Flaschen
// --------------------------------------------------------------------------
function drawBottle(x, y, label, color, o = {}) {
  const s = o.scale ?? 1;
  const glow = o.glow ?? 0;
  const tilt = o.tilt ?? 0;
  ctx.save(); ctx.translate(x, y); ctx.rotate(tilt); ctx.scale(s, s);
  if (glow > 0) {
    const g = ctx.createRadialGradient(0, -34, 4, 0, -34, 58);
    g.addColorStop(0, `rgba(255,241,150,${.4 * glow})`); g.addColorStop(1, 'rgba(255,241,150,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, -34, 58, 0, S.TAU); ctx.fill();
  }
  // Körper
  S.fillRR(-17, -54, 34, 56, 8, 'rgba(235,250,255,.82)', OUT, 2.6);
  // Flüssigkeit
  ctx.save(); ctx.beginPath(); S.rr(-14, -48, 28, 47, 5); ctx.clip();
  ctx.fillStyle = color; ctx.fillRect(-17, -23, 34, 30);
  ctx.fillStyle = 'rgba(255,255,255,.28)'; ctx.fillRect(-17, -23, 34, 3);
  ctx.restore();
  // Hals
  S.fillRR(-8, -70, 16, 20, 3, 'rgba(235,250,255,.82)', OUT, 2.4);
  // Korken
  S.fillRR(-9, -79, 18, 11, 3, '#b98a55', OUT, 2.2);
  S.line(-6, -76, -6, -71, 'rgba(80,50,20,.35)', 1.4);
  // Etikett
  S.fillRR(-15, -44, 30, 24, 3, '#f8f0dc', OUT, 1.8);
  const words = label.split('-');
  S.txt(words[0], 0, -34, { size: 7.5, align: 'center', color: OUT, font: DISPLAY, weight: 800 });
  if (words[1]) S.txt(words[1], 0, -25, { size: 7.5, align: 'center', color: OUT, font: DISPLAY, weight: 800 });
  // Totenkopf
  if (o.skull) {
    const sy = -58;
    S.circle(0, sy, 6, '#e8e2d4', OUT, 1.4);
    S.circle(-2.3, sy - .5, 1.4, OUT); S.circle(2.3, sy - .5, 1.4, OUT);
    S.line(-2.5, sy + 4, 2.5, sy + 4, OUT, 1.2);
  }
  // Glanz
  S.line(-11, -48, -11, -10, 'rgba(255,255,255,.6)', 2.4);
  ctx.restore();
}

Object.assign(S, {
  drawSeatedKid, drawDesk, drawBlackboard, drawClock, drawWindow, drawDoor,
  drawPoster, drawCloud, drawSun, drawTree, drawBush, drawLeafPile, drawPool,
  drawFence, drawGate, drawSchoolBuilding, drawBird, drawBottle, CHALK
});
})();
