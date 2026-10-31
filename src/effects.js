import * as THREE from 'three'
import { makeComicSprite, makeIconTexture } from './utils.js'

export function createEffects(scene, camera, comicLayer) {
  const bursts = []
  const impacts = []
  const shocks = []
  const heartTexture = makeIconTexture('heart')

  function burst(position, color = 0xffcf4a, count = 16, opts = {}) {
    const positions = new Float32Array(count * 3)
    const velocities = new Float32Array(count * 3)
    const colors = opts.colors ? new Float32Array(count * 3) : null
    const colorObj = new THREE.Color()
    for (let i = 0; i < count; i++) {
      positions[i * 3] = position.x + (Math.random() - 0.5) * (opts.spread || 0.2)
      positions[i * 3 + 1] = position.y + (Math.random() - 0.5) * (opts.spread || 0.2)
      positions[i * 3 + 2] = position.z + (Math.random() - 0.5) * (opts.spread || 0.2)
      const speed = (opts.speed || 3) * (0.35 + Math.random() * 0.9)
      const theta = Math.random() * Math.PI * 2
      const phi = Math.random() * Math.PI
      velocities[i * 3] = Math.cos(theta) * Math.sin(phi) * speed
      velocities[i * 3 + 1] = Math.cos(phi) * speed + (opts.up || 1.5)
      velocities[i * 3 + 2] = Math.sin(theta) * Math.sin(phi) * speed
      if (colors) {
        const c = opts.colors[Math.floor(Math.random() * opts.colors.length)]
        colorObj.set(c)
        colors[i * 3] = colorObj.r
        colors[i * 3 + 1] = colorObj.g
        colors[i * 3 + 2] = colorObj.b
      }
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    if (colors) geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    const mat = new THREE.PointsMaterial({
      color: colors ? 0xffffff : color,
      size: opts.size || 0.16,
      transparent: true,
      opacity: 1,
      depthWrite: false,
      vertexColors: Boolean(colors),
      map: opts.texture || null,
      alphaTest: opts.texture ? 0.1 : 0,
      sizeAttenuation: true,
    })
    const points = new THREE.Points(geo, mat)
    points.frustumCulled = false
    scene.add(points)
    bursts.push({
      points,
      velocities,
      life: opts.life || 1.1,
      maxLife: opts.life || 1.1,
      gravity: opts.gravity ?? 9,
      grow: opts.grow ?? 0,
    })
  }

  function hearts(position, count = 10) {
    burst(position, 0xffffff, count, {
      texture: heartTexture,
      size: 0.4,
      speed: 1.1,
      up: 1.9,
      gravity: -0.35,
      life: 1.5,
      spread: 0.4,
    })
  }

  function confetti(position) {
    const colors = [0xffcf4a, 0xff7a3c, 0x3e9d62, 0x8ec5e8, 0xff9ab5, 0xfff7e3]
    for (let i = 0; i < 4; i++) {
      burst(
        { x: position.x + (Math.random() - 0.5) * 3, y: position.y + 2 + Math.random() * 2, z: position.z + (Math.random() - 0.5) * 3 },
        0xffffff,
        22,
        { colors, size: 0.14, speed: 5, up: 6, gravity: 7, life: 2.6, spread: 0.5, grow: 0 }
      )
    }
  }

  function impactText(text, position, color = '#ffcf4a', scale = 1) {
    const sprite = makeComicSprite(text, color, scale)
    sprite.position.copy(position)
    scene.add(sprite)
    impacts.push({ sprite, life: 1.25, maxLife: 1.25, vy: 1.1 })
  }

  function shockwave(position, color = 0xffe27a) {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false })
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.7, 0.95, 36), mat)
    ring.rotation.x = -Math.PI / 2
    ring.position.copy(position)
    scene.add(ring)
    shocks.push({ mesh: ring, life: 0.7, maxLife: 0.7 })
  }

  function comicPop(text, position, { color = '#ffcf4a', size = 30, rot = -6 } = {}) {
    const v = position.clone ? position.clone() : new THREE.Vector3(position.x, position.y, position.z)
    v.project(camera)
    if (v.z > 1 || v.z < -1) return
    const x = (v.x * 0.5 + 0.5) * window.innerWidth
    const y = (-v.y * 0.5 + 0.5) * window.innerHeight
    if (x < -80 || x > window.innerWidth + 80 || y < -60 || y > window.innerHeight + 60) return
    const node = document.createElement('div')
    node.className = 'comic-pop'
    node.textContent = text
    node.style.left = `${x}px`
    node.style.top = `${y}px`
    node.style.setProperty('--size', `${size}px`)
    node.style.setProperty('--rot', `${rot}deg`)
    node.style.color = color
    comicLayer.appendChild(node)
    window.setTimeout(() => node.remove(), 1250)
  }

  function dust(position, count = 8) {
    burst(position, 0xc9b98f, count, { size: 0.11, speed: 1.2, up: 0.7, gravity: 1.2, life: 0.65, spread: 0.25 })
  }

  function splat(position) {
    burst(position, 0x7d5b34, 20, { size: 0.14, speed: 2.4, up: 1.7, gravity: 10, life: 0.9, spread: 0.2 })
    burst(position, 0xd8b463, 8, { size: 0.1, speed: 3.2, up: 2.2, gravity: 12, life: 0.7 })
  }

  function stars(position) {
    burst(position, 0xffe27a, 30, { size: 0.22, speed: 4.5, up: 1.5, gravity: 5, life: 1.2, colors: [0xffe27a, 0xffffff, 0xffb52e] })
  }

  function update(dt) {
    for (let i = bursts.length - 1; i >= 0; i--) {
      const b = bursts[i]
      b.life -= dt
      const pos = b.points.geometry.attributes.position.array
      for (let p = 0; p < b.velocities.length / 3; p++) {
        b.velocities[p * 3 + 1] -= b.gravity * dt
        pos[p * 3] += b.velocities[p * 3] * dt
        pos[p * 3 + 1] += b.velocities[p * 3 + 1] * dt
        pos[p * 3 + 2] += b.velocities[p * 3 + 2] * dt
      }
      b.points.geometry.attributes.position.needsUpdate = true
      b.points.material.opacity = Math.max(0, b.life / b.maxLife)
      if (b.grow) {
        const s = 1 + (1 - b.life / b.maxLife) * b.grow
        b.points.scale.setScalar(s)
      }
      if (b.life <= 0) {
        scene.remove(b.points)
        b.points.geometry.dispose()
        b.points.material.map?.dispose?.()
        b.points.material.dispose()
        bursts.splice(i, 1)
      }
    }
    for (let i = impacts.length - 1; i >= 0; i--) {
      const im = impacts[i]
      im.life -= dt
      im.sprite.position.y += im.vy * dt
      im.sprite.material.opacity = Math.max(0, Math.min(1, im.life / (im.maxLife * 0.4)))
      if (im.life <= 0) {
        scene.remove(im.sprite)
        im.sprite.material.map?.dispose?.()
        im.sprite.material.dispose()
        impacts.splice(i, 1)
      }
    }
    for (let i = shocks.length - 1; i >= 0; i--) {
      const s = shocks[i]
      s.life -= dt
      const k = 1 - s.life / s.maxLife
      s.mesh.scale.setScalar(1 + k * 8)
      s.mesh.material.opacity = Math.max(0, 0.9 * (1 - k))
      if (s.life <= 0) {
        scene.remove(s.mesh)
        s.mesh.geometry.dispose()
        s.mesh.material.dispose()
        shocks.splice(i, 1)
      }
    }
  }

  return {
    burst,
    hearts,
    confetti,
    impactText,
    shockwave,
    comicPop,
    dust,
    splat,
    stars,
    update,
  }
}
