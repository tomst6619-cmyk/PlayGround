import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import {
  canvasTexture,
  color,
  drawBubble,
  makeBrickTexture,
  makeGrassTexture,
  makeIconTexture,
  makeLabelTexture,
  makeRoadTexture,
  makeSidewalkTexture,
  makeStripeTexture,
  makeSpeechSprite,
  mergeColoredMeshes,
  mesh,
  mulberry32,
  pick,
  roundedBox,
  standard,
} from './utils.js'
import { createBatman, createBunny, createPerson } from './characters.js'

const TRASH_VERTEX_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0.08 })
const CARROT_VERTEX_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72, metalness: 0 })
const STATIC_VERTEX_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 })
const STATIC_VERTEX_FLAT_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0, flatShading: true })

const HOUSE_PALETTES = [
  { wall: 0xf0dfbf, roof: 0x9d4f3f, trim: 0xfff8e8, door: 0x6c4b36 },
  { wall: 0xf4cda6, roof: 0x596b85, trim: 0xfff8e8, door: 0x3e5568 },
  { wall: 0xd3e2cd, roof: 0x8b5844, trim: 0xfffdf5, door: 0x7d4a35 },
  { wall: 0xc9dbeb, roof: 0x6b4a3e, trim: 0xfffaf0, door: 0xb35a3e },
  { wall: 0xf0d3d0, roof: 0x75505a, trim: 0xfffbf3, door: 0x4c4a5e },
  { wall: 0xebddaa, roof: 0x4f6a52, trim: 0xfffdf4, door: 0x6a4a33 },
]

const TRASH_TYPES = [
  { type: 'bag', name: 'Müllbeutel' },
  { type: 'can', name: 'Dose' },
  { type: 'bottle', name: 'Flasche' },
  { type: 'box', name: 'Pizzakarton' },
  { type: 'paper', name: 'Papierknäuel' },
  { type: 'banana', name: 'Bananenschale' },
]

const SKY_VERT = `
varying vec3 vWorldPos;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorldPos = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`

const SKY_FRAG = `
varying vec3 vWorldPos;
uniform vec3 uTop;
uniform vec3 uMid;
uniform vec3 uHorizon;
uniform vec3 uSunDir;
void main() {
  vec3 dir = normalize(vWorldPos);
  float h = clamp(dir.y, 0.0, 1.0);
  vec3 col = mix(uHorizon, uMid, smoothstep(0.0, 0.28, h));
  col = mix(col, uTop, smoothstep(0.25, 0.85, h));
  float sunDot = max(dot(dir, normalize(uSunDir)), 0.0);
  col += vec3(1.0, 0.68, 0.32) * pow(sunDot, 1400.0) * 1.7;
  col += vec3(1.0, 0.52, 0.2) * pow(sunDot, 220.0) * 0.06;
  float band = smoothstep(0.92, 1.0, 1.0 - abs(h - 0.06));
  col += vec3(1.0, 0.7, 0.4) * band * 0.12;
  gl_FragColor = vec4(col, 1.0);
}
`

/* Merge every static mesh that shares a material into one draw call. This is
   the single biggest win on software renderers: the neighborhood drops from
   roughly 1,800 draw calls to a few dozen. Objects that move at runtime are
   marked userData.noBake and stay untouched. */
function bakeStaticMeshes(root) {
  root.updateMatrixWorld(true)
  const rootInverse = new THREE.Matrix4().copy(root.matrixWorld).invert()
  const buckets = new Map()
  const originals = []

  const collect = (object) => {
    if (object.userData.noBake) return
    if (object.isMesh && object.geometry && !Array.isArray(object.material)) {
      originals.push(object)
      return
    }
    for (const child of object.children) collect(child)
  }
  collect(root)

  for (const source of originals) {
    let geometry
    if (source.geometry.index) {
      geometry = source.geometry.toNonIndexed()
    } else {
      geometry = source.geometry.clone()
    }
    for (const name of Object.keys(geometry.attributes)) {
      if (name !== 'position' && name !== 'normal' && name !== 'uv') geometry.deleteAttribute(name)
    }
    if (!geometry.attributes.normal) geometry.computeVertexNormals()
    if (!geometry.attributes.uv) {
      geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(geometry.attributes.position.count * 2), 2))
    }
    const matrix = new THREE.Matrix4().multiplyMatrices(rootInverse, source.matrixWorld)
    geometry.applyMatrix4(matrix)

    const material = source.material
    const canBakeVertexColors =
      material.isMeshStandardMaterial &&
      !material.map &&
      !material.transparent &&
      material.side === THREE.FrontSide &&
      (!material.emissive || material.emissive.getHex() === 0)

    let key
    let bucketMaterial = material
    if (canBakeVertexColors) {
      key = material.flatShading ? 'vertex-flat' : 'vertex-smooth'
      bucketMaterial = material.flatShading ? STATIC_VERTEX_FLAT_MAT : STATIC_VERTEX_MAT
      const color = material.color ?? new THREE.Color(0xffffff)
      const count = geometry.attributes.position.count
      const colors = new Float32Array(count * 3)
      for (let i = 0; i < count; i++) {
        colors[i * 3] = color.r
        colors[i * 3 + 1] = color.g
        colors[i * 3 + 2] = color.b
      }
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    } else {
      key = `material:${material.uuid}`
    }

    let bucket = buckets.get(key)
    if (!bucket) {
      bucket = { material: bucketMaterial, geometries: [], castShadow: false, receiveShadow: false }
      buckets.set(key, bucket)
    }
    bucket.geometries.push(geometry)
    if (source.castShadow) bucket.castShadow = true
    if (source.receiveShadow) bucket.receiveShadow = true
  }

  for (const bucket of buckets.values()) {
    const merged = mergeGeometries(bucket.geometries, false)
    if (!merged) continue
    merged.computeBoundingSphere()
    const baked = new THREE.Mesh(merged, bucket.material)
    baked.name = 'baked-static'
    baked.castShadow = bucket.castShadow
    baked.receiveShadow = bucket.receiveShadow
    root.add(baked)
    for (const geometry of bucket.geometries) geometry.dispose()
  }

  for (const source of originals) source.parent?.remove(source)
}

/* Clouds drift as a group, so each cloud's puffs can be one mesh inside its
   movable parent. */
function mergeCloudPuffs(cloud, puffs, material) {
  const geometries = puffs.map((puff) => {
    puff.updateMatrix()
    const geometry = puff.geometry.index ? puff.geometry.toNonIndexed() : puff.geometry.clone()
    geometry.applyMatrix4(puff.matrix)
    return geometry
  })
  const merged = mergeGeometries(geometries, false)
  for (const geometry of geometries) geometry.dispose()
  if (!merged) return
  cloud.clear()
  cloud.add(new THREE.Mesh(merged, material))
}

export function createWorld(scene) {
  const rnd = mulberry32(20261031)
  const root = new THREE.Group()
  root.name = 'neighborhood'
  scene.add(root)

  const colliders = []
  const world = {
    root,
    colliders,
    houses: [],
    trashItems: [],
    carrots: [],
    npcs: [],
    clouds: [],
    trees: [],
    bunny: null,
    batman: null,
    truck: null,
    totalTrash: 0,
    depositPoint: new THREE.Vector3(0, 1.0, 42.55),
    depositRadius: 3.4,
    bounds: { minX: -30, maxX: 30, minZ: -52, maxZ: 52 },
  }

  const addCollider = (minX, maxX, minZ, maxZ, tag = '') => {
    colliders.push({ minX, maxX, minZ, maxZ, tag })
  }

  /* ---------------- sky, light, fog ---------------- */
  const sunDir = new THREE.Vector3(-0.42, 0.4, -0.81).normalize()
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(310, 32, 20),
    new THREE.ShaderMaterial({
      uniforms: {
        uTop: { value: new THREE.Color(0x4076a8) },
        uMid: { value: new THREE.Color(0xef9d7c) },
        uHorizon: { value: new THREE.Color(0xffdfa8) },
        uSunDir: { value: sunDir },
      },
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    })
  )
  sky.name = 'sky'
  scene.add(sky)
  scene.background = new THREE.Color(0xffd9a8)
  scene.fog = new THREE.Fog(0xf5c6a0, 58, 148)

  const hemi = new THREE.HemisphereLight(0xbcd7ff, 0x6e7c4b, 0.95)
  scene.add(hemi)
  const sun = new THREE.DirectionalLight(0xffd9a6, 2.5)
  sun.position.copy(sunDir).multiplyScalar(70)
  sun.position.y = 48
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  sun.shadow.camera.near = 1
  sun.shadow.camera.far = 160
  sun.shadow.camera.left = -54
  sun.shadow.camera.right = 54
  sun.shadow.camera.top = 54
  sun.shadow.camera.bottom = -54
  sun.shadow.bias = -0.0004
  sun.shadow.normalBias = 0.025
  sun.shadow.radius = 2.2
  scene.add(sun)
  scene.add(sun.target)
  world.sun = sun
  const fill = new THREE.DirectionalLight(0xffb680, 0.5)
  fill.position.set(28, 18, 30)
  scene.add(fill)

  /* ---------------- ground, road, sidewalks ---------------- */
  const grassTex = makeGrassTexture(rnd)
  const grassMat = new THREE.MeshStandardMaterial({ map: grassTex, color: 0xffffff, roughness: 1 })
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), grassMat)
  ground.rotation.x = -Math.PI / 2
  ground.receiveShadow = true
  root.add(ground)

  const roadMat = new THREE.MeshStandardMaterial({ map: makeRoadTexture(rnd), roughness: 0.95, color: 0xdadada })
  const road = new THREE.Mesh(new THREE.PlaneGeometry(10.6, 112), roadMat)
  road.rotation.x = -Math.PI / 2
  road.position.y = 0.012
  road.receiveShadow = true
  root.add(road)

  const walkMat = new THREE.MeshStandardMaterial({ map: makeSidewalkTexture(rnd), roughness: 0.95, color: 0xf5efe2 })
  for (const side of [-1, 1]) {
    const walk = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 112), walkMat)
    walk.rotation.x = -Math.PI / 2
    walk.position.set(side * 6.8, 0.02, 0)
    walk.receiveShadow = true
    root.add(walk)

    const curb = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.16, 112), standard(0xd0c7b4, { roughness: 0.9 }))
    curb.position.set(side * 5.38, 0.07, 0)
    curb.castShadow = true
    curb.receiveShadow = true
    root.add(curb)

    const verge = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 112), standard(0x7f9a50, { roughness: 1 }))
    verge.rotation.x = -Math.PI / 2
    verge.position.set(side * 8.55, 0.021, 0)
    verge.receiveShadow = true
    root.add(verge)
  }

  // faded center dashes
  const dashMat = new THREE.MeshStandardMaterial({ color: 0xe9d9a5, roughness: 0.9, transparent: true, opacity: 0.55 })
  for (let z = -50; z <= 50; z += 9) {
    const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 2.6), dashMat)
    dash.rotation.x = -Math.PI / 2
    dash.position.set(0, 0.025, z)
    root.add(dash)
  }

  const manholeMat = standard(0x3a3a37, { roughness: 0.7, metalness: 0.3 })
  for (const [x, z] of [[1.9, 12], [-2.2, -18], [1.2, 33]]) {
    const hole = new THREE.Mesh(new THREE.CircleGeometry(0.42, 20), manholeMat)
    hole.rotation.x = -Math.PI / 2
    hole.position.set(x, 0.03, z)
    root.add(hole)
  }

  /* ---------------- shared geometries ---------------- */
  const geoms = {
    foundation: new THREE.BoxGeometry(8.7, 0.55, 7.5),
    body: new THREE.BoxGeometry(7.8, 4.0, 6.6),
    roofSlope: new THREE.BoxGeometry(Math.hypot(4.5, 2.25) + 0.5, 0.2, 7.65),
    ridge: new THREE.BoxGeometry(0.28, 0.28, 7.7),
    chimney: new THREE.BoxGeometry(0.8, 1.7, 0.8),
    door: new THREE.BoxGeometry(0.12, 2.1, 1.08),
    doorFrame: new THREE.BoxGeometry(0.16, 2.28, 1.28),
    garageDoor: new THREE.BoxGeometry(0.12, 2.15, 3.0),
    windowFrame: new THREE.BoxGeometry(0.14, 1.4, 1.55),
    windowGlass: new THREE.PlaneGeometry(1.32, 1.18),
    porchRoof: new THREE.BoxGeometry(1.5, 0.16, 2.7),
    post: new THREE.BoxGeometry(0.14, 1.4, 0.14),
    step: new THREE.BoxGeometry(1.2, 0.18, 1.7),
    binBody: new THREE.BoxGeometry(0.62, 1.0, 0.68),
    binLid: new THREE.BoxGeometry(0.68, 0.1, 0.74),
    hedge: new THREE.BoxGeometry(4.4, 0.85, 0.55),
    fencePost: new THREE.BoxGeometry(0.11, 0.9, 0.11),
    fenceRail: new THREE.BoxGeometry(0.07, 0.1, 4.4),
    treeTrunk: new THREE.CylinderGeometry(0.18, 0.3, 2.8, 7),
    canopy: new THREE.IcosahedronGeometry(1, 0),
    bush: new THREE.IcosahedronGeometry(0.6, 1),
  }

  const concreteMat = standard(0xc7bda9, { roughness: 0.98 })
  const concreteDark = standard(0xa9a08d, { roughness: 0.98 })
  const hedgeMat = standard(0x4c7b3c, { roughness: 1, flat: true })
  const trunkMat = standard(0x6c4a30, { roughness: 1 })
  const whiteFenceMat = standard(0xf3ecdb, { roughness: 0.9 })
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x8fb6c9, roughness: 0.12, metalness: 0.35, emissive: 0x2b3c48, emissiveIntensity: 0.18 })
  const brickMat = new THREE.MeshStandardMaterial({ map: makeBrickTexture(rnd), roughness: 0.95 })
  const porchLampMat = standard(0xffd98a, { roughness: 0.5, emissive: 0xffb84d, emissiveIntensity: 1.4 })
  const streetLampMat = standard(0xffe1a1, { roughness: 0.4, emissive: 0xffb44a, emissiveIntensity: 0.6 })

  // One atlas for all twelve house numbers means the plates share a material
  // and bake into a single draw call.
  const numberCols = 4
  const numberRows = 3
  const numberW = 192
  const numberH = 128
  const numberCanvas = document.createElement('canvas')
  numberCanvas.width = numberCols * numberW
  numberCanvas.height = numberRows * numberH
  const numberCtx = numberCanvas.getContext('2d')
  for (let i = 0; i < 12; i++) {
    const label = makeLabelTexture(String(2 + i * 2), { bg: '#fff7e3', fg: '#211f19', w: numberW, h: numberH, font: '900 80px "Arial Black", sans-serif' })
    numberCtx.drawImage(label.image, (i % numberCols) * numberW, Math.floor(i / numberCols) * numberH)
    label.dispose()
  }
  const numberTexture = new THREE.CanvasTexture(numberCanvas)
  numberTexture.colorSpace = THREE.SRGBColorSpace
  numberTexture.anisotropy = 4
  const numberMat = new THREE.MeshStandardMaterial({ map: numberTexture, roughness: 0.8 })

  function addPlane(tex, w, h, x, y, z, rotY = 0) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }))
    m.position.set(x, y, z)
    m.rotation.y = rotY
    m.castShadow = false
    m.receiveShadow = true
    return m
  }

  /* ---------------- houses ---------------- */
  const houseZs = [-35, -21, -7, 7, 21, 35]
  let houseId = 0
  for (const side of [-1, 1]) {
    for (let i = 0; i < houseZs.length; i++) {
      const z = houseZs[i]
      const palette = HOUSE_PALETTES[(houseId + (side === 1 ? 2 : 0)) % HOUSE_PALETTES.length]
      const g = new THREE.Group()
      const hx = side * 17
      g.position.set(hx, 0, z)
      g.rotation.y = side === 1 ? Math.PI : 0
      root.add(g)

      const wallMat = standard(palette.wall, { roughness: 0.9 })
      const roofMat = standard(palette.roof, { roughness: 0.92 })
      const trimMat = standard(palette.trim, { roughness: 0.85 })
      const doorMat = standard(palette.door, { roughness: 0.85 })
      const flip = i % 2 === 0 ? 1 : -1
      const doorZ = 0.95 * flip
      const garageZ = -2.25 * flip
      const windowZ = 2.6 * flip

      const foundation = new THREE.Mesh(geoms.foundation, concreteDark)
      foundation.position.y = 0.28
      foundation.castShadow = true
      foundation.receiveShadow = true
      g.add(foundation)

      const body = new THREE.Mesh(geoms.body, wallMat)
      body.position.y = 2.55
      body.castShadow = true
      body.receiveShadow = true
      g.add(body)

      // roof slopes
      const angle = Math.atan2(2.25, 4.5)
      for (const sign of [-1, 1]) {
        const slope = new THREE.Mesh(geoms.roofSlope, roofMat)
        slope.position.set(sign * 2.15, 5.66, 0)
        slope.rotation.z = -sign * angle
        slope.castShadow = true
        slope.receiveShadow = true
        g.add(slope)
      }
      const ridge = new THREE.Mesh(geoms.ridge, roofMat)
      ridge.position.y = 6.83
      ridge.castShadow = true
      g.add(ridge)

      // gable ends close the roof
      const shape = new THREE.Shape()
      shape.moveTo(-4.5, 0)
      shape.lineTo(4.5, 0)
      shape.lineTo(0, 2.28)
      shape.closePath()
      const gableGeo = new THREE.ShapeGeometry(shape)
      for (const sign of [-1, 1]) {
        const gable = new THREE.Mesh(gableGeo, wallMat)
        gable.position.set(0, 4.55, sign * 3.32)
        gable.rotation.y = sign === 1 ? 0 : Math.PI
        gable.castShadow = true
        gable.receiveShadow = true
        g.add(gable)
      }

      const chimney = new THREE.Mesh(geoms.chimney, brickMat)
      chimney.position.set(-1.9, 5.9, 1.2)
      chimney.castShadow = true
      g.add(chimney)
      const cap = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.14, 1.0), concreteDark)
      cap.position.set(-1.9, 6.8, 1.2)
      cap.castShadow = true
      g.add(cap)

      // garage + door
      const garageFrame = new THREE.Mesh(geoms.garageDoor, trimMat)
      garageFrame.position.set(3.92, 1.62, garageZ)
      garageFrame.castShadow = true
      g.add(garageFrame)
      const garagePanel = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.95, 2.8), standard(0xe9e4d5, { roughness: 0.8 }))
      garagePanel.position.set(4.0, 1.62, garageZ)
      g.add(garagePanel)
      for (let line = 0; line < 4; line++) {
        const groove = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.035, 2.8), standard(0xb7b0a1, { roughness: 0.9 }))
        groove.position.set(4.07, 0.92 + line * 0.47, garageZ)
        g.add(groove)
      }

      // front door
      const doorFrame = new THREE.Mesh(geoms.doorFrame, trimMat)
      doorFrame.position.set(3.94, 1.58, doorZ)
      doorFrame.castShadow = true
      g.add(doorFrame)
      const door = new THREE.Mesh(geoms.door, doorMat)
      door.position.set(4.0, 1.52, doorZ)
      door.castShadow = true
      g.add(door)
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), standard(0xe2b94c, { roughness: 0.3, metalness: 0.6 }))
      knob.position.set(4.08, 1.55, doorZ + 0.38)
      g.add(knob)
      const step = new THREE.Mesh(geoms.step, concreteMat)
      step.position.set(4.5, 0.09, doorZ)
      step.receiveShadow = true
      step.castShadow = true
      g.add(step)

      // porch roof and posts
      const porch = new THREE.Mesh(geoms.porchRoof, roofMat)
      porch.position.set(4.85, 3.25, doorZ)
      porch.castShadow = true
      g.add(porch)
      for (const zz of [doorZ - 1.2, doorZ + 1.2]) {
        const post = new THREE.Mesh(geoms.post, trimMat)
        post.position.set(5.5, 2.5, zz)
        post.castShadow = true
        g.add(post)
      }

      // front window
      const frame = new THREE.Mesh(geoms.windowFrame, trimMat)
      frame.position.set(3.94, 2.55, windowZ)
      frame.castShadow = true
      g.add(frame)
      const glass = new THREE.Mesh(geoms.windowGlass, glassMat)
      glass.position.set(4.02, 2.55, windowZ)
      glass.rotation.y = Math.PI / 2
      g.add(glass)
      for (const off of [-0.36, 0.36]) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.18, 0.05), trimMat)
        bar.position.set(4.04, 2.55, windowZ + off)
        g.add(bar)
      }
      const sill = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.1, 1.75), trimMat)
      sill.position.set(4.05, 1.83, windowZ)
      sill.castShadow = true
      g.add(sill)

      // little attic window in the gable side
      for (const sign of [-1, 1]) {
        const atticFrame = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.62, 0.62), trimMat)
        atticFrame.position.set(-1.4, 5.25, sign * 3.36)
        atticFrame.rotation.y = Math.PI / 2
        g.add(atticFrame)
        const atticGlass = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.46), glassMat)
        atticGlass.position.set(-1.4, 5.25, sign * 3.42)
        if (sign === -1) atticGlass.rotation.y = Math.PI
        g.add(atticGlass)
      }

      // siding trim lines
      for (const yy of [1.15, 1.95, 3.55]) {
        const trim = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 6.6), trimMat)
        trim.position.set(3.92, yy, 0)
        g.add(trim)
      }

      // path and driveway
      const path = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 1.5), concreteMat)
      path.rotation.x = -Math.PI / 2
      path.position.set(6.7, 0.028, doorZ)
      path.receiveShadow = true
      g.add(path)
      const drive = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 3.1), concreteDark)
      drive.rotation.x = -Math.PI / 2
      drive.position.set(6.7, 0.018, garageZ)
      drive.receiveShadow = true
      g.add(drive)

      // flower bed + flowers
      const bed = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.3, 1.55), standard(0x5c4632, { roughness: 1 }))
      bed.position.set(4.25, 0.16, windowZ)
      bed.castShadow = true
      g.add(bed)
      const flowerColors = [0xff8fa8, 0xffd25e, 0xda8cff, 0xff6b5e]
      for (let fi = 0; fi < 5; fi++) {
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.28, 4), standard(0x4a7a32, { roughness: 0.9 }))
        const fx = 4.25 + (rnd() - 0.5) * 0.5
        const fz = windowZ + (rnd() - 0.5) * 1.2
        stem.position.set(fx, 0.42, fz)
        g.add(stem)
        const bloom = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), standard(pick(flowerColors, rnd), { roughness: 0.7 }))
        bloom.position.set(fx, 0.58, fz)
        g.add(bloom)
      }

      // hedges between plots
      for (const sign of [-1, 1]) {
        const hedge = new THREE.Mesh(geoms.hedge, hedgeMat)
        hedge.position.set(6.7, 0.44, sign * 4.0)
        hedge.castShadow = true
        hedge.receiveShadow = true
        g.add(hedge)
      }

      // mailbox
      const mailbox = new THREE.Group()
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.15, 0.1), whiteFenceMat)
      post.position.y = 0.58
      post.castShadow = true
      mailbox.add(post)
      const boxMat = standard(0x4e6a8a, { roughness: 0.7 })
      const box = new THREE.Mesh(roundedBox(0.34, 0.26, 0.5, 0.07), boxMat)
      box.position.set(0, 1.15, 0)
      box.castShadow = true
      mailbox.add(box)
      const flag = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.26, 0.14), standard(0xd85d44, { roughness: 0.7 }))
      flag.position.set(0.18, 1.21, 0.12)
      mailbox.add(flag)
      mailbox.position.set(9.1, 0, 3.4 * flip)
      g.add(mailbox)

      // wheelie bin
      const bin = new THREE.Group()
      const binMat = standard(0x3c6a43, { roughness: 0.85 })
      const binBody = new THREE.Mesh(geoms.binBody, binMat)
      binBody.position.y = 0.55
      binBody.castShadow = true
      bin.add(binBody)
      const lid = new THREE.Mesh(geoms.binLid, standard(0x2c5234, { roughness: 0.85 }))
      lid.position.y = 1.08
      lid.rotation.x = 0.04
      lid.castShadow = true
      bin.add(lid)
      for (const sign of [-1, 1]) {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.08, 8), standard(0x252525, { roughness: 0.8 }))
        wheel.rotation.z = Math.PI / 2
        wheel.position.set(sign * 0.26, 0.12, -0.3)
        bin.add(wheel)
      }
      bin.position.set(5.2, 0, -3.1 * flip)
      bin.rotation.y = 0.2 * flip
      g.add(bin)

      // house number
      const plateGeo = new THREE.PlaneGeometry(0.4, 0.26)
      const uv = plateGeo.attributes.uv
      const col = houseId % numberCols
      const row = Math.floor(houseId / numberCols)
      const u0 = col / numberCols
      const u1 = (col + 1) / numberCols
      const v0 = 1 - (row + 1) / numberRows
      const v1 = 1 - row / numberRows
      for (let i = 0; i < uv.count; i++) {
        uv.setXY(i, u0 + uv.getX(i) * (u1 - u0), v0 + uv.getY(i) * (v1 - v0))
      }
      const plate = new THREE.Mesh(plateGeo, numberMat)
      plate.position.set(4.03, 2.55, doorZ + 0.82)
      plate.rotation.y = Math.PI / 2
      g.add(plate)

      // porch light
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), porchLampMat)
      lamp.position.set(4.08, 2.95, doorZ + 1.35)
      g.add(lamp)

      // garden gnome for every third house
      if (houseId % 3 === 1) {
        const gnome = new THREE.Group()
        const bodyG = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.42, 7), standard(0x3f74b5, { roughness: 0.8 }))
        bodyG.position.y = 0.24
        bodyG.castShadow = true
        gnome.add(bodyG)
        const headG = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), standard(0xf2c6a0, { roughness: 0.8 }))
        headG.position.y = 0.49
        headG.castShadow = true
        gnome.add(headG)
        const hat = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.3, 7), standard(0xc84f3f, { roughness: 0.8 }))
        hat.position.y = 0.66
        hat.castShadow = true
        gnome.add(hat)
        gnome.position.set(6.0, 0, 3.2 * flip)
        g.add(gnome)
      }

      const house = {
        id: houseId,
        side,
        x: hx,
        z,
        group: g,
        trash: [],
        cleared: false,
        doorZ,
        flip,
        worldDoor: new THREE.Vector3(side === 1 ? hx - 4.6 : hx + 4.6, 0, side === 1 ? z - doorZ : z + doorZ),
      }
      world.houses.push(house)
      addCollider(hx - 4.45, hx + 4.45, z - 3.85, z + 3.85, 'house')

      // scattered trash — three per house
      const spots = [
        { lx: 5.3 + rnd() * 0.5, lz: 2.5 * flip + (rnd() - 0.5) * 0.4, type: TRASH_TYPES[(houseId * 3) % TRASH_TYPES.length] },
        { lx: 7.3 + rnd() * 0.7, lz: -1.6 * flip + (rnd() - 0.5) * 0.7, type: TRASH_TYPES[(houseId * 3 + 1) % TRASH_TYPES.length] },
        { lx: 8.2 + rnd() * 0.5, lz: 0.8 * flip + (rnd() - 0.5) * 0.8, type: TRASH_TYPES[(houseId * 3 + 2) % TRASH_TYPES.length] },
      ]
      for (const spot of spots) {
        const wx = side === 1 ? hx - spot.lx : hx + spot.lx
        const wz = side === 1 ? z - spot.lz : z + spot.lz
        const item = createTrash(spot.type, rnd)
        item.group.position.set(wx, 0, wz)
        item.group.rotation.y = rnd() * Math.PI * 2
        item.home = house
        item.homeId = house.id
        item.state = 'ground'
        root.add(item.group)
        house.trash.push(item)
        world.trashItems.push(item)
      }

      houseId++
    }
  }
  world.totalTrash = world.trashItems.length

  /* ---------------- trees & bushes ---------------- */
  const canopyColors = [0x4f7d3f, 0x5c8b45, 0x44703a, 0x6a934e]
  const addTree = (x, z, scale = 1) => {
    const t = new THREE.Group()
    const trunk = new THREE.Mesh(geoms.treeTrunk, trunkMat)
    trunk.position.y = 1.4 * scale
    trunk.scale.setScalar(scale)
    trunk.castShadow = true
    t.add(trunk)
    const blobs = []
    const canopyMat = standard(pick(canopyColors, rnd), { roughness: 1, flat: true })
    for (let i = 0; i < 4; i++) {
      const blob = new THREE.Mesh(geoms.canopy, canopyMat)
      const s = (0.85 + rnd() * 0.65) * scale
      blob.scale.set(s * 1.15, s * 0.9, s * 1.15)
      blob.position.set((rnd() - 0.5) * 1.3 * scale, (2.9 + rnd() * 1.1) * scale, (rnd() - 0.5) * 1.3 * scale)
      blob.rotation.set(rnd(), rnd(), rnd())
      blob.castShadow = true
      blob.receiveShadow = true
      t.add(blob)
      blobs.push(blob)
    }
    t.position.set(x, 0, z)
    root.add(t)
    world.trees.push({ group: t, blobs, phase: rnd() * Math.PI * 2 })
    addCollider(x - 0.32, x + 0.32, z - 0.32, z + 0.32, 'tree')
    return t
  }

  for (const side of [-1, 1]) {
    for (const z of [-42, -28, -14, 0, 14, 28, 42]) {
      addTree(side * (11.6 + rnd() * 1.8), z + (rnd() - 0.5) * 2.4, 0.9 + rnd() * 0.45)
    }
    for (const z of [-38, -24, -10, 4, 18, 32, 46]) {
      addTree(side * (24.5 + rnd() * 3.5), z + (rnd() - 0.5) * 3, 1.1 + rnd() * 0.6)
    }
  }
  for (let i = 0; i < 10; i++) {
    addTree((rnd() - 0.5) * 100, (rnd() > 0.5 ? 1 : -1) * (48 + rnd() * 8), 1 + rnd() * 0.7)
  }

  const bushColors = [0x4e7a3d, 0x5b8a46, 0x3f6a36]
  for (const house of world.houses) {
    for (let i = 0; i < 2; i++) {
      const bush = new THREE.Mesh(geoms.bush, standard(pick(bushColors, rnd), { roughness: 1, flat: true }))
      const lx = 4.3 + rnd() * 0.6
      const lz = (rnd() > 0.5 ? 1 : -1) * (3.0 + rnd() * 0.5)
      bush.position.set(house.side === 1 ? house.x - lx : house.x + lx, 0.42, house.side === 1 ? house.z - lz : house.z + lz)
      bush.scale.set(1.2, 0.9, 1.1)
      bush.rotation.y = rnd() * Math.PI
      bush.castShadow = true
      root.add(bush)
    }
  }

  /* ---------------- street props ---------------- */
  const poleMat = standard(0x394047, { roughness: 0.6, metalness: 0.3 })
  for (const [x, z] of [[-7.9, 20], [7.9, -12], [-7.9, -38], [7.9, 40]]) {
    const lamp = new THREE.Group()
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 5.3, 8), poleMat)
    pole.position.y = 2.65
    pole.castShadow = true
    lamp.add(pole)
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.0, 6), poleMat)
    arm.rotation.z = Math.PI / 2
    arm.position.set(x > 0 ? -0.45 : 0.45, 5.2, 0)
    lamp.add(arm)
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), streetLampMat)
    head.position.set(x > 0 ? -0.9 : 0.9, 5.12, 0)
    lamp.add(head)
    lamp.position.set(x, 0, z)
    root.add(lamp)
    addCollider(x - 0.15, x + 0.15, z - 0.15, z + 0.15, 'lamp')
  }

  // hydrant
  const hydrant = new THREE.Group()
  const hMat = standard(0xc94b3d, { roughness: 0.6 })
  const hBody = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.18, 0.6, 10), hMat)
  hBody.position.y = 0.32
  hBody.castShadow = true
  hydrant.add(hBody)
  const hTop = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), hMat)
  hTop.position.y = 0.64
  hTop.castShadow = true
  hydrant.add(hTop)
  for (const sign of [-1, 1]) {
    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.18, 8), hMat)
    nozzle.rotation.z = Math.PI / 2
    nozzle.position.set(sign * 0.17, 0.36, 0)
    hydrant.add(nozzle)
  }
  hydrant.position.set(-8.0, 0, 26.5)
  root.add(hydrant)

  // street sign
  const signGroup = new THREE.Group()
  const signPole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.4, 8), poleMat)
  signPole.position.y = 1.2
  signGroup.add(signPole)
  const signTex = makeLabelTexture('SPIELSTRASSE', { bg: '#2c6da8', fg: '#ffffff', w: 512, h: 160, font: '900 52px "Arial Black", sans-serif' })
  const signPlate = new THREE.Mesh(new THREE.PlaneGeometry(1.35, 0.42), new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.7, side: THREE.DoubleSide }))
  signPlate.position.y = 2.3
  signGroup.add(signPlate)
  signGroup.position.set(7.9, 0, 15.5)
  signGroup.rotation.y = Math.PI
  root.add(signGroup)

  /* ---------------- garbage truck ---------------- */
  const truck = createTruck(rnd)
  root.add(truck.group)
  addCollider(-1.9, 1.9, 43.3, 53.2, 'truck')
  world.truck = truck

  /* ---------------- bunny + hutch ---------------- */
  const hutch = createHutch()
  hutch.position.set(12.6, 0, 10.7)
  root.add(hutch)
  addCollider(11.5, 13.7, 9.7, 11.7, 'hutch')

  const bunny = createBunny()
  bunny.group.position.set(10.4, 0, 8.4)
  bunny.group.userData.noBake = true
  root.add(bunny.group)
  world.bunny = bunny

  /* ---------------- carrots ---------------- */
  const carrotSpots = [
    [10.4, 4.2], [11.3, 5.4], [9.7, 6.1], [-10.2, 18.2], [-11.4, 22.4], [-9.6, 25.2], [10.8, -6.8], [9.9, -2.2],
  ]
  for (const [x, z] of carrotSpots) {
    const carrot = createCarrot()
    carrot.group.position.set(x, 0, z)
    root.add(carrot.group)
    world.carrots.push(carrot)
  }

  /* ---------------- batman ---------------- */
  const batman = createBatman()
  batman.group.scale.setScalar(1.35)
  batman.group.position.set(-18, 12.4, 0)
  batman.patrol = { cx: 0, cz: 0, radiusX: 19, radiusZ: 21, speed: 0.105, height: 12.6 }
  batman.group.userData.noBake = true
  root.add(batman.group)
  world.batman = batman

  /* ---------------- citizens ---------------- */
  for (let i = 0; i < 8; i++) {
    const person = createPerson(rnd, i)
    const side = i % 2 === 0 ? -1 : 1
    const z = -30 + i * 8.6 + rnd() * 3
    person.group.position.set(side * 6.4, 0, z)
    person.group.rotation.y = i % 4 < 2 ? 0 : Math.PI
    person.group.userData.noBake = true
    root.add(person.group)
    const npc = {
      id: i,
      group: person.group,
      parts: person.parts,
      speech: person.speech,
      phase: person.phase,
      style: person.style,
      x: side * 6.4,
      z,
      side,
      dir: i % 2 === 0 ? 1 : -1,
      speed: 1.15 + rnd() * 0.55,
      state: 'walk',
      stateT: 0,
      hitBy: new Set(),
      launch: null,
      bubbleT: 0,
      respawnT: 0,
      walkPhase: rnd() * 10,
    }
    world.npcs.push(npc)
  }

  /* ---------------- clouds ---------------- */
  const cloudMat = new THREE.MeshStandardMaterial({ color: 0xfff1dc, roughness: 1, emissive: 0xffd2a0, emissiveIntensity: 0.18, transparent: true, opacity: 0.92 })
  for (let i = 0; i < 8; i++) {
    const cloud = new THREE.Group()
    const puffs = []
    const puffCount = 3 + Math.floor(rnd() * 3)
    for (let p = 0; p < puffCount; p++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 7), cloudMat)
      const s = 3 + rnd() * 4
      puff.scale.set(s * (1 + rnd() * 0.4), s * 0.55, s)
      puff.position.set((p - puffCount / 2) * 3.4, (rnd() - 0.5) * 1.2, (rnd() - 0.5) * 2.5)
      cloud.add(puff)
      puffs.push(puff)
    }
    cloud.position.set((rnd() - 0.5) * 150, 38 + rnd() * 20, (rnd() - 0.5) * 150)
    cloud.userData.noBake = true
    mergeCloudPuffs(cloud, puffs, cloudMat)
    root.add(cloud)
    world.clouds.push(cloud)
  }

  /* ---------------- deposit marker ---------------- */
  const marker = new THREE.Group()
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x67e08a, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false })
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.55, 1.9, 40), ringMat)
  ring.rotation.x = -Math.PI / 2
  ring.position.y = 0.04
  marker.add(ring)
  const inner = new THREE.Mesh(new THREE.CircleGeometry(1.5, 32), new THREE.MeshBasicMaterial({ color: 0x67e08a, transparent: true, opacity: 0.1, depthWrite: false }))
  inner.rotation.x = -Math.PI / 2
  inner.position.y = 0.035
  marker.add(inner)
  const markerLabel = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeLabelTexture('ABLADEN', { bg: '#e9ffd9', fg: '#257047', w: 320, h: 112, font: '900 64px "Arial Black", sans-serif' }), transparent: true, depthTest: true }))
  markerLabel.scale.set(2.1, 0.74, 1)
  markerLabel.position.y = 2.0
  marker.add(markerLabel)
  marker.position.set(world.depositPoint.x, 0, world.depositPoint.z)
  marker.userData.noBake = true
  root.add(marker)
  world.marker = marker
  world.markerRing = ring

  /* Static scenery is baked down to one mesh per material before the first
     frame. Houses, trees, street props and the truck all collapse into a
     handful of draw calls. */
  bakeStaticMeshes(root)

  /* ---------------- update helpers ---------------- */
  world.updateAmbient = (dt, time, playerPos) => {
    for (const cloud of world.clouds) {
      cloud.position.x += dt * 0.55
      if (cloud.position.x > 85) cloud.position.x = -85
    }
    for (const carrot of world.carrots) {
      if (carrot.state !== 'ground') continue
      carrot.group.position.y = 0.18 + Math.sin(time * 2.2 + carrot.phase) * 0.07
      carrot.group.rotation.y += dt * 1.1
      carrot.ring.scale.setScalar(1 + Math.sin(time * 3 + carrot.phase) * 0.08)
    }
    for (const item of world.trashItems) {
      if (item.state !== 'ground') continue
      if (item.near) {
        item.ring.scale.setScalar(1 + Math.sin(time * 5 + item.phase) * 0.12)
        item.icon.position.y = 1.02 + Math.sin(time * 3.4 + item.phase) * 0.07
      }
    }
    if (world.markerRing) {
      world.markerRing.scale.setScalar(1 + Math.sin(time * 2.6) * 0.045)
      world.markerRing.material.opacity = 0.6 + Math.sin(time * 2.6) * 0.2
    }
    if (world.bunny) updateBunny(world, dt, time, playerPos)
    if (world.batman) updateBatman(world, dt, time)
  }

  world.updateBunnyVisual = (dt, time) => {
    // small idle twitch even while following
    const b = world.bunny
    if (!b) return
    b.heart.visible = b.happy > 0
    if (b.heart.visible) {
      b.happy -= dt
      b.heart.position.y = 1.15 + Math.sin(time * 6) * 0.08
      b.heart.scale.setScalar(0.3 + Math.sin(time * 6) * 0.04)
    }
  }

  return world
}

/* ============================================================
   Trash
   ============================================================ */
function createTrash(spec, rnd) {
  const group = new THREE.Group()
  group.userData.noBake = true
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xffd45a, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false })
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.52, 28), ringMat)
  ring.rotation.x = -Math.PI / 2
  ring.position.y = 0.035
  ring.visible = false
  group.add(ring)

  const iconMat = new THREE.SpriteMaterial({ map: makeIconTexture('exclaim'), transparent: true, depthTest: false, depthWrite: false })
  const icon = new THREE.Sprite(iconMat)
  icon.scale.set(0.34, 0.34, 1)
  icon.position.y = 1.0
  icon.renderOrder = 15
  icon.visible = false
  group.add(icon)

  const dark = standard(0x262622, { roughness: 0.95 })
  if (spec.type === 'bag') {
    for (let i = 0; i < 3; i++) {
      const blob = new THREE.Mesh(new THREE.SphereGeometry(0.24 + rnd() * 0.08, 9, 7), dark)
      blob.position.set((rnd() - 0.5) * 0.26, 0.24 + (rnd() - 0.5) * 0.1, (rnd() - 0.5) * 0.26)
      blob.scale.set(1, 0.95 + rnd() * 0.25, 1)
      blob.castShadow = true
      group.add(blob)
    }
    const knot = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.18, 6), dark)
    knot.position.y = 0.52
    knot.castShadow = true
    group.add(knot)
  } else if (spec.type === 'can') {
    const can = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.34, 12), standard(0xbfc7c9, { roughness: 0.35, metalness: 0.75 }))
    can.rotation.z = Math.PI / 2
    can.position.set(0, 0.1, 0)
    can.castShadow = true
    group.add(can)
    const label = new THREE.Mesh(new THREE.CylinderGeometry(0.092, 0.092, 0.16, 12), standard(0xc0392b, { roughness: 0.6 }))
    label.rotation.z = Math.PI / 2
    label.position.set(0, 0.1, 0)
    group.add(label)
  } else if (spec.type === 'bottle') {
    const glass = new THREE.MeshStandardMaterial({ color: 0x4e9c6b, roughness: 0.18, metalness: 0.05, transparent: true, opacity: 0.86 })
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.095, 0.32, 12), glass)
    body.rotation.z = Math.PI / 2
    body.position.set(0, 0.1, 0)
    body.castShadow = true
    group.add(body)
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.07, 0.14, 10), glass)
    neck.rotation.z = Math.PI / 2
    neck.position.set(0.22, 0.1, 0)
    group.add(neck)
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.04, 8), standard(0xe0c050, { roughness: 0.5, metalness: 0.4 }))
    cap.rotation.z = Math.PI / 2
    cap.position.set(0.31, 0.1, 0)
    group.add(cap)
  } else if (spec.type === 'box') {
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.075, 0.44), standard(0xb47c42, { roughness: 0.95 }))
    box.position.set(0, 0.05, 0)
    box.rotation.y = rnd() * 0.5
    box.castShadow = true
    group.add(box)
    const label = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.2), new THREE.MeshStandardMaterial({ map: makeLabelTexture('PIZZA', { bg: '#f6ead2', fg: '#b3382f', w: 256, h: 128, font: '900 56px "Arial Black", sans-serif' }), roughness: 0.9 }))
    label.rotation.x = -Math.PI / 2
    label.position.set(0, 0.09, 0)
    group.add(label)
  } else if (spec.type === 'paper') {
    const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(0.17, 0), standard(0xf1ecdd, { roughness: 0.95, flat: true }))
    ball.position.set(0, 0.15, 0)
    ball.castShadow = true
    group.add(ball)
  } else {
    const peel = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.04, 6, 14, Math.PI * 1.25), standard(0xf1c53c, { roughness: 0.75 }))
    peel.rotation.x = -Math.PI / 2
    peel.rotation.z = 0.4
    peel.position.set(0, 0.06, 0)
    peel.castShadow = true
    group.add(peel)
  }

  // One vertex-coloured mesh per piece of litter. Textured details (the pizza
  // box label) and the highlight ring stay separate.
  const decor = group.children.filter((child) => child.isMesh && child !== ring && !child.material?.map)
  const merged = mergeColoredMeshes(decor, TRASH_VERTEX_MAT)
  if (merged) {
    for (const child of decor) group.remove(child)
    group.add(merged)
  }

  return {
    group,
    ring,
    icon,
    type: spec.type,
    name: spec.name,
    state: 'ground',
    home: null,
    homeId: -1,
    phase: rnd() * Math.PI * 2,
    near: false,
    spin: new THREE.Vector3(),
    vel: new THREE.Vector3(),
    collectCool: 0,
  }
}

/* ============================================================
   Carrot
   ============================================================ */
function createCarrot() {
  const group = new THREE.Group()
  group.userData.noBake = true
  const body = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.42, 9), standard(0xff8b2e, { roughness: 0.7 }))
  body.rotation.z = Math.PI
  body.position.y = 0.34
  body.castShadow = true
  group.add(body)
  for (let i = 0; i < 3; i++) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.3, 5), standard(0x4c8f3f, { roughness: 0.9 }))
    leaf.position.set((i - 1) * 0.05, 0.68, (i % 2) * 0.03)
    leaf.rotation.z = (i - 1) * 0.24
    leaf.castShadow = true
    group.add(leaf)
  }
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.28, 0.38, 24), new THREE.MeshBasicMaterial({ color: 0x9ef28a, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false }))
  ring.rotation.x = -Math.PI / 2
  ring.position.y = 0.03
  group.add(ring)
  const icon = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeIconTexture('heart'), transparent: true, depthTest: false }))
  icon.scale.set(0.28, 0.28, 1)
  icon.position.y = 1.0
  icon.renderOrder = 15
  group.add(icon)
  const decor = group.children.filter((child) => child.isMesh && child !== ring)
  const merged = mergeColoredMeshes(decor, CARROT_VERTEX_MAT)
  if (merged) {
    for (const child of decor) group.remove(child)
    group.add(merged)
  }
  return { group, ring, icon, state: 'ground', phase: Math.random() * Math.PI * 2, respawn: 0 }
}

/* ============================================================
   Hutch
   ============================================================ */
function createHutch() {
  const g = new THREE.Group()
  const wood = standard(0x9a6a3e, { roughness: 0.95 })
  const woodDark = standard(0x74502f, { roughness: 0.95 })
  for (const [x, z] of [[-0.75, -0.55], [0.75, -0.55], [-0.75, 0.55], [0.75, 0.55]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.5, 0.12), woodDark)
    leg.position.set(x, 0.25, z)
    leg.castShadow = true
    g.add(leg)
  }
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.0, 1.5), wood)
  body.position.y = 1.0
  body.castShadow = true
  body.receiveShadow = true
  g.add(body)
  for (const x of [-0.95, 0.95]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.4, 0.1), woodDark)
    post.position.set(x, 1.85, 0.68)
    g.add(post)
  }
  const roof = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.12, 1.9), woodDark)
  roof.position.set(0, 2.3, 0)
  roof.rotation.x = -0.18
  roof.castShadow = true
  g.add(roof)
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.62, 0.9), standard(0x4a3524, { roughness: 0.95 }))
  door.position.set(1.01, 0.85, 0)
  door.rotation.y = 0.12
  g.add(door)
  const hay = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), standard(0xd9b45a, { roughness: 1, flat: true }))
  hay.scale.set(2.2, 0.4, 1.6)
  hay.position.set(0, 0.56, 0)
  hay.castShadow = true
  g.add(hay)
  const signTex = makeLabelTexture('MAX', { bg: '#fff7e3', fg: '#b25c12', w: 256, h: 128, font: '900 72px "Arial Black", sans-serif' })
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.3), new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.8 }))
  sign.position.set(1.08, 1.42, 0.4)
  sign.rotation.y = Math.PI / 2
  g.add(sign)
  return g
}

/* ============================================================
   Garbage truck
   ============================================================ */
function createTruck(rnd) {
  const group = new THREE.Group()
  const cabMat = standard(0x2f7a55, { roughness: 0.55, metalness: 0.15 })
  const cargoMat = standard(0xdfe3d8, { roughness: 0.7, metalness: 0.1 })
  const darkMat = standard(0x2b2d2b, { roughness: 0.8 })
  const stripeMat = new THREE.MeshStandardMaterial({ map: makeStripeTexture('#2b2b28', '#ffcf4a'), roughness: 0.7 })

  const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.4, 8.8), darkMat)
  chassis.position.set(0, 0.72, 0.4)
  chassis.castShadow = true
  group.add(chassis)

  const cargo = new THREE.Mesh(roundedBox(3.0, 2.85, 6.0, 0.14), cargoMat)
  cargo.position.set(0, 2.3, -0.3)
  cargo.castShadow = true
  cargo.receiveShadow = true
  group.add(cargo)

  for (const side of [-1, 1]) {
    const stripe = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 0.42), stripeMat)
    stripe.position.set(side * 1.51, 1.28, -0.3)
    stripe.rotation.y = side * Math.PI / 2
    group.add(stripe)
    const textTex = makeLabelTexture('MÜLLABFUHR', { bg: '#2f7a55', fg: '#fff7e3', w: 512, h: 128, font: '900 66px "Arial Black", sans-serif', border: false })
    const text = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.85), new THREE.MeshStandardMaterial({ map: textTex, roughness: 0.7, transparent: true }))
    text.position.set(side * 1.515, 2.7, -0.3)
    text.rotation.y = side * Math.PI / 2
    group.add(text)
  }

  const hopper = new THREE.Mesh(new THREE.BoxGeometry(3.0, 1.3, 0.9), standard(0x6b706a, { roughness: 0.7, metalness: 0.2 }))
  hopper.position.set(0, 1.45, -3.55)
  hopper.rotation.x = 0.28
  hopper.castShadow = true
  group.add(hopper)
  const rear = new THREE.Mesh(new THREE.BoxGeometry(2.85, 2.1, 0.16), standard(0x9aa096, { roughness: 0.7 }))
  rear.position.set(0, 2.35, -3.25)
  rear.castShadow = true
  group.add(rear)
  const rearStripe = new THREE.Mesh(new THREE.PlaneGeometry(2.75, 0.45), stripeMat)
  rearStripe.position.set(0, 1.35, -3.35)
  rearStripe.rotation.y = Math.PI
  group.add(rearStripe)
  const rearLabel = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeLabelTexture('MÜLL', { bg: '#ffcf4a', fg: '#211f19', w: 256, h: 128, font: '900 72px "Arial Black", sans-serif' }), transparent: true, depthTest: true }))
  rearLabel.scale.set(1.3, 0.55, 1)
  rearLabel.position.set(0, 3.1, -3.5)
  group.add(rearLabel)

  const cab = new THREE.Mesh(roundedBox(2.6, 2.2, 2.5, 0.18), cabMat)
  cab.position.set(0, 2.0, 3.9)
  cab.castShadow = true
  group.add(cab)
  const windshield = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 0.95), new THREE.MeshStandardMaterial({ color: 0x89b3c7, roughness: 0.12, metalness: 0.4 }))
  windshield.position.set(0, 2.5, 5.17)
  group.add(windshield)
  for (const side of [-1, 1]) {
    const sideWindow = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.8), new THREE.MeshStandardMaterial({ color: 0x89b3c7, roughness: 0.12, metalness: 0.4 }))
    sideWindow.position.set(side * 1.31, 2.45, 4.0)
    sideWindow.rotation.y = side * Math.PI / 2
    group.add(sideWindow)
    const headlight = new THREE.Mesh(new THREE.CircleGeometry(0.18, 12), new THREE.MeshStandardMaterial({ color: 0xfff0b0, emissive: 0xffcf4a, emissiveIntensity: 0.8 }))
    headlight.position.set(side * 0.85, 1.45, 5.16)
    group.add(headlight)
  }
  const bumper = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.28, 0.22), darkMat)
  bumper.position.set(0, 1.0, 5.16)
  group.add(bumper)

  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.18, 8), new THREE.MeshStandardMaterial({ color: 0xffb43c, emissive: 0xff8a1f, emissiveIntensity: 1.8 }))
  beacon.position.set(0, 3.2, 4.6)
  group.add(beacon)

  const wheelMat = standard(0x1f1f1f, { roughness: 0.9 })
  for (const z of [-2.6, -0.4, 3.6]) {
    for (const side of [-1, 1]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.34, 14), wheelMat)
      wheel.rotation.z = Math.PI / 2
      wheel.position.set(side * 1.42, 0.48, z)
      wheel.castShadow = true
      wheel.receiveShadow = true
      group.add(wheel)
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.36, 10), standard(0x9b9b96, { roughness: 0.5, metalness: 0.5 }))
      hub.rotation.z = Math.PI / 2
      hub.position.set(side * 1.42, 0.48, z)
      group.add(hub)
    }
  }

  // bags peeking out of the hopper
  for (let i = 0; i < 3; i++) {
    const bag = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), standard(0x24241f, { roughness: 1 }))
    bag.position.set((rnd() - 0.5) * 1.7, 2.05 + rnd() * 0.2, -3.35 - rnd() * 0.3)
    bag.scale.set(1, 0.9, 0.8)
    bag.castShadow = true
    group.add(bag)
  }

  group.position.set(0, 0, 47.2)
  return { group, position: group.position }
}

/* ============================================================
   Bunny behaviour
   ============================================================ */
function updateBunny(world, dt, time, playerPos) {
  const b = world.bunny
  const prevX = b.group.position.x
  const prevZ = b.group.position.z

  if (b.follow > 0 && playerPos) {
    b.follow -= dt
    const dx = playerPos.x - b.group.position.x
    const dz = playerPos.z - b.group.position.z
    const dist = Math.hypot(dx, dz)
    if (dist > 2.4) {
      b.target.set(playerPos.x, 0, playerPos.z)
      b.state = 'follow'
    } else {
      b.state = 'idle'
    }
  } else {
    b.state = b.state === 'follow' ? 'idle' : b.state
  }

  if (b.state === 'follow') {
    const dx = b.target.x - b.group.position.x
    const dz = b.target.z - b.group.position.z
    const dist = Math.hypot(dx, dz)
    if (dist > 0.05) {
      const speed = 2.6
      b.group.position.x += (dx / dist) * speed * dt
      b.group.position.z += (dz / dist) * speed * dt
      b.facing = Math.atan2(dx, dz)
    }
    b.hop += dt * 9
    b.group.position.y = Math.abs(Math.sin(b.hop)) * 0.16
    b.body.rotation.x = Math.sin(b.hop * 2) * 0.08
  } else {
    // idle: tiny hopes inside the garden
    b.phase += dt
    b.hop += dt * 3
    b.group.position.y = Math.max(0, Math.sin(b.hop)) * 0.05
    b.body.rotation.x = 0
    const distHome = Math.hypot(b.group.position.x - b.home.x, b.group.position.z - b.home.z)
    if (distHome > 2.6) {
      const dx = b.home.x - b.group.position.x
      const dz = b.home.z - b.group.position.z
      const dist = Math.hypot(dx, dz) || 1
      b.group.position.x += (dx / dist) * 0.35 * dt
      b.group.position.z += (dz / dist) * 0.35 * dt
      b.facing = Math.atan2(dx, dz)
    } else if (Math.sin(time * 0.7 + 1.3) > 0.995) {
      b.facing += (Math.random() - 0.5) * 1.2
    }
  }

  // keep Max in a friendly range and out of the house
  b.group.position.x = Math.min(11.9, Math.max(7.1, b.group.position.x))
  b.group.position.z = Math.min(30, Math.max(-40, b.group.position.z))

  const moveX = b.group.position.x - prevX
  const moveZ = b.group.position.z - prevZ
  if (Math.hypot(moveX, moveZ) > 0.001) b.facing = Math.atan2(moveX, moveZ)
  b.group.rotation.y = b.facing

  // ears and nose animation
  b.earL.rotation.x = -0.08 + Math.sin(time * 2.2) * 0.05
  b.earR.rotation.x = -0.08 + Math.sin(time * 2.2 + 1.2) * 0.05
  b.head.rotation.z = Math.sin(time * 1.3) * 0.05
  b.heart.visible = b.happy > 0
  if (b.happy > 0) {
    b.happy -= dt
    b.heart.position.y = 1.15 + Math.sin(time * 6) * 0.08
    b.heart.scale.setScalar(0.32 + Math.sin(time * 6) * 0.04)
  }
}

/* ============================================================
   Batman patrol / stun
   ============================================================ */
function updateBatman(world, dt, time) {
  const b = world.batman
  const p = b.patrol
  if (b.hitFlash > 0) b.hitFlash -= dt

  if (b.stun > 0) {
    b.stun -= dt
    b.spin += dt * 9
    b.group.rotation.y += dt * 9
    b.group.rotation.z = Math.sin(time * 20) * 0.16
    const targetY = b.baseY - 2.2
    b.group.position.y += (targetY - b.group.position.y) * Math.min(1, dt * 3)
    if (b.stun <= 0) {
      b.group.rotation.z = 0
      b.spin = 0
    }
  } else {
    b.angle += dt * p.speed
    const x = p.cx + Math.cos(b.angle) * p.radiusX
    const z = p.cz + Math.sin(b.angle) * p.radiusZ
    const y = b.baseY + Math.sin(time * 0.7) * 0.55
    b.group.position.x += (x - b.group.position.x) * Math.min(1, dt * 5)
    b.group.position.z += (z - b.group.position.z) * Math.min(1, dt * 5)
    b.group.position.y += (y - b.group.position.y) * Math.min(1, dt * 5)
    const targetRot = Math.atan2(-Math.sin(b.angle) * p.radiusX, -Math.cos(b.angle) * p.radiusZ) + Math.PI
    let diff = targetRot - b.group.rotation.y
    diff = Math.atan2(Math.sin(diff), Math.cos(diff))
    b.group.rotation.y += diff * Math.min(1, dt * 2.5)
    b.group.rotation.z += (Math.sin(time * 0.8) * 0.05 - b.group.rotation.z) * Math.min(1, dt * 2)
  }

  // cape wave
  const pos = b.capeGeo.attributes.position
  const arr = pos.array
  const base = b.capeBase
  for (let i = 0; i < pos.count; i++) {
    const x = base[i * 3]
    const y = base[i * 3 + 1]
    const wave = Math.sin(time * 2.2 + y * 2.4 + x * 1.5) * 0.12
    const spread = (1 - (y + 1.02) / 2.05) * 0.35
    arr[i * 3] = x * (1 + spread * 0.35)
    arr[i * 3 + 2] = base[i * 3 + 2] - spread - wave * (0.4 + (1 - (y + 1.02) / 2.05))
  }
  pos.needsUpdate = true
}

export { drawBubble, makeSpeechSprite }
