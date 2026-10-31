import * as THREE from 'three'
import { clamp, pick, setSpeech } from './utils.js'
import { updatePersonAnim } from './characters.js'

const MAX_BAG = 10
const BUBBLE_LINES = ['HEY!', 'MEIN HEMD!', 'IGITT!', 'WAS SOLL DAS?!', 'NICHT DIE FRISUR!', 'MAMA!', 'HILFE!']
const COMIC_WORDS = ['PENG!', 'BONK!', 'KLATSCH!', 'WUMM!', 'SPLAT!']
const BATMAN_LINES = ['HMMM!', 'AUTSCH!', 'ICH BIN DIE NACHT!', 'NICHT DIE FLEDERMAUS!', 'WER WAR DAS?!']
const TACKLE_WORDS = ['PENG!', 'WUMM!', 'BONK!']

export function createGameplay({ world, player, camera, hud, effects, audio, onWin }) {
  const state = {
    score: 0,
    bag: 0,
    carrots: 0,
    cleaned: 0,
    housesCleared: 0,
    bonks: 0,
    tackles: 0,
    fed: 0,
    combo: 0,
    comboTimer: 0,
    shake: 0,
    active: false,
    won: false,
    winPending: false,
    winTimer: 0,
    interaction: null,
    firstPickup: false,
    firstHit: false,
    firstTackle: false,
    firstFeed: false,
  }

  const heldTrash = []
  const camDir = new THREE.Vector3()
  const tmpVec = new THREE.Vector3()
  const tmpVec2 = new THREE.Vector3()
  const center = new THREE.Vector3()

  hud.setBag(0, MAX_BAG)
  hud.setCarrots(0)
  hud.setScore(0)
  hud.setProgress(0, 0)

  /* ------------------------------------------------------------
     helpers
     ------------------------------------------------------------ */
  function addScore(points) {
    state.score += points
    hud.setScore(state.score)
  }

  function updateProgress() {
    hud.setProgress(state.cleaned, state.housesCleared)
  }

  function countDeposited() {
    return world.trashItems.reduce((n, item) => n + (item.state === 'deposited' ? 1 : 0), 0)
  }

  function depositItem(item, direct = false, silent = false) {
    if (item.state === 'deposited') return 0
    item.state = 'deposited'
    item.group.visible = false
    item.ring.visible = false
    item.icon.visible = false
    item.near = false
    state.cleaned++
    const points = direct ? 90 : 35
    addScore(points)
    if (!silent) updateProgress()
    checkHouseClear(item.home)
    if (!silent) checkWin()
    return points
  }

  function checkHouseClear(house) {
    if (!house || house.cleared) return false
    if (!house.trash.every((item) => item.state === 'deposited')) return false
    house.cleared = true
    state.housesCleared++
    addScore(250)
    updateProgress()
    const number = 2 + house.id * 2
    hud.banner(`HAUS ${number} IST SAUBER!`, '+250 · Der Nachbar traut sich wieder raus')
    hud.feed(`Haus ${number} komplett geräumt +250`, 'good')
    audio.deposit()
    effects.comicPop('SAUBER!', tmpVec.set(house.x, 3.5, house.z), { color: '#a8efb0', size: 34, rot: 4 })
    return true
  }

  function checkWin() {
    if (state.won || state.winPending) return
    const cleaned = countDeposited()
    if (cleaned < world.totalTrash) return
    state.cleaned = cleaned
    updateProgress()
    state.winPending = true
    state.winTimer = 1.5
    hud.banner('ALLES SAUBER!', 'Die Nachbarschaft glänzt · Auftrag erledigt', 2600)
    hud.feed('Alle Müllteile entsorgt. Wahnsinn.', 'good')
    audio.fanfare()
    effects.confetti(player.pos)
    effects.comicPop('SAUBER!', tmpVec.set(player.pos.x, 2.4, player.pos.z), { color: '#a8efb0', size: 44, rot: -4 })
  }

  function stats() {
    return {
      score: state.score,
      cleaned: state.cleaned,
      bonks: state.bonks,
      tackles: state.tackles,
      fed: state.fed,
      houses: state.housesCleared,
    }
  }

  function isWinLocked() {
    return state.won || state.winPending
  }

  /* ------------------------------------------------------------
     interaction detection
     ------------------------------------------------------------ */
  function playerForward() {
    return tmpVec2.set(-Math.sin(player.yaw), 0, -Math.cos(player.yaw))
  }

  function findInteraction() {
    const forward = playerForward()
    let bestTrash = null
    let bestTrashDist = 3.1
    let bestTrashDot = 0
    let bestCarrot = null
    let bestCarrotDist = 2.5
    let bestCarrotDot = 0

    for (const item of world.trashItems) {
      const isGround = item.state === 'ground'
      const pos = item.group.position
      const dx = pos.x - player.pos.x
      const dz = pos.z - player.pos.z
      const dist = Math.hypot(dx, dz)
      const near = isGround && dist < 3.8
      item.near = near
      item.ring.visible = near && item.collectCool <= 0
      item.icon.visible = near && item.collectCool <= 0
      if (!isGround || item.collectCool > 0) continue
      const dot = dist > 0.01 ? (dx * forward.x + dz * forward.z) / dist : 1
      if (dist < bestTrashDist && (dot > 0.15 || dist < 0.8)) {
        bestTrashDist = dist
        bestTrashDot = dot
        bestTrash = item
      }
    }

    for (const carrot of world.carrots) {
      if (carrot.state !== 'ground') continue
      const pos = carrot.group.position
      const dx = pos.x - player.pos.x
      const dz = pos.z - player.pos.z
      const dist = Math.hypot(dx, dz)
      if (dist < bestCarrotDist) {
        const dot = dist > 0.01 ? (dx * forward.x + dz * forward.z) / dist : 1
        if (dot > 0.15 || dist < 0.8) {
          bestCarrotDist = dist
          bestCarrotDot = dot
          bestCarrot = carrot
        }
      }
    }

    const truckDist = Math.hypot(world.depositPoint.x - player.pos.x, world.depositPoint.z - player.pos.z)
    if (truckDist < 3.5 && heldTrash.length > 0) {
      return { type: 'deposit', label: `${heldTrash.length} Müllteile am Laster abladen`, verb: 'Abladen' }
    }

    const bunny = world.bunny
    if (bunny) {
      const bunnyDist = Math.hypot(bunny.group.position.x - player.pos.x, bunny.group.position.z - player.pos.z)
      if (bunnyDist < 2.9 && state.carrots > 0) {
        return { type: 'feed', label: 'Max mit einer Karotte füttern', verb: 'Füttern' }
      }
      if (bunnyDist < 2.9 && state.carrots === 0 && !bestTrash && !bestCarrot) {
        return { type: 'maxHungry', label: 'Max hat Hunger – finde eine Karotte', verb: 'Max' }
      }
    }

    const trashScore = bestTrashDist - bestTrashDot * 0.9
    const carrotScore = bestCarrotDist - bestCarrotDot * 0.9
    const carrotFirst = bestCarrot && (!bestTrash || carrotScore <= trashScore)

    if (carrotFirst) {
      return { type: 'carrot', item: bestCarrot, label: 'Karotte aufheben', verb: 'Aufheben' }
    }

    if (bestTrash) {
      if (state.bag >= MAX_BAG) {
        return { type: 'bagfull', item: bestTrash, label: 'Tüte voll – erst am Laster abladen', verb: 'Voll' }
      }
      return { type: 'trash', item: bestTrash, label: `${bestTrash.name} aufheben`, verb: 'Nehmen' }
    }

    if (bestCarrot) {
      return { type: 'carrot', item: bestCarrot, label: 'Karotte aufheben', verb: 'Aufheben' }
    }

    return null
  }

  function refreshInteraction() {
    if (!state.active || isWinLocked()) {
      state.interaction = null
      hud.setPrompt(null)
      hud.setActionLabel('Nehmen')
      return
    }
    const action = findInteraction()
    state.interaction = action
    if (!action) {
      hud.setPrompt(null)
      hud.setActionLabel('Nehmen')
      return
    }
    hud.setPrompt(action.label)
    hud.setActionLabel(action.verb)
  }

  /* ------------------------------------------------------------
     actions
     ------------------------------------------------------------ */
  function interact() {
    if (!state.active || isWinLocked()) return
    const action = state.interaction || findInteraction()
    if (!action) return

    if (action.type === 'deposit') {
      const count = heldTrash.length
      if (!count) {
        hud.toast('Nichts zum Abladen in der Tüte.', 'warn')
        return
      }
      let points = 0
      for (const item of heldTrash.slice()) {
        points += depositItem(item, false)
      }
      heldTrash.length = 0
      state.bag = 0
      hud.setBag(state.bag, MAX_BAG)
      addScore(5 * count)
      points += 5 * count
      audio.deposit()
      hud.toast(`${count} Müllteile entsorgt · +${points}`, 'good', 2400)
      hud.feed(`${count} Müllteile abgeladen +${points}`, 'good')
      effects.burst(tmpVec.set(world.depositPoint.x, 1.4, world.depositPoint.z), 0xa8efb0, 18, { speed: 2.6, up: 2.2, size: 0.15, life: 0.9 })
      refreshInteraction()
      checkWin()
      return
    }

    if (action.type === 'bagfull') {
      audio.deny()
      hud.toast('Tüte voll! Bring den Müll zum Laster.', 'warn')
      return
    }

    if (action.type === 'maxHungry') {
      audio.deny()
      hud.toast('Max will eine Karotte. Such eine im Garten!', 'warn')
      return
    }

    if (action.type === 'trash') {
      const item = action.item
      if (state.bag >= MAX_BAG) {
        audio.deny()
        hud.toast('Tüte voll!', 'warn')
        return
      }
      item.state = 'held'
      item.group.visible = false
      item.ring.visible = false
      item.icon.visible = false
      item.near = false
      heldTrash.push(item)
      state.bag++
      addScore(10)
      hud.setBag(state.bag, MAX_BAG)
      audio.pickup()
      effects.comicPop('+10', tmpVec.copy(item.group.position).setY(0.9), { color: '#fff7e3', size: 19, rot: -4 })
      if (!state.firstPickup) {
        state.firstPickup = true
        hud.toast('Gut! Bring den Müll zum Laster – oder wirf ihn auf Nachbarn.', '', 3600)
        hud.feed('Tipp: Am Müll-Laster hinten alles abladen.', '')
      }
      refreshInteraction()
      return
    }

    if (action.type === 'carrot') {
      const carrot = action.item
      carrot.state = 'held'
      carrot.group.visible = false
      carrot.respawn = 28
      state.carrots++
      addScore(15)
      hud.setCarrots(state.carrots)
      audio.pickup()
      hud.feed('Karotte gefunden · +15', 'good')
      hud.toast('Karotte! Max wird sich freuen.', 'good', 1800)
      effects.burst(tmpVec.copy(carrot.group.position).setY(0.6), 0x9ef28a, 10, { speed: 1.4, up: 1.6, size: 0.1, life: 0.8 })
      refreshInteraction()
      return
    }

    if (action.type === 'feed') {
      const bunny = world.bunny
      if (state.carrots <= 0) {
        hud.toast('Keine Karotte in der Tasche.', 'warn')
        return
      }
      state.carrots--
      state.fed++
      addScore(200)
      hud.setCarrots(state.carrots)
      bunny.follow = 42
      bunny.happy = 5
      bunny.state = 'follow'
      bunny.target.set(player.pos.x, 0, player.pos.z)
      audio.bunny()
      effects.hearts(tmpVec.copy(bunny.group.position).setY(0.9), 12)
      effects.comicPop('MAX ♥', tmpVec.copy(bunny.group.position).setY(1.6), { color: '#ffc2d3', size: 27, rot: -5 })
      hud.toast('Max mag dich. Sehr.', 'good', 2100)
      hud.feed('Max gefüttert +200 · Er hoppelt hinterher', 'good')
      if (!state.firstFeed) {
        state.firstFeed = true
        hud.feed('Max folgt dir jetzt eine Weile. Süß.', 'good')
      }
      refreshInteraction()
    }
  }

  /* ------------------------------------------------------------
     throwing
     ------------------------------------------------------------ */
  function throwTrash(power = 1) {
    if (!state.active || isWinLocked()) return false
    if (heldTrash.length === 0) {
      audio.deny()
      hud.toast('Deine Tüte ist leer! Sammle erst Müll.', 'warn')
      return false
    }
    const item = heldTrash.pop()
    state.bag = Math.max(0, state.bag - 1)
    hud.setBag(state.bag, MAX_BAG)

    camDir.set(0, 0, -1).applyEuler(new THREE.Euler(player.pitch, player.yaw, 0, 'YXZ'))
    const speed = 13 + power * 11
    item.state = 'flying'
    item.group.visible = true
    item.group.position.copy(camera.position).addScaledVector(camDir, 0.65)
    item.group.position.y -= 0.08
    item.group.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3)
    item.vel.copy(camDir).multiplyScalar(speed)
    item.vel.y += 1.4 + power * 1.4
    item.spin.set((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14)
    item.hitNpcs = item.hitNpcs || new Set()
    item.hitNpcs.clear()
    item.hitBatman = false
    item.collectCool = 0
    item.ring.visible = false
    item.icon.visible = false
    audio.throw()
    refreshInteraction()
    return true
  }

  function landItem(item) {
    item.state = 'ground'
    item.vel.set(0, 0, 0)
    item.collectCool = 0.35
    item.group.position.y = 0.02
    item.group.rotation.x = 0
    item.group.rotation.z = 0
    item.group.rotation.y = Math.random() * Math.PI * 2
    resolveLitter(item.group.position)
    effects.dust(tmpVec.copy(item.group.position).setY(0.1), 7)
  }

  function resolveLitter(pos) {
    pos.x = clamp(pos.x, world.bounds.minX + 1, world.bounds.maxX - 1)
    pos.z = clamp(pos.z, world.bounds.minZ + 1, world.bounds.maxZ - 1)
    const r = 0.28
    for (const c of world.colliders) {
      if (pos.x > c.minX - r && pos.x < c.maxX + r && pos.z > c.minZ - r && pos.z < c.maxZ + r) {
        const dx1 = pos.x - (c.minX - r)
        const dx2 = c.maxX + r - pos.x
        const dz1 = pos.z - (c.minZ - r)
        const dz2 = c.maxZ + r - pos.z
        const min = Math.min(dx1, dx2, dz1, dz2)
        if (min === dx1) pos.x = c.minX - r
        else if (min === dx2) pos.x = c.maxX + r
        else if (min === dz1) pos.z = c.minZ - r
        else pos.z = c.maxZ + r
      }
    }
  }

  function hitNPC(item, npc, point) {
    item.hitNpcs.add(npc.id)
    npc.state = 'flee'
    npc.stateT = 1.05
    npc.fleeX = npc.group.position.x - player.pos.x
    npc.fleeZ = npc.group.position.z - player.pos.z
    const len = Math.hypot(npc.fleeX, npc.fleeZ) || 1
    npc.fleeX /= len
    npc.fleeZ /= len
    npc.bubbleT = 1.9
    setSpeech(npc.speech, pick(BUBBLE_LINES), '#b23a2e')
    npc.speech.scale.set(2.1, 0.72, 1)

    state.combo = state.comboTimer > 0 ? state.combo + 1 : 1
    state.comboTimer = 4.6
    const multiplier = Math.min(5, state.combo)
    const points = 150 * multiplier
    state.bonks++
    addScore(points)
    audio.splat()
    audio.scream()
    effects.splat(point)
    effects.comicPop(`${pick(COMIC_WORDS)} +${points}`, tmpVec.copy(point).add(tmpVec2.set(0, 0.5, 0)), { color: '#ffcf4a', size: 28, rot: -5 })
    if (multiplier > 1) effects.comicPop(`x${multiplier}`, tmpVec.copy(point).add(tmpVec2.set(0, 1.1, 0)), { color: '#ff9ab5', size: 22, rot: 7 })
    hud.feed(`Nachbar getroffen +${points}${multiplier > 1 ? ` · x${multiplier}` : ''}`, 'hot')

    item.vel.multiplyScalar(0.34)
    item.vel.y = 2.2
    item.spin.set((Math.random() - 0.5) * 9, (Math.random() - 0.5) * 9, (Math.random() - 0.5) * 9)

    if (!state.firstHit) {
      state.firstHit = true
      hud.toast('Er rennt weg … und fliegt gleich zu Batman!', '', 3800)
      hud.feed('Tipp: Getroffene Nachbarn fliegen zu Batman und tacklen ihn.', '')
    }
    refreshInteraction()
  }

  function hitBatman(item, point) {
    item.hitBatman = true
    addScore(120)
    const batman = world.batman
    batman.hitFlash = 1
    batman.stun = Math.max(batman.stun, 1.15)
    batman.bubbleT = 2.2
    setSpeech(batman.speech, pick(BATMAN_LINES), '#b23a2e')
    audio.batman()
    audio.splat()
    effects.splat(point)
    effects.comicPop('BATMAN BESCHMUTZT +120', tmpVec.copy(point).setY(point.y + 1.4), { color: '#c9d7ff', size: 24, rot: 3 })
    hud.feed('Batman direkt getroffen +120', 'hot')
    item.vel.multiplyScalar(0.3)
    item.vel.y = 1.8
  }

  function tackleBatman(npc) {
    const batman = world.batman
    npc.state = 'gone'
    npc.group.visible = false
    npc.speech.visible = false
    npc.respawnT = 6 + Math.random() * 7
    state.tackles++
    addScore(500)
    state.shake = 0.55
    batman.stun = 2.7
    batman.hitFlash = 1
    batman.bubbleT = 2.8
    setSpeech(batman.speech, pick(BATMAN_LINES), '#b23a2e')
    audio.tackle()
    audio.batman()

    const bp = batman.group.position.clone()
    bp.y += 2.3
    effects.stars(bp)
    effects.shockwave(bp)
    effects.impactText(pick(TACKLE_WORDS), bp.clone().add(tmpVec.set(0, 0.8, 0)), '#ffcf4a', 1.4)
    effects.comicPop('BATMAN-TACKLE! +500', bp.clone().add(tmpVec.set(0, 0.2, 0)), { color: '#ffcf4a', size: 40, rot: -3 })
    hud.feed('Batman-Tackle +500 · Die Nachbarschaft wehrt sich', 'good')
    if (!state.firstTackle) {
      state.firstTackle = true
      hud.banner('BATMAN-TACKLE!', '+500 · Ein fliegender Nachbar, ein müder Batman')
    } else {
      hud.toast('Batman-Tackle! +500', 'good', 1800)
    }
    refreshInteraction()
  }

  /* ------------------------------------------------------------
     NPC simulation
     ------------------------------------------------------------ */
  function startLaunch(npc) {
    npc.state = 'launch'
    npc.stateT = 0
    npc.launch = { t: 0, dur: 2.15, start: npc.group.position.clone() }
    npc.bubbleT = 1.2
    setSpeech(npc.speech, 'MAMA!', '#b23a2e')
    npc.speech.scale.set(2.0, 0.7, 1)
    npc.group.rotation.x = 0
    npc.group.rotation.z = 0
    effects.dust(tmpVec.copy(npc.group.position).setY(0.05), 9)
    audio.scream()
  }

  function respawnNPC(npc) {
    npc.state = 'walk'
    npc.stateT = 0
    npc.bubbleT = 0
    npc.speech.visible = false
    npc.group.visible = true
    npc.group.rotation.set(0, npc.dir > 0 ? 0 : Math.PI, 0)
    npc.dir = Math.random() < 0.5 ? 1 : -1
    npc.speed = 1.1 + Math.random() * 0.6
    npc.phase = Math.random() * Math.PI * 2
    let z = player.pos.z + (Math.random() < 0.5 ? -1 : 1) * (18 + Math.random() * 26)
    z = clamp(z, -44, 44)
    npc.z = z
    npc.group.position.set(npc.side * 6.4, 0, z)
  }

  function updateNPCs(dt, time, active) {
    for (const npc of world.npcs) {
      if (npc.bubbleT > 0) {
        npc.bubbleT -= dt
        if (npc.bubbleT <= 0) npc.speech.visible = false
      }

      if (npc.state === 'gone') {
        npc.respawnT -= dt
        if (npc.respawnT <= 0) respawnNPC(npc)
        continue
      }

      if (npc.state === 'walk') {
        npc.z += npc.dir * npc.speed * dt
        if (npc.z > 45) {
          npc.z = 45
          npc.dir = -1
        } else if (npc.z < -45) {
          npc.z = -45
          npc.dir = 1
        }
        npc.group.position.x = npc.side * 6.4
        npc.group.position.z = npc.z
        npc.group.rotation.y = npc.dir > 0 ? 0 : Math.PI
        updatePersonAnim(npc, dt, npc.speed, 'walk')
        continue
      }

      if (!active) {
        updatePersonAnim(npc, dt, 0, 'idle')
        continue
      }

      if (npc.state === 'flee') {
        npc.stateT -= dt
        npc.group.position.x += npc.fleeX * 4.2 * dt
        npc.group.position.z += npc.fleeZ * 4.2 * dt
        npc.group.position.x = clamp(npc.group.position.x, -8.4, 8.4)
        npc.group.position.z = clamp(npc.group.position.z, -50, 50)
        npc.group.rotation.y = Math.atan2(npc.fleeX, npc.fleeZ)
        updatePersonAnim(npc, dt, 4.2, 'panic')
        if (npc.stateT <= 0) startLaunch(npc)
        continue
      }

      if (npc.state === 'launch') {
        npc.launch.t += dt
        const k = clamp(npc.launch.t / npc.launch.dur, 0, 1)
        const target = tmpVec.copy(world.batman.group.position)
        target.y += 2.2
        const ease = k * k
        npc.group.position.lerpVectors(npc.launch.start, target, ease)
        npc.group.position.y += Math.sin(Math.PI * k) * 4.5
        npc.group.rotation.y += dt * 7.5
        npc.group.rotation.x = Math.sin(k * Math.PI * 3) * 0.4
        updatePersonAnim(npc, dt, 6, 'launch')
        if (k >= 1 || npc.group.position.distanceTo(target) < 1.35) {
          tackleBatman(npc)
        }
        continue
      }
    }
  }

  /* ------------------------------------------------------------
     projectiles
     ------------------------------------------------------------ */
  function updateProjectiles(dt) {
    const batman = world.batman
    for (const item of world.trashItems) {
      if (item.collectCool > 0) item.collectCool -= dt
      if (item.state !== 'flying') continue

      item.vel.y -= 19 * dt
      item.group.position.addScaledVector(item.vel, dt)
      item.group.rotation.x += item.spin.x * dt
      item.group.rotation.y += item.spin.y * dt
      item.group.rotation.z += item.spin.z * dt
      const pos = item.group.position
      const hitPoint = tmpVec.copy(pos)
      hitPoint.y += 0.2

      // citizens
      for (const npc of world.npcs) {
        if (npc.state === 'gone' || npc.state === 'launch') continue
        if (item.hitNpcs.has(npc.id)) continue
        center.set(npc.group.position.x, npc.group.position.y + 1.1, npc.group.position.z)
        if (hitPoint.distanceTo(center) < 0.82) {
          hitNPC(item, npc, hitPoint.clone())
          break
        }
      }

      // Batman himself
      if (!item.hitBatman) {
        center.copy(batman.group.position)
        center.y += 2.2
        if (hitPoint.distanceTo(center) < 1.2) hitBatman(item, hitPoint.clone())
      }

      // thrown straight into the truck's hopper
      if (Math.abs(pos.x) < 1.5 && pos.z > 42.7 && pos.z < 44.4 && pos.y > 1.0 && pos.y < 4.2) {
        depositItem(item, true)
        audio.deposit()
        effects.burst(tmpVec.copy(pos), 0xa8efb0, 14, { speed: 2.2, up: 2, size: 0.15, life: 0.8 })
        hud.toast('Slam-Dunk in den Laster! +90', 'good', 1900)
        hud.feed('Müll direkt in den Laster geworfen +90', 'good')
        refreshInteraction()
        checkWin()
        continue
      }

      if (pos.y <= 0.06) {
        landItem(item)
      }
    }
  }

  /* ------------------------------------------------------------
     carrots & bunny housekeeping
     ------------------------------------------------------------ */
  function updateCarrots(dt) {
    for (const carrot of world.carrots) {
      if (carrot.state === 'held') {
        carrot.respawn -= dt
        if (carrot.respawn <= 0) {
          carrot.state = 'ground'
          carrot.group.visible = true
          carrot.group.position.y = 0.18
          if (Math.abs(carrot.group.position.x - player.pos.x) < 18 && Math.abs(carrot.group.position.z - player.pos.z) < 18) {
            effects.burst(tmpVec.copy(carrot.group.position).setY(0.3), 0x9ef28a, 8, { speed: 1, up: 1.4, size: 0.09, life: 0.7 })
          }
        }
      }
    }
    if (world.batman.bubbleT > 0) {
      world.batman.bubbleT -= dt
      if (world.batman.bubbleT <= 0) world.batman.speech.visible = false
    }
  }

  /* ------------------------------------------------------------
     main update
     ------------------------------------------------------------ */
  function update(dt, time, active) {
    state.active = active
    if (state.comboTimer > 0) {
      state.comboTimer -= dt
      if (state.comboTimer <= 0) state.combo = 0
    }
    updateNPCs(dt, time, active)
    if (active) {
      updateProjectiles(dt)
      updateCarrots(dt)
      refreshInteraction()
    } else {
      updateCarrots(dt)
      hud.setPrompt(null)
    }

    if (state.winPending && !state.won) {
      state.winTimer -= dt
      if (state.winTimer <= 0) {
        state.won = true
        state.active = false
        hud.setPrompt(null)
        onWin(stats())
      }
    }
  }

  /* ------------------------------------------------------------
     debug helpers (also used by automated visual checks)
     ------------------------------------------------------------ */
  function debugDepositAll() {
    for (const item of world.trashItems) {
      if (item.state === 'deposited') continue
      item.state = 'deposited'
      item.group.visible = false
      item.ring.visible = false
      item.icon.visible = false
    }
    for (const house of world.houses) house.cleared = true
    state.cleaned = world.totalTrash
    state.housesCleared = world.houses.length
    state.score += world.totalTrash * 35 + world.houses.length * 250
    state.bag = 0
    heldTrash.length = 0
    hud.setBag(0, MAX_BAG)
    hud.setScore(state.score)
    updateProgress()
    checkWin()
  }

  function debugFeed() {
    state.carrots++
    hud.setCarrots(state.carrots)
    state.fed++
    addScore(200)
    world.bunny.follow = 40
    world.bunny.happy = 5
    effects.hearts(tmpVec.copy(world.bunny.group.position).setY(0.9), 10)
    hud.feed('Max gefüttert +200', 'good')
  }

  return {
    state,
    stats,
    update,
    interact,
    throwTrash,
    refreshInteraction,
    isWinLocked,
    heldTrash,
    debug: {
      depositAll: debugDepositAll,
      feed: debugFeed,
    },
  }
}
