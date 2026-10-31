/* HUD, minimap, toasts and overlays. */
export function createHud(world, audio) {
  const $ = (id) => document.getElementById(id)
  const el = {
    hud: $('hud'),
    start: $('startScreen'),
    startBtn: $('startBtn'),
    pause: $('pauseScreen'),
    pauseBtn: $('pauseBtn'),
    resumeBtn: $('resumeBtn'),
    pauseRestartBtn: $('pauseRestartBtn'),
    win: $('winScreen'),
    restartBtn: $('restartBtn'),
    winScore: $('winScore'),
    winTrash: $('winTrash'),
    winBonks: $('winBonks'),
    winTackles: $('winTackles'),
    winCarrots: $('winCarrots'),
    winLine: $('winLine'),
    score: $('score'),
    bag: $('bag'),
    carrots: $('carrots'),
    progressFill: $('progressFill'),
    progressText: $('progressText'),
    houseText: $('houseText'),
    objectiveCard: $('objectiveCard'),
    toast: $('toast'),
    banner: $('banner'),
    prompt: $('prompt'),
    promptText: $('promptText'),
    chargeRing: $('chargeRing'),
    crosshair: $('crosshair'),
    feed: $('eventFeed'),
    muteBtn: $('muteBtn'),
    minimap: $('minimap'),
    comicLayer: $('comicLayer'),
    touchUI: $('touchUI'),
    stickZone: $('stickZone'),
    stickBase: $('stickBase'),
    stickKnob: $('stickKnob'),
    actionBtn: $('actionBtn'),
    actionLabel: document.querySelector('#actionBtn small'),
    throwBtn: $('throwBtn'),
    desktopHints: $('desktopHints'),
    mobileHint: $('mobileHint'),
    rotateNotice: $('rotateNotice'),
    totalTrash: world.totalTrash,
  }
  const miniCtx = el.minimap.getContext('2d')
  let toastTimer = 0
  let bannerTimer = 0
  let feedItems = 0

  function setScore(value) {
    el.score.textContent = String(Math.round(value))
    el.score.animate?.(
      [{ transform: 'scale(1.22)', color: '#e0771d' }, { transform: 'scale(1)', color: '#b25c12' }],
      { duration: 220, easing: 'ease-out' }
    )
  }

  function setBag(count, max = 10) {
    el.bag.textContent = `${count}/${max}`
    el.bag.parentElement.classList.toggle('full', count >= max)
  }

  function setCarrots(count) {
    el.carrots.textContent = String(count)
  }

  function setProgress(cleaned, housesCleared) {
    const pct = Math.min(100, (cleaned / el.totalTrash) * 100)
    el.progressFill.style.width = `${pct}%`
    el.progressText.textContent = `${cleaned} / ${el.totalTrash} Müllteile`
    el.houseText.textContent = `${housesCleared} / ${world.houses.length} Häuser`
  }

  function toast(text, kind = '', ms = 2300) {
    el.toast.textContent = text
    el.toast.className = `toast show ${kind}`.trim()
    window.clearTimeout(toastTimer)
    toastTimer = window.setTimeout(() => {
      el.toast.className = `toast ${kind}`.trim()
    }, ms)
  }

  function banner(main, sub = '', ms = 2100) {
    el.banner.innerHTML = `${main}${sub ? `<small>${sub}</small>` : ''}`
    el.banner.classList.add('show')
    window.clearTimeout(bannerTimer)
    bannerTimer = window.setTimeout(() => el.banner.classList.remove('show'), ms)
  }

  function feed(text, kind = '') {
    const item = document.createElement('div')
    item.className = `feed-item ${kind}`.trim()
    item.textContent = text
    el.feed.appendChild(item)
    feedItems++
    while (feedItems > 4) {
      el.feed.firstElementChild?.remove()
      feedItems--
    }
    window.setTimeout(() => {
      if (item.parentElement) {
        item.remove()
        feedItems = Math.max(0, feedItems - 1)
      }
    }, 4100)
  }

  function setPrompt(text) {
    if (!text) {
      el.prompt.classList.remove('show')
      return
    }
    el.promptText.textContent = text
    el.prompt.classList.add('show')
  }

  function setActionLabel(text) {
    el.actionLabel.textContent = text
  }

  function setCharge(t) {
    if (t <= 0) {
      el.chargeRing.style.opacity = '0'
      el.crosshair.style.transform = 'scale(1)'
      return
    }
    el.chargeRing.style.opacity = '1'
    el.chargeRing.style.transform = `scale(${0.35 + t * 1.5}) rotate(${t * 180}deg)`
    el.crosshair.style.transform = `scale(${1 + t * 0.18})`
  }

  function showStart() {
    el.start.classList.remove('hidden', 'leaving')
  }

  function hideStart() {
    el.start.classList.add('leaving')
    window.setTimeout(() => el.start.classList.add('hidden'), 460)
    el.hud.classList.remove('hidden')
    if (document.body.classList.contains('is-touch')) {
      el.touchUI.classList.remove('hidden')
      el.desktopHints.classList.add('hidden')
      el.mobileHint.classList.remove('hidden')
    }
  }

  function showPause() {
    el.pause.classList.remove('hidden')
  }

  function hidePause() {
    el.pause.classList.add('hidden')
  }

  function showWin(stats) {
    el.hud.classList.add('hidden')
    el.touchUI.classList.add('hidden')
    el.win.classList.remove('hidden')
    el.winScore.textContent = String(Math.round(stats.score))
    el.winTrash.textContent = `${stats.cleaned}`
    el.winBonks.textContent = `${stats.bonks}`
    el.winTackles.textContent = `${stats.tackles}`
    el.winCarrots.textContent = `${stats.fed}`
    el.winLine.textContent = stats.fed > 0
      ? 'Kein Krümel, kein Krümelchen. Max ist satt und Batman hat endlich seine Ruhe.'
      : 'Kein Krümel, kein Krümelchen. Sogar Batman ist stolz – auch ohne Karotte.'
  }

  function setMuted(muted) {
    el.muteBtn.textContent = muted ? '🔇' : '🔊'
    el.muteBtn.classList.toggle('muted', muted)
  }

  function renderMinimap(player) {
    const W = el.minimap.width
    const H = el.minimap.height
    const ctx = miniCtx
    const pad = 9
    const scale = Math.min((W - pad * 2) / 64, (H - pad * 2) / 112)
    const cx = W / 2
    const cy = H / 2
    const px = (x) => cx + x * scale
    const py = (z) => cy + z * scale
    ctx.clearRect(0, 0, W, H)

    const bg = ctx.createRadialGradient(W * 0.4, H * 0.3, 10, W / 2, H / 2, W * 0.72)
    bg.addColorStop(0, '#fff8e4')
    bg.addColorStop(1, '#efdfb8')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, W, H)

    // lawns
    ctx.fillStyle = 'rgba(141, 174, 92, 0.28)'
    ctx.fillRect(0, 0, W, H)

    // road
    ctx.fillStyle = '#6f6a5e'
    ctx.fillRect(px(-5.3), py(-53), 10.6 * scale, 106 * scale)
    ctx.fillStyle = 'rgba(255, 247, 227, 0.5)'
    ctx.fillRect(px(-5.3), py(-53), 0.4 * scale, 106 * scale)
    ctx.fillRect(px(4.9), py(-53), 0.4 * scale, 106 * scale)

    // sidewalks
    ctx.fillStyle = '#d8ceba'
    ctx.fillRect(px(-8.3), py(-53), 3.0 * scale, 106 * scale)
    ctx.fillRect(px(5.3), py(-53), 3.0 * scale, 106 * scale)

    // center dashes
    ctx.strokeStyle = 'rgba(255, 232, 170, 0.7)'
    ctx.lineWidth = 1
    ctx.setLineDash([3, 4])
    ctx.beginPath()
    ctx.moveTo(px(0), py(-50))
    ctx.lineTo(px(0), py(50))
    ctx.stroke()
    ctx.setLineDash([])

    // houses
    for (const house of world.houses) {
      const x = px(house.x - 4.4)
      const y = py(house.z - 3.8)
      const w = 8.8 * scale
      const h = 7.6 * scale
      ctx.fillStyle = house.cleared ? '#7cc78a' : '#d9c49a'
      ctx.strokeStyle = '#3a352a'
      ctx.lineWidth = 1.2
      ctx.fillRect(x, y, w, h)
      ctx.strokeRect(x, y, w, h)
      if (house.cleared) {
        ctx.fillStyle = '#256b3e'
        ctx.font = '900 7px "Trebuchet MS", sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText('✓', x + w / 2, y + h / 2 + 2.5)
      }
    }

    // truck
    ctx.fillStyle = '#2f7a55'
    ctx.strokeStyle = '#211f19'
    ctx.lineWidth = 1.2
    ctx.fillRect(px(-1.9), py(43.3), 3.8 * scale, 9.9 * scale)
    ctx.strokeRect(px(-1.9), py(43.3), 3.8 * scale, 9.9 * scale)
    ctx.fillStyle = '#ffcf4a'
    ctx.beginPath()
    ctx.arc(px(0), py(42.6), 2.2, 0, Math.PI * 2)
    ctx.fill()

    // trash + carrots
    for (const item of world.trashItems) {
      if (item.state !== 'ground') continue
      ctx.fillStyle = '#e89b26'
      ctx.beginPath()
      ctx.arc(px(item.group.position.x), py(item.group.position.z), 1.6, 0, Math.PI * 2)
      ctx.fill()
    }
    for (const carrot of world.carrots) {
      if (carrot.state !== 'ground') continue
      ctx.fillStyle = '#ff8b2e'
      ctx.strokeStyle = '#257047'
      ctx.lineWidth = 0.8
      ctx.beginPath()
      ctx.arc(px(carrot.group.position.x), py(carrot.group.position.z), 1.5, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
    }

    // bunny
    if (world.bunny) {
      ctx.fillStyle = '#ff9ab5'
      ctx.strokeStyle = '#211f19'
      ctx.lineWidth = 0.9
      ctx.beginPath()
      ctx.arc(px(world.bunny.group.position.x), py(world.bunny.group.position.z), 2.6, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
    }

    // citizens
    for (const npc of world.npcs) {
      if (npc.state === 'gone') continue
      ctx.fillStyle = '#d8492f'
      ctx.beginPath()
      ctx.arc(px(npc.group.position.x), py(npc.group.position.z), 2.2, 0, Math.PI * 2)
      ctx.fill()
    }

    // player arrow
    ctx.save()
    ctx.translate(px(player.pos.x), py(player.pos.z))
    ctx.rotate(-player.yaw)
    ctx.beginPath()
    ctx.moveTo(0, -6)
    ctx.lineTo(4.8, 5)
    ctx.lineTo(0, 2.6)
    ctx.lineTo(-4.8, 5)
    ctx.closePath()
    ctx.fillStyle = '#ffcf4a'
    ctx.strokeStyle = '#211f19'
    ctx.lineWidth = 1.6
    ctx.fill()
    ctx.stroke()
    ctx.restore()

    // fading edge
    const edge = ctx.createRadialGradient(W / 2, H / 2, W * 0.32, W / 2, H / 2, W * 0.54)
    edge.addColorStop(0, 'rgba(0,0,0,0)')
    edge.addColorStop(1, 'rgba(80, 60, 30, 0.18)')
    ctx.fillStyle = edge
    ctx.fillRect(0, 0, W, H)
  }

  return {
    el,
    setScore,
    setBag,
    setCarrots,
    setProgress,
    toast,
    banner,
    feed,
    setPrompt,
    setActionLabel,
    setCharge,
    showStart,
    hideStart,
    showPause,
    hidePause,
    showWin,
    setMuted,
    renderMinimap,
  }
}
