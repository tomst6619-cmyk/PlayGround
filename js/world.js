import * as THREE from '../vendor/three.module.js';
import { CONFIG, rand, randInt, pick, shuffle } from './config.js';
import { makeSign } from './textures.js';

const { mapW: W, mapH: H, cell: CELL, wallH: WALL_H } = CONFIG;

const SIGN_WORDS = [
  ['WARD 3', '#a8e8b8'], ['MORGUE', '#e8a8a8'], ['X-RAY', '#a8d8e8'],
  ['NO ENTRY', '#e8c58a'], ['ICU', '#a8e8b8'], ['STAFF ONLY', '#d8d8c0'],
  ['ELEVATOR', '#c0c8a8'], ['PHARMACY', '#a8e8c8'],
];

export class HospitalWorld {
  constructor(scene, assets) {
    this.scene = scene;
    this.assets = assets;
    this.group = null;
    this.souls = [];
    this.colliders = [];
    this.fixtures = [];
    this.exit = null;
    this.exitActive = false;
    this.dust = null;
    this.grid = null;
    this.openCells = [];
  }

  cellCenter(x, y, out = new THREE.Vector3()) {
    return out.set((x - (W - 1) / 2) * CELL, 0, (y - (H - 1) / 2) * CELL);
  }

  cellOf(x, z) {
    return [Math.floor(x / CELL + W / 2), Math.floor(z / CELL + H / 2)];
  }

  isWall(x, y) {
    return x < 0 || y < 0 || x >= W || y >= H || this.grid[y][x] === 1;
  }

  canStand(x, z, radius = CONFIG.playerRadius, ignoreProps = false) {
    const [cx, cy] = this.cellOf(x, z);
    if (this.isWall(cx, cy)) return false;
    const steps = 8;
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      const px = x + Math.cos(a) * radius;
      const pz = z + Math.sin(a) * radius;
      const [gx, gy] = this.cellOf(px, pz);
      if (this.isWall(gx, gy)) return false;
    }
    if (!ignoreProps) {
      for (const c of this.colliders) {
        const dx = x - c.x;
        const dz = z - c.z;
        if (dx * dx + dz * dz < (radius + c.r) * (radius + c.r)) return false;
      }
    }
    return true;
  }

  lineOfSight(a, b) {
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const dist = Math.hypot(dx, dz);
    const steps = Math.max(2, Math.ceil(dist / 0.32));
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const [gx, gy] = this.cellOf(a.x + dx * t, a.z + dz * t);
      if (this.isWall(gx, gy)) return false;
    }
    return true;
  }

  bfs(start, goal) {
    if (!start || !goal) return null;
    const sk = start[1] * W + start[0];
    const gk = goal[1] * W + goal[0];
    if (this.grid[start[1]]?.[start[0]] === 1) return null;
    const prev = new Int32Array(W * H).fill(-1);
    const seen = new Uint8Array(W * H);
    const queue = [sk];
    seen[sk] = 1;
    let head = 0;
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    while (head < queue.length) {
      const key = queue[head++];
      if (key === gk) break;
      const x = key % W;
      const y = (key - x) / W;
      for (const [dx, dy] of dirs) {
        const nx = x + dx;
        const ny = y + dy;
        if (this.isWall(nx, ny)) continue;
        const nk = ny * W + nx;
        if (seen[nk]) continue;
        seen[nk] = 1;
        prev[nk] = key;
        queue.push(nk);
      }
    }
    if (!seen[gk]) return null;
    const path = [];
    let k = gk;
    while (k !== -1) {
      path.push([k % W, Math.floor(k / W)]);
      if (k === sk) break;
      k = prev[k];
    }
    return path.reverse();
  }

  distanceField(start) {
    const dist = new Int32Array(W * H).fill(-1);
    const sk = start[1] * W + start[0];
    const queue = [sk];
    dist[sk] = 0;
    let head = 0;
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    while (head < queue.length) {
      const key = queue[head++];
      const x = key % W;
      const y = (key - x) / W;
      for (const [dx, dy] of dirs) {
        const nx = x + dx;
        const ny = y + dy;
        if (this.isWall(nx, ny)) continue;
        const nk = ny * W + nx;
        if (dist[nk] !== -1) continue;
        dist[nk] = dist[key] + 1;
        queue.push(nk);
      }
    }
    return dist;
  }

  generate() {
    if (this.group) {
      this.scene.remove(this.group);
      this.group.traverse((o) => {
        if (o.isMesh && o.geometry) o.geometry.dispose();
      });
    }
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.souls = [];
    this.colliders = [];
    this.fixtures = [];
    this.exitActive = false;
    this.grid = this._maze();
    this.openCells = [];
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        if (this.grid[y][x] === 0) this.openCells.push([x, y]);
      }
    }

    const layout = this._layout();
    this.spawn = layout.spawn;
    this.exitCell = layout.exitCell;

    this._buildShell();
    this._buildProps(layout);
    this._buildFixtures(layout);
    this._buildSigns();
    this._buildDecals();
    this._buildExit(layout);
    this._buildSouls(layout);
    this._buildDust();

    return layout;
  }

  _maze() {
    const g = Array.from({ length: H }, () => Array(W).fill(1));
    let x = 1;
    let y = 1;
    g[y][x] = 0;
    const stack = [[x, y]];
    const dirs = [[2, 0], [-2, 0], [0, 2], [0, -2]];
    while (stack.length) {
      const [cx, cy] = stack[stack.length - 1];
      const options = shuffle(dirs.slice());
      let advanced = false;
      for (const [dx, dy] of options) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx > 0 && ny > 0 && nx < W - 1 && ny < H - 1 && g[ny][nx] === 1) {
          g[cy + dy / 2][cx + dx / 2] = 0;
          g[ny][nx] = 0;
          stack.push([nx, ny]);
          advanced = true;
          break;
        }
      }
      if (!advanced) stack.pop();
    }
    // Knock through some walls to create loops (less dead-end frustration).
    for (let i = 0; i < 46; i++) {
      const x = randInt(2, W - 3);
      const y = randInt(2, H - 3);
      if (g[y][x] === 1 && ((x % 2 === 0) !== (y % 2 === 0))) g[y][x] = 0;
    }
    // Wards / open rooms.
    for (let r = 0; r < 3; r++) {
      const cx = randInt(3, W - 4);
      const cy = randInt(3, H - 4);
      for (let yy = cy - 1; yy <= cy + 1; yy++) {
        for (let xx = cx - 1; xx <= cx + 1; xx++) {
          if (xx > 0 && yy > 0 && xx < W - 1 && yy < H - 1) g[yy][xx] = 0;
        }
      }
    }
    return g;
  }

  _layout() {
    const passages = [];
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) if (this.grid[y][x] === 0) passages.push([x, y]);
    }

    // Carve a long, clean opening corridor so the first sight of the demon is framed.
    const dirs = [[0, -1], [1, 0], [0, 1], [-1, 0]];
    let spot = null;
    for (const [sx, sy] of shuffle(passages.slice())) {
      for (const [dx, dy] of shuffle(dirs.slice())) {
        let okay = true;
        for (let i = 0; i < 10; i++) {
          const nx = sx + dx * i;
          const ny = sy + dy * i;
          if (nx < 1 || ny < 1 || nx >= W - 1 || ny >= H - 1) { okay = false; break; }
        }
        if (okay) { spot = { sx, sy, dx, dy }; break; }
      }
      if (spot) break;
    }
    if (!spot) spot = { sx: 1, sy: 1, dx: 1, dy: 0 };
    for (let i = 0; i < 10; i++) this.grid[spot.sy + spot.dy * i][spot.sx + spot.dx * i] = 0;

    const spawnCell = [spot.sx, spot.sy];
    const dist = this.distanceField(spawnCell);
    const spawnPos = this.cellCenter(spot.sx, spot.sy);

    // Demon waits down the opening corridor.
    const demonCell = [spot.sx + spot.dx * 2, spot.sy + spot.dy * 2];
    const demonPos = this.cellCenter(demonCell[0], demonCell[1]);
    demonPos.x -= spot.dx * 2.35;
    demonPos.z -= spot.dy * 2.35;

    const yaw = Math.atan2(-spot.dx, -spot.dy);
    const spawn = { cell: spawnCell, pos: spawnPos, yaw, dir: [spot.dx, spot.dy], demonPos, demonCell };

    // Exit at the furthest reachable point.
    let exitCell = spawnCell;
    let best = -1;
    for (const [x, y] of this.openCells) {
      const d = dist[y * W + x];
      if (d > best) { best = d; exitCell = [x, y]; }
    }
    // Orient the exit gate toward the way back.
    let faceCell = [exitCell[0], exitCell[1] + 1];
    let bestFace = Infinity;
    for (const [dx, dy] of dirs) {
      const nx = exitCell[0] + dx;
      const ny = exitCell[1] + dy;
      if (this.isWall(nx, ny)) continue;
      const d = dist[ny * W + nx];
      if (d >= 0 && d < bestFace) { bestFace = d; faceCell = [nx, ny]; }
    }
    const exitPos = this.cellCenter(exitCell[0], exitCell[1]);

    // Spread five souls across the map.
    const chosen = [];
    const candidates = this.openCells.filter(([x, y]) => {
      const d = dist[y * W + x];
      return d >= 5 && !(Math.abs(x - spawnCell[0]) + Math.abs(y - spawnCell[1]) < 3);
    });
    const shuffled = shuffle(candidates.slice());
    for (const c of shuffled) {
      if (chosen.length >= CONFIG.soulsNeeded) break;
      if (chosen.some((o) => Math.abs(o[0] - c[0]) + Math.abs(o[1] - c[1]) < 6)) continue;
      if (Math.abs(c[0] - exitCell[0]) + Math.abs(c[1] - exitCell[1]) < 2) continue;
      chosen.push(c);
    }
    for (const c of shuffled) {
      if (chosen.length >= CONFIG.soulsNeeded) break;
      if (!chosen.some((o) => o[0] === c[0] && o[1] === c[1])) chosen.push(c);
    }
    const soulCells = chosen.slice(0, CONFIG.soulsNeeded);

    return {
      spawn, exitCell, exitPos, faceCell, demonCell, demonPos,
      soulCells, dist, spawnCell, openCells: this.openCells,
    };
  }

  _buildShell() {
    const { mats } = this.assets;
    const width = W * CELL;
    const depth = H * CELL;

    const floorGeo = new THREE.PlaneGeometry(width, depth);
    const floor = new THREE.Mesh(floorGeo, mats.floor);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.group.add(floor);

    const ceilGeo = new THREE.PlaneGeometry(width, depth);
    const ceiling = new THREE.Mesh(ceilGeo, mats.ceiling);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = WALL_H;
    ceiling.receiveShadow = true;
    this.group.add(ceiling);

    const wallCells = [];
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (this.grid[y][x] !== 1) continue;
        let exposed = false;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < W && ny < H && this.grid[ny][nx] === 0) { exposed = true; break; }
        }
        if (exposed) wallCells.push([x, y]);
      }
    }

    const geo = new THREE.BoxGeometry(CELL, WALL_H, CELL);
    const mesh = new THREE.InstancedMesh(geo, mats.wall, wallCells.length);
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    wallCells.forEach(([x, y], i) => {
      dummy.position.set((x - (W - 1) / 2) * CELL, WALL_H / 2, (y - (H - 1) / 2) * CELL);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      const v = rand(0.8, 1.03);
      color.setRGB(v, v, v * rand(0.94, 1.02));
      mesh.setColorAt(i, color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.castShadow = !this.assets.lowGfx;
    mesh.receiveShadow = true;
    this.group.add(mesh);
  }

  _buildFixtures(layout) {
    const { mats } = this.assets;
    const choices = shuffle(this.openCells.filter(([x, y]) => {
      const d = layout.dist[y * W + x];
      return d > 4 && Math.abs(x - layout.spawnCell[0]) + Math.abs(y - layout.spawnCell[1]) > 4;
    })).slice(0, 7);

    choices.forEach(([x, y], i) => {
      const p = this.cellCenter(x, y);
      const mat = new THREE.MeshBasicMaterial({ color: 0xcfd6c4, toneMapped: false });
      const bar = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.07, 0.36), mat);
      bar.position.set(p.x, WALL_H - 0.12, p.z);
      this.group.add(bar);
      const cage = new THREE.Mesh(new THREE.BoxGeometry(1.66, 0.12, 0.5), mats.metalDark);
      cage.position.set(p.x, WALL_H - 0.17, p.z);
      this.group.add(cage);

      let light = null;
      if (i < (this.assets.lowGfx ? 2 : 4)) {
        light = new THREE.PointLight(0xc4d2bc, 9, 8.5, 1.8);
        light.position.set(p.x, WALL_H - 0.5, p.z);
        this.group.add(light);
      }
      this.fixtures.push({
        mat,
        light,
        base: light ? 9 : 0,
        phase: rand(0, 10),
        speed: rand(0.4, 1.6),
        flicker: i % 3 === 0,
        color: new THREE.Color(0xcfd6c4),
      });
    });
  }

  _buildProps(layout) {
    const rooms = this.openCells.filter(([x, y]) => {
      let open = 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!this.isWall(x + dx, y + dy)) open++;
      if (open < 3) return false;
      if (Math.abs(x - layout.spawnCell[0]) + Math.abs(y - layout.spawnCell[1]) < 4) return false;
      if (Math.abs(x - layout.exitCell[0]) + Math.abs(y - layout.exitCell[1]) < 2) return false;
      if (layout.soulCells.some(([sx, sy]) => sx === x && sy === y)) return false;
      return true;
    });

    const selected = shuffle(rooms.slice()).slice(0, 12);
    let count = 0;
    for (const [x, y] of selected) {
      if (Math.random() < 0.28) continue;
      const p = this.cellCenter(x, y);
      // Push furniture toward a nearby wall.
      let ox = 0;
      let oz = 0;
      const walls = [];
      if (this.isWall(x - 1, y)) walls.push([-1, 0]);
      if (this.isWall(x + 1, y)) walls.push([1, 0]);
      if (this.isWall(x, y - 1)) walls.push([0, -1]);
      if (this.isWall(x, y + 1)) walls.push([0, 1]);
      if (walls.length) {
        const [wx, wz] = pick(walls);
        ox = wx * (CELL / 2 - 1.0);
        oz = wz * (CELL / 2 - 1.0);
      }
      const px = p.x + ox;
      const pz = p.z + oz;
      const rot = Math.atan2(ox, oz) + (Math.random() < 0.5 ? Math.PI / 2 : 0);
      const type = count % 4;
      if (type === 0) this._bed(px, pz, rot, true);
      else if (type === 1) this._gurney(px, pz, rot);
      else if (type === 2) this._ivStand(px, pz);
      else this._cart(px, pz, rot);
      count++;
      if (count >= 9) break;
    }

    // A gurney waits in the opening corridor, just out of the flashlight's reach.
    const sp = layout.spawn;
    const perp = [-sp.dir[1], sp.dir[0]];
    const gx = sp.pos.x + sp.dir[0] * CELL * 1.15 + perp[0] * 1.32;
    const gz = sp.pos.z + sp.dir[1] * CELL * 1.15 + perp[1] * 1.32;
    this._gurney(gx, gz, Math.atan2(-sp.dir[1], sp.dir[0]));
  }

  _bed(x, z, rot, withCollider = true) {
    const { mats } = this.assets;
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = rot;

    const frame = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.1, 0.94), mats.metal);
    frame.position.y = 0.56;
    const mattress = new THREE.Mesh(new THREE.BoxGeometry(1.98, 0.19, 0.86), mats.mattress);
    mattress.position.y = 0.7;
    const sheet = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.035, 0.88), mats.sheet);
    sheet.position.set(0.26, 0.81, 0);
    sheet.rotation.z = 0.004;
    const pillow = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.1, 0.64), mats.sheet);
    pillow.position.set(-0.72, 0.83, 0);
    pillow.rotation.y = rand(-0.12, 0.12);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.9, 0.98), mats.metalDark);
    head.position.set(-1.03, 0.78, 0);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 0.96), mats.metalDark);
    foot.position.set(1.03, 0.56, 0);
    g.add(frame, mattress, sheet, pillow, head, foot);
    for (const sx of [-0.86, 0.86]) {
      for (const sz of [-0.36, 0.36]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.55, 6), mats.metal);
        leg.position.set(sx, 0.28, sz);
        g.add(leg);
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.04, 8), mats.metalDark);
        wheel.rotation.x = Math.PI / 2;
        wheel.position.set(sx, 0.06, sz);
        g.add(wheel);
      }
    }
    g.traverse((o) => { if (o.isMesh) { o.castShadow = !this.assets.lowGfx; o.receiveShadow = true; } });
    this.group.add(g);
    if (withCollider) this.colliders.push({ x, z, r: 0.72 });
  }

  _gurney(x, z, rot) {
    const { mats } = this.assets;
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = rot;
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.09, 0.7), mats.metal);
    top.position.y = 0.8;
    const pad = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.12, 0.64), mats.mattress);
    pad.position.y = 0.9;
    g.add(top, pad);
    for (const sx of [-0.72, 0.72]) {
      for (const sz of [-0.26, 0.26]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.78, 6), mats.metal);
        leg.position.set(sx, 0.4, sz);
        g.add(leg);
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.045, 8), mats.metalDark);
        wheel.rotation.x = Math.PI / 2;
        wheel.position.set(sx, 0.07, sz);
        g.add(wheel);
      }
    }
    g.traverse((o) => { if (o.isMesh) { o.castShadow = !this.assets.lowGfx; o.receiveShadow = true; } });
    this.group.add(g);
    this.colliders.push({ x, z, r: 0.58 });
  }

  _ivStand(x, z) {
    const { mats } = this.assets;
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.05, 10), mats.metalDark);
    base.position.y = 0.03;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1.85, 6), mats.metal);
    pole.position.y = 0.95;
    const bag = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.3, 0.05), new THREE.MeshStandardMaterial({ color: 0xa8b49a, roughness: 0.45, transparent: true, opacity: 0.75 }));
    bag.position.set(0.12, 1.55, 0);
    g.add(base, pole, bag);
    g.traverse((o) => { if (o.isMesh) o.castShadow = !this.assets.lowGfx; });
    this.group.add(g);
    this.colliders.push({ x, z, r: 0.3 });
  }

  _cart(x, z, rot) {
    const { mats } = this.assets;
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = rot;
    for (let i = 0; i < 3; i++) {
      const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.035, 0.5), mats.metal);
      shelf.position.y = 0.3 + i * 0.38;
      g.add(shelf);
    }
    for (const sx of [-0.32, 0.32]) {
      for (const sz of [-0.21, 0.21]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 1.08, 6), mats.metal);
        post.position.set(sx, 0.54, sz);
        g.add(post);
      }
    }
    g.traverse((o) => { if (o.isMesh) { o.castShadow = !this.assets.lowGfx; o.receiveShadow = true; } });
    this.group.add(g);
    this.colliders.push({ x, z, r: 0.36 });
  }

  _buildSigns() {
    const wallFaces = [];
    for (const [x, y] of this.openCells) {
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (this.isWall(x + dx, y + dy)) wallFaces.push({ open: [x, y], dir: [dx, dy] });
      }
    }
    const chosen = shuffle(wallFaces).slice(0, 11);
    chosen.forEach((face, i) => {
      if (Math.random() < 0.2) return;
      const [word, color] = SIGN_WORDS[i % SIGN_WORDS.length];
      const mat = makeSign(word, color, '#08100b');
      const [ox, oy] = face.open;
      const [dx, dy] = face.dir;
      const p = this.cellCenter(ox, oy);
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.35, 0.34), mat);
      sign.position.set(p.x + dx * (CELL / 2 - 0.015), 2.32, p.z + dy * (CELL / 2 - 0.015));
      sign.rotation.y = Math.atan2(-dx, -dy);
      this.group.add(sign);
    });
  }

  _buildDecals() {
    const { mats } = this.assets;
    // Wall splatters
    const faces = [];
    for (const [x, y] of this.openCells) {
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (this.isWall(x + dx, y + dy)) faces.push({ open: [x, y], dir: [dx, dy] });
      }
    }
    shuffle(faces).slice(0, 12).forEach((face) => {
      const [ox, oy] = face.open;
      const [dx, dy] = face.dir;
      const p = this.cellCenter(ox, oy);
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(rand(1.1, 2.2), rand(1.2, 2.4)), mats.blood);
      mesh.position.set(p.x + dx * (CELL / 2 - 0.02), rand(0.8, 1.7), p.z + dy * (CELL / 2 - 0.02));
      mesh.rotation.y = Math.atan2(-dx, -dy);
      mesh.rotation.z = rand(0, Math.PI);
      this.group.add(mesh);
    });
    // Floor pools
    for (let i = 0; i < 18; i++) {
      const cell = pick(this.openCells);
      const p = this.cellCenter(cell[0], cell[1]);
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(rand(0.7, 2.1), rand(0.7, 2.1)), mats.blood);
      mesh.position.set(p.x + rand(-1.4, 1.4), 0.012, p.z + rand(-1.4, 1.4));
      mesh.rotation.x = -Math.PI / 2;
      mesh.rotation.z = rand(0, Math.PI * 2);
      this.group.add(mesh);
    }
  }

  _buildExit(layout) {
    const { mats } = this.assets;
    const p = layout.exitPos;
    const g = new THREE.Group();
    g.position.copy(p);
    const [fx, fy] = layout.faceCell;
    const dx = fx - layout.exitCell[0];
    const dz = fy - layout.exitCell[1];
    g.rotation.y = Math.atan2(dx, dz);

    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.9, 2.72, 0.24), mats.metalDark);
    frame.position.y = 1.36;
    frame.position.z = -0.06;
    g.add(frame);

    const red = mats.exitRed;
    const panels = [];
    for (const side of [-1, 1]) {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(0.78, 2.4, 0.1), red);
      panel.position.set(side * 0.42, 1.25, 0.1);
      panel.castShadow = !this.assets.lowGfx;
      g.add(panel);
      panels.push(panel);
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.34, 6), mats.metal);
      handle.rotation.z = Math.PI / 2;
      handle.position.set(side * 0.11, 1.05, 0.18);
      g.add(handle);
    }

    const redSign = makeSign('EXIT', '#ff7060', '#160303');
    const greenSign = makeSign('EXIT', '#8dffb0', '#03140a');
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 0.26), redSign);
    sign.position.set(0, 2.5, 0.14);
    g.add(sign);

    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.assets.glow, color: 0xff4a3a, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.3,
    }));
    halo.position.set(0, 1.4, 0.12);
    halo.scale.set(3.6, 3.2, 1);
    g.add(halo);

    const light = new THREE.PointLight(0xff3a2a, 16, 8, 1.9);
    light.position.set(0, 2.15, 0.7);
    g.add(light);

    this.group.add(g);
    this.exit = { group: g, panels, sign, redSign, greenSign, halo, light, pos: p };
  }

  activateExit() {
    if (this.exitActive || !this.exit) return;
    this.exitActive = true;
    for (const panel of this.exit.panels) panel.material = this.assets.mats.exitGreen;
    this.exit.sign.material = this.exit.greenSign;
    this.exit.halo.material.color.setHex(0x5aff96);
    this.exit.halo.material.opacity = 0.45;
    this.exit.light.color.setHex(0x3aff7a);
    this.exit.light.intensity = 9;
  }

  _buildSouls(layout) {
    const soulMat = new THREE.MeshBasicMaterial({ color: 0xffd45a, toneMapped: false });
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffc23a, transparent: true, opacity: 0.55,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    });
    layout.soulCells.forEach(([x, y]) => {
      const p = this.cellCenter(x, y);
      p.y = 1.18;
      const g = new THREE.Group();
      g.position.copy(p);

      const core = new THREE.Mesh(new THREE.SphereGeometry(0.13, 18, 14), soulMat);
      g.add(core);
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({
        map: this.assets.glow, color: 0xffc83a, transparent: true,
        blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.95,
      }));
      halo.scale.set(1.55, 1.55, 1);
      g.add(halo);
      const beam = new THREE.Sprite(new THREE.SpriteMaterial({
        map: this.assets.glow, color: 0xffb52a, transparent: true,
        blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.11,
      }));
      beam.scale.set(1.15, 3.6, 1);
      g.add(beam);

      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.012, 6, 32), ringMat);
      ring.rotation.x = Math.PI / 2.5;
      g.add(ring);
      const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.008, 6, 32), ringMat);
      ring2.rotation.x = Math.PI / 2;
      ring2.rotation.y = Math.PI / 3;
      g.add(ring2);

      this.group.add(g);
      this.souls.push({ group: g, core, halo, ring, ring2, pos: p.clone(), collected: false, phase: rand(0, 10) });
    });
  }

  _buildDust() {
    const count = this.assets.lowGfx ? 180 : 460;
    const positions = new Float32Array(count * 3);
    const base = new Float32Array(count * 3);
    const phase = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const [gx, gy] = pick(this.openCells);
      const p = this.cellCenter(gx, gy);
      const x = p.x + rand(-CELL / 2, CELL / 2);
      const z = p.z + rand(-CELL / 2, CELL / 2);
      const y = rand(0.2, WALL_H - 0.2);
      positions[i * 3] = base[i * 3] = x;
      positions[i * 3 + 1] = base[i * 3 + 1] = y;
      positions[i * 3 + 2] = base[i * 3 + 2] = z;
      phase[i] = rand(0, Math.PI * 2);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      map: this.assets.glow, color: 0x9fa79a, size: 0.075, sizeAttenuation: true,
      transparent: true, opacity: 0.32, depthWrite: false,
      blending: THREE.AdditiveBlending, toneMapped: false,
    });
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    this.group.add(points);
    this.dust = { points, base, phase, count };
  }

  tryCollectSoul(pos) {
    for (const soul of this.souls) {
      if (soul.collected) continue;
      const dx = soul.pos.x - pos.x;
      const dz = soul.pos.z - pos.z;
      if (dx * dx + dz * dz < 1.45 * 1.45) {
        soul.collected = true;
        soul.group.visible = false;
        return soul;
      }
    }
    return null;
  }

  nearestSoulDistance(pos) {
    let best = Infinity;
    for (const soul of this.souls) {
      if (soul.collected) continue;
      best = Math.min(best, Math.hypot(soul.pos.x - pos.x, soul.pos.z - pos.z));
    }
    return best;
  }

  update(dt, time) {
    if (this.fixtures) {
      for (const f of this.fixtures) {
        let flick = 1;
        if (f.flicker) {
          const n = Math.sin(time * 11 + f.phase) * Math.sin(time * 3.7 + f.phase * 2);
          flick = n > 0.55 ? 0.18 : (Math.random() < 0.006 ? 0.1 : 1);
        }
        const pulse = 0.86 + Math.sin(time * f.speed + f.phase) * 0.14;
        if (f.light) f.light.intensity = f.base * pulse * flick;
        f.mat.color.copy(f.color).multiplyScalar(clamp01(pulse * flick));
      }
    }
    for (const soul of this.souls) {
      if (soul.collected) continue;
      const t = time + soul.phase;
      soul.group.position.y = 1.18 + Math.sin(t * 1.35) * 0.09;
      soul.ring.rotation.z += dt * 0.9;
      soul.ring2.rotation.z -= dt * 0.6;
      soul.halo.material.opacity = 0.78 + Math.sin(t * 2.1) * 0.16;
      const s = 1.5 + Math.sin(t * 2.1) * 0.12;
      soul.halo.scale.set(s, s, 1);
    }
    if (this.exit) {
      const t = time;
      this.exit.halo.material.opacity = (this.exitActive ? 0.42 : 0.26) + Math.sin(t * 2.3) * 0.08;
      this.exit.light.intensity = (this.exitActive ? 9 : 16) * (0.87 + Math.sin(t * 2.7) * 0.13);
    }
    if (this.dust) {
      const arr = this.dust.points.geometry.attributes.position.array;
      for (let i = 0; i < this.dust.count; i++) {
        arr[i * 3] = this.dust.base[i * 3] + Math.sin(time * 0.22 + this.dust.phase[i]) * 0.22;
        arr[i * 3 + 1] = this.dust.base[i * 3 + 1] + Math.sin(time * 0.35 + this.dust.phase[i] * 1.7) * 0.28;
        arr[i * 3 + 2] = this.dust.base[i * 3 + 2] + Math.cos(time * 0.19 + this.dust.phase[i]) * 0.22;
      }
      this.dust.points.geometry.attributes.position.needsUpdate = true;
    }
  }
}

const clamp01 = (v) => Math.max(0, Math.min(1, v));
