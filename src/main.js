import * as THREE from 'three'
import './style.css'
import { createWorld } from './world.js'
import { createHud } from './hud.js'
import { createEffects } from './effects.js'
import { createGameplay } from './gameplay.js'
import { AudioEngine } from './audio.js'
import { clamp, easeInOut, standard } from './utils.js'

/* ============================================================
   Renderer + scene
   ============================================================ */
const canvas = document.getElementById('scene')
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })

/* Headless CI and some laptops fall back to SwiftShader/llvmpipe. Rendering a
   full-resolution, shadowed scene there is a slideshow, so detect it and drop
   the internal resolution plus shadow fidelity for a playable frame rate. */
const gl = renderer.getContext()
const debugInfo = gl.getExtension('WEBGL_debug_renderer_info')
const rendererName = debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)
const softwareRenderer = /swiftshader|llvmpipe|software rasterizer/i.test(String(rendererName))
const pixelRatio = softwareRenderer ? Math.min(window.devicePixelRatio || 1, 0.65) : Math.min(window.devicePixelRatio || 1, 1.75)
renderer.setPixelRatio(pixelRatio)
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.06
renderer.shadowMap.enabled = !softwareRenderer
renderer.shadowMap.type = THREE.PCFShadowMap

const scene = new THREE.Scene()
// The sky dome has a radius of 310, so the far plane must sit beyond it or
// the dome gets clipped into a giant pale disc.
const camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.08, 620)
camera.rotation.order = 'YXZ'
scene.add(camera)

const world = createWorld(scene)
if (softwareRenderer && world.sun) world.sun.shadow.mapSize.set(1024, 1024)
const audio = new AudioEngine()
const hud = createHud(world, audio)
const effects = createEffects(scene, camera, hud.el.comicLayer)
const isTouch = window.matchMedia('(hover: none) and (pointer: coarse)').matches || navigator.maxTouchPoints > 0 || window.innerWidth < 820
if (isTouch) document.body.classList.add('is-touch')

/* ============================================================
   Player state
   ============================================================ */
const player = {
  pos: new THREE.Vector3(0.35, 0, 40.8),
  vel: new THREE.Vector3(),
  yaw: 0.015,
  pitch: -0.035,
  vy: 0,
  onGround: true,
  bobPhase: 0,
  moving: 0,
  sprinting: false,
  stepTimer: 0,
}
const touchMove = { x: 0, y: 0 }

const app = {
  started: false,
  paused: false,
  won: false,
  ready: false,
  intro: null,
  charging: false,
  chargeT: 0,
  throwAnim: 0,
  dragging: false,
  muted: false,
  minimapClock: 0,
  lastHudBag: -1,
}

const gameplay = createGameplay({ world, player, camera, hud, effects, audio, onWin: showWin })
const keys = new Set()

/* ============================================================
   First person view model
   ============================================================ */
function makeViewmodel() {
  const root = new THREE.Group()
  root.position.set(0.4, -0.44, -0.76)

  const sleeveMat = standard(0x3f6c86, { roughness: 0.9 })
  const skinMat = standard(0xe6b28c, { roughness: 0.8 })
  const bagMat = standard(0x24241f, { roughness: 0.95 })

  const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.3, 4, 8), sleeveMat)
  arm.position.set(0.08, -0.15, 0.02)
  arm.rotation.z = -0.42
  arm.rotation.x = 0.35
  root.add(arm)

  const hand = new THREE.Mesh(new THREE.SphereGeometry(0.082, 10, 8), skinMat)
  hand.position.set(-0.005, -0.01, 0)
  hand.rotation.y = 0.3
  root.add(hand)

  const bag = new THREE.Group()
  for (let i = 0; i < 3; i++) {
    const blob = new THREE.Mesh(new THREE.SphereGeometry(0.085, 8, 6), bagMat)
    blob.position.set((i - 1) * 0.055, 0.07 + (i % 2) * 0.035, (i - 1) * 0.03)
    blob.scale.set(1, 0.92, 1)
    bag.add(blob)
  }
  const knot = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.07, 6), bagMat)
  knot.position.y = 0.17
  bag.add(knot)
  bag.position.set(-0.02, 0.02, -0.03)
  bag.visible = false
  root.add(bag)

  root.traverse((o) => {
    o.castShadow = false
    o.receiveShadow = false
  })
  camera.add(root)
  return { root, bag }
}
const view = makeViewmodel()

/* ============================================================
   Pointer lock / mouse look
   ============================================================ */
const SENS = 0.0022
const TOUCH_SENS = 0.0044

function playing() {
  return app.started && !app.paused && !app.won && !gameplay.isWinLocked()
}

function requestLock() {
  if (isTouch) return
  try {
    const result = canvas.requestPointerLock?.()
    if (result?.catch) result.catch(() => {})
  } catch {}
}

function startCharge() {
  if (!playing() || app.charging) return
  app.charging = true
  app.chargeT = 0
}

function releaseCharge() {
  if (!app.charging) return
  const power = 0.55 + clamp(app.chargeT / 1.1, 0, 1) * 0.85
  const threw = gameplay.throwTrash(power)
  if (threw) {
    app.throwAnim = 0.36
    audio.init()
  }
  app.charging = false
  app.chargeT = 0
  hud.setCharge(0)
}

canvas.addEventListener('mousedown', (event) => {
  if (isTouch) return
  if (event.button !== 0) return
  if (!app.started || app.paused || app.won) return
  if (document.pointerLockElement !== canvas) {
    requestLock()
    app.dragging = true
    return
  }
  startCharge()
})

document.addEventListener('mousemove', (event) => {
  if (isTouch || !playing()) return
  if (document.pointerLockElement === canvas) {
    player.yaw -= event.movementX * SENS
    player.pitch -= event.movementY * SENS
  } else if (app.dragging) {
    player.yaw -= event.movementX * SENS * 1.25
    player.pitch -= event.movementY * SENS * 1.25
  } else {
    return
  }
  player.pitch = clamp(player.pitch, -1.35, 1.32)
})

document.addEventListener('mouseup', (event) => {
  if (isTouch) return
  app.dragging = false
  if (event.button !== 0) return
  releaseCharge()
})

document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement !== canvas) {
    app.dragging = false
    if (app.charging) {
      app.charging = false
      app.chargeT = 0
      hud.setCharge(0)
    }
  }
})

canvas.addEventListener('click', () => {
  if (isTouch || !app.started || app.paused || app.won) return
  if (document.pointerLockElement !== canvas) requestLock()
})

document.addEventListener('contextmenu', (event) => event.preventDefault())

/* ============================================================
   Keyboard
   ============================================================ */
const MOVE_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight'])
window.addEventListener('keydown', (event) => {
  if (MOVE_KEYS.has(event.code)) {
    keys.add(event.code)
    if (event.code.startsWith('Arrow')) event.preventDefault()
  }
  if (event.code === 'Space') {
    event.preventDefault()
    if (!event.repeat && playing() && player.onGround) {
      player.vy = 5.4
      player.onGround = false
    }
  }
  if (event.code === 'KeyE' && !event.repeat) {
    if (playing()) {
      audio.init()
      gameplay.interact()
      app.chargeT = 0
    }
  }
  if (event.code === 'KeyM' && !event.repeat) toggleMute()
  if (event.code === 'Escape' && !event.repeat && app.started && !app.won) {
    if (app.paused) resumeGame()
    else pauseGame()
  }
  if (event.code === 'KeyP' && !event.repeat && app.started && !app.won) {
    if (app.paused) resumeGame()
    else pauseGame()
  }
})
window.addEventListener('keyup', (event) => {
  keys.delete(event.code)
})
window.addEventListener('blur', () => {
  keys.clear()
  touchMove.x = 0
  touchMove.y = 0
})

/* ============================================================
   Touch controls
   ============================================================ */
const stick = { id: null, max: 44 }
const look = { id: null, x: 0, y: 0 }
const stickZone = hud.el.stickZone
const stickKnob = hud.el.stickKnob

function setStickFromEvent(event) {
  const rect = stickZone.getBoundingClientRect()
  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height / 2
  let dx = event.clientX - cx
  let dy = event.clientY - cy
  const dist = Math.hypot(dx, dy)
  if (dist > stick.max) {
    dx = (dx / dist) * stick.max
    dy = (dy / dist) * stick.max
  }
  touchMove.x = dx / stick.max
  touchMove.y = -dy / stick.max
  stickKnob.style.transform = `translate(${dx}px, ${dy}px)`
}

stickZone.addEventListener('pointerdown', (event) => {
  if (!playing() || stick.id !== null) return
  event.preventDefault()
  event.stopPropagation()
  stick.id = event.pointerId
  stickZone.setPointerCapture(event.pointerId)
  setStickFromEvent(event)
})
stickZone.addEventListener('pointermove', (event) => {
  if (stick.id !== event.pointerId) return
  event.preventDefault()
  setStickFromEvent(event)
})
function endStick(event) {
  if (stick.id !== event.pointerId) return
  stick.id = null
  touchMove.x = 0
  touchMove.y = 0
  stickKnob.style.transform = 'translate(0, 0)'
}
stickZone.addEventListener('pointerup', endStick)
stickZone.addEventListener('pointercancel', endStick)
stickZone.addEventListener('lostpointercapture', () => {
  stick.id = null
  touchMove.x = 0
  touchMove.y = 0
  stickKnob.style.transform = 'translate(0, 0)'
})

canvas.addEventListener('pointerdown', (event) => {
  if (!isTouch || event.pointerType === 'mouse') return
  if (!playing() || look.id !== null) return
  look.id = event.pointerId
  look.x = event.clientX
  look.y = event.clientY
  try { canvas.setPointerCapture(event.pointerId) } catch {}
})
canvas.addEventListener('pointermove', (event) => {
  if (look.id !== event.pointerId) return
  const dx = event.clientX - look.x
  const dy = event.clientY - look.y
  look.x = event.clientX
  look.y = event.clientY
  player.yaw -= dx * TOUCH_SENS
  player.pitch = clamp(player.pitch - dy * TOUCH_SENS, -1.35, 1.32)
})
function endLook(event) {
  if (look.id !== event.pointerId) return
  look.id = null
}
canvas.addEventListener('pointerup', endLook)
canvas.addEventListener('pointercancel', endLook)

const throwBtn = hud.el.throwBtn
throwBtn.addEventListener('pointerdown', (event) => {
  event.preventDefault()
  event.stopPropagation()
  throwBtn.classList.add('held')
  startCharge()
})
function endThrow(event) {
  event.preventDefault()
  event.stopPropagation()
  throwBtn.classList.remove('held')
  releaseCharge()
}
throwBtn.addEventListener('pointerup', endThrow)
throwBtn.addEventListener('pointercancel', endThrow)
throwBtn.addEventListener('pointerleave', (event) => {
  if (event.buttons === 0) {
    throwBtn.classList.remove('held')
    releaseCharge()
  }
})
window.addEventListener('pointerup', () => {
  if (isTouch && app.charging) {
    throwBtn.classList.remove('held')
    releaseCharge()
  }
})
window.addEventListener('pointercancel', () => {
  if (isTouch && app.charging) {
    throwBtn.classList.remove('held')
    releaseCharge()
  }
})

hud.el.actionBtn.addEventListener('pointerdown', (event) => {
  event.preventDefault()
  event.stopPropagation()
  if (!playing()) return
  audio.init()
  gameplay.interact()
})
hud.el.actionBtn.addEventListener('click', (event) => {
  event.preventDefault()
  event.stopPropagation()
})

/* ============================================================
   Start, pause, win
   ============================================================ */
function startGame() {
  if (app.started) return
  audio.init()
  audio.click()
  app.started = true
  app.paused = false
  app.intro = {
    startedAt: performance.now(),
    dur: 0.8,
    fromPos: camera.position.clone(),
    fromQuat: camera.quaternion.clone(),
  }
  hud.hideStart()
  requestLock()
  hud.toast('Los geht’s! Sammle Müll, ärgere Nachbarn, rette Batman.', 'good', 3600)
  hud.feed('Auftrag: 36 Müllteile in 12 Gärten einsammeln.', '')
}

function pauseGame() {
  if (!app.started || app.won || app.paused) return
  app.paused = true
  app.charging = false
  app.chargeT = 0
  hud.setCharge(0)
  touchMove.x = 0
  touchMove.y = 0
  stickKnob.style.transform = 'translate(0, 0)'
  try { document.exitPointerLock?.() } catch {}
  hud.showPause()
}

function resumeGame() {
  if (!app.paused) return
  app.paused = false
  hud.hidePause()
  requestLock()
}

function showWin(stats) {
  app.won = true
  app.charging = false
  hud.setCharge(0)
  try { document.exitPointerLock?.() } catch {}
  hud.showWin(stats)
}

function toggleMute() {
  audio.init()
  app.muted = audio.toggleMute()
  hud.setMuted(app.muted)
}

hud.el.startBtn.addEventListener('click', startGame)
hud.el.pauseBtn.addEventListener('click', () => {
  if (app.paused) resumeGame()
  else pauseGame()
})
hud.el.resumeBtn.addEventListener('click', resumeGame)
hud.el.pauseRestartBtn.addEventListener('click', () => window.location.reload())
hud.el.restartBtn.addEventListener('click', () => window.location.reload())
hud.el.muteBtn.addEventListener('click', toggleMute)

/* ============================================================
   Movement / camera
   ============================================================ */
const WALK_SPEED = 4.3
const RUN_SPEED = 7.3
const PLAYER_RADIUS = 0.36
const tmp = new THREE.Vector3()

function collidePlayer() {
  const b = world.bounds
  player.pos.x = clamp(player.pos.x, b.minX, b.maxX)
  player.pos.z = clamp(player.pos.z, b.minZ, b.maxZ)
  const x = player.pos.x
  const z = player.pos.z
  for (const c of world.colliders) {
    if (x > c.minX - PLAYER_RADIUS && x < c.maxX + PLAYER_RADIUS && z > c.minZ - PLAYER_RADIUS && z < c.maxZ + PLAYER_RADIUS) {
      const dx1 = x - (c.minX - PLAYER_RADIUS)
      const dx2 = c.maxX + PLAYER_RADIUS - x
      const dz1 = z - (c.minZ - PLAYER_RADIUS)
      const dz2 = c.maxZ + PLAYER_RADIUS - z
      const min = Math.min(dx1, dx2, dz1, dz2)
      if (min === dx1) player.pos.x = c.minX - PLAYER_RADIUS
      else if (min === dx2) player.pos.x = c.maxX + PLAYER_RADIUS
      else if (min === dz1) player.pos.z = c.minZ - PLAYER_RADIUS
      else player.pos.z = c.maxZ + PLAYER_RADIUS
    }
  }
}

function updatePlayer(dt, canControl) {
  let moveX = 0
  let moveZ = 0
  if (canControl) {
    if (keys.has('KeyW') || keys.has('ArrowUp')) moveZ += 1
    if (keys.has('KeyS') || keys.has('ArrowDown')) moveZ -= 1
    if (keys.has('KeyD') || keys.has('ArrowRight')) moveX += 1
    if (keys.has('KeyA') || keys.has('ArrowLeft')) moveX -= 1
    moveX += touchMove.x
    moveZ += touchMove.y
  }
  const mag = Math.hypot(moveX, moveZ)
  if (mag > 1) {
    moveX /= mag
    moveZ /= mag
  }
  const touchSprint = Math.hypot(touchMove.x, touchMove.y) > 0.93
  player.sprinting = canControl && (keys.has('ShiftLeft') || keys.has('ShiftRight') || touchSprint)
  const targetSpeed = player.sprinting ? RUN_SPEED : WALK_SPEED
  const sin = Math.sin(player.yaw)
  const cos = Math.cos(player.yaw)
  const wishX = (cos * moveX - sin * moveZ) * targetSpeed
  const wishZ = (-sin * moveX - cos * moveZ) * targetSpeed
  const lambda = player.onGround ? 13 : 3.4
  player.vel.x += (wishX - player.vel.x) * (1 - Math.exp(-lambda * dt))
  player.vel.z += (wishZ - player.vel.z) * (1 - Math.exp(-lambda * dt))
  player.pos.x += player.vel.x * dt
  player.pos.z += player.vel.z * dt
  collidePlayer()

  player.vy -= 19 * dt
  player.pos.y += player.vy * dt
  if (player.pos.y <= 0) {
    if (!player.onGround && player.vy < -4) effects.dust(tmp.set(player.pos.x, 0.06, player.pos.z), 5)
    player.pos.y = 0
    player.vy = 0
    player.onGround = true
  } else {
    player.onGround = false
  }

  const horizontalSpeed = Math.hypot(player.vel.x, player.vel.z)
  player.moving = horizontalSpeed
  if (horizontalSpeed > 0.4 && player.onGround) {
    player.bobPhase += dt * (3.2 + horizontalSpeed * 1.3)
    player.stepTimer += horizontalSpeed * dt
    if (player.stepTimer > 2.15) {
      player.stepTimer = 0
      audio.footstep(player.sprinting)
    }
  }
  const bobAmount = Math.min(1, horizontalSpeed / WALK_SPEED)
  const bobY = Math.sin(player.bobPhase * 2) * 0.032 * bobAmount
  const roll = Math.sin(player.bobPhase) * 0.008 * bobAmount

  camera.position.set(player.pos.x, player.pos.y + 1.68 + bobY, player.pos.z)
  camera.rotation.set(player.pitch, player.yaw, roll)

  // camera shake from Batman tackles
  const shake = gameplay.state.shake
  if (shake > 0) {
    gameplay.state.shake = Math.max(0, shake - dt * 2.4)
    camera.position.x += (Math.random() - 0.5) * shake * 0.22
    camera.position.y += (Math.random() - 0.5) * shake * 0.22
    camera.rotation.z += (Math.random() - 0.5) * shake * 0.04
  }
  if (app.charging) {
    app.chargeT += dt
  }
  hud.setCharge(app.charging ? clamp(app.chargeT / 1.1, 0, 1) : 0)
}

/* ============================================================
   Attract camera
   ============================================================ */
function updateAttract(time) {
  const a = time * 0.075
  camera.position.set(Math.sin(a) * 11.5, 5.4 + Math.sin(time * 0.21) * 0.5, 31 + Math.cos(a) * 5.5)
  camera.lookAt(0, 2.6, 5 + Math.sin(a * 1.7) * 6)
  camera.rotation.z += Math.sin(time * 0.16) * 0.012
}

/* ============================================================
   Viewmodel animation
   ============================================================ */
function updateViewmodel(dt) {
  view.root.visible = app.started && !app.won
  const horizontalSpeed = Math.hypot(player.vel.x, player.vel.z)
  const k = Math.min(1, horizontalSpeed / WALK_SPEED)
  const bob = Math.sin(player.bobPhase * 2)
  view.root.position.set(0.4 + bob * 0.011 * k, -0.44 + Math.abs(bob) * 0.016 * k, -0.76)
  view.root.rotation.set(0.02, Math.sin(player.bobPhase) * 0.02 * k, Math.sin(player.bobPhase) * 0.035 * k)
  if (app.throwAnim > 0) {
    app.throwAnim = Math.max(0, app.throwAnim - dt)
    const p = Math.sin((1 - app.throwAnim / 0.36) * Math.PI)
    view.root.position.z -= p * 0.22
    view.root.position.y += p * 0.13
    view.root.rotation.x -= p * 0.85
  }
  view.bag.visible = gameplay.heldTrash.length > 0 && app.throwAnim < 0.14
}

/* ============================================================
   Loop
   ============================================================ */
const clock = new THREE.Clock()
let frame = 0

function animate() {
  requestAnimationFrame(animate)
  const dt = Math.min(clock.getDelta(), 0.05)
  const time = clock.elapsedTime
  const active = playing()

  if (!app.started) updateAttract(time)

  if (!app.paused) {
    if (app.started && !app.won) updatePlayer(dt, active)
    gameplay.update(dt, time, active)
    world.updateAmbient(dt, time, app.started ? player.pos : null)
    effects.update(dt)
    updateViewmodel(dt)
  }

  if (app.started && !app.won) {
    if (app.intro) {
      const targetPos = camera.position.clone()
      const targetQuat = camera.quaternion.clone()
      const elapsed = (performance.now() - app.intro.startedAt) / 1000
      const k = easeInOut(Math.min(1, elapsed / app.intro.dur))
      camera.position.lerpVectors(app.intro.fromPos, targetPos, k)
      camera.quaternion.slerpQuaternions(app.intro.fromQuat, targetQuat, k)
      if (elapsed >= app.intro.dur) app.intro = null
    }
  }

  app.minimapClock += dt
  if (app.minimapClock > 0.12) {
    app.minimapClock = 0
    hud.renderMinimap(player)
  }

  renderer.render(scene, camera)
  app.stats = {
    calls: renderer.info.render.calls,
    triangles: renderer.info.render.triangles,
    pixelRatio,
    softwareRenderer,
    renderer: String(rendererName),
  }
  frame++
  if (!app.ready && frame > 1) {
    app.ready = true
    document.body.dataset.ready = '1'
  }
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.fov = window.innerWidth < 820 ? 74 : 68
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
})
camera.fov = window.innerWidth < 820 ? 74 : 68
camera.updateProjectionMatrix()

/* ============================================================
   Debug / automation hooks
   ============================================================ */
window.__game = {
  THREE,
  start: startGame,
  pause: pauseGame,
  resume: resumeGame,
  player,
  world,
  gameplay,
  camera,
  app,
  renderer,
  state: gameplay.state,
  teleport(x, z, yaw = player.yaw) {
    player.pos.x = x
    player.pos.z = z
    player.pos.y = 0
    player.yaw = yaw
    player.vel.set(0, 0, 0)
  },
  look(yaw, pitch = 0) {
    player.yaw = yaw
    player.pitch = pitch
  },
  depositAll() {
    gameplay.debug.depositAll()
  },
  feedMax() {
    gameplay.debug.feed()
  },
  winNow() {
    gameplay.debug.depositAll()
    gameplay.state.winTimer = 0.05
  },
  snapshot() {
    return {
      started: app.started,
      won: app.won,
      score: gameplay.state.score,
      cleaned: gameplay.state.cleaned,
      bag: gameplay.state.bag,
      held: gameplay.heldTrash.length,
      houses: gameplay.state.housesCleared,
      bonks: gameplay.state.bonks,
      tackles: gameplay.state.tackles,
      fed: gameplay.state.fed,
    }
  },
  perf() {
    return app.stats
  },
}

animate()
