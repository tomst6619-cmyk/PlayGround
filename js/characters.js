import { rr, TAU, clamp } from './utils.js';

/* A tiny blocky-person renderer. Everything is drawn from primitives so the
   game ships without image assets and still holds up at any resolution. */

const DEFAULT_PAL = {
  skin: '#f0c39c',
  skinShade: '#d9a37c',
  hair: '#ffd35c',
  hairShade: '#e0a92f',
  shirt: '#2f7cf6',
  shirtShade: '#1f5cc2',
  pants: '#2b3346',
  shoes: '#f4f4f4',
};

function hairBack(ctx, pal, style) {
  ctx.fillStyle = pal.hair;
  if (style === 'long') {
    ctx.beginPath();
    ctx.moveTo(-20, -14);
    ctx.quadraticCurveTo(-25, 10, -19, 22);
    ctx.quadraticCurveTo(-10, 26, -12, 14);
    ctx.lineTo(12, 14);
    ctx.quadraticCurveTo(10, 26, 19, 22);
    ctx.quadraticCurveTo(25, 10, 20, -14);
    ctx.closePath();
    ctx.fill();
  }
  if (style === 'bun') {
    ctx.beginPath();
    ctx.arc(0, -25, 10, 0, TAU);
    ctx.fill();
    ctx.fillStyle = pal.hairShade;
    ctx.beginPath();
    ctx.arc(0, -25, 10, 0.4, 2.4);
    ctx.lineWidth = 3;
    ctx.strokeStyle = pal.hairShade;
    ctx.stroke();
  }
}

function hairFront(ctx, pal, style, f) {
  const { hair, hairShade } = pal;
  ctx.fillStyle = hair;

  if (style === 'swoop') {
    ctx.beginPath();
    ctx.moveTo(-19, 4);
    ctx.quadraticCurveTo(-23, -8, -17, -17);
    ctx.lineTo(-13, -11);
    ctx.lineTo(-10, -23);
    ctx.lineTo(-4, -15);
    ctx.lineTo(0, -25);
    ctx.lineTo(5, -15);
    ctx.lineTo(11, -22);
    ctx.lineTo(14, -12);
    ctx.quadraticCurveTo(22, -9, 19, 3);
    ctx.quadraticCurveTo(10, -7, 2, -5);
    ctx.quadraticCurveTo(-9, -7, -19, 4);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-12, -14);
    ctx.quadraticCurveTo(-4, -21, 6, -16);
    ctx.stroke();
    ctx.fillStyle = hairShade;
    ctx.beginPath();
    ctx.moveTo(-19, 4);
    ctx.quadraticCurveTo(-23, -8, -17, -17);
    ctx.lineTo(-14, -12);
    ctx.quadraticCurveTo(-18, -4, -16, 2);
    ctx.closePath();
    ctx.fill();
    return;
  }

  if (style === 'curly') {
    for (const [x, y, r] of [
      [-14, -14, 8], [-7, -21, 9], [1, -23, 9], [9, -20, 8], [16, -13, 7], [-18, -5, 6], [18, -4, 6],
    ]) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = hairShade;
    ctx.beginPath();
    ctx.arc(-6, -19, 3.4, 0, TAU);
    ctx.arc(7, -16, 2.6, 0, TAU);
    ctx.fill();
    return;
  }

  if (style === 'bun') {
    ctx.beginPath();
    ctx.moveTo(-19, 1);
    ctx.quadraticCurveTo(-21, -16, -6, -20);
    ctx.quadraticCurveTo(9, -24, 18, -14);
    ctx.quadraticCurveTo(22, -6, 19, 1);
    ctx.quadraticCurveTo(12, -8, 2, -7);
    ctx.quadraticCurveTo(-8, -8, -19, 1);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-12, -13);
    ctx.quadraticCurveTo(0, -18, 12, -12);
    ctx.stroke();
    return;
  }

  if (style === 'beanie') {
    ctx.fillStyle = pal.beanie || '#e45d6c';
    ctx.beginPath();
    ctx.moveTo(-20, -6);
    ctx.quadraticCurveTo(-20, -26, 0, -27);
    ctx.quadraticCurveTo(20, -26, 20, -6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.24)';
    rr(ctx, -20, -9, 40, 7, 3);
    ctx.fill();
    ctx.fillStyle = pal.beanieDark || '#b43d50';
    ctx.beginPath();
    ctx.arc(0, -29, 5, 0, TAU);
    ctx.fill();
    return;
  }

  if (style === 'cap') {
    ctx.fillStyle = pal.cap || '#3c7bd4';
    ctx.beginPath();
    ctx.moveTo(-19, -2);
    ctx.quadraticCurveTo(-18, -22, 0, -22);
    ctx.quadraticCurveTo(18, -22, 19, -2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = pal.capDark || '#2a5aa0';
    ctx.beginPath();
    ctx.ellipse(2 * f, -2, 22, 7, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    ctx.arc(-4, -15, 3.5, 0, TAU);
    ctx.fill();
    return;
  }

  // long / default: soft fringe
  ctx.beginPath();
  ctx.moveTo(-19, 2);
  ctx.quadraticCurveTo(-21, -17, -4, -21);
  ctx.quadraticCurveTo(12, -24, 19, -12);
  ctx.quadraticCurveTo(23, -4, 19, 2);
  ctx.quadraticCurveTo(12, -8, 3, -6);
  ctx.quadraticCurveTo(-9, -7, -19, 2);
  ctx.closePath();
  ctx.fill();
}

/** Head centred at (0,0), roughly 38 wide, 36 tall. */
export function drawHead(ctx, pal, { mood = 'sad', f = 1, accessory = null, t = 0, blinkPhase = 0 } = {}) {
  // ears
  ctx.fillStyle = pal.skinShade;
  ctx.beginPath();
  ctx.ellipse(-19, 1, 4, 5, 0, 0, TAU);
  ctx.ellipse(19, 1, 4, 5, 0, 0, TAU);
  ctx.fill();

  // face
  const faceGrad = ctx.createLinearGradient(0, -18, 0, 18);
  faceGrad.addColorStop(0, pal.skin);
  faceGrad.addColorStop(1, pal.skinShade);
  ctx.fillStyle = faceGrad;
  rr(ctx, -18, -18, 36, 36, 11);
  ctx.fill();

  // eyes
  const eyeY = -1;
  const look = clamp(f, -1, 1) * 1.6;
  const blink = Math.sin((t + (blinkPhase || 0)) * 2.15) > 0.984;
  if (blink) {
    ctx.fillStyle = pal.skinShade;
    rr(ctx, -14, eyeY - 4, 28, 10, 4);
    ctx.fill();
    ctx.strokeStyle = 'rgba(60,40,30,0.55)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-12, eyeY + 1);
    ctx.lineTo(-4, eyeY + 1);
    ctx.moveTo(4, eyeY + 1);
    ctx.lineTo(12, eyeY + 1);
    ctx.stroke();
  } else {
    for (const ex of [-8, 8]) {
      ctx.fillStyle = '#221c24';
      rr(ctx, ex - 4 + look, eyeY - 3.2, 8, 9, 3.6);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath();
      ctx.arc(ex - 1.2 + look, eyeY - 0.6, 1.7, 0, TAU);
      ctx.fill();
    }
  }

  // brows — sad brows tilt inward, happy brows relax
  ctx.strokeStyle = pal.brow || 'rgba(60,40,30,0.72)';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  if (mood === 'sad') {
    ctx.beginPath();
    ctx.moveTo(-13, -8.5);
    ctx.lineTo(-5, -6.6);
    ctx.moveTo(13, -8.5);
    ctx.lineTo(5, -6.6);
    ctx.stroke();
  } else if (mood === 'happy') {
    ctx.beginPath();
    ctx.moveTo(-13, -7.4);
    ctx.quadraticCurveTo(-9, -9.6, -5, -8.2);
    ctx.moveTo(13, -7.4);
    ctx.quadraticCurveTo(9, -9.6, 5, -8.2);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(-13, -8);
    ctx.lineTo(-5, -8);
    ctx.moveTo(13, -8);
    ctx.lineTo(5, -8);
    ctx.stroke();
  }

  // mouth
  ctx.strokeStyle = '#7a4038';
  ctx.lineWidth = 1.9;
  ctx.beginPath();
  if (mood === 'happy') {
    ctx.moveTo(-5, 9.5);
    ctx.quadraticCurveTo(0, 14, 5, 9.5);
  } else if (mood === 'sad') {
    ctx.moveTo(-5, 12);
    ctx.quadraticCurveTo(0, 8.2, 5, 12);
  } else {
    ctx.moveTo(-3.5, 10.5);
    ctx.lineTo(3.5, 10.5);
  }
  ctx.stroke();

  // blush
  ctx.fillStyle = 'rgba(255,120,140,0.18)';
  ctx.beginPath();
  ctx.ellipse(-12, 6, 4.4, 2.6, 0, 0, TAU);
  ctx.ellipse(12, 6, 4.4, 2.6, 0, 0, TAU);
  ctx.fill();

  // accessory
  if (accessory === 'glasses') {
    ctx.strokeStyle = 'rgba(30,36,50,0.85)';
    ctx.lineWidth = 1.7;
    ctx.beginPath();
    ctx.arc(-8, eyeY + 1, 7.4, 0, TAU);
    ctx.moveTo(0.6, eyeY + 1);
    ctx.arc(8, eyeY + 1, 7.4, 0, TAU);
    ctx.moveTo(-15, eyeY + 1);
    ctx.lineTo(-18.5, eyeY - 1);
    ctx.moveTo(15, eyeY + 1);
    ctx.lineTo(18.5, eyeY - 1);
    ctx.stroke();
  }

  hairFront(ctx, pal, pal.hairStyle || 'swoop', f);
}

export function drawPortrait(canvas, pal, mood) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const bg = ctx.createRadialGradient(w * 0.5, h * 0.24, 8, w * 0.5, h * 0.62, w * 0.72);
  bg.addColorStop(0, '#43547f');
  bg.addColorStop(0.55, '#273251');
  bg.addColorStop(1, '#151a2b');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // soft spotlight + floating hearts
  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = '#ffd6a8';
  ctx.beginPath();
  ctx.ellipse(w * 0.5, h * 0.1, w * 0.42, h * 0.3, 0, 0, TAU);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(w / 2, h * 0.58);
  ctx.scale(3.4, 3.4);
  hairBack(ctx, pal, pal.hairStyle);
  // shoulders so the portrait reads as a person, not a floating head
  const shirt = ctx.createLinearGradient(0, 10, 0, 34);
  shirt.addColorStop(0, pal.shirt);
  shirt.addColorStop(1, pal.shirtShade || pal.shirt);
  ctx.fillStyle = shirt;
  rr(ctx, -23, 13, 46, 24, 9);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  rr(ctx, -7, 13, 14, 4, 2);
  ctx.fill();
  ctx.fillStyle = pal.skin;
  rr(ctx, -5, 7, 10, 9, 3);
  ctx.fill();
  drawHead(ctx, pal, { mood, f: 1, accessory: pal.accessory });
  ctx.restore();

  // vignette
  const vig = ctx.createRadialGradient(w / 2, h / 2, w * 0.24, w / 2, h / 2, w * 0.75);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);
}

const shade = (hex, amt) => {
  const n = parseInt(hex.slice(1), 16);
  const r = clamp(((n >> 16) & 255) + amt, 0, 255);
  const g = clamp(((n >> 8) & 255) + amt, 0, 255);
  const b = clamp((n & 255) + amt, 0, 255);
  return `rgb(${r},${g},${b})`;
};

export function drawCharacter(ctx, c, t) {
  const pal = { ...DEFAULT_PAL, ...c.pal };
  const f = c.dir < 0 ? -1 : 1;
  const phase = c.walkPhase || 0;
  const moving = c.moving;
  const bob = moving ? Math.abs(Math.sin(phase)) * 2.4 : Math.sin(t * 1.8 + (c.seed || 0)) * 0.7;
  const swing = moving ? Math.sin(phase) * 5 : 0;
  const scale = c.scale || 1;

  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.scale(scale, scale);

  // shadow
  ctx.fillStyle = 'rgba(10,14,22,0.32)';
  ctx.beginPath();
  ctx.ellipse(0, 1, 23, 8, 0, 0, TAU);
  ctx.fill();

  // cape (player)
  if (pal.cape) {
    const flutter = Math.sin(t * 2.6 + (c.seed || 0)) * 2.4 + (moving ? Math.sin(phase * 2) * 3.4 : 0);
    const g = ctx.createLinearGradient(0, -58, 0, -6);
    g.addColorStop(0, shade(pal.cape, 22));
    g.addColorStop(0.6, pal.cape);
    g.addColorStop(1, shade(pal.cape, -48));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-18, -56 + bob);
    ctx.quadraticCurveTo(-34, -38, -31, -7 + flutter);
    ctx.quadraticCurveTo(-21, -1 + flutter, -11, -9 + flutter);
    ctx.quadraticCurveTo(0, -2 + flutter, 11, -9 + flutter);
    ctx.quadraticCurveTo(21, -1 + flutter, 31, -7 + flutter);
    ctx.quadraticCurveTo(34, -38, 18, -56 + bob);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-30, -8 + flutter);
    ctx.quadraticCurveTo(-10, -3 + flutter, 0, -8 + flutter);
    ctx.quadraticCurveTo(10, -3 + flutter, 30, -8 + flutter);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-12, -44);
    ctx.quadraticCurveTo(-16, -26, -14, -12 + flutter);
    ctx.moveTo(12, -44);
    ctx.quadraticCurveTo(16, -26, 14, -12 + flutter);
    ctx.stroke();
  }

  // legs
  const legLift = moving ? Math.sin(phase) * 3 : 0;
  ctx.fillStyle = pal.pants;
  rr(ctx, -12, -24 + bob + Math.max(0, legLift), 10, 22, 4);
  ctx.fill();
  rr(ctx, 2, -24 + bob + Math.max(0, -legLift), 10, 22, 4);
  ctx.fill();
  ctx.fillStyle = pal.shoes;
  rr(ctx, -13, -5 + bob + Math.max(0, legLift), 12, 6, 3);
  ctx.fill();
  rr(ctx, 1, -5 + bob + Math.max(0, -legLift), 12, 6, 3);
  ctx.fill();

  // arms behind swing
  ctx.fillStyle = pal.skin;
  rr(ctx, -23, -50 + bob - swing * 0.5, 9, 16, 4.5);
  ctx.fill();
  rr(ctx, 14, -50 + bob + swing * 0.5, 9, 16, 4.5);
  ctx.fill();

  // torso
  const torsoGrad = ctx.createLinearGradient(0, -56 + bob, 0, -22 + bob);
  torsoGrad.addColorStop(0, pal.shirt);
  torsoGrad.addColorStop(1, pal.shirtShade);
  ctx.fillStyle = torsoGrad;
  rr(ctx, -16, -56 + bob, 32, 33, 8);
  ctx.fill();

  // sleeves
  ctx.fillStyle = pal.shirtShade;
  rr(ctx, -23, -54 + bob - swing * 0.5, 9, 14, 4.5);
  ctx.fill();
  rr(ctx, 14, -54 + bob + swing * 0.5, 9, 14, 4.5);
  ctx.fill();

  // collar
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  rr(ctx, -7, -56 + bob, 14, 4, 2);
  ctx.fill();

  if (pal.logo) {
    ctx.save();
    ctx.translate(0, -39 + bob);
    ctx.font = '900 8px "Arial Black", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.fillText(pal.logo, 0, 0);
    ctx.restore();
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    rr(ctx, -8, -45 + bob, 16, 3, 1.5);
    ctx.fill();
  }

  // head
  ctx.save();
  ctx.translate(0, -72 + bob);
  hairBack(ctx, pal, pal.hairStyle);
  drawHead(ctx, pal, { mood: c.mood || 'neutral', f, accessory: pal.accessory, t, blinkPhase: c.seed || 0 });
  ctx.restore();

  // name tag
  if (c.name) {
    const tag = c.name;
    ctx.font = '700 10px "Segoe UI", system-ui, sans-serif';
    const tw = ctx.measureText(tag).width;
    const pillW = tw + (c.forgiven ? 30 : 18);
    ctx.translate(0, -101 + bob * 0.4);
    ctx.fillStyle = c.forgiven ? 'rgba(84,26,48,0.82)' : 'rgba(14,18,30,0.72)';
    rr(ctx, -pillW / 2, -10, pillW, 19, 9.5);
    ctx.fill();
    ctx.strokeStyle = c.forgiven ? 'rgba(255,140,175,0.7)' : 'rgba(255,255,255,0.16)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = c.forgiven ? '#ffd7e4' : '#f2eee4';
    ctx.fillText(tag, c.forgiven ? -4 : 0, 0);
    if (c.forgiven) {
      ctx.fillStyle = '#ff7ea5';
      ctx.font = '10px sans-serif';
      ctx.fillText('♥', pillW / 2 - 8, 0);
    }
    ctx.translate(0, 101 - bob * 0.4);
  }

  // prompt bubble
  if (c.showPrompt) {
    const float = Math.sin(t * 4) * 2;
    const y = -122 + float;
    ctx.fillStyle = 'rgba(14,18,30,0.9)';
    ctx.beginPath();
    ctx.arc(0, y, 14, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#ffd27a';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#ffd27a';
    ctx.font = '800 12px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(c.promptText || 'E', 0, y + 0.5);
  }

  ctx.restore();
}
