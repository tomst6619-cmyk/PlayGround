import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

/* Small deterministic PRNG so the neighborhood looks the same every run. */
export function mulberry32(seed) {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const clamp = (v, min, max) => Math.min(max, Math.max(min, v))
export const lerp = (a, b, t) => a + (b - a) * t
export const easeOut = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3)
export const easeInOut = (t) => {
  t = clamp(t, 0, 1)
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
}
export const damp = (current, target, lambda, dt) => current + (target - current) * (1 - Math.exp(-lambda * dt))
export const pick = (arr, rnd = Math.random) => arr[Math.floor(rnd() * arr.length) % arr.length]

export function canvasTexture(width, height, draw, { repeat = [1, 1], srgb = true, filter = true } = {}) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  draw(ctx, width, height)
  const texture = new THREE.CanvasTexture(canvas)
  if (srgb) texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(repeat[0], repeat[1])
  texture.anisotropy = filter ? 4 : 1
  texture.needsUpdate = true
  return texture
}

export function makeGrassTexture(rnd) {
  return canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#7d9c4d'
    ctx.fillRect(0, 0, w, h)
    for (let i = 0; i < 9000; i++) {
      const x = rnd() * w
      const y = rnd() * h
      const shade = 0.55 + rnd() * 0.5
      const g = Math.floor(120 * shade + 40)
      ctx.fillStyle = `rgba(${Math.floor(g * 0.72)}, ${g}, ${Math.floor(g * 0.4)}, ${0.18 + rnd() * 0.4})`
      ctx.fillRect(x, y, 1 + rnd() * 2.2, 2 + rnd() * 5)
    }
    for (let i = 0; i < 60; i++) {
      ctx.fillStyle = `rgba(60, 90, 40, ${0.05 + rnd() * 0.08})`
      ctx.beginPath()
      ctx.ellipse(rnd() * w, rnd() * h, 10 + rnd() * 55, 8 + rnd() * 35, rnd() * Math.PI, 0, Math.PI * 2)
      ctx.fill()
    }
  }, { repeat: [44, 44] })
}

export function makeRoadTexture(rnd) {
  return canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#4a4a48'
    ctx.fillRect(0, 0, w, h)
    for (let i = 0; i < 16000; i++) {
      const v = 45 + rnd() * 55
      ctx.fillStyle = `rgba(${v},${v},${v - 2},${0.15 + rnd() * 0.45})`
      ctx.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1 + rnd() * 2)
    }
    for (let i = 0; i < 7; i++) {
      ctx.strokeStyle = `rgba(25,25,24,${0.2 + rnd() * 0.25})`
      ctx.lineWidth = 1 + rnd() * 1.4
      ctx.beginPath()
      let x = rnd() * w
      let y = rnd() * h
      ctx.moveTo(x, y)
      for (let j = 0; j < 5; j++) {
        x += (rnd() - 0.5) * 70
        y += 18 + rnd() * 30
        ctx.lineTo(x, y)
      }
      ctx.stroke()
    }
  }, { repeat: [1.4, 12] })
}

export function makeSidewalkTexture(rnd) {
  return canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#c8c0ae'
    ctx.fillRect(0, 0, w, h)
    for (let i = 0; i < 2600; i++) {
      const v = 160 + rnd() * 60
      ctx.fillStyle = `rgba(${v},${v - 6},${v - 20},${0.14 + rnd() * 0.3})`
      ctx.fillRect(rnd() * w, rnd() * h, 1, 1 + rnd() * 2)
    }
    ctx.strokeStyle = 'rgba(90, 84, 70, .38)'
    ctx.lineWidth = 3
    for (let i = 0; i <= 2; i++) {
      ctx.beginPath()
      ctx.moveTo(0, (i * w) / 2)
      ctx.lineTo(w, (i * w) / 2)
      ctx.stroke()
    }
    ctx.strokeStyle = 'rgba(90, 84, 70, .18)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(w / 2, 0)
    ctx.lineTo(w / 2, h)
    ctx.stroke()
  }, { repeat: [1, 18] })
}

export function makeBrickTexture(rnd) {
  return canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#e6dcc7'
    ctx.fillRect(0, 0, w, h)
    const rows = 8
    const bh = h / rows
    for (let r = 0; r < rows; r++) {
      const offset = r % 2 ? w / 10 : 0
      for (let c = -1; c < 6; c++) {
        const x = c * (w / 5) + offset
        const shade = 0.9 + rnd() * 0.16
        ctx.fillStyle = `rgb(${Math.floor(230 * shade)},${Math.floor(222 * shade)},${Math.floor(204 * shade)})`
        ctx.fillRect(x + 2, r * bh + 2, w / 5 - 4, bh - 4)
      }
    }
  }, { repeat: [3, 1] })
}

export function makeStripeTexture(colorA = '#2b2b28', colorB = '#ffcf4a') {
  return canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = colorB
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = colorA
    ctx.save()
    ctx.translate(w / 2, h / 2)
    ctx.rotate(-Math.PI / 4)
    for (let i = -4; i < 5; i++) ctx.fillRect(i * 32 - 8, -h, 16, h * 2)
    ctx.restore()
  }, { repeat: [4, 1] })
}

export function makeLabelTexture(text, { bg = '#fff7e3', fg = '#211f19', font = '900 64px "Arial Black", sans-serif', w = 256, h = 128, pad = 10, border = true } = {}) {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, w, h)
  if (bg) {
    ctx.fillStyle = bg
    roundRect(ctx, 2, 2, w - 4, h - 4, 16)
    ctx.fill()
    if (border) {
      ctx.strokeStyle = '#211f19'
      ctx.lineWidth = 6
      roundRect(ctx, 4, 4, w - 8, h - 8, 14)
      ctx.stroke()
    }
  }
  ctx.fillStyle = fg
  ctx.font = font
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  fitText(ctx, text, w - pad * 2, h * 0.58)
  ctx.fillText(text, w / 2, h / 2 + 2)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function fitText(ctx, text, maxWidth, maxHeight) {
  const size = parseInt(ctx.font, 10) || 64
  let current = size
  while (current > 10) {
    ctx.font = ctx.font.replace(/\d+px/, `${current}px`)
    if (ctx.measureText(text).width <= maxWidth) break
    current -= 2
  }
}

export function makeBubbleCanvas(canvas) {
  if (!canvas) {
    canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 176
  }
  return canvas
}

export function drawBubble(canvas, text, accent = '#211f19') {
  const ctx = canvas.getContext('2d')
  const w = canvas.width
  const h = canvas.height
  ctx.clearRect(0, 0, w, h)
  ctx.save()
  ctx.translate(0, 0)
  ctx.fillStyle = '#fff7e3'
  ctx.strokeStyle = '#211f19'
  ctx.lineWidth = 12
  ctx.lineJoin = 'round'
  roundRect(ctx, 18, 14, w - 36, h - 52, 40)
  ctx.fill()
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(w * 0.34, h - 46)
  ctx.lineTo(w * 0.42, h - 8)
  ctx.lineTo(w * 0.52, h - 46)
  ctx.closePath()
  ctx.fillStyle = '#fff7e3'
  ctx.fill()
  ctx.strokeStyle = '#211f19'
  ctx.stroke()
  ctx.fillStyle = accent
  ctx.font = '900 62px "Arial Black", "Trebuchet MS", sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  fitText(ctx, text, w - 80, 100)
  ctx.fillText(text, w / 2, h / 2 - 8)
  ctx.restore()
  return canvas
}

export function makeSpeechSprite() {
  const canvas = makeBubbleCanvas()
  drawBubble(canvas, 'HEY!')
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false })
  const sprite = new THREE.Sprite(material)
  sprite.scale.set(2.4, 0.82, 1)
  sprite.renderOrder = 20
  sprite.visible = false
  sprite.userData.canvas = canvas
  sprite.userData.texture = texture
  return sprite
}

export function setSpeech(sprite, text, accent = '#211f19') {
  drawBubble(sprite.userData.canvas, text, accent)
  sprite.userData.texture.needsUpdate = true
  sprite.visible = true
}

export function makeComicSprite(text, color = '#ffcf4a', scale = 1) {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 192
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, 512, 192)
  ctx.save()
  ctx.translate(256, 100)
  ctx.rotate(-0.06)
  ctx.font = '900 104px "Arial Black", "Trebuchet MS", sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = '#211f19'
  ctx.lineWidth = 18
  ctx.strokeText(text, 0, 0)
  ctx.fillStyle = color
  ctx.fillText(text, 0, 0)
  ctx.restore()
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false })
  const sprite = new THREE.Sprite(material)
  sprite.scale.set(4.4 * scale, 1.65 * scale, 1)
  sprite.renderOrder = 21
  return sprite
}

export function makeIconTexture(kind) {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, 128, 128)
  ctx.font = '900 92px "Trebuchet MS", sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  if (kind === 'exclaim') {
    ctx.fillStyle = '#ffcf4a'
    ctx.strokeStyle = '#211f19'
    ctx.lineWidth = 8
    ctx.beginPath()
    ctx.arc(64, 64, 46, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = '#211f19'
    ctx.font = '900 72px "Arial Black", sans-serif'
    ctx.fillText('!', 64, 68)
  } else if (kind === 'heart') {
    ctx.fillStyle = '#ff6f91'
    ctx.strokeStyle = '#211f19'
    ctx.lineWidth = 5
    ctx.beginPath()
    ctx.moveTo(64, 104)
    ctx.bezierCurveTo(18, 72, 18, 30, 46, 26)
    ctx.bezierCurveTo(58, 24, 64, 34, 64, 40)
    ctx.bezierCurveTo(64, 34, 70, 24, 82, 26)
    ctx.bezierCurveTo(110, 30, 110, 72, 64, 104)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

const standardCache = new Map()

/* Most props in the neighborhood reuse a handful of colours. Caching the
   materials keeps Three.js from compiling and uploading dozens of identical
   shader programs on low-end devices. Only immutable material settings belong
   in the key; animated transparency/emissive values should use their own
   material instead. */
export function standard(color, opts = {}) {
  const colorKey = color instanceof THREE.Color ? color.getHexString() : new THREE.Color(color).getHexString()
  const key = [
    colorKey,
    opts.roughness ?? 0.85,
    opts.metalness ?? 0,
    opts.flat ?? false,
    opts.transparent ?? false,
    opts.opacity ?? 1,
    opts.emissive ?? 0x000000,
    opts.emissiveIntensity ?? 1,
    opts.side ?? THREE.FrontSide,
  ].join('|')
  const cached = standardCache.get(key)
  if (cached) return cached
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness ?? 0.85,
    metalness: opts.metalness ?? 0,
    flatShading: opts.flat ?? false,
    transparent: opts.transparent ?? false,
    opacity: opts.opacity ?? 1,
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 1,
    side: opts.side ?? THREE.FrontSide,
  })
  standardCache.set(key, material)
  return material
}

/* Merge differently coloured parts into one vertex-coloured mesh. Used by
   pedestrians, loose trash and carrots so a prop costs one draw call instead
   of one per little sphere/cylinder. */
export function mergeColoredMeshes(meshes, material) {
  const geometries = []
  for (const source of meshes) {
    if (!source.isMesh || !source.geometry) continue
    source.updateMatrix()
    const geometry = source.geometry.index ? source.geometry.toNonIndexed() : source.geometry.clone()
    for (const name of Object.keys(geometry.attributes)) {
      if (name !== 'position' && name !== 'normal' && name !== 'uv') geometry.deleteAttribute(name)
    }
    if (!geometry.attributes.normal) geometry.computeVertexNormals()
    if (!geometry.attributes.uv) {
      geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(geometry.attributes.position.count * 2), 2))
    }
    geometry.applyMatrix4(source.matrix)
    const color = source.material?.color ?? new THREE.Color(0xffffff)
    const count = geometry.attributes.position.count
    const colors = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      colors[i * 3] = color.r
      colors[i * 3 + 1] = color.g
      colors[i * 3 + 2] = color.b
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    geometries.push(geometry)
  }
  if (!geometries.length) return null
  const merged = mergeGeometries(geometries, false)
  for (const geometry of geometries) geometry.dispose()
  if (!merged) return null
  merged.computeBoundingSphere()
  const result = new THREE.Mesh(merged, material)
  result.castShadow = true
  result.receiveShadow = false
  return result
}

export function mesh(geometry, material, { x = 0, y = 0, z = 0, cast = true, receive = true } = {}) {
  const m = new THREE.Mesh(geometry, material)
  m.position.set(x, y, z)
  m.castShadow = cast
  m.receiveShadow = receive
  return m
}

export function roundedBox(w, h, d, radius = 0.08, segments = 3) {
  const shape = new THREE.Shape()
  const x = -w / 2
  const y = -h / 2
  shape.moveTo(x + radius, y)
  shape.lineTo(x + w - radius, y)
  shape.quadraticCurveTo(x + w, y, x + w, y + radius)
  shape.lineTo(x + w, y + h - radius)
  shape.quadraticCurveTo(x + w, y + h, x + w - radius, y + h)
  shape.lineTo(x + radius, y + h)
  shape.quadraticCurveTo(x, y + h, x, y + h - radius)
  shape.lineTo(x, y + radius)
  shape.quadraticCurveTo(x, y, x + radius, y)
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: radius * 0.35, bevelThickness: radius * 0.35, curveSegments: segments })
  geometry.translate(0, 0, -d / 2)
  geometry.computeVertexNormals()
  return geometry
}

export function color(hex) {
  return new THREE.Color(hex)
}

export function planeTexture(texture, w, h, opts = {}) {
  const material = new THREE.MeshStandardMaterial({
    map: texture,
    transparent: opts.transparent ?? false,
    roughness: opts.roughness ?? 0.9,
    metalness: 0,
    side: opts.side ?? THREE.FrontSide,
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 1,
  })
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), material)
}
