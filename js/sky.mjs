import { clamp, distance, mulberry32 } from './logic.mjs';

const TAU = Math.PI * 2;

function makeCanvas(width, height, dpr = 1) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * dpr));
  canvas.height = Math.max(1, Math.round(height * dpr));
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  return { canvas, ctx, width, height, dpr };
}

export class SkyRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.skyLayer = document.createElement('div');
    this.skyLayer.className = 'sky-static';
    this.skyLayer.setAttribute('aria-hidden', 'true');
    canvas.parentNode.insertBefore(this.skyLayer, canvas);
    this.ctx = canvas.getContext('2d');
    this.w = 1;
    this.h = 1;
    this.dpr = 1;
    this.reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    this.stars = [];
    this.clouds = [];
    this.grainTiles = [];
    this.grainPatterns = [];
    this.glowCache = new Map();
    this.staticSky = null;
    this.ambientMeteor = null;
    this.ambientMeteorIn = 8;
    this.lastResize = 0;
    this.resize();
    window.addEventListener('resize', () => this.resize(), { passive: true });
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const width = Math.max(320, rect.width || window.innerWidth);
    const height = Math.max(320, rect.height || window.innerHeight);
    const dpr = clamp(window.devicePixelRatio || 1, 1, 2);
    this.w = width;
    this.h = height;
    this.dpr = dpr;
    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.layout();
  }

  layout() {
    const { w, h } = this;
    const random = mulberry32(917_431);
    this.moon = {
      x: w * (w < 620 ? 0.79 : 0.815),
      y: h * (w < 620 ? 0.145 : 0.17),
      r: clamp(Math.min(w, h) * 0.052, 22, 58),
    };

    this.stars = Array.from({ length: w < 620 ? 190 : 320 }, () => {
      const bright = random();
      return {
        x: random() * w,
        y: random() * h * 0.82,
        r: 0.35 + bright * bright * 1.65,
        alpha: 0.28 + bright * 0.72,
        phase: random() * TAU,
        speed: 0.35 + random() * 1.8,
        tint: random() < 0.14 ? 'warm' : random() < 0.25 ? 'blue' : 'white',
        cross: bright > 0.9,
      };
    });

    this.clouds = Array.from({ length: 4 }, (_, index) => ({
      x: random() * w,
      y: h * (0.4 + random() * 0.24),
      speed: 3 + random() * 7,
      scale: 0.8 + random() * 1.35,
      alpha: 0.06 + random() * 0.07,
      sprite: index % 2,
    }));

    this.cloudSprites = [this.buildCloudSprite(11), this.buildCloudSprite(29)];
    this.background = this.buildBackground();
    this.horizon = this.buildHorizon();
    this.grainTiles = [this.buildGrain(4), this.buildGrain(8), this.buildGrain(15), this.buildGrain(23)];
    this.grainPatterns = this.grainTiles.map((tile) => this.ctx.createPattern(tile, 'repeat'));
    this.craters = Array.from({ length: 9 }, () => ({
      x: (random() - 0.5) * 1.3,
      y: (random() - 0.5) * 1.3,
      r: 0.06 + random() * 0.13,
      alpha: 0.05 + random() * 0.11,
    })).filter((crater) => Math.hypot(crater.x, crater.y) < 0.62);
    this.staticSky = this.buildStaticSky();
    try {
      this.skyLayer.style.backgroundImage = `url("${this.staticSky.toDataURL('image/webp', 0.92)}")`;
    } catch {
      // If encoding fails, the renderer falls back to drawing the sky each frame.
    }
  }

  buildStaticSky() {
    const { w, h, dpr } = this;
    const { canvas, ctx } = makeCanvas(w, h, dpr);
    this.drawBackground(12.34, ctx, false);
    this.drawHorizon(ctx);
    return canvas;
  }

  buildBackground() {
    const { w, h, dpr } = this;
    const { canvas, ctx } = makeCanvas(w, h, dpr);
    const random = mulberry32(5_122_099);

    const gradient = ctx.createLinearGradient(0, 0, w * 0.2, h);
    gradient.addColorStop(0, '#01030a');
    gradient.addColorStop(0.34, '#030a16');
    gradient.addColorStop(0.64, '#061627');
    gradient.addColorStop(0.83, '#0a2031');
    gradient.addColorStop(1, '#0a1a22');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);

    const lowGlow = ctx.createRadialGradient(w * 0.28, h * 0.76, 0, w * 0.28, h * 0.76, w * 0.6);
    lowGlow.addColorStop(0, 'rgba(35, 98, 112, 0.12)');
    lowGlow.addColorStop(0.55, 'rgba(23, 63, 82, 0.05)');
    lowGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = lowGlow;
    ctx.fillRect(0, 0, w, h);

    const nebulae = [
      { x: 0.17, y: 0.6, r: 0.24, color: 'rgba(42, 122, 136, 0.16)' },
      { x: 0.74, y: 0.33, r: 0.3, color: 'rgba(72, 54, 128, 0.12)' },
      { x: 0.5, y: 0.5, r: 0.2, color: 'rgba(110, 48, 103, 0.08)' },
    ];
    for (const nebula of nebulae) {
      const glow = ctx.createRadialGradient(
        w * nebula.x,
        h * nebula.y,
        0,
        w * nebula.x,
        h * nebula.y,
        Math.max(w, h) * nebula.r,
      );
      glow.addColorStop(0, nebula.color);
      glow.addColorStop(0.5, nebula.color.replace(/[\d.]+\)$/, '0.035)'));
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);
    }

    // Milky Way: a soft diagonal band of dusty dots.
    ctx.save();
    ctx.translate(w * 0.46, h * 0.4);
    ctx.rotate(-0.62);
    const bandLength = Math.hypot(w, h) * 0.9;
    for (let i = 0; i < (w < 620 ? 850 : 1600); i += 1) {
      const t = random() * 2 - 1;
      const spread = (random() + random() + random() - 1.5) * bandLength * 0.085;
      const x = t * bandLength * 0.5;
      const y = spread;
      const size = 0.25 + random() * 0.7;
      const alpha = 0.04 + random() * 0.14;
      const tint = random();
      ctx.fillStyle = tint < 0.18
        ? `rgba(190, 210, 255, ${alpha})`
        : tint < 0.4
          ? `rgba(255, 226, 198, ${alpha * 0.8})`
          : `rgba(224, 242, 255, ${alpha})`;
      ctx.fillRect(x, y, size, size);
    }
    for (let i = 0; i < 7; i += 1) {
      const x = (random() - 0.5) * bandLength;
      const y = (random() - 0.5) * bandLength * 0.08;
      const r = bandLength * (0.04 + random() * 0.09);
      const glow = ctx.createRadialGradient(x, y, 0, x, y, r);
      glow.addColorStop(0, 'rgba(144, 177, 210, 0.045)');
      glow.addColorStop(0.6, 'rgba(119, 111, 178, 0.025)');
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    ctx.restore();

    // A very faint high haze near the horizon.
    const haze = ctx.createLinearGradient(0, h * 0.55, 0, h * 0.86);
    haze.addColorStop(0, 'rgba(35, 92, 112, 0)');
    haze.addColorStop(0.7, 'rgba(35, 92, 112, 0.06)');
    haze.addColorStop(1, 'rgba(74, 118, 124, 0)');
    ctx.fillStyle = haze;
    ctx.fillRect(0, h * 0.5, w, h * 0.4);

    return canvas;
  }

  buildCloudSprite(seed) {
    const { ctx, canvas } = makeCanvas(360, 150, 1);
    const random = mulberry32(seed);
    for (let i = 0; i < 12; i += 1) {
      const x = 60 + random() * 240;
      const y = 70 + random() * 35;
      const r = 28 + random() * 62;
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
      gradient.addColorStop(0, 'rgba(107, 142, 166, 0.4)');
      gradient.addColorStop(0.55, 'rgba(66, 101, 128, 0.2)');
      gradient.addColorStop(1, 'rgba(24, 47, 68, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    return canvas;
  }

  buildHorizon() {
    const { w, h, dpr } = this;
    const { canvas, ctx } = makeCanvas(w, h, dpr);
    const random = mulberry32(37_771);

    const ridge = (baseY, amplitude, colorTop, colorBottom, step) => {
      const points = [];
      for (let x = -20; x <= w + 20; x += step) {
        const noise = Math.sin(x * 0.006 + 1.4) * 0.5 + Math.sin(x * 0.017 + 0.7) * 0.5;
        const y = baseY + noise * amplitude + (random() - 0.5) * amplitude * 0.7;
        points.push([x, y]);
      }
      ctx.beginPath();
      ctx.moveTo(-20, h);
      for (const [x, y] of points) ctx.lineTo(x, y);
      ctx.lineTo(w + 20, h);
      ctx.closePath();
      const gradient = ctx.createLinearGradient(0, baseY - amplitude, 0, h);
      gradient.addColorStop(0, colorTop);
      gradient.addColorStop(1, colorBottom);
      ctx.fillStyle = gradient;
      ctx.fill();
      return points;
    };

    ridge(h * 0.805, h * 0.06, '#071522', '#030a12', Math.max(22, w / 26));

    // A low forest line on the near ridge.
    const nearBase = h * 0.882;
    ctx.beginPath();
    ctx.moveTo(-10, h);
    for (let x = -10; x <= w + 10; x += 9) {
      const noise = Math.sin(x * 0.011 + 2.2) * 8 + Math.sin(x * 0.027) * 5;
      ctx.lineTo(x, nearBase + noise + (random() - 0.5) * 4);
    }
    ctx.lineTo(w + 10, h);
    ctx.closePath();
    ctx.fillStyle = '#02070d';
    ctx.fill();

    // Pine silhouettes.
    ctx.fillStyle = '#02060b';
    for (let x = -10; x < w + 20; x += 17 + random() * 26) {
      const base = nearBase + Math.sin(x * 0.011 + 2.2) * 8 + Math.sin(x * 0.027) * 5 + 3;
      const height = 16 + random() * 42;
      const spread = height * (0.18 + random() * 0.07);
      for (let layer = 0; layer < 3; layer += 1) {
        const y = base - height * (layer * 0.22);
        const ly = height * (1 - layer * 0.19);
        const lx = spread * (1 - layer * 0.18);
        ctx.beginPath();
        ctx.moveTo(x, y - ly);
        ctx.lineTo(x - lx, y);
        ctx.lineTo(x + lx, y);
        ctx.closePath();
        ctx.fill();
      }
      ctx.fillRect(x - 1.2, base - 4, 2.4, 7);
    }

    // Small observatory dome on the far ridge.
    const domeX = w * 0.14;
    const domeY = h * 0.772;
    const domeR = clamp(w * 0.026, 17, 34);
    ctx.fillStyle = '#040b13';
    ctx.beginPath();
    ctx.arc(domeX, domeY, domeR, Math.PI, 0);
    ctx.lineTo(domeX + domeR, domeY + 13);
    ctx.lineTo(domeX - domeR, domeY + 13);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#02060b';
    ctx.fillRect(domeX - domeR * 0.18, domeY - domeR * 1.04, domeR * 0.36, domeR * 1.1);
    ctx.fillStyle = 'rgba(116, 239, 255, 0.28)';
    ctx.fillRect(domeX + domeR * 0.44, domeY + 3, 2.4, 3.4);

    // Foreground telescope silhouette, anchored bottom right.
    const scopeX = w * (w < 620 ? 0.84 : 0.88);
    const baseY = h + 18;
    const pivotY = h * 0.79;
    const unit = clamp(Math.min(w, h) * 0.2, 54, 180);
    ctx.save();
    ctx.translate(scopeX, baseY);
    ctx.fillStyle = '#010408';
    ctx.strokeStyle = '#010408';
    ctx.lineCap = 'round';

    // Tripod.
    ctx.lineWidth = Math.max(2.5, unit * 0.036);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-unit * 0.28, -unit * 0.7);
    ctx.moveTo(0, 0);
    ctx.lineTo(unit * 0.24, -unit * 0.72);
    ctx.moveTo(0, 0);
    ctx.lineTo(unit * 0.04, -unit * 0.55);
    ctx.stroke();

    // Tube pointing up and to the left.
    ctx.save();
    ctx.translate(unit * 0.05, -unit * 0.74);
    ctx.rotate(-0.78);
    ctx.fillStyle = '#02060b';
    ctx.beginPath();
    ctx.roundRect(-unit * 0.15, -unit * 0.1, unit * 0.66, unit * 0.2, unit * 0.05);
    ctx.fill();
    ctx.fillStyle = '#010408';
    ctx.beginPath();
    ctx.roundRect(unit * 0.48, -unit * 0.13, unit * 0.17, unit * 0.26, unit * 0.03);
    ctx.fill();
    ctx.strokeStyle = 'rgba(130, 219, 238, 0.16)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-unit * 0.13, -unit * 0.085);
    ctx.lineTo(unit * 0.45, -unit * 0.085);
    ctx.stroke();
    ctx.fillStyle = 'rgba(116, 239, 255, 0.22)';
    ctx.beginPath();
    ctx.ellipse(unit * 0.64, 0, unit * 0.014, unit * 0.09, 0, 0, TAU);
    ctx.fill();
    ctx.restore();

    // Counterweight and pivot.
    ctx.fillStyle = '#010408';
    ctx.beginPath();
    ctx.arc(unit * 0.05, -unit * 0.74, unit * 0.055, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(-unit * 0.11, -unit * 0.8, unit * 0.08, unit * 0.18, 3);
    ctx.fill();
    ctx.restore();

    return canvas;
  }

  buildGrain(seed) {
    const { ctx, canvas } = makeCanvas(160, 160, 1);
    const random = mulberry32(seed);
    const image = ctx.createImageData(160, 160);
    for (let i = 0; i < image.data.length; i += 4) {
      const value = random() * 255;
      image.data[i] = value;
      image.data[i + 1] = value;
      image.data[i + 2] = value;
      image.data[i + 3] = random() < 0.55 ? 24 : 0;
    }
    ctx.putImageData(image, 0, 0);
    return canvas;
  }

  buildLensVignette() {
    const { w, h } = this;
    const { canvas, ctx } = makeCanvas(w, h, this.dpr);
    const inner = ctx.createRadialGradient(w * 0.5, h * 0.46, Math.min(w, h) * 0.18, w * 0.5, h * 0.46, Math.max(w, h) * 0.68);
    inner.addColorStop(0, 'rgba(0,0,0,0)');
    inner.addColorStop(0.72, 'rgba(0,2,6,0.16)');
    inner.addColorStop(1, 'rgba(0,1,4,0.7)');
    ctx.fillStyle = inner;
    ctx.fillRect(0, 0, w, h);
    return canvas;
  }

  drawBackground(now, ctx = this.ctx, ambient = true) {
    const { w, h } = this;
    ctx.drawImage(this.background, 0, 0, w, h);

    const swayX = this.reducedMotion ? 0 : Math.sin(now * 0.00007) * 4;
    const swayY = this.reducedMotion ? 0 : Math.cos(now * 0.00005) * 3;

    // Moon glow.
    const { x: mx, y: my, r: mr } = this.moon;
    const halo = ctx.createRadialGradient(mx, my, mr * 0.4, mx, my, mr * 8.5);
    halo.addColorStop(0, 'rgba(198, 236, 247, 0.22)');
    halo.addColorStop(0.18, 'rgba(137, 201, 222, 0.1)');
    halo.addColorStop(0.55, 'rgba(74, 134, 165, 0.035)');
    halo.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.save();
    ctx.translate(swayX, swayY);
    ctx.fillStyle = halo;
    ctx.fillRect(mx - mr * 9, my - mr * 9, mr * 18, mr * 18);

    // Stars.
    ctx.globalCompositeOperation = 'lighter';
    for (const star of this.stars) {
      const flicker = 0.6 + 0.4 * Math.sin(now * 0.001 * star.speed + star.phase);
      const alpha = star.alpha * flicker;
      const color = star.tint === 'warm'
        ? `rgba(255, 223, 188, ${alpha})`
        : star.tint === 'blue'
          ? `rgba(184, 212, 255, ${alpha})`
          : `rgba(232, 247, 255, ${alpha})`;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.r, 0, TAU);
      ctx.fill();
      if (star.cross) {
        ctx.strokeStyle = color;
        ctx.globalAlpha = 0.35;
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.moveTo(star.x - star.r * 5, star.y);
        ctx.lineTo(star.x + star.r * 5, star.y);
        ctx.moveTo(star.x, star.y - star.r * 5);
        ctx.lineTo(star.x, star.y + star.r * 5);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
    ctx.globalCompositeOperation = 'source-over';

    // Aurora, almost too faint to be sure about.
    if (!this.reducedMotion) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let layer = 0; layer < 2; layer += 1) {
        if (layer === 1 && w > 900) continue;
        const yBase = h * (0.24 + layer * 0.08);
        const grad = ctx.createLinearGradient(0, yBase - 80, 0, yBase + 120);
        if (layer === 0) {
          grad.addColorStop(0, 'rgba(58, 172, 157, 0)');
          grad.addColorStop(0.4, 'rgba(64, 196, 176, 0.052)');
          grad.addColorStop(0.7, 'rgba(102, 92, 202, 0.03)');
          grad.addColorStop(1, 'rgba(80, 55, 160, 0)');
        } else {
          grad.addColorStop(0, 'rgba(66, 104, 206, 0)');
          grad.addColorStop(0.5, 'rgba(84, 126, 222, 0.036)');
          grad.addColorStop(1, 'rgba(50, 60, 140, 0)');
        }
        ctx.strokeStyle = grad;
        ctx.lineWidth = 64 + layer * 30;
        ctx.beginPath();
        for (let x = -20; x <= w + 20; x += 22) {
          const y = yBase
            + Math.sin(x * 0.006 + now * 0.00012 + layer * 1.8) * 26
            + Math.sin(x * 0.014 - now * 0.00008) * 12;
          if (x === -20) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.restore();
    }

    this.drawMoon(mx, my, mr, now, ctx);
    this.drawClouds(now, ctx);
    if (ambient) this.drawAmbientMeteor(now, 0.016, ctx);

    // Lens flare when looking close to the moon.
    ctx.restore();
  }

  drawMoon(mx, my, mr, now, ctx = this.ctx) {
    const glow = ctx.createRadialGradient(mx, my, mr * 0.7, mx, my, mr * 3.2);
    glow.addColorStop(0, 'rgba(229, 249, 255, 0.18)');
    glow.addColorStop(0.45, 'rgba(164, 215, 235, 0.06)');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(mx, my, mr * 3.2, 0, TAU);
    ctx.fill();

    const surface = ctx.createRadialGradient(mx - mr * 0.34, my - mr * 0.38, mr * 0.1, mx, my, mr);
    surface.addColorStop(0, '#fbffff');
    surface.addColorStop(0.5, '#d9ecf3');
    surface.addColorStop(0.82, '#a5c2ce');
    surface.addColorStop(1, '#7c9aa8');
    ctx.fillStyle = surface;
    ctx.beginPath();
    ctx.arc(mx, my, mr, 0, TAU);
    ctx.fill();

    ctx.save();
    ctx.beginPath();
    ctx.arc(mx, my, mr, 0, TAU);
    ctx.clip();
    for (const crater of this.craters) {
      const cx = mx + crater.x * mr;
      const cy = my + crater.y * mr;
      const cr = crater.r * mr;
      ctx.fillStyle = `rgba(69, 95, 110, ${crater.alpha})`;
      ctx.beginPath();
      ctx.arc(cx, cy, cr, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = `rgba(255, 255, 255, ${crater.alpha * 0.8})`;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.arc(cx - cr * 0.14, cy - cr * 0.14, cr * 0.88, 0.2, Math.PI * 1.1);
      ctx.stroke();
    }
    const terminator = ctx.createLinearGradient(mx - mr, my - mr, mx + mr, my + mr);
    terminator.addColorStop(0, 'rgba(2, 8, 14, 0)');
    terminator.addColorStop(0.74, 'rgba(2, 8, 14, 0.04)');
    terminator.addColorStop(1, 'rgba(2, 8, 14, 0.4)');
    ctx.fillStyle = terminator;
    ctx.fillRect(mx - mr, my - mr, mr * 2, mr * 2);
    ctx.restore();

    ctx.strokeStyle = 'rgba(238, 253, 255, 0.35)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.arc(mx, my, mr, 0, TAU);
    ctx.stroke();
  }

  drawClouds(now, ctx = this.ctx) {
    const { w } = this;
    for (const cloud of this.clouds) {
      const x = ((cloud.x + now * 0.001 * cloud.speed) % (w + 460)) - 230;
      const sprite = this.cloudSprites[cloud.sprite];
      const width = 360 * cloud.scale;
      const height = 150 * cloud.scale;
      ctx.globalAlpha = cloud.alpha;
      ctx.drawImage(sprite, x - width / 2, cloud.y - height / 2, width, height);
    }
    ctx.globalAlpha = 1;
  }

  drawAmbientMeteor(now, dt = 0.016, ctx = this.ctx) {
    if (!this.ambientMeteor) {
      this.ambientMeteorIn -= dt;
      if (this.ambientMeteorIn <= 0 && !this.reducedMotion) {
        const { w, h } = this;
        this.ambientMeteor = {
          x: w * (0.1 + Math.random() * 0.65),
          y: h * (0.06 + Math.random() * 0.3),
          vx: (160 + Math.random() * 200) * (Math.random() < 0.5 ? -1 : 1),
          vy: 90 + Math.random() * 100,
          life: 1.4,
          maxLife: 1.4,
        };
        this.ambientMeteorIn = 11 + Math.random() * 14;
      }
      return;
    }
    const meteor = this.ambientMeteor;
    meteor.life -= dt;
    meteor.x += meteor.vx * dt;
    meteor.y += meteor.vy * dt;
    const alpha = clamp(meteor.life / meteor.maxLife, 0, 1);
    const tailX = meteor.x - meteor.vx * 0.22;
    const tailY = meteor.y - meteor.vy * 0.22;
    const gradient = ctx.createLinearGradient(tailX, tailY, meteor.x, meteor.y);
    gradient.addColorStop(0, 'rgba(255,255,255,0)');
    gradient.addColorStop(1, `rgba(220, 246, 255, ${alpha * 0.8})`);
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(tailX, tailY);
    ctx.lineTo(meteor.x, meteor.y);
    ctx.stroke();
    if (meteor.life <= 0) {
      this.ambientMeteor = null;
    }
  }

  drawHorizon(ctx = this.ctx) {
    const { w, h } = this;
    ctx.drawImage(this.horizon, 0, 0, w, h);
    const haze = ctx.createLinearGradient(0, h * 0.74, 0, h * 0.9);
    haze.addColorStop(0, 'rgba(20, 61, 77, 0)');
    haze.addColorStop(0.55, 'rgba(20, 61, 77, 0.05)');
    haze.addColorStop(1, 'rgba(3, 10, 16, 0)');
    ctx.fillStyle = haze;
    ctx.fillRect(0, h * 0.72, w, h * 0.2);
  }

  glowSprite(color) {
    const match = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(color);
    if (!match) return null;
    const key = `${match[1]},${match[2]},${match[3]}`;
    let sprite = this.glowCache.get(key);
    if (sprite) return sprite;

    const { canvas } = makeCanvas(128, 128, 1);
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, `rgba(${key}, 1)`);
    gradient.addColorStop(0.22, `rgba(${key}, 0.55)`);
    gradient.addColorStop(0.58, `rgba(${key}, 0.12)`);
    gradient.addColorStop(1, `rgba(${key}, 0)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);
    this.glowCache.set(key, canvas);
    return canvas;
  }

  drawGlowSprite(x, y, radius, color, alpha = 1) {
    if (radius <= 0 || alpha <= 0) return;
    const sprite = this.glowSprite(color);
    if (!sprite) return;
    const { ctx } = this;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = alpha;
    ctx.drawImage(sprite, x - radius, y - radius, radius * 2, radius * 2);
    ctx.restore();
  }

  drawEntity(entity, state, now) {
    if (entity.alpha <= 0.01 || entity.dead) return;
    const { ctx } = this;
    const x = entity.x;
    const y = entity.y + (entity.family === 'ufo' ? Math.sin(entity.age * 1.7 + entity.phase) * 2.6 : 0);
    ctx.save();
    ctx.translate(x, y);
    ctx.globalAlpha = clamp(entity.alpha, 0, 1);

    if (entity.family === 'ufo') {
      if (entity.kind === 'triangle') this.drawTriangle(entity, now);
      else if (entity.kind === 'orb') this.drawOrb(entity, now);
      else if (entity.kind === 'mothership') this.drawMothership(entity, now);
      else this.drawSaucer(entity, now);
    } else if (entity.kind === 'plane') {
      this.drawPlane(entity, now);
    } else if (entity.kind === 'satellite') {
      this.drawSatellite(entity, now);
    } else if (entity.kind === 'meteor') {
      this.drawMeteor(entity);
    }

    ctx.restore();
  }

  drawSaucer(entity, now) {
    const { ctx } = this;
    const s = entity.size;
    const alpha = entity.alpha;
    const bob = Math.sin(entity.age * 0.9 + entity.phase) * 0.04;

    if (entity.beam) {
      const beamAlpha = 0.08 + Math.sin(now * 0.002 + entity.beamPhase) * 0.035;
      const beam = ctx.createLinearGradient(0, s * 0.12, 0, s * 1.5);
      beam.addColorStop(0, `rgba(116, 239, 255, ${beamAlpha})`);
      beam.addColorStop(1, 'rgba(116, 239, 255, 0)');
      ctx.fillStyle = beam;
      ctx.beginPath();
      ctx.moveTo(-s * 0.18, s * 0.08);
      ctx.lineTo(s * 0.18, s * 0.08);
      ctx.lineTo(s * 0.62, s * 1.6);
      ctx.lineTo(-s * 0.62, s * 1.6);
      ctx.closePath();
      ctx.fill();
    }

    this.drawGlowSprite(0, s * 0.1, s * 1.2, 'rgba(80, 220, 255, 0.24)', alpha);

    ctx.save();
    ctx.rotate(bob);
    const body = ctx.createLinearGradient(0, -s * 0.23, 0, s * 0.25);
    body.addColorStop(0, '#d9e9ee');
    body.addColorStop(0.32, '#8ea8b7');
    body.addColorStop(0.6, '#3b505f');
    body.addColorStop(1, '#111a23');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.64, s * 0.21, 0, 0, TAU);
    ctx.fill();

    ctx.strokeStyle = 'rgba(230, 253, 255, 0.85)';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.64, s * 0.21, 0, 0.05, Math.PI - 0.05);
    ctx.stroke();

    // Dome.
    const dome = ctx.createLinearGradient(0, -s * 0.36, 0, s * 0.02);
    dome.addColorStop(0, 'rgba(181, 244, 255, 0.9)');
    dome.addColorStop(0.45, 'rgba(67, 137, 161, 0.75)');
    dome.addColorStop(1, 'rgba(13, 34, 48, 0.4)');
    ctx.fillStyle = dome;
    ctx.beginPath();
    ctx.moveTo(-s * 0.28, -s * 0.08);
    ctx.bezierCurveTo(-s * 0.25, -s * 0.43, s * 0.25, -s * 0.43, s * 0.28, -s * 0.08);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(216, 253, 255, 0.55)';
    ctx.lineWidth = 0.8;
    ctx.stroke();

    // Dome highlight.
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.42)';
    ctx.beginPath();
    ctx.moveTo(-s * 0.16, -s * 0.14);
    ctx.quadraticCurveTo(-s * 0.12, -s * 0.35, s * 0.04, -s * 0.38);
    ctx.stroke();

    // Rim lights.
    for (let i = 0; i < 9; i += 1) {
      const angle = entity.age * 1.25 + (i / 9) * TAU;
      const lx = Math.cos(angle) * s * 0.55;
      const ly = Math.sin(angle) * s * 0.16 + s * 0.055;
      const front = Math.sin(angle) > -0.2;
      const lightAlpha = (front ? 0.9 : 0.35) * clamp(entity.alpha, 0, 1);
      const color = i % 3 === 0 ? `rgba(255, 126, 188, ${lightAlpha})` : `rgba(120, 243, 255, ${lightAlpha})`;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(lx, ly, Math.max(1.2, s * 0.025), 0, TAU);
      ctx.fill();
      this.drawGlowSprite(lx, ly, s * 0.11, color, lightAlpha);
    }

    // Underbelly light.
    this.drawGlowSprite(0, s * 0.13, s * 0.32, 'rgba(116, 239, 255, 0.55)', alpha);
    ctx.fillStyle = 'rgba(226, 253, 255, 0.8)';
    ctx.beginPath();
    ctx.ellipse(0, s * 0.13, s * 0.08, s * 0.024, 0, 0, TAU);
    ctx.fill();

    // Small antenna.
    ctx.strokeStyle = 'rgba(178, 232, 241, 0.7)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.38);
    ctx.lineTo(0, -s * 0.48);
    ctx.stroke();
    ctx.fillStyle = `rgba(255, 95, 125, ${0.5 + Math.sin(now * 0.006) * 0.4})`;
    ctx.beginPath();
    ctx.arc(0, -s * 0.49, Math.max(1, s * 0.014), 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  drawTriangle(entity, now) {
    const { ctx } = this;
    const s = entity.size;
    const alpha = entity.alpha;
    const rotation = Math.sin(entity.age * 0.3 + entity.phase) * 0.18;

    this.drawGlowSprite(0, 0, s * 1.1, 'rgba(255, 157, 226, 0.16)', alpha);
    ctx.save();
    ctx.rotate(rotation);

    const body = ctx.createLinearGradient(0, -s * 0.5, 0, s * 0.36);
    body.addColorStop(0, '#1a2430');
    body.addColorStop(0.55, '#0b111a');
    body.addColorStop(1, '#05080d');
    ctx.fillStyle = body;
    ctx.strokeStyle = 'rgba(255, 157, 226, 0.5)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.52);
    ctx.lineTo(s * 0.48, s * 0.32);
    ctx.lineTo(0, s * 0.45);
    ctx.lineTo(-s * 0.48, s * 0.32);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255, 157, 226, 0.22)';
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.34);
    ctx.lineTo(s * 0.28, s * 0.22);
    ctx.lineTo(-s * 0.28, s * 0.22);
    ctx.closePath();
    ctx.stroke();

    // Corner lights.
    const corners = [
      [0, -s * 0.46],
      [s * 0.42, s * 0.27],
      [-s * 0.42, s * 0.27],
    ];
    corners.forEach(([cx, cy], index) => {
      const pulse = 0.55 + 0.45 * Math.sin(now * 0.005 + index * 2.1 + entity.phase);
      const color = index === 1 ? `rgba(255, 95, 125, ${pulse})` : `rgba(232, 255, 255, ${pulse})`;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(1.3, s * 0.023), 0, TAU);
      ctx.fill();
      this.drawGlowSprite(cx, cy, s * 0.1, color, pulse);
    });

    this.drawGlowSprite(0, s * 0.1, s * 0.4, 'rgba(255, 126, 208, 0.5)', alpha);
    ctx.fillStyle = 'rgba(255, 212, 246, 0.85)';
    ctx.beginPath();
    ctx.ellipse(0, s * 0.1, s * 0.07, s * 0.022, 0, 0, TAU);
    ctx.fill();

    // Underside beam.
    if (entity.beam) {
      const beam = ctx.createLinearGradient(0, s * 0.18, 0, s * 1.5);
      beam.addColorStop(0, `rgba(255, 157, 226, ${0.08 + Math.sin(now * 0.0022) * 0.03})`);
      beam.addColorStop(1, 'rgba(255, 157, 226, 0)');
      ctx.fillStyle = beam;
      ctx.beginPath();
      ctx.moveTo(-s * 0.1, s * 0.16);
      ctx.lineTo(s * 0.1, s * 0.16);
      ctx.lineTo(s * 0.38, s * 1.45);
      ctx.lineTo(-s * 0.38, s * 1.45);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  drawOrb(entity, now) {
    const { ctx } = this;
    const s = entity.size;
    const pulse = 0.9 + Math.sin(now * 0.004 + entity.phase) * 0.12;

    this.drawGlowSprite(0, 0, s * 1.7 * pulse, 'rgba(255, 196, 96, 0.23)', entity.alpha);
    const core = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 0.52 * pulse);
    core.addColorStop(0, 'rgba(255, 255, 245, 1)');
    core.addColorStop(0.24, 'rgba(255, 225, 146, 0.95)');
    core.addColorStop(0.58, 'rgba(255, 171, 63, 0.55)');
    core.addColorStop(1, 'rgba(255, 133, 41, 0)');
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.58 * pulse, 0, TAU);
    ctx.fill();

    ctx.save();
    ctx.rotate(entity.age * 0.8);
    ctx.strokeStyle = 'rgba(255, 230, 171, 0.7)';
    ctx.lineWidth = 1;
    ctx.setLineDash([s * 0.28, s * 0.18]);
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.55, 0, TAU);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.rotate(-entity.age * 1.3 + 1);
    ctx.strokeStyle = 'rgba(255, 188, 91, 0.3)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.82, s * 0.3, 0, 0, TAU);
    ctx.stroke();
    for (let i = 0; i < 2; i += 1) {
      const angle = entity.age * 1.6 + i * Math.PI;
      const x = Math.cos(angle) * s * 0.82;
      const y = Math.sin(angle) * s * 0.3;
      ctx.fillStyle = 'rgba(255, 242, 204, 0.95)';
      ctx.beginPath();
      ctx.arc(x, y, Math.max(1.2, s * 0.025), 0, TAU);
      ctx.fill();
      this.drawGlowSprite(x, y, s * 0.12, 'rgba(255, 206, 115, 0.9)', entity.alpha);
    }
    ctx.restore();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(1.4, s * 0.045), 0, TAU);
    ctx.fill();
  }

  drawMothership(entity, now) {
    const { ctx } = this;
    const s = entity.size;
    const alpha = entity.alpha;

    if (entity.beam) {
      const beamAlpha = 0.1 + Math.sin(now * 0.0018 + entity.beamPhase) * 0.04;
      const beam = ctx.createLinearGradient(0, s * 0.14, 0, s * 1.15);
      beam.addColorStop(0, `rgba(179, 137, 255, ${beamAlpha})`);
      beam.addColorStop(0.7, `rgba(128, 174, 255, ${beamAlpha * 0.35})`);
      beam.addColorStop(1, 'rgba(128, 174, 255, 0)');
      ctx.fillStyle = beam;
      ctx.beginPath();
      ctx.moveTo(-s * 0.28, s * 0.1);
      ctx.lineTo(s * 0.28, s * 0.1);
      ctx.lineTo(s * 0.74, s * 1.3);
      ctx.lineTo(-s * 0.74, s * 1.3);
      ctx.closePath();
      ctx.fill();
    }

    this.drawGlowSprite(0, 0, s * 1.15, 'rgba(133, 120, 255, 0.2)', alpha);
    ctx.save();
    ctx.rotate(Math.sin(entity.age * 0.16 + entity.phase) * 0.03);
    const body = ctx.createLinearGradient(0, -s * 0.22, 0, s * 0.23);
    body.addColorStop(0, '#e4e9ff');
    body.addColorStop(0.28, '#8e93bf');
    body.addColorStop(0.56, '#3d3f64');
    body.addColorStop(1, '#10111e');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.68, s * 0.2, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(230, 232, 255, 0.7)';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.68, s * 0.2, 0, 0.05, Math.PI - 0.05);
    ctx.stroke();

    // Second tier.
    ctx.fillStyle = 'rgba(44, 48, 78, 0.95)';
    ctx.beginPath();
    ctx.ellipse(0, -s * 0.06, s * 0.42, s * 0.13, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(179, 137, 255, 0.5)';
    ctx.stroke();

    // Domes.
    for (const dx of [-s * 0.17, s * 0.17]) {
      const dome = ctx.createLinearGradient(0, -s * 0.3, 0, -s * 0.03);
      dome.addColorStop(0, 'rgba(222, 247, 255, 0.85)');
      dome.addColorStop(1, 'rgba(66, 90, 126, 0.35)');
      ctx.fillStyle = dome;
      ctx.beginPath();
      ctx.moveTo(dx - s * 0.12, -s * 0.09);
      ctx.bezierCurveTo(dx - s * 0.1, -s * 0.3, dx + s * 0.1, -s * 0.3, dx + s * 0.12, -s * 0.09);
      ctx.closePath();
      ctx.fill();
    }

    // Outer rotating lights.
    for (let i = 0; i < 14; i += 1) {
      const angle = entity.age * 0.7 + (i / 14) * TAU;
      const lx = Math.cos(angle) * s * 0.6;
      const ly = Math.sin(angle) * s * 0.165 + s * 0.045;
      const pulse = 0.55 + 0.45 * Math.sin(entity.age * 4 + i);
      const color = i % 4 === 0 ? `rgba(255, 125, 190, ${pulse})` : `rgba(173, 146, 255, ${pulse})`;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(lx, ly, Math.max(1.4, s * 0.018), 0, TAU);
      ctx.fill();
      this.drawGlowSprite(lx, ly, s * 0.07, color, pulse * alpha);
    }

    // Center underlight.
    this.drawGlowSprite(0, s * 0.13, s * 0.5, 'rgba(179, 137, 255, 0.55)', alpha);
    ctx.fillStyle = 'rgba(232, 220, 255, 0.9)';
    ctx.beginPath();
    ctx.ellipse(0, s * 0.13, s * 0.12, s * 0.032, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  drawPlane(entity, now) {
    const { ctx } = this;
    const s = entity.size;
    const angle = Math.atan2(entity.vy, entity.vx);
    const trailLength = Math.min(150, Math.abs(entity.vx) * 2.6);
    const tailX = -Math.cos(angle) * trailLength;
    const tailY = -Math.sin(angle) * trailLength;
    const trail = ctx.createLinearGradient(0, 0, tailX, tailY);
    trail.addColorStop(0, 'rgba(205, 228, 240, 0.32)');
    trail.addColorStop(1, 'rgba(191, 218, 232, 0)');
    ctx.strokeStyle = trail;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(tailX, tailY);
    ctx.stroke();

    ctx.save();
    ctx.rotate(angle);
    ctx.fillStyle = 'rgba(139, 163, 177, 0.92)';
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.5, s * 0.09, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(225, 245, 255, 0.35)';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.ellipse(0, -s * 0.022, s * 0.46, s * 0.055, 0, 0.2, Math.PI - 0.2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(151, 177, 191, 0.9)';
    ctx.beginPath();
    ctx.moveTo(-s * 0.06, 0);
    ctx.lineTo(-s * 0.24, -s * 0.46);
    ctx.lineTo(-s * 0.08, -s * 0.46);
    ctx.lineTo(s * 0.1, 0);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-s * 0.06, 0);
    ctx.lineTo(-s * 0.24, s * 0.46);
    ctx.lineTo(-s * 0.08, s * 0.46);
    ctx.lineTo(s * 0.1, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(165, 190, 202, 0.9)';
    ctx.beginPath();
    ctx.moveTo(-s * 0.44, 0);
    ctx.lineTo(-s * 0.56, -s * 0.25);
    ctx.lineTo(-s * 0.42, -s * 0.25);
    ctx.lineTo(-s * 0.3, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    const blink = Math.sin(entity.age * 5.2 + entity.blink);
    const strobe = Math.sin(entity.age * 12 + entity.blink * 2) > 0.76;
    const leftX = -s * 0.21 * Math.cos(angle) - s * 0.44 * Math.sin(angle);
    const leftY = -s * 0.21 * Math.sin(angle) + s * 0.44 * Math.cos(angle);
    const rightX = -s * 0.21 * Math.cos(angle) + s * 0.44 * Math.sin(angle);
    const rightY = -s * 0.21 * Math.sin(angle) - s * 0.44 * Math.cos(angle);

    const redPulse = 0.28 + clamp(blink, 0, 1) * 0.72;
    const greenPulse = 0.28 + clamp(-blink, 0, 1) * 0.72;
    this.drawGlowSprite(leftX, leftY, s * 0.18, 'rgba(255, 72, 88, 0.9)', redPulse);
    this.drawGlowSprite(rightX, rightY, s * 0.18, 'rgba(96, 255, 176, 0.9)', greenPulse);
    ctx.fillStyle = `rgba(255, 122, 132, ${redPulse})`;
    ctx.beginPath();
    ctx.arc(leftX, leftY, 1.5, 0, TAU);
    ctx.fill();
    ctx.fillStyle = `rgba(146, 255, 203, ${greenPulse})`;
    ctx.beginPath();
    ctx.arc(rightX, rightY, 1.5, 0, TAU);
    ctx.fill();
    if (strobe) {
      this.drawGlowSprite(s * 0.42 * Math.cos(angle), s * 0.42 * Math.sin(angle), s * 0.24, 'rgba(245, 255, 255, 0.9)', 1);
    }
  }

  drawSatellite(entity, now) {
    const { ctx } = this;
    const s = entity.size;
    const angle = Math.atan2(entity.vy, entity.vx);
    const glint = 0.55 + 0.45 * Math.sin(entity.age * 4.5 + entity.blink);
    const tail = Math.min(110, Math.abs(entity.vx) * 0.65);
    const trail = ctx.createLinearGradient(0, 0, -Math.cos(angle) * tail, -Math.sin(angle) * tail);
    trail.addColorStop(0, `rgba(213, 235, 255, ${0.45 * glint})`);
    trail.addColorStop(1, 'rgba(213, 235, 255, 0)');
    ctx.strokeStyle = trail;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-Math.cos(angle) * tail, -Math.sin(angle) * tail);
    ctx.stroke();

    ctx.save();
    ctx.rotate(angle);
    ctx.fillStyle = 'rgba(153, 184, 210, 0.7)';
    ctx.fillRect(-s * 0.2, -s * 0.32, s * 0.16, s * 0.64);
    ctx.fillRect(s * 0.06, -s * 0.32, s * 0.16, s * 0.64);
    ctx.strokeStyle = 'rgba(208, 233, 255, 0.45)';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(-s * 0.2, -s * 0.32, s * 0.16, s * 0.64);
    ctx.strokeRect(s * 0.06, -s * 0.32, s * 0.16, s * 0.64);
    ctx.fillStyle = 'rgba(203, 229, 248, 0.9)';
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.08, 0, TAU);
    ctx.fill();
    ctx.restore();

    this.drawGlowSprite(0, 0, s * 0.7, 'rgba(190, 224, 255, 0.75)', glint);
    if (glint > 0.65) {
      ctx.strokeStyle = `rgba(233, 247, 255, ${(glint - 0.65) * 1.6})`;
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(-s * 0.6, 0);
      ctx.lineTo(s * 0.6, 0);
      ctx.stroke();
    }
    void now;
  }

  drawMeteor(entity) {
    const { ctx } = this;
    const fade = clamp(entity.alpha, 0, 1);
    const velocity = Math.hypot(entity.vx, entity.vy) || 1;
    const length = Math.min(220, 48 + velocity * 0.18);
    const dx = (entity.vx / velocity) * length;
    const dy = (entity.vy / velocity) * length;
    const gradient = ctx.createLinearGradient(0, 0, -dx, -dy);
    gradient.addColorStop(0, `rgba(255, 250, 228, ${0.95 * fade})`);
    gradient.addColorStop(0.18, `rgba(255, 222, 172, ${0.65 * fade})`);
    gradient.addColorStop(1, 'rgba(255, 205, 148, 0)');
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 2.1;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-dx, -dy);
    ctx.stroke();
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.55 * fade})`;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-dx * 0.45, -dy * 0.45);
    ctx.stroke();
    this.drawGlowSprite(0, 0, 16, 'rgba(255, 232, 190, 0.8)', fade);
  }

  drawParticles(particles, effects) {
    const { ctx } = this;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const particle of particles) {
      const life = clamp(particle.life / particle.maxLife, 0, 1);
      const radius = Math.max(0.4, particle.size * (0.4 + life * 0.9));
      if (particle.type === 'ring') {
        ctx.strokeStyle = particle.color.replace(/[\d.]+\)$/, `${life * 0.7})`);
        ctx.lineWidth = Math.max(0.6, 2 * life);
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, radius, 0, TAU);
        ctx.stroke();
      } else {
        ctx.fillStyle = particle.color.replace(/[\d.]+\)$/, `${life * (particle.alpha ?? 0.9)})`);
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, radius, 0, TAU);
        ctx.fill();
      }
    }
    if (effects) {
      for (const effect of effects) {
        const t = clamp(effect.life / effect.maxLife, 0, 1);
        ctx.strokeStyle = effect.color.replace(/[\d.]+\)$/, `${t * 0.6})`);
        ctx.lineWidth = Math.max(0.5, 1.6 * t);
        ctx.beginPath();
        ctx.arc(effect.x, effect.y, effect.radius * (1.15 - t * 0.9), 0, TAU);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  drawTargetUI(state) {
    const { ctx } = this;
    const target = state.target;
    if (!target || !state.showReticle) return;
    const radius = target.lock;
    const color = target.family === 'ufo' ? '116, 239, 255' : '255, 195, 107';
    const isUfo = target.family === 'ufo';
    const identified = target.classification >= 0.55;
    const ringColor = identified && !isUfo ? '255, 195, 107' : color;

    ctx.save();
    ctx.translate(target.x, target.y);
    const bracket = 12;
    const arm = 18;
    const pulse = 0.55 + Math.sin(state.now * 0.004) * 0.12;
    ctx.strokeStyle = `rgba(${ringColor}, ${pulse})`;
    ctx.lineWidth = 1.1;
    const corners = [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ];
    for (const [sx, sy] of corners) {
      const cx = sx * radius;
      const cy = sy * radius;
      ctx.beginPath();
      ctx.moveTo(cx - sx * arm, cy);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx, cy - sy * arm);
      ctx.stroke();
    }

    // Exposure arc.
    if (target.exposure > 0.005) {
      ctx.strokeStyle = `rgba(${ringColor}, 0.9)`;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(0, 0, radius + 7, -Math.PI / 2, -Math.PI / 2 + TAU * Math.min(1, target.exposure));
      ctx.stroke();
      ctx.strokeStyle = `rgba(${ringColor}, 0.16)`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, radius + 7, 0, TAU);
      ctx.stroke();
    }

    if (identified) {
      const label = isUfo ? `UNBEKANNT · ${Math.round(target.exposure * 100)}%` : `${target.name.toUpperCase()} · ABBRECHEN`;
      ctx.font = '600 9px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      const textWidth = ctx.measureText(label).width;
      const ly = -radius - bracket - 10;
      ctx.fillStyle = 'rgba(2, 9, 16, 0.62)';
      ctx.fillRect(-textWidth / 2 - 6, ly - 13, textWidth + 12, 17);
      ctx.fillStyle = isUfo ? 'rgba(176, 247, 255, 0.92)' : 'rgba(255, 209, 134, 0.95)';
      ctx.fillText(label, 0, ly + 1);
    }
    ctx.restore();
  }

  drawReticle(state) {
    if (!state.showReticle) return;
    const { ctx } = this;
    const { x, y } = state.aim;
    const hot = Boolean(state.target);
    const filming = state.filming;
    const color = filming ? '255, 128, 150' : hot ? '116, 239, 255' : '198, 235, 244';
    const alpha = filming ? 0.98 : hot ? 0.9 : 0.62;
    const radius = 27;

    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = `rgba(${color}, ${alpha})`;
    ctx.fillStyle = `rgba(${color}, ${alpha})`;
    ctx.lineWidth = 1;

    ctx.save();
    ctx.rotate(state.now * 0.00022);
    ctx.setLineDash([2, 7]);
    ctx.lineDashOffset = state.now * 0.003;
    ctx.beginPath();
    ctx.arc(0, 0, radius + 9, 0, TAU);
    ctx.stroke();
    ctx.restore();

    ctx.setLineDash([]);
    for (let i = 0; i < 4; i += 1) {
      const angle = (i / 4) * TAU;
      const inner = radius + 2;
      const outer = radius + (i % 2 === 0 ? 9 : 6);
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
      ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.arc(0, 0, 17, 0, TAU);
    ctx.globalAlpha = 0.55;
    ctx.stroke();
    ctx.globalAlpha = 1;

    const gap = 7;
    const arm = 13;
    ctx.beginPath();
    ctx.moveTo(-gap - arm, 0);
    ctx.lineTo(-gap, 0);
    ctx.moveTo(gap, 0);
    ctx.lineTo(gap + arm, 0);
    ctx.moveTo(0, -gap - arm);
    ctx.lineTo(0, -gap);
    ctx.moveTo(0, gap);
    ctx.lineTo(0, gap + arm);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, 1.7, 0, TAU);
    ctx.fill();

    if (filming) {
      ctx.strokeStyle = 'rgba(255, 128, 150, 0.85)';
      ctx.lineWidth = 1.2;
      for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        ctx.beginPath();
        ctx.moveTo(sx * 42, sy * 42 - sy * 9);
        ctx.lineTo(sx * 42, sy * 42);
        ctx.lineTo(sx * 42 - sx * 9, sy * 42);
        ctx.stroke();
      }
    }

    if (state.width >= 720 && !state.target) {
      ctx.font = '8px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.fillStyle = `rgba(${color}, 0.55)`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(`AZ ${(state.azimuth ?? 0).toFixed(1).padStart(5, '0')}°`, 46, 8);
      ctx.fillText(`ELV ${(state.elevation ?? 0).toFixed(1).padStart(4, '0')}°`, 46, 19);
    }
    ctx.restore();
  }

  drawLensEffects(state) {
    const { ctx, w, h } = this;
    // Film grain.
    const pattern = this.grainPatterns[Math.floor(state.now / 90) % this.grainPatterns.length];
    if (pattern && state.filming) {
      ctx.save();
      ctx.globalAlpha = 0.2;
      ctx.fillStyle = pattern;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }

    if (state.filming) {
      const tint = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.2, w / 2, h / 2, Math.max(w, h) * 0.75);
      tint.addColorStop(0, 'rgba(255, 95, 125, 0.015)');
      tint.addColorStop(1, 'rgba(255, 95, 125, 0.08)');
      ctx.fillStyle = tint;
      ctx.fillRect(0, 0, w, h);
    }

    // A subtle lens ghost when aiming close to the moon.
    if (state.showReticle) {
      const d = distance(state.aim.x, state.aim.y, this.moon.x, this.moon.y);
      const strength = clamp(1 - d / 260, 0, 1) * 0.36;
      if (strength > 0.02) {
        const dx = this.moon.x - state.aim.x;
        const dy = this.moon.y - state.aim.y;
        for (let i = 1; i <= 3; i += 1) {
          const t = i / 3.4;
          const gx = state.aim.x + dx * t;
          const gy = state.aim.y + dy * t;
          const gr = this.moon.r * (0.12 + i * 0.09);
          const ghost = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
          ghost.addColorStop(0, `rgba(146, 226, 255, ${strength * 0.22})`);
          ghost.addColorStop(0.7, `rgba(80, 170, 205, ${strength * 0.08})`);
          ghost.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = ghost;
          ctx.beginPath();
          ctx.arc(gx, gy, gr, 0, TAU);
          ctx.fill();
        }
      }
    }
  }

  render(state, dt = 0.016) {
    const { ctx, w, h } = this;
    const now = state.now ?? performance.now();
    ctx.clearRect(0, 0, w, h);
    if (!this.skyLayer.style.backgroundImage && this.staticSky) ctx.drawImage(this.staticSky, 0, 0, w, h);
    this.drawAmbientMeteor(now, dt);

    const entities = state.entities ?? [];
    const decoys = entities.filter((entity) => entity.family === 'decoy');
    const ufos = entities.filter((entity) => entity.family === 'ufo');
    for (const entity of decoys) this.drawEntity(entity, state, now);
    for (const entity of ufos) this.drawEntity(entity, state, now);

    this.drawParticles(state.particles ?? [], state.effects ?? []);
    this.drawTargetUI(state);
    this.drawReticle(state);
    this.drawLensEffects(state);
  }
}
