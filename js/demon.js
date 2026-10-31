import * as THREE from '../vendor/three.module.js';
import { CONFIG, clamp, lerp, rand, pick } from './config.js';

const CELL = CONFIG.cell;

/* The thing that sees souls. */
export class SoulDemon {
  constructor(scene, assets) {
    this.scene = scene;
    this.assets = assets;
    this.group = new THREE.Group();
    this.group.visible = false;
    scene.add(this.group);
    this.state = 'dormant';
    this.path = null;
    this.pathIndex = 0;
    this.pathTimer = 0;
    this.lastSeen = 0;
    this.lastKnown = null;
    this.searchTimer = 0;
    this.growlTimer = 0;
    this.threat = 0;
    this.animTime = 0;
    this.caught = false;
    this._build();
  }

  _build() {
    const { mats, glow } = this.assets;

    const robePts = [];
    const profile = [
      [1.12, 0.02], [1.02, 0.3], [0.84, 0.68], [0.68, 1.02],
      [0.64, 1.28], [0.78, 1.52], [0.74, 1.68], [0.48, 1.82], [0.34, 1.88],
    ];
    for (const [x, y] of profile) robePts.push(new THREE.Vector2(x, y));
    const robeGeo = new THREE.LatheGeometry(robePts, 24);
    const pos = robeGeo.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      if (v.y < 0.46) {
        const a = Math.atan2(v.z, v.x);
        const ragged = 1 + Math.sin(a * 9 + 0.7) * 0.08 + Math.sin(a * 23) * 0.025;
        v.x *= ragged;
        v.z *= ragged;
        if (v.y < 0.09) v.y = Math.abs(Math.sin(a * 7)) * 0.12;
      }
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    robeGeo.computeVertexNormals();
    const robe = new THREE.Mesh(robeGeo, mats.robe);
    robe.castShadow = true;
    this.group.add(robe);

    // tattered cloth at the hem
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + rand(-0.1, 0.1);
      const strip = new THREE.Mesh(new THREE.ConeGeometry(rand(0.03, 0.075), rand(0.18, 0.46), 3), mats.robe);
      strip.position.set(Math.cos(a) * 1.04, 0.16, Math.sin(a) * 1.04);
      strip.rotation.z = rand(-0.18, 0.18);
      strip.rotation.x = rand(-0.14, 0.14);
      strip.castShadow = true;
      this.group.add(strip);
    }

    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.58, 9), mats.skin);
    neck.position.set(0, 1.99, 0.03);
    neck.rotation.x = -0.08;
    neck.castShadow = true;
    this.group.add(neck);

    const head = new THREE.Group();
    head.position.set(0, 2.3, 0.05);
    head.scale.setScalar(1.16);
    this.head = head;
    this.group.add(head);

    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.37, 28, 22), mats.skin);
    skull.scale.set(0.98, 1.14, 1.02);
    skull.position.y = 0.05;
    skull.castShadow = true;
    head.add(skull);

    const face = new THREE.Mesh(new THREE.SphereGeometry(0.26, 24, 18), mats.skin);
    face.scale.set(0.92, 0.8, 0.72);
    face.position.set(0, -0.2, 0.1);
    face.castShadow = true;
    head.add(face);

    const jaw = new THREE.Group();
    jaw.position.set(0, -0.38, 0.07);
    head.add(jaw);
    this.jawGroup = jaw;
    const jawMesh = new THREE.Mesh(new THREE.SphereGeometry(0.23, 20, 14), mats.skin);
    jawMesh.scale.set(1.0, 0.42, 0.9);
    jawMesh.position.y = -0.01;
    jawMesh.castShadow = true;
    jaw.add(jawMesh);

    const mouth = new THREE.Mesh(new THREE.SphereGeometry(0.21, 16, 12), mats.black);
    mouth.scale.set(1.15, 0.9, 0.55);
    mouth.position.set(0, -0.33, 0.26);
    head.add(mouth);

    const nasal = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.16, 3), mats.black);
    nasal.position.set(0, -0.13, 0.36);
    nasal.rotation.x = Math.PI;
    nasal.scale.z = 0.45;
    head.add(nasal);

    // upper teeth
    for (let i = 0; i < 9; i++) {
      const x = (i - 4) * 0.044;
      const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.031, rand(0.12, 0.18), 5), mats.bone);
      tooth.position.set(x, -0.238 - Math.abs(i - 4) * 0.005, 0.338);
      tooth.rotation.x = Math.PI;
      tooth.rotation.z = rand(-0.16, 0.16);
      tooth.castShadow = true;
      head.add(tooth);
    }
    // lower teeth
    for (let i = 0; i < 8; i++) {
      const x = (i - 3.5) * 0.049;
      const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.028, rand(0.09, 0.15), 5), mats.bone);
      tooth.position.set(x, -0.1 + Math.abs(i - 3.5) * 0.004, 0.33);
      tooth.rotation.z = rand(-0.16, 0.16);
      tooth.castShadow = true;
      jaw.add(tooth);
    }

    // eye sockets & burning eyes
    this.eyeGlows = [];
    this.eyeMats = [];
    for (const side of [-1, 1]) {
      const socket = new THREE.Mesh(new THREE.SphereGeometry(0.145, 16, 12), mats.black);
      socket.scale.set(1.08, 0.94, 0.22);
      socket.position.set(side * 0.16, 0.06, 0.26);
      head.add(socket);

      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.108, 0.019, 8, 22), mats.black);
      rim.position.set(side * 0.157, 0.062, 0.35);
      head.add(rim);

      const eyeMat = mats.eye.clone();
      eyeMat.color.setHex(0xffe14a);
      eyeMat.fog = false;
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.092, 18, 14), eyeMat);
      eye.position.set(side * 0.157, 0.062, 0.366);
      head.add(eye);
      this.eyeMats.push(eye.material);

      // Sit the glow fully in front of the eyeball: at z 0.43 the sprite plane
      // cut through the sphere, so its hot core was depth-clipped and the eyes
      // read as hollow yellow rings.
      const glowSprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glow, color: 0xffd340, transparent: true,
        blending: THREE.AdditiveBlending, depthWrite: false,
        opacity: 0.95, fog: false,
      }));
      glowSprite.position.set(side * 0.157, 0.062, 0.49);
      glowSprite.scale.set(0.56, 0.56, 1);
      glowSprite.renderOrder = 3;
      head.add(glowSprite);
      this.eyeGlows.push(glowSprite);

      const shadow = new THREE.Mesh(new THREE.BoxGeometry(0.245, 0.055, 0.03), mats.black);
      shadow.position.set(side * 0.165, 0.17, 0.315);
      shadow.rotation.z = side * 0.22;
      head.add(shadow);

      const brow = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.065, 0.16), mats.skin);
      brow.position.set(side * 0.17, 0.2, 0.29);
      brow.rotation.z = side * 0.24;
      brow.rotation.x = -0.12;
      brow.castShadow = true;
      head.add(brow);

      const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), mats.skin);
      cheek.scale.set(1.25, 0.5, 1.0);
      cheek.position.set(side * 0.25, -0.13, 0.2);
      cheek.rotation.z = side * 0.18;
      head.add(cheek);

      const temple = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), mats.skin);
      temple.scale.set(0.6, 1.3, 0.9);
      temple.position.set(side * 0.31, 0.05, 0.03);
      head.add(temple);
    }

    for (const side of [-1, 1]) {
      const nostril = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 6), mats.black);
      nostril.position.set(side * 0.044, -0.135, 0.35);
      head.add(nostril);
    }

    // Fibrous wisps hang from the back of the skull.
    const strandMat = new THREE.MeshStandardMaterial({ color: 0x7c7467, roughness: 0.97 });
    const up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < 28; i++) {
      const a = rand(0, Math.PI * 2);
      const baseR = rand(0.14, 0.34);
      const bz = Math.sin(a) * baseR - 0.04;
      if (bz > 0.14) continue;
      const base = new THREE.Vector3(Math.cos(a) * baseR, rand(0.14, 0.37), bz);
      const dir = new THREE.Vector3(
        Math.cos(a) * rand(0.05, 0.25),
        -rand(0.78, 1.0),
        Math.sin(a) * rand(0.05, 0.25),
      ).normalize();
      const len = rand(0.4, 1.05);
      const strand = new THREE.Mesh(new THREE.ConeGeometry(rand(0.002, 0.006), len, 4), strandMat);
      strand.position.copy(base).addScaledVector(dir, len * 0.4);
      strand.quaternion.setFromUnitVectors(up, dir);
      strand.rotation.z += rand(-0.18, 0.18);
      head.add(strand);
    }

    // Arms
    this.arms = [];
    for (const side of [-1, 1]) {
      const arm = new THREE.Group();
      arm.position.set(side * 0.62, 1.7, 0.02);
      arm.rotation.z = side * 0.26;
      arm.rotation.x = -0.12;
      const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.78, 8), mats.robe);
      sleeve.position.y = -0.36;
      sleeve.castShadow = true;
      const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.086, 0.84, 8), mats.skin);
      upper.position.y = -0.42;
      upper.castShadow = true;
      const elbow = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 8), mats.skin);
      elbow.position.y = -0.84;
      const fore = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.072, 0.72, 8), mats.skin);
      fore.position.y = -1.2;
      fore.castShadow = true;
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.105, 10, 8), mats.skin);
      hand.scale.set(0.82, 1.2, 0.7);
      hand.position.y = -1.6;
      arm.add(sleeve, upper, elbow, fore, hand);
      for (let c = 0; c < 4; c++) {
        const claw = new THREE.Mesh(new THREE.ConeGeometry(0.019, rand(0.17, 0.27), 5), mats.bone);
        claw.position.set((c - 1.5) * 0.052, -1.75, 0.035);
        claw.rotation.x = Math.PI + rand(-0.18, 0.18);
        claw.rotation.z = rand(-0.22, 0.22);
        claw.castShadow = true;
        arm.add(claw);
      }
      this.group.add(arm);
      this.arms.push(arm);
    }

    // Eye light bleeds into the corridor and up the face.
    this.eyeLight = new THREE.PointLight(0xffa020, 3.6, 5.5, 1.9);
    this.eyeLight.position.set(0, 2.36, 0.58);
    this.group.add(this.eyeLight);

    const aura = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glow, color: 0xffa818, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.07,
    }));
    aura.scale.set(3.0, 3.4, 1);
    aura.position.y = 2.2;
    this.group.add(aura);
    this.aura = aura;

    this.group.traverse((o) => { if (o.isMesh) o.frustumCulled = false; });
  }

  spawn(pos, playerPos) {
    this.group.visible = true;
    this.group.position.set(pos.x, 0, pos.z);
    this.group.rotation.set(0, Math.atan2(playerPos.x - pos.x, playerPos.z - pos.z), 0);
    this.state = 'dormant';
    this.path = null;
    this.pathIndex = 0;
    this.pathTimer = 0;
    this.lastSeen = 0;
    this.lastKnown = null;
    this.searchTimer = 0;
    this.growlTimer = 0;
    this.threat = 0;
    this.caught = false;
    this.animTime = 0;
    this.head.rotation.set(0, 0, 0);
    this.jaw = this.jaw;
  }

  placeForScare(playerPos, yaw) {
    const fx = -Math.sin(yaw);
    const fz = -Math.cos(yaw);
    const px = playerPos.x + fx * 2.05;
    const pz = playerPos.z + fz * 2.05;
    this.group.visible = true;
    this.group.position.set(px, 0, pz);
    this.group.rotation.set(0, Math.atan2(playerPos.x - px, playerPos.z - pz), 0);
    this.head.rotation.set(-0.1, 0, 0);
    this.state = 'scare';
  }

  update(dt, time, ctx) {
    this.animTime += dt;
    const p = this.group.position;
    const player = ctx.playerPos;
    const dx = player.x - p.x;
    const dz = player.z - p.z;
    const dist = Math.hypot(dx, dz);

    const active = ctx.mode === 'playing' && ctx.grace <= 0;
    const headPos = new THREE.Vector3(p.x, 2.25, p.z);
    const eyePos = new THREE.Vector3(player.x, CONFIG.eyeHeight, player.z);
    const clear = ctx.world.lineOfSight(headPos, eyePos);
    const seeRange = ctx.flashlightOn ? 24 : 14.5;
    const sees = active && clear && dist < seeRange;
    const hears = active && ctx.sprinting && dist < 16;
    const close = active && clear && dist < 3.3;

    if (ctx.mode === 'playing') {
      if (sees || hears || close) {
        if (this.state !== 'hunt' && this.state !== 'scare') {
          this.state = 'hunt';
          this.growlTimer = 0;
          if (ctx.onGrowl) ctx.onGrowl(false);
        }
        this.state = this.state === 'scare' ? 'scare' : 'hunt';
        this.lastSeen = 0;
        this.lastKnown = ctx.world.cellOf(player.x, player.z);
      } else if (this.state === 'hunt') {
        this.lastSeen += dt;
        if (this.lastSeen > 4.2) {
          this.state = 'search';
          this.searchTimer = 8;
          this.path = null;
        }
      } else if (this.state === 'dormant' && active) {
        this.state = 'stalk';
      } else if (this.state === 'search') {
        this.searchTimer -= dt;
        if (this.searchTimer <= 0) {
          this.state = 'stalk';
          this.path = null;
        }
      }
    }

    if (this.state === 'scare') {
      const bob = Math.sin(this.animTime * 20) * 0.015;
      this.group.position.y = bob;
      this.head.rotation.z = Math.sin(this.animTime * 30) * 0.05;
      this._animateEyes(time, 1);
      return dist;
    }

    let target = null;
    let speed = 0;
    if (this.state === 'hunt') {
      speed = 3.92;
      if (clear && dist < 9) {
        target = { x: player.x, z: player.z };
      } else {
        this._repath(ctx.world, player, dt, 0.32);
        target = this._waypoint(ctx.world, dt);
      }
      this.growlTimer -= dt;
      if (this.growlTimer <= 0) {
        this.growlTimer = rand(1.8, 3.4);
        if (ctx.onGrowl) ctx.onGrowl(true);
      }
    } else if (this.state === 'search') {
      speed = 2.15;
      if (this.searchTimer === 8 || !this.lastKnown) {
        this.lastKnown = ctx.world.cellOf(player.x, player.z);
      }
      this._repath(ctx.world, { x: this._lastKnownPos(ctx.world).x, z: this._lastKnownPos(ctx.world).z }, dt, 0.5);
      target = this._waypoint(ctx.world, dt);
    } else if (this.state === 'stalk') {
      speed = dist < 7 ? 2.05 : 1.62;
      this._repath(ctx.world, player, dt, 0.55);
      target = this._waypoint(ctx.world, dt);
    } else if (this.state === 'dormant') {
      // The first stare. Face the player, barely moving.
      this.group.rotation.y = Math.atan2(dx, dz);
    }

    if (target) {
      const tx = target.x - p.x;
      const tz = target.z - p.z;
      const td = Math.hypot(tx, tz);
      if (td > 0.02) {
        const wantYaw = Math.atan2(tx, tz);
        this.group.rotation.y = lerpAngle(this.group.rotation.y, wantYaw, 1 - Math.exp(-dt * 7));
        const step = Math.min(speed * dt, td);
        const nx = p.x + (tx / td) * step;
        const nz = p.z + (tz / td) * step;
        if (ctx.world.canStand(nx, nz, 0.52, true)) {
          p.x = nx;
          p.z = nz;
        } else {
          if (ctx.world.canStand(nx, p.z, 0.52, true)) p.x = nx;
          if (ctx.world.canStand(p.x, nz, 0.52, true)) p.z = nz;
          this.path = null;
        }
      }
    }

    // Body language
    const hunting = this.state === 'hunt';
    const breathe = Math.sin(this.animTime * (hunting ? 6 : 1.4)) * (hunting ? 0.035 : 0.022);
    p.y = breathe;
    this.head.rotation.z = Math.sin(this.animTime * 1.1) * 0.045;
    this.head.rotation.x = hunting ? 0.16 : Math.sin(this.animTime * 0.7) * 0.03;
    this.head.rotation.y = Math.sin(this.animTime * 0.5) * 0.06;
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? -1 : 1;
      const arm = this.arms[i];
      arm.rotation.x = (hunting ? -1.18 : -0.14) + Math.sin(this.animTime * (hunting ? 5 : 1.2) + i) * (hunting ? 0.12 : 0.05);
      arm.rotation.z = side * (hunting ? 0.42 : 0.26) + Math.sin(this.animTime * 1.5 + i) * 0.03;
    }
    const jawOpen = hunting ? 0.09 : Math.sin(this.animTime * 1.3) * 0.01;
    if (this.jawGroup) this.jawGroup.position.y = -0.38 - jawOpen;
    this._animateEyes(time, hunting ? 1.25 : 1);

    this.threat = lerp(this.threat, hunting ? clamp(1 - dist / 19, 0.12, 1) : clamp(1 - dist / 15, 0, 0.42) * 0.5, 0.08);

    if (active && !this.caught && dist < 1.34) {
      this.caught = true;
      if (ctx.onCatch) ctx.onCatch();
    }
    return dist;
  }

  _animateEyes(time, intensity) {
    const pulse = 0.92 + Math.sin(time * 4.2) * 0.08 + Math.sin(time * 13.7) * 0.03;
    for (const s of this.eyeGlows) {
      s.material.opacity = 0.75 + pulse * 0.22;
      const scale = (0.55 + pulse * 0.14) * (0.9 + intensity * 0.12);
      s.scale.set(scale, scale, 1);
    }
    if (this.eyeLight) this.eyeLight.intensity = (4.2 + pulse * 2.6) * intensity;
    if (this.aura) this.aura.material.opacity = 0.07 + Math.sin(time * 2.2) * 0.03;
  }

  _lastKnownPos(world) {
    if (!this.lastKnown) return { x: this.group.position.x, z: this.group.position.z };
    return world.cellCenter(this.lastKnown[0], this.lastKnown[1]);
  }

  _repath(world, target, dt, interval) {
    this.pathTimer -= dt;
    if (this.pathTimer > 0 && this.path) return;
    this.pathTimer = interval;
    const start = world.cellOf(this.group.position.x, this.group.position.z);
    const goal = world.cellOf(target.x, target.z);
    if (start[0] === goal[0] && start[1] === goal[1]) { this.path = null; return; }
    this.path = world.bfs(start, goal);
    this.pathIndex = this.path && this.path.length > 1 ? 1 : 0;
  }

  _waypoint(world, dt) {
    if (!this.path || this.path.length === 0) {
      // No path: drift in place so it never freezes.
      return null;
    }
    while (this.pathIndex < this.path.length) {
      const c = this.path[this.pathIndex];
      const p = world.cellCenter(c[0], c[1]);
      const d = Math.hypot(p.x - this.group.position.x, p.z - this.group.position.z);
      if (d < 0.46) {
        this.pathIndex++;
        continue;
      }
      return p;
    }
    return null;
  }
}

function lerpAngle(a, b, t) {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

function clamp01(v) { return clamp(v, 0, 1); }
