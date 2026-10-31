// Dude Theft Wars landing page — navigation, wanted-level demo, small niceties.
(() => {
  const toggle = document.querySelector('.nav-toggle')
  const nav = document.getElementById('site-nav')

  if (toggle && nav) {
    const setOpen = (open) => {
      nav.classList.toggle('open', open)
      toggle.setAttribute('aria-expanded', String(open))
    }
    toggle.addEventListener('click', () => setOpen(!nav.classList.contains('open')))
    nav.addEventListener('click', (event) => {
      if (event.target.closest('a')) setOpen(false)
    })
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') setOpen(false)
    })
  }

  const levels = {
    1: { charge: 'Jaywalking', text: 'A single patrol car slows down to look at you. Barely a crime, really.' },
    2: { charge: 'Property damage', text: 'Two units are tailing you and the radio is getting chatty.' },
    3: { charge: 'Grand theft auto', text: 'Roadblocks, patrol cars and a chopper overhead. Time to find a side street.' },
    4: { charge: 'Armed robbery', text: 'Snipers take the rooftops while armoured units close in from both ends of the block.' },
    5: { charge: 'Full manhunt', text: 'Five stars. Every unit in the city, a sniper on every roof. Lose them or pay the fine.' },
  }

  const stars = Array.from(document.querySelectorAll('.star'))
  const number = document.getElementById('wanted-number')
  const text = document.getElementById('wanted-text')
  const charge = document.getElementById('wanted-charge')

  const setLevel = (level) => {
    const entry = levels[level]
    if (!entry) return
    stars.forEach((star) => {
      star.setAttribute('aria-pressed', String(Number(star.dataset.level) <= level))
    })
    if (number) number.textContent = String(level)
    if (text) text.textContent = entry.text
    if (charge) charge.textContent = entry.charge
  }

  stars.forEach((star) => {
    star.addEventListener('click', () => setLevel(Number(star.dataset.level)))
  })

  setLevel(3)

  // Hero art reacts subtly to pointer movement on large screens.
  const scene = document.querySelector('.scene')
  if (scene && window.matchMedia('(hover: hover) and (prefers-reduced-motion: no-preference)').matches) {
    const hero = scene.closest('.hero')
    hero?.addEventListener('pointermove', (event) => {
      const rect = scene.getBoundingClientRect()
      const dx = (event.clientX - (rect.left + rect.width / 2)) / rect.width
      const dy = (event.clientY - (rect.top + rect.height / 2)) / rect.height
      scene.style.transform = `rotate(${(dx * 2).toFixed(2)}deg) translate(${(dx * 6).toFixed(1)}px, ${(dy * 6).toFixed(1)}px)`
    })
    hero?.addEventListener('pointerleave', () => { scene.style.transform = '' })
  }

  // Mark the page as rendered for capture tooling.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => document.documentElement.setAttribute('data-rendered', 'true'))
  })
})()
