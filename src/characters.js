import * as THREE from 'three'
import { makeComicSprite, makeIconTexture, makeLabelTexture, makeSpeechSprite, mergeColoredMeshes, pick, standard } from './utils.js'

const PERSON_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0 })

const SKIN = [0xf2c6a0, 0xdca47c, 0xb87a52, 0x8d5a3a, 0xf6d8b8, 0xc98f62]
const SHIRTS = [0xe4604b, 0x4d84c6, 0x53a06a, 0xe3a63c, 0x9a6fc2, 0xe98aa6, 0x3f9b9b, 0xd5d1c4, 0xef7f4e]
const PANTS = [0x36465c, 0x4a4036, 0x2c3138, 0x5b6c7d, 0x6b5744, 0x394b3e]
const HAIR = [0x2c2118, 0x4a3120, 0x6b4a2f, 0xb98a4b, 0x8a8d92, 0x1d1b19, 0x9c5a34]

export function createPerson(rnd, index) {
  const group = new THREE.Group()
  const skin = standard(pick(SKIN, rnd), { roughness: 0.82 })
  const shirtColor = pick(SHIRTS, rnd)
  const shirt = standard(shirtColor, { roughness: 0.9 })
  const pants = standard(pick(PANTS, rnd), { roughness: 0.95 })
  const shoe = standard(0x2a2622, { roughness: 0.9 })
  const hairMat = standard(pick(HAIR, rnd), { roughness: 0.95 })
  const accent = standard(new THREE.Color(shirtColor).offsetHSL(0.08, 0.05, -0.12), { roughness: 0.9 })

  const legL = new THREE.Group()
  const legR = new THREE.Group()
  for (const [leg, sign] of [[legL, -1], [legR, 1]]) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.74, 0.24), pants)
    mesh.position.y = -0.37
    mesh.castShadow = true
    leg.add(mesh)
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.13, 0.36), shoe)
    boot.position.set(0, -0.78, 0.055)
    boot.castShadow = true
    leg.add(boot)
    leg.position.set(sign * 0.13, 0.85, 0)
    group.add(leg)
  }

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.245, 0.42, 5, 12), shirt)
  torso.position.y = 1.27
  torso.castShadow = true
  group.add(torso)

  const hips = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.18, 0.3), pants)
  hips.position.y = 0.88
  hips.castShadow = true
  group.add(hips)

  const armL = new THREE.Group()
  const armR = new THREE.Group()
  for (const [arm, sign] of [[armL, -1], [armR, 1]]) {
    const sleeve = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.32, 4, 8), shirt)
    sleeve.position.y = -0.2
    sleeve.castShadow = true
    arm.add(sleeve)
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.082, 8, 8), skin)
    hand.position.y = -0.43
    hand.castShadow = true
    arm.add(hand)
    arm.position.set(sign * 0.335, 1.49, 0)
    arm.rotation.z = sign * 0.08
    group.add(arm)
  }

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.09, 8), skin)
  neck.position.y = 1.73
  group.add(neck)

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.185, 16, 14), skin)
  head.position.y = 1.9
  head.castShadow = true
  group.add(head)

  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.192, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.52), hairMat)
  hair.position.y = 1.925
  hair.rotation.x = -0.1
  hair.castShadow = true
  group.add(hair)

  // face — local +z is forward
  const eyeMat = standard(0x191817, { roughness: 0.4 })
  for (const sign of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 8), eyeMat)
    eye.position.set(sign * 0.062, 1.915, 0.168)
    group.add(eye)
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.014, 0.012), hairMat)
    brow.position.set(sign * 0.062, 1.957, 0.177)
    group.add(brow)
  }
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.012, 0.01), standard(0x7a4a44, { roughness: 0.7 }))
  mouth.position.set(0, 1.842, 0.178)
  group.add(mouth)

  // accessories
  const style = index % 4
  if (style === 0) {
    const capMat = standard(new THREE.Color(shirtColor).offsetHSL(0.01, 0.1, -0.22), { roughness: 0.8 })
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.198, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.45), capMat)
    cap.position.y = 1.946
    cap.castShadow = true
    group.add(cap)
    const brim = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.025, 0.16), capMat)
    brim.position.set(0, 1.93, 0.19)
    brim.castShadow = true
    group.add(brim)
  } else if (style === 1) {
    const bag = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.4, 0.16), standard(0x7b5a3a, { roughness: 0.95 }))
    bag.position.set(0, 1.31, -0.28)
    bag.castShadow = true
    group.add(bag)
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.5, 0.05), accent)
    strap.position.set(0.13, 1.52, -0.22)
    strap.rotation.z = -0.2
    group.add(strap)
  } else if (style === 2) {
    const glasses = standard(0x25282b, { roughness: 0.4 })
    for (const sign of [-1, 1]) {
      const lens = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.011, 6, 12), glasses)
      lens.position.set(sign * 0.062, 1.915, 0.17)
      group.add(lens)
    }
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.012, 0.012), glasses)
    bridge.position.set(0, 1.915, 0.175)
    group.add(bridge)
  } else {
    const flower = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 6), standard(0xffd1e0, { roughness: 0.7 }))
    flower.position.set(0.14, 1.58, 0.19)
    group.add(flower)
  }

  // Fold each animated limb into one vertex-coloured mesh, and all the static
  // body parts into another. 8 walkers now cost a handful of draw calls each.
  for (const limb of [legL, legR, armL, armR]) {
    const limbMeshes = limb.children.filter((child) => child.isMesh)
    const limbMesh = mergeColoredMeshes(limbMeshes, PERSON_MAT)
    if (limbMesh) {
      for (const child of limbMeshes) limb.remove(child)
      limb.add(limbMesh)
    }
  }
  const bodyMeshes = group.children.filter((child) => child.isMesh)
  const body = mergeColoredMeshes(bodyMeshes, PERSON_MAT)
  if (body) {
    for (const child of bodyMeshes) group.remove(child)
    group.add(body)
  }

  const speech = makeSpeechSprite()
  speech.position.set(0, 2.62, 0)
  group.add(speech)

  group.userData = { type: 'person' }
  return {
    group,
    parts: { legL, legR, armL, armR, torso: body ?? torso, head, hair, speech },
    speech,
    phase: rnd() * Math.PI * 2,
    baseY: 0,
    style,
  }
}

export function updatePersonAnim(npc, dt, speed = 1.4, mode = 'walk') {
  const p = npc.parts
  const t = npc.phase
  if (mode === 'walk' || mode === 'run') {
    const amp = mode === 'run' ? 0.95 : 0.55
    npc.phase += dt * (2.4 + speed * 1.5)
    const s = Math.sin(npc.phase)
    p.legL.rotation.x = s * amp
    p.legR.rotation.x = -s * amp
    p.armL.rotation.x = -s * amp * 0.82
    p.armR.rotation.x = s * amp * 0.82
    p.armL.rotation.z = -0.08
    p.armR.rotation.z = 0.08
    p.torso.rotation.z = Math.sin(npc.phase * 2) * 0.03
    npc.group.position.y = Math.abs(Math.sin(npc.phase * 2)) * (mode === 'run' ? 0.045 : 0.028)
  } else if (mode === 'panic') {
    npc.phase += dt * 14
    const s = Math.sin(npc.phase)
    p.legL.rotation.x = s * 1.05
    p.legR.rotation.x = -s * 1.05
    p.armL.rotation.x = -2.4 + s * 0.35
    p.armR.rotation.x = -2.4 - s * 0.35
    p.armL.rotation.z = -0.55
    p.armR.rotation.z = 0.55
    npc.group.position.y = Math.abs(s) * 0.09
  } else if (mode === 'launch') {
    p.legL.rotation.x = 0.5
    p.legR.rotation.x = -0.35
    p.armL.rotation.z = 2.4
    p.armR.rotation.z = -2.4
    p.armL.rotation.x = -0.4
    p.armR.rotation.x = -0.4
  } else if (mode === 'idle') {
    npc.phase += dt
    p.armL.rotation.x *= 0.92
    p.armR.rotation.x *= 0.92
    p.legL.rotation.x *= 0.9
    p.legR.rotation.x *= 0.9
  }
}

export function createBunny() {
  const group = new THREE.Group()
  const white = standard(0xf7f2e7, { roughness: 0.95 })
  const pink = standard(0xf4a9b8, { roughness: 0.9 })
  const dark = standard(0x2a2420, { roughness: 0.5 })

  const body = new THREE.Group()
  group.add(body)

  const torso = new THREE.Mesh(new THREE.SphereGeometry(0.3, 18, 14), white)
  torso.scale.set(0.92, 0.92, 1.22)
  torso.position.y = 0.38
  torso.castShadow = true
  body.add(torso)

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.23, 18, 14), white)
  head.position.set(0, 0.66, 0.24)
  head.castShadow = true
  body.add(head)

  const earL = new THREE.Group()
  const earR = new THREE.Group()
  for (const [ear, sign] of [[earL, -1], [earR, 1]]) {
    const outer = new THREE.Mesh(new THREE.CapsuleGeometry(0.062, 0.32, 4, 8), white)
    outer.position.y = 0.2
    outer.scale.z = 0.55
    outer.castShadow = true
    ear.add(outer)
    const inner = new THREE.Mesh(new THREE.CapsuleGeometry(0.032, 0.26, 3, 6), pink)
    inner.position.set(0, 0.2, 0.032)
    inner.scale.z = 0.4
    ear.add(inner)
    ear.position.set(sign * 0.1, 0.82, 0.24)
    ear.rotation.z = sign * 0.1
    ear.rotation.x = -0.08
    body.add(ear)
  }

  for (const sign of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 8), dark)
    eye.position.set(sign * 0.085, 0.7, 0.44)
    body.add(eye)
    const shine = new THREE.Mesh(new THREE.SphereGeometry(0.01, 6, 6), standard(0xffffff, { roughness: 0.2 }))
    shine.position.set(sign * 0.075, 0.715, 0.465)
    body.add(shine)
  }

  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 8), pink)
  nose.position.set(0, 0.655, 0.466)
  body.add(nose)

  const tail = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), white)
  tail.position.set(0, 0.42, -0.36)
  tail.castShadow = true
  body.add(tail)

  const feet = []
  for (const sign of [-1, 1]) {
    const foot = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), white)
    foot.scale.set(0.95, 0.6, 1.6)
    foot.position.set(sign * 0.13, 0.08, 0.14)
    foot.castShadow = true
    group.add(foot)
    feet.push(foot)
  }

  const name = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeLabelTexture('MAX', { bg: '#fff7e3', fg: '#b25c12', w: 256, h: 112 }), transparent: true, depthTest: true }))
  name.scale.set(0.75, 0.33, 1)
  name.position.set(0, 1.38, 0)
  name.renderOrder = 5
  group.add(name)

  const heartTex = makeIconTexture('heart')
  const heart = new THREE.Sprite(new THREE.SpriteMaterial({ map: heartTex, transparent: true, depthTest: false }))
  heart.scale.set(0.34, 0.34, 1)
  heart.position.set(0, 1.1, 0)
  heart.visible = false
  group.add(heart)

  group.userData = { type: 'bunny' }
  return {
    group,
    body,
    head,
    earL,
    earR,
    feet,
    heart,
    phase: 0,
    hop: 0,
    facing: 0,
    state: 'idle',
    target: new THREE.Vector3(10.5, 0, 8),
    home: new THREE.Vector3(10.5, 0, 8),
    follow: 0,
    happy: 0,
  }
}

export function createBatman() {
  const group = new THREE.Group()
  const suit = standard(0x2b323c, { roughness: 0.62 })
  const suitDark = standard(0x1d222a, { roughness: 0.7 })
  const gold = standard(0xe8b33c, { roughness: 0.4, metalness: 0.25 })
  const skin = standard(0xe8b08a, { roughness: 0.75 })

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.56, 5, 12), suit)
  torso.position.y = 1.66
  torso.scale.set(1.25, 1, 0.82)
  torso.castShadow = true
  group.add(torso)

  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.62, 0.18), suit)
  chest.position.set(0, 1.78, 0.24)
  chest.castShadow = true
  group.add(chest)

  const belt = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.14, 0.42), gold)
  belt.position.y = 1.28
  belt.castShadow = true
  group.add(belt)
  const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.05), standard(0xffd968, { roughness: 0.3, metalness: 0.4 }))
  buckle.position.set(0, 1.28, 0.24)
  group.add(buckle)

  // bat emblem
  const emblemCanvas = document.createElement('canvas')
  emblemCanvas.width = 256
  emblemCanvas.height = 256
  const ec = emblemCanvas.getContext('2d')
  ec.fillStyle = '#e8b33c'
  ec.beginPath()
  ec.arc(128, 128, 118, 0, Math.PI * 2)
  ec.fill()
  ec.fillStyle = '#1d222a'
  ec.beginPath()
  ec.moveTo(128, 90)
  ec.lineTo(148, 112)
  ec.lineTo(214, 82)
  ec.lineTo(196, 124)
  ec.lineTo(216, 148)
  ec.lineTo(170, 140)
  ec.lineTo(154, 182)
  ec.lineTo(128, 150)
  ec.lineTo(102, 182)
  ec.lineTo(86, 140)
  ec.lineTo(40, 148)
  ec.lineTo(60, 124)
  ec.lineTo(42, 82)
  ec.lineTo(108, 112)
  ec.closePath()
  ec.fill()
  const emblemTex = new THREE.CanvasTexture(emblemCanvas)
  emblemTex.colorSpace = THREE.SRGBColorSpace
  const emblem = new THREE.Mesh(new THREE.CircleGeometry(0.17, 24), new THREE.MeshStandardMaterial({ map: emblemTex, roughness: 0.45 }))
  emblem.position.set(0, 1.85, 0.335)
  group.add(emblem)

  const legs = []
  for (const sign of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.72, 4, 8), suitDark)
    leg.position.set(sign * 0.19, 0.72, 0)
    leg.castShadow = true
    group.add(leg)
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.22, 0.48), suitDark)
    boot.position.set(sign * 0.19, 0.2, 0.06)
    boot.castShadow = true
    group.add(boot)
    legs.push(leg)
  }

  const arms = []
  for (const sign of [-1, 1]) {
    const arm = new THREE.Group()
    const limb = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.62, 4, 8), suit)
    limb.position.y = -0.34
    limb.castShadow = true
    arm.add(limb)
    const glove = new THREE.Mesh(new THREE.SphereGeometry(0.105, 8, 8), suitDark)
    glove.position.y = -0.7
    glove.castShadow = true
    arm.add(glove)
    arm.position.set(sign * 0.46, 2.02, 0)
    arm.rotation.z = sign * 0.2
    arm.rotation.x = -0.35
    group.add(arm)
    arms.push(arm)
  }

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.12, 8), suitDark)
  neck.position.y = 2.14
  group.add(neck)

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.235, 18, 14), suitDark)
  head.position.y = 2.35
  head.castShadow = true
  group.add(head)

  const jaw = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 10), skin)
  jaw.scale.set(1, 0.68, 0.8)
  jaw.position.set(0, 2.27, 0.115)
  group.add(jaw)

  const eyeMat = standard(0xf3f6ff, { roughness: 0.25, emissive: 0xbcd3ff, emissiveIntensity: 0.6 })
  for (const sign of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.028, 0.02), eyeMat)
    eye.position.set(sign * 0.085, 2.39, 0.216)
    eye.rotation.z = sign * 0.14
    group.add(eye)
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.28, 6), suitDark)
    ear.position.set(sign * 0.12, 2.62, 0.01)
    ear.rotation.z = sign * 0.06
    ear.castShadow = true
    group.add(ear)
  }

  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.018, 0.01), standard(0x5c3a30, { roughness: 0.6 }))
  mouth.position.set(0, 2.24, 0.25)
  group.add(mouth)

  // flowing cape
  const capeGeo = new THREE.PlaneGeometry(1.25, 2.05, 6, 12)
  const capeMat = new THREE.MeshStandardMaterial({ color: 0x171b22, roughness: 0.85, side: THREE.DoubleSide })
  const cape = new THREE.Mesh(capeGeo, capeMat)
  cape.position.set(0, 1.35, -0.3)
  cape.castShadow = true
  group.add(cape)
  const capeBase = capeGeo.attributes.position.array.slice()

  const speech = makeSpeechSprite()
  speech.position.set(0, 3.25, 0)
  speech.scale.set(2.6, 0.9, 1)
  group.add(speech)

  group.userData = { type: 'batman' }
  return {
    group,
    parts: { torso, head, jaw, arms, legs, cape },
    capeGeo,
    capeBase,
    speech,
    state: 'patrol',
    stun: 0,
    angle: 0,
    baseY: 12.4,
    spin: 0,
    hitFlash: 0,
  }
}

export function createImpactBurst(text, color = '#ffcf4a') {
  return makeComicSprite(text, color)
}

export function disposeObject(root) {
  root.traverse((obj) => {
    if (obj.geometry) obj.geometry.dispose()
    if (obj.material) {
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
      for (const m of mats) {
        if (m.map) m.map.dispose()
        m.dispose()
      }
    }
  })
}
