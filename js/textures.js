import * as THREE from '../vendor/three.module.js';
import { rand, randInt } from './config.js';

/* All art is generated at runtime: no external image or font requests. */

function noiseOverlay(g, size, amount, alpha = 1) {
  const img = g.getImageData(0, 0, size, size);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * amount;
    d[i] = Math.max(0, Math.min(255, d[i] + n));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n));
    if (alpha < 1) d[i + 3] = Math.round(d[i + 3] * alpha);
  }
  g.putImageData(img, 0, 0);
}

function stains(g, size, count, color, maxR = 90, alpha = 0.08) {
  for (let i = 0; i < count; i++) {
    const x = rand(0, size);
    const y = rand(0, size);
    const r = rand(maxR * 0.16, maxR);
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, `rgba(${color},${rand(alpha * 0.5, alpha)})`);
    grd.addColorStop(1, `rgba(${color},0)`);
    g.fillStyle = grd;
    g.beginPath();
    g.ellipse(x, y, r * rand(0.55, 1.3), r * rand(0.4, 1.1), rand(0, Math.PI), 0, Math.PI * 2);
    g.fill();
  }
}

function cracks(g, size, count, color, width = 1) {
  g.strokeStyle = color;
  g.lineCap = 'round';
  for (let i = 0; i < count; i++) {
    let x = rand(0, size);
    let y = rand(0, size);
    g.lineWidth = rand(0.5, width);
    g.beginPath();
    g.moveTo(x, y);
    const steps = randInt(3, 10);
    let a = rand(0, Math.PI * 2);
    for (let s = 0; s < steps; s++) {
      a += rand(-0.9, 0.9);
      x += Math.cos(a) * rand(5, 26);
      y += Math.sin(a) * rand(5, 26);
      g.lineTo(x, y);
    }
    g.stroke();
  }
}

function createCanvasTexture(size, paint, repeatX = 1, repeatY = 1, renderer) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext('2d');
  paint(g, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  tex.needsUpdate = true;
  return tex;
}

function makeGlowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.18, 'rgba(255,244,196,0.9)');
  grd.addColorStop(0.42, 'rgba(255,196,54,0.35)');
  grd.addColorStop(0.72, 'rgba(255,160,20,0.08)');
  grd.addColorStop(1, 'rgba(255,160,20,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function makeSign(text, color = '#9fe6b4', bg = '#07130b') {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, 512, 128);
  g.strokeStyle = color;
  g.lineWidth = 4;
  g.globalAlpha = 0.5;
  g.strokeRect(8, 8, 496, 112);
  g.globalAlpha = 1;
  g.font = 'bold 62px "Trebuchet MS", Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = color;
  g.shadowBlur = 26;
  g.fillStyle = color;
  g.fillText(text, 256, 68);
  g.shadowBlur = 0;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    toneMapped: false,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
}

export function createAssets(renderer) {
  const wall = createCanvasTexture(512, (g, S) => {
    g.fillStyle = '#55564d';
    g.fillRect(0, 0, S, S);
    stains(g, S, 55, '18,20,15', 120, 0.22);
    stains(g, S, 25, '120,116,98', 60, 0.12);
    // long damp streaks
    for (let i = 0; i < 34; i++) {
      const x = rand(0, S);
      const y = rand(0, S * 0.6);
      const w = rand(2, 16);
      const h = rand(30, 210);
      const grd = g.createLinearGradient(x, y, x, y + h);
      grd.addColorStop(0, 'rgba(20,24,18,0)');
      grd.addColorStop(0.35, `rgba(20,24,18,${rand(0.08, 0.28)})`);
      grd.addColorStop(1, 'rgba(20,24,18,0)');
      g.fillStyle = grd;
      g.fillRect(x, y, w, h);
    }
    // chipped paint
    for (let i = 0; i < 160; i++) {
      const x = rand(0, S);
      const y = rand(0, S);
      g.fillStyle = `rgba(${randInt(70, 110)},${randInt(70, 105)},${randInt(60, 90)},${rand(0.05, 0.25)})`;
      g.beginPath();
      g.ellipse(x, y, rand(1, 7), rand(1, 4), rand(0, 3), 0, Math.PI * 2);
      g.fill();
    }
    // horizontal tiling seams
    g.fillStyle = 'rgba(24,26,21,0.35)';
    g.fillRect(0, S * 0.48, S, 2);
    g.fillRect(0, S * 0.98, S, 2);
    cracks(g, S, 14, 'rgba(20,22,18,0.38)', 1.6);
    // floor grime
    const grime = g.createLinearGradient(0, S * 0.72, 0, S);
    grime.addColorStop(0, 'rgba(12,14,10,0)');
    grime.addColorStop(1, 'rgba(10,12,9,0.55)');
    g.fillStyle = grime;
    g.fillRect(0, S * 0.72, S, S * 0.28);
    noiseOverlay(g, S, 26);
  }, 2, 1.35, renderer);

  const floor = createCanvasTexture(512, (g, S) => {
    g.fillStyle = '#34352e';
    g.fillRect(0, 0, S, S);
    const tile = S / 4;
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        const shade = randInt(-9, 9);
        g.fillStyle = `rgb(${58 + shade},${59 + shade},${50 + shade})`;
        g.fillRect(x * tile + 3, y * tile + 3, tile - 6, tile - 6);
        g.fillStyle = `rgba(210,208,186,${rand(0.01, 0.05)})`;
        g.fillRect(x * tile + 8, y * tile + 8, tile - 16, rand(3, 14));
      }
    }
    g.strokeStyle = 'rgba(17,18,14,0.9)';
    g.lineWidth = 5;
    for (let i = 0; i <= 4; i++) {
      g.beginPath(); g.moveTo(i * tile, 0); g.lineTo(i * tile, S); g.stroke();
      g.beginPath(); g.moveTo(0, i * tile); g.lineTo(S, i * tile); g.stroke();
    }
    stains(g, S, 40, '12,14,10', 110, 0.28);
    cracks(g, S, 22, 'rgba(12,14,10,0.45)', 1.2);
    // scuffs
    for (let i = 0; i < 55; i++) {
      g.strokeStyle = `rgba(14,15,12,${rand(0.08, 0.3)})`;
      g.lineWidth = rand(0.5, 2.4);
      g.beginPath();
      const x = rand(0, S), y = rand(0, S);
      g.moveTo(x, y);
      g.lineTo(x + rand(-45, 45), y + rand(-8, 8));
      g.stroke();
    }
    noiseOverlay(g, S, 22);
  }, 9, 9, renderer);

  const ceiling = createCanvasTexture(512, (g, S) => {
    g.fillStyle = '#8d8c7d';
    g.fillRect(0, 0, S, S);
    const tile = S / 3;
    for (let y = 0; y < 3; y++) {
      for (let x = 0; x < 3; x++) {
        const v = randInt(-8, 8);
        g.fillStyle = `rgb(${140 + v},${139 + v},${123 + v})`;
        g.fillRect(x * tile + 4, y * tile + 4, tile - 8, tile - 8);
      }
    }
    g.strokeStyle = 'rgba(42,43,36,0.85)';
    g.lineWidth = 5;
    for (let i = 0; i <= 3; i++) {
      g.beginPath(); g.moveTo(i * tile, 0); g.lineTo(i * tile, S); g.stroke();
      g.beginPath(); g.moveTo(0, i * tile); g.lineTo(S, i * tile); g.stroke();
    }
    stains(g, S, 34, '60,58,42', 100, 0.22);
    stains(g, S, 18, '30,32,24', 50, 0.16);
    for (let i = 0; i < 8; i++) {
      g.strokeStyle = 'rgba(50,50,40,0.3)';
      g.lineWidth = rand(1, 3);
      g.beginPath();
      const x = rand(0, S), y = rand(0, S);
      g.moveTo(x, y);
      g.lineTo(x + rand(-120, 120), y + rand(-30, 30));
      g.stroke();
    }
    noiseOverlay(g, S, 16);
  }, 6, 6, renderer);

  const fabric = createCanvasTexture(256, (g, S) => {
    g.fillStyle = '#8b8877';
    g.fillRect(0, 0, S, S);
    for (let i = 0; i < 2400; i++) {
      g.fillStyle = `rgba(${randInt(70, 150)},${randInt(68, 145)},${randInt(58, 120)},${rand(0.06, 0.24)})`;
      g.fillRect(rand(0, S), rand(0, S), rand(1, 3), rand(1, 3));
    }
    stains(g, S, 16, '60,50,30', 55, 0.22);
    noiseOverlay(g, S, 18);
  }, 2, 2, renderer);

  const metal = createCanvasTexture(256, (g, S) => {
    const grd = g.createLinearGradient(0, 0, S, 0);
    grd.addColorStop(0, '#4d514e');
    grd.addColorStop(0.22, '#777c74');
    grd.addColorStop(0.45, '#555a55');
    grd.addColorStop(0.7, '#7f847b');
    grd.addColorStop(1, '#454945');
    g.fillStyle = grd;
    g.fillRect(0, 0, S, S);
    for (let i = 0; i < 90; i++) {
      g.strokeStyle = `rgba(255,255,245,${rand(0.01, 0.08)})`;
      g.lineWidth = rand(0.4, 1.6);
      g.beginPath();
      const y = rand(0, S);
      g.moveTo(0, y);
      g.lineTo(S, y + rand(-3, 3));
      g.stroke();
    }
    stains(g, S, 20, '90,48,22', 35, 0.22);
    noiseOverlay(g, S, 18);
  }, 1, 1, renderer);

  const skin = createCanvasTexture(256, (g, S) => {
    g.fillStyle = '#6f604c';
    g.fillRect(0, 0, S, S);
    stains(g, S, 60, '40,32,24', 55, 0.28);
    stains(g, S, 40, '135,120,92', 30, 0.18);
    // veins / creases
    for (let i = 0; i < 42; i++) {
      g.strokeStyle = `rgba(${randInt(30, 65)},${randInt(24, 50)},${randInt(18, 38)},${rand(0.12, 0.4)})`;
      g.lineWidth = rand(0.4, 1.5);
      g.beginPath();
      let x = rand(0, S), y = rand(0, S);
      g.moveTo(x, y);
      for (let s = 0; s < 4; s++) {
        x += rand(-34, 34);
        y += rand(-34, 34);
        g.lineTo(x, y);
      }
      g.stroke();
    }
    noiseOverlay(g, S, 24);
  }, 1, 1, renderer);

  const robe = createCanvasTexture(256, (g, S) => {
    g.fillStyle = '#20201f';
    g.fillRect(0, 0, S, S);
    for (let i = 0; i < 70; i++) {
      const x = rand(0, S);
      g.strokeStyle = `rgba(${randInt(4, 24)},${randInt(4, 24)},${randInt(4, 22)},${rand(0.2, 0.6)})`;
      g.lineWidth = rand(1, 8);
      g.beginPath();
      g.moveTo(x, 0);
      g.bezierCurveTo(x + rand(-20, 20), S * 0.35, x + rand(-30, 30), S * 0.7, x + rand(-24, 24), S);
      g.stroke();
    }
    for (let i = 0; i < 500; i++) {
      g.fillStyle = `rgba(90,88,80,${rand(0.02, 0.1)})`;
      g.fillRect(rand(0, S), rand(0, S), 1, rand(1, 4));
    }
    noiseOverlay(g, S, 10);
  }, 2, 2, renderer);

  const blood = createCanvasTexture(512, (g, S) => {
    g.clearRect(0, 0, S, S);
    const cx = S / 2, cy = S / 2;
    for (let i = 0; i < 32; i++) {
      const a = rand(0, Math.PI * 2);
      const r = rand(8, 120);
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      g.fillStyle = `rgba(${randInt(70, 135)},${randInt(2, 18)},${randInt(2, 12)},${rand(0.35, 0.9)})`;
      g.beginPath();
      g.ellipse(x, y, rand(2, 22), rand(2, 16), rand(0, 3), 0, Math.PI * 2);
      g.fill();
    }
    for (let i = 0; i < 26; i++) {
      const a = rand(0, Math.PI * 2);
      const r = rand(80, 240);
      g.fillStyle = `rgba(${randInt(60, 120)},4,4,${rand(0.6, 1)})`;
      g.beginPath();
      g.ellipse(cx + Math.cos(a) * r, cy + Math.sin(a) * r, rand(0.8, 4), rand(0.8, 4), 0, 0, Math.PI * 2);
      g.fill();
    }
    const grd = g.createRadialGradient(cx, cy, 4, cx, cy, 150);
    grd.addColorStop(0, 'rgba(95,5,5,0.75)');
    grd.addColorStop(1, 'rgba(80,3,3,0)');
    g.fillStyle = grd;
    g.beginPath();
    g.arc(cx, cy, 150, 0, Math.PI * 2);
    g.fill();
  }, 1, 1, renderer);
  blood.wrapS = blood.wrapT = THREE.ClampToEdgeWrapping;

  const door = createCanvasTexture(256, (g, S) => {
    g.fillStyle = '#5b635b';
    g.fillRect(0, 0, S, S);
    g.strokeStyle = 'rgba(28,32,28,0.9)';
    g.lineWidth = 10;
    g.strokeRect(16, 16, S - 32, S - 32);
    g.strokeStyle = 'rgba(170,176,160,0.22)';
    g.lineWidth = 2;
    g.strokeRect(32, 32, S - 64, S - 64);
    g.fillStyle = 'rgba(40,45,40,0.5)';
    g.fillRect(58, 74, S - 116, 60);
    stains(g, S, 24, '30,24,14', 40, 0.3);
    noiseOverlay(g, S, 20);
  }, 1, 1, renderer);

  const glow = makeGlowTexture();

  const mats = {
    wall: new THREE.MeshStandardMaterial({ map: wall, bumpMap: wall, bumpScale: 0.28, color: 0xa6a89a, roughness: 0.94, metalness: 0.03 }),
    floor: new THREE.MeshStandardMaterial({ map: floor, bumpMap: floor, bumpScale: 0.22, color: 0x969a90, roughness: 0.9, metalness: 0.06 }),
    ceiling: new THREE.MeshStandardMaterial({ map: ceiling, bumpMap: ceiling, bumpScale: 0.14, color: 0x9fa196, roughness: 0.96, metalness: 0.02 }),
    fabric: new THREE.MeshStandardMaterial({ map: fabric, bumpMap: fabric, bumpScale: 0.08, color: 0xb9b4a2, roughness: 0.98 }),
    metal: new THREE.MeshStandardMaterial({ map: metal, color: 0x9fa39c, roughness: 0.56, metalness: 0.6 }),
    metalDark: new THREE.MeshStandardMaterial({ color: 0x313531, roughness: 0.62, metalness: 0.55 }),
    mattress: new THREE.MeshStandardMaterial({ map: fabric, bumpMap: fabric, bumpScale: 0.08, color: 0x99978a, roughness: 1 }),
    sheet: new THREE.MeshStandardMaterial({ color: 0xb8b3a2, roughness: 0.97 }),
    door: new THREE.MeshStandardMaterial({ map: door, color: 0x8b9287, roughness: 0.68, metalness: 0.3 }),
    blood: new THREE.MeshStandardMaterial({
      map: blood, color: 0x8f1717, transparent: true, roughness: 0.55,
      depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2,
    }),
    bone: new THREE.MeshStandardMaterial({ color: 0xd2c8ab, roughness: 0.58, metalness: 0.02 }),
    skin: new THREE.MeshStandardMaterial({
      map: skin, bumpMap: skin, bumpScale: 0.22, color: 0x96846d, roughness: 0.88, metalness: 0.02,
      emissive: 0x0d0804, emissiveIntensity: 0.9,
    }),
    robe: new THREE.MeshStandardMaterial({ map: robe, color: 0x3a3a3a, roughness: 0.96, emissive: 0x030303, emissiveIntensity: 1 }),
    black: new THREE.MeshBasicMaterial({ color: 0x000000 }),
    eye: new THREE.MeshBasicMaterial({ color: 0xffd23a, toneMapped: false }),
    exitRed: new THREE.MeshStandardMaterial({
      color: 0x230606, emissive: 0x7a0b0b, emissiveIntensity: 0.85, roughness: 0.55, metalness: 0.45,
    }),
    exitGreen: new THREE.MeshStandardMaterial({
      color: 0x04140a, emissive: 0x11a34c, emissiveIntensity: 0.62, roughness: 0.5, metalness: 0.35,
    }),
    porcelain: new THREE.MeshStandardMaterial({ color: 0xbcbcb0, roughness: 0.32, metalness: 0.05 }),
  };

  return { tex: { wall, floor, ceiling, fabric, metal, skin, robe, blood, door }, glow, mats };
}
