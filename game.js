/* ==========================================================================
   Hasen-Hoppel — game logic
   ========================================================================== */
(function () {
  'use strict';

  const CAP = 3;
  const STORAGE_KEY = 'hasen-hoppel-v1';
  const LEVELS = window.LEVELS || [];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const $ = (selector) => document.querySelector(selector);
  const boardEl = $('#board');
  const statusEl = $('#status');
  const movesEl = $('#movesCount');
  const movesPill = document.querySelector('.moves-pill');
  const levelKicker = $('#levelKicker');
  const levelNameEl = $('#levelName');
  const levelsBtn = $('#levelsBtn');
  const helpBtn = $('#helpBtn');
  const hintBtn = $('#hintBtn');
  const undoBtn = $('#undoBtn');
  const restartBtn = $('#restartBtn');
  const soundBtn = $('#soundBtn');
  const introOverlay = $('#introOverlay');
  const levelsOverlay = $('#levelsOverlay');
  const winOverlay = $('#winOverlay');
  const levelGrid = $('#levelGrid');
  const introTitle = $('#introTitle');
  const introProgress = $('#introProgress');
  const startBtn = $('#startBtn');
  const introLevelsBtn = $('#introLevelsBtn');
  const closeLevelsBtn = $('#closeLevelsBtn');
  const nextBtn = $('#nextBtn');
  const replayBtn = $('#replayBtn');
  const winLevelsBtn = $('#winLevelsBtn');
  const winKicker = $('#winKicker');
  const winStars = $('#winStars');
  const winText = $('#winText');
  const winBunnies = $('#winBunnies');
  const heroBunnies = $('#heroBunnies');
  const confettiCanvas = $('#confetti');
  const appEl = $('.app');

  const COLORS = {
    orange: { name: 'Karotte', base: '#ef8b4a', light: '#ffc38f', dark: '#c7612b', inner: '#f3ad9e' },
    pink:   { name: 'Beere',   base: '#e6799c', light: '#ffb6ca', dark: '#bb5074', inner: '#f4b4c2' },
    lilac:  { name: 'Lavendel',base: '#a78bda', light: '#d3c0f2', dark: '#7d61b4', inner: '#d8b9d9' },
    mint:   { name: 'Minze',   base: '#5cbaa2', light: '#a9e5d5', dark: '#378d78', inner: '#b5d9c8' },
    sky:    { name: 'Himmel',  base: '#66a9dd', light: '#b5daf2', dark: '#3d7db5', inner: '#b9d3e8' },
    sun:    { name: 'Sonne',   base: '#ecc84d', light: '#ffeb9d', dark: '#c5a026', inner: '#efcbb0' },
    cream:  { name: 'Sahne',   base: '#efdfc2', light: '#fff9e9', dark: '#c7ae85', inner: '#efbcb8' }
  };

  const PATTERNS = {
    orange: `<circle cx="23" cy="57" r="3.4" fill="#ffd9b6" opacity=".55"/><circle cx="38" cy="51" r="2.6" fill="#ffd9b6" opacity=".5"/><circle cx="43" cy="61" r="2" fill="#ffd9b6" opacity=".45"/>`,
    pink:   `<path d="M31 49.4c-2.6-2.6-5.2-4-5.2-6.2a2.9 2.9 0 0 1 5.2-1.6 2.9 2.9 0 0 1 5.2 1.6c0 2.2-2.6 3.6-5.2 6.2Z" fill="#ffd2df" opacity=".6"/>`,
    lilac:  `<path d="M23 62c3-4 5-9 7-16" fill="none" stroke="#e2d3fb" stroke-width="3.6" stroke-linecap="round" opacity=".5"/><path d="M33 63c2-5 4-9 6-13" fill="none" stroke="#e2d3fb" stroke-width="2.4" stroke-linecap="round" opacity=".45"/>`,
    mint:   `<ellipse cx="23" cy="55" rx="6" ry="4.4" fill="#c5f2e3" opacity=".42" transform="rotate(-18 23 55)"/><ellipse cx="41" cy="58" rx="5" ry="3.6" fill="#c5f2e3" opacity=".38" transform="rotate(14 41 58)"/>`,
    sky:    `<circle cx="24" cy="56" r="3" fill="#dff2ff" opacity=".5"/><circle cx="32" cy="53" r="2.2" fill="#dff2ff" opacity=".45"/><circle cx="39" cy="57" r="3.4" fill="#dff2ff" opacity=".5"/><circle cx="32" cy="61" r="2" fill="#dff2ff" opacity=".4"/>`,
    sun:    `<circle cx="24" cy="56" r="1.3" fill="#fff3bb" opacity=".8"/><circle cx="28" cy="61" r="1.1" fill="#fff3bb" opacity=".75"/><circle cx="37" cy="54" r="1.2" fill="#fff3bb" opacity=".8"/><circle cx="40" cy="61" r="1.4" fill="#fff3bb" opacity=".7"/><circle cx="33" cy="58" r="1" fill="#fff3bb" opacity=".7"/>`,
    cream:  `<ellipse cx="32" cy="62" rx="9" ry="4.2" fill="#fffdf4" opacity=".6"/><path d="M20 57c2.4 1.8 5.6 2.8 12 2.8s9.6-1 12-2.8" fill="none" stroke="#f6ead4" stroke-width="1.8" opacity=".5"/>`
  };

  let rabbitId = 0;
  let hintTimer = 0;
  let winTimer = 0;
  let lastFocused = null;
  let levelsReturn = 'game';
  let audioCtx = null;

  const progress = loadProgress();
  const params = new URLSearchParams(window.location.search);
  const urlLevel = Number.parseInt(params.get('level') || '', 10);
  const noIntro = params.has('nointro');

  const state = {
    levelIndex: 0,
    level: null,
    initial: [],
    hutches: [],
    selected: -1,
    moves: 0,
    history: [],
    win: false,
    hint: null,
    colorCount: 0
  };

  let hutchEls = [];

  /* ------------------------------------------------------------------------
     Persistence
     ------------------------------------------------------------------------ */

  function loadProgress() {
    const fallback = { unlocked: 1, best: {}, lastLevel: 1, sound: true };
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      return {
        unlocked: Math.max(1, Math.min(LEVELS.length || 1, Number(parsed.unlocked) || 1)),
        best: parsed.best && typeof parsed.best === 'object' ? parsed.best : {},
        lastLevel: Math.max(1, Math.min(LEVELS.length || 1, Number(parsed.lastLevel) || 1)),
        sound: parsed.sound !== false
      };
    } catch {
      return fallback;
    }
  }

  function saveProgress() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    } catch {
      /* Private mode or full storage: the game still works for this session. */
    }
  }

  /* ------------------------------------------------------------------------
     Rabbit artwork
     ------------------------------------------------------------------------ */

  function bunnySvg(color, id) {
    const c = COLORS[color] || COLORS.orange;
    const gid = `fur-${id}`;
    const clip = `clip-${id}`;
    return `
      <svg viewBox="0 0 64 70" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id="${gid}" x1="0" y1="0" x2="0.18" y2="1">
            <stop offset="0" stop-color="${c.light}"/>
            <stop offset="0.45" stop-color="${c.base}"/>
            <stop offset="1" stop-color="${c.dark}"/>
          </linearGradient>
          <clipPath id="${clip}">
            <ellipse cx="32" cy="35" rx="18.5" ry="16.5"/>
            <ellipse cx="32" cy="56" rx="20" ry="14"/>
          </clipPath>
        </defs>
        <g>
          <ellipse cx="22.5" cy="15" rx="5.9" ry="15.2" transform="rotate(-8 22.5 15)" fill="url(#${gid})" stroke="${c.dark}" stroke-opacity=".25" stroke-width="1.1"/>
          <ellipse cx="22.5" cy="16.5" rx="3.1" ry="10.2" transform="rotate(-8 22.5 16.5)" fill="${c.inner}" opacity=".7"/>
          <ellipse cx="41.5" cy="14.5" rx="5.9" ry="15.2" transform="rotate(7 41.5 14.5)" fill="url(#${gid})" stroke="${c.dark}" stroke-opacity=".25" stroke-width="1.1"/>
          <ellipse cx="41.5" cy="16" rx="3.1" ry="10.2" transform="rotate(7 41.5 16)" fill="${c.inner}" opacity=".7"/>
        </g>
        <circle cx="52.5" cy="52" r="5.2" fill="${c.light}" stroke="${c.dark}" stroke-opacity=".22" stroke-width="1"/>
        <ellipse cx="21" cy="66.2" rx="7.4" ry="3.5" fill="${c.dark}" opacity=".85"/>
        <ellipse cx="43" cy="66.2" rx="7.4" ry="3.5" fill="${c.dark}" opacity=".85"/>
        <ellipse cx="32" cy="56" rx="20" ry="14" fill="url(#${gid})" stroke="${c.dark}" stroke-opacity=".2" stroke-width="1"/>
        <ellipse cx="32" cy="60" rx="11.5" ry="8" fill="${c.light}" opacity=".34"/>
        <g clip-path="url(#${clip})">${PATTERNS[color] || ''}</g>
        <ellipse cx="32" cy="35" rx="18.5" ry="16.5" fill="url(#${gid})" stroke="${c.dark}" stroke-opacity=".2" stroke-width="1"/>
        <ellipse cx="32" cy="46" rx="8" ry="5.6" fill="${c.light}" opacity=".55"/>
        <g>
          <circle cx="25" cy="34" r="2.45" fill="#3b2a20"/>
          <circle cx="39" cy="34" r="2.45" fill="#3b2a20"/>
          <circle cx="25.8" cy="33.2" r=".8" fill="#fffdf5"/>
          <circle cx="39.8" cy="33.2" r=".8" fill="#fffdf5"/>
          <ellipse cx="20.5" cy="41" rx="3.5" ry="2" fill="#e58b8f" opacity=".28"/>
          <ellipse cx="43.5" cy="41" rx="3.5" ry="2" fill="#e58b8f" opacity=".28"/>
          <path d="M32 40.5c0 1.6-2.6 2.6-2.6 1.1 0-1 1.3-1.7 2.6-2.5 1.3.8 2.6 1.5 2.6 2.5 0 1.5-2.6.5-2.6-1.1Z" fill="#c9677a"/>
          <path d="M32 43.4v.9m0 .9c-.9 1.1-2.2 1.1-3 .3m3-.3c.9 1.1 2.2 1.1 3 .3" fill="none" stroke="#5a4032" stroke-width=".8" stroke-linecap="round" opacity=".8"/>
          <path d="M23 44.5 17.8 46m5.7-2.7-6.2-.2m23.9 1.4 5.2 1.5m-5.7-2.7 6.2-.2" fill="none" stroke="#5a4032" stroke-width=".7" stroke-linecap="round" opacity=".45"/>
        </g>
        <ellipse cx="26.4" cy="55.5" rx="4.2" ry="3.1" fill="${c.light}" opacity=".52" transform="rotate(-12 26.4 55.5)"/>
        <ellipse cx="38.2" cy="55.5" rx="4.2" ry="3.1" fill="${c.light}" opacity=".52" transform="rotate(12 38.2 55.5)"/>
      </svg>`;
  }

  /* ------------------------------------------------------------------------
     Puzzle helpers
     ------------------------------------------------------------------------ */

  function cloneColors(stacks) {
    return stacks.map((stack) => stack.slice());
  }

  function canMove(from, to) {
    if (from === to) return false;
    const src = state.hutches[from];
    const dst = state.hutches[to];
    if (!src || !dst || !src.length || dst.length >= CAP) return false;
    if (!dst.length) return true;
    return dst[dst.length - 1].color === src[src.length - 1].color;
  }

  function hasLegalMove() {
    for (let i = 0; i < state.hutches.length; i++) {
      for (let j = 0; j < state.hutches.length; j++) {
        if (canMove(i, j)) return true;
      }
    }
    return false;
  }

  function isSolved() {
    const seenColors = new Set();
    for (const stack of state.hutches) {
      if (!stack.length) continue;
      if (stack.length !== CAP) return false;
      const color = stack[0].color;
      if (stack.some((rabbit) => rabbit.color !== color)) return false;
      if (seenColors.has(color)) return false;
      seenColors.add(color);
    }
    return seenColors.size === state.colorCount;
  }

  function groupedColorCount() {
    let count = 0;
    if (!state.level) return 0;
    const colors = new Set(state.level.stacks.flat());
    for (const color of colors) {
      const holders = state.hutches.filter((stack) => stack.some((rabbit) => rabbit.color === color));
      if (
        holders.length === 1 &&
        holders[0].length === CAP &&
        holders[0].every((rabbit) => rabbit.color === color)
      ) {
        count++;
      }
    }
    return count;
  }

  /* ------------------------------------------------------------------------
     Hint solver (small, depth-first with a visited set)
     ------------------------------------------------------------------------ */

  function solveFirstMove(colorStacks) {
    const stacks = colorStacks.map((stack) => stack.slice());
    const seen = new Set();
    const path = [];
    let nodes = 0;
    const maxNodes = 160000;

    const canonical = () => stacks.map((stack) => stack.join('')).sort().join('|');

    function solved() {
      const colors = new Set();
      for (const stack of stacks) {
        if (!stack.length) continue;
        if (stack.length !== CAP) return false;
        if (stack.some((color) => color !== stack[0])) return false;
        colors.add(stack[0]);
      }
      return colors.size === colorStacks.reduce((set, stack) => {
        stack.forEach((color) => set.add(color));
        return set;
      }, new Set()).size;
    }

    function dfs() {
      if (++nodes > maxNodes) return false;
      if (solved()) return true;
      const key = canonical();
      if (seen.has(key)) return false;
      seen.add(key);

      const moves = [];
      for (let from = 0; from < stacks.length; from++) {
        const src = stacks[from];
        if (!src.length) continue;
        const color = src[src.length - 1];
        for (let to = 0; to < stacks.length; to++) {
          if (from === to) continue;
          const dst = stacks[to];
          if (dst.length >= CAP) continue;
          if (dst.length && dst[dst.length - 1] !== color) continue;
          if (!dst.length && src.every((c) => c === color)) continue;
          let score = 0;
          if (dst.length && dst[dst.length - 1] === color) score += 30;
          if (!dst.length) score -= 4;
          if (src.length === 1) score += 7;
          if (src.every((c) => c === color)) score -= 8;
          if (dst.length === CAP - 1) score += 9;
          moves.push({ from, to, score });
        }
      }
      moves.sort((a, b) => b.score - a.score);
      for (const move of moves) {
        stacks[move.to].push(stacks[move.from].pop());
        path.push([move.from, move.to]);
        if (dfs()) return true;
        path.pop();
        stacks[move.from].push(stacks[move.to].pop());
      }
      return false;
    }

    if (!dfs() || !path.length) return null;
    return { from: path[0][0], to: path[0][1] };
  }

  /* ------------------------------------------------------------------------
     Board rendering
     ------------------------------------------------------------------------ */

  function bunnyElements() {
    return Array.from(boardEl.querySelectorAll('.bunny-slot'));
  }

  function bunnyRect(id) {
    const el = boardEl.querySelector(`.bunny-slot[data-rabbit="${id}"]`);
    return el ? el.getBoundingClientRect() : null;
  }

  function hutchAria(index) {
    const stack = state.hutches[index];
    const base = stack.length
      ? `Gehege ${index + 1}. ${stack.length} von ${CAP} Plätzen belegt. Oberster Hase: ${COLORS[stack[stack.length - 1].color].name}.`
      : `Gehege ${index + 1}. Leer.`;
    if (index === state.selected) return `${base} Ausgewählt.`;
    if (state.selected >= 0 && canMove(state.selected, index)) return `${base} Der ausgewählte Hase kann hierher hoppeln.`;
    return base;
  }

  function renderBoard(options = {}) {
    const { enter = false, movedId = null, fromRect = null, focusIndex = null } = options;
    const fragment = document.createDocumentFragment();

    state.hutches.forEach((stack, index) => {
      const hutch = document.createElement('button');
      hutch.type = 'button';
      hutch.className = 'hutch';
      hutch.dataset.hutch = String(index);
      hutch.setAttribute('aria-label', hutchAria(index));
      hutch.setAttribute('aria-pressed', 'false');
      if (!stack.length) hutch.classList.add('empty');
      if (enter) hutch.classList.add('enter');

      hutch.innerHTML = `
        <span class="hutch-inner" aria-hidden="true"></span>
        ${!stack.length ? '<span class="empty-hint" aria-hidden="true">frei</span>' : ''}
        ${stack.map((rabbit, slot) => `
          <span class="bunny-slot" data-rabbit="${rabbit.id}" data-top="${slot === stack.length - 1 ? '1' : '0'}" style="--i:${slot};--bottom:${(5 + slot * 30.2).toFixed(1)}%;--delay:${slot * 40}ms;--win-delay:${slot * 70 + 80}ms" aria-hidden="true">
            ${bunnySvg(rabbit.color, rabbit.id)}
          </span>`).join('')}
      `;
      hutch.addEventListener('click', () => onHutchClick(index));
      fragment.appendChild(hutch);
    });

    boardEl.replaceChildren(fragment);
    hutchEls = Array.from(boardEl.querySelectorAll('.hutch'));
    layoutBoard();
    updateSelectionUI();

    if (movedId && fromRect && !reducedMotion) {
      const target = boardEl.querySelector(`.bunny-slot[data-rabbit="${movedId}"]`);
      if (target) {
        const to = target.getBoundingClientRect();
        const dx = fromRect.left - to.left;
        const dy = fromRect.top - to.top;
        const lift = Math.min(48, Math.abs(dy) * 0.18 + 20);
        target.animate(
          [
            { transform: `translate(${dx}px, ${dy}px) scale(1.02)`, offset: 0 },
            { transform: `translate(${dx * 0.52}px, ${dy * 0.52 - lift}px) rotate(${dx > 0 ? 7 : -7}deg) scale(1.06)`, offset: 0.55 },
            { transform: 'translate(0, 0) rotate(0deg) scale(1)', offset: 1 }
          ],
          { duration: 430, easing: 'cubic-bezier(.22,.9,.3,1.06)' }
        );
      }
    }

    if (focusIndex !== null) {
      hutchEls[focusIndex]?.focus({ preventScroll: true });
    }
  }

  function updateSelectionUI() {
    boardEl.classList.toggle('has-selection', state.selected >= 0);
    hutchEls.forEach((hutch, index) => {
      const selected = index === state.selected;
      const canDrop = state.selected >= 0 && canMove(state.selected, index);
      hutch.classList.toggle('is-selected', selected);
      hutch.classList.toggle('can-drop', canDrop);
      hutch.setAttribute('aria-pressed', selected ? 'true' : 'false');
      hutch.setAttribute('aria-label', hutchAria(index));
      hutch.classList.toggle('empty', state.hutches[index].length === 0);
    });
  }

  function layoutBoard() {
    const count = state.hutches.length;
    if (!count) return;
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    const shortLandscape = vw > vh && vh < 620;
    const narrow = !shortLandscape && vw < 900;
    const cols = shortLandscape ? count : narrow ? Math.min(5, Math.max(3, Math.ceil(count / 2))) : count;
    const rows = Math.ceil(count / cols);
    const gap = narrow ? (vw < 520 ? 7 : 10) : 14;
    const maxWidth = narrow ? (vw < 600 ? 100 : 124) : 124;
    const widthAvailable = Math.min(vw - 18, cols * maxWidth + (cols - 1) * gap);
    const widthByWidth = (widthAvailable - (cols - 1) * gap) / cols;
    const reserved = shortLandscape ? 155 : narrow ? 190 : 180;
    const heightAvailable = Math.max(shortLandscape ? 180 : 250, vh - reserved);
    const heightByHeight = (heightAvailable - (rows - 1) * gap) / rows;
    let width = Math.min(maxWidth, widthByWidth, heightByHeight * 0.34);
    width = Math.max(shortLandscape ? 40 : narrow ? 44 : 54, width);

    const hutchWidth = Math.floor(width);
    boardEl.style.setProperty('--cols', String(cols));
    boardEl.style.setProperty('--gap', `${gap}px`);
    boardEl.style.setProperty('--hutch-w', `${hutchWidth}px`);
    boardEl.style.setProperty('--hutch-h', `${Math.round(width / 0.34)}px`);
    boardEl.style.width = `${Math.round(cols * hutchWidth + (cols - 1) * gap)}px`;
  }

  /* ------------------------------------------------------------------------
     Status & moves
     ------------------------------------------------------------------------ */

  function setStatus(message, tone = '') {
    statusEl.textContent = message;
    statusEl.classList.toggle('warn', tone === 'warn');
    statusEl.classList.toggle('good', tone === 'good');
  }

  function updateMoves(bump = false) {
    movesEl.textContent = String(state.moves);
    if (bump) {
      movesPill.classList.remove('bump');
      void movesPill.offsetWidth;
      movesPill.classList.add('bump');
    }
  }

  function updateTools() {
    undoBtn.disabled = state.win || state.history.length === 0;
    hintBtn.disabled = state.win;
  }

  /* ------------------------------------------------------------------------
     Interaction
     ------------------------------------------------------------------------ */

  function clearHint() {
    window.clearTimeout(hintTimer);
    state.hint = null;
    hutchEls.forEach((hutch) => hutch.classList.remove('hint-source', 'hint-target'));
  }

  function selectHutch(index) {
    state.selected = index;
    haptic(8);
    sound('select');
    clearHint();
    updateSelectionUI();
    const stack = state.hutches[index];
    const color = COLORS[stack[stack.length - 1].color].name;
    const targets = state.hutches.reduce((sum, _stack, i) => sum + (canMove(index, i) ? 1 : 0), 0);
    if (targets === 0) {
      setStatus(`${color}-Hase ausgewählt. Für ihn ist gerade kein Gehege frei.`, 'warn');
    } else {
      setStatus(`${color}-Hase ausgewählt. ${targets === 1 ? 'Ein Gehege passt' : `${targets} Gehege passen`}.`);
    }
  }

  function deselect() {
    state.selected = -1;
    updateSelectionUI();
    setStatus('Auswahl aufgehoben. Tippe den obersten Hasen an, der hoppeln soll.');
  }

  function shake(index) {
    const hutch = hutchEls[index];
    if (!hutch) return;
    hutch.classList.remove('shake');
    void hutch.offsetWidth;
    hutch.classList.add('shake');
    window.setTimeout(() => hutch.classList.remove('shake'), 430);
  }

  function nudge(index) {
    const hutch = hutchEls[index];
    if (!hutch) return;
    hutch.classList.remove('nudge');
    void hutch.offsetWidth;
    hutch.classList.add('nudge');
    window.setTimeout(() => hutch.classList.remove('nudge'), 350);
  }

  function onHutchClick(index) {
    if (state.win || anyOverlayOpen()) return;
    clearHint();

    if (state.selected < 0) {
      if (!state.hutches[index].length) {
        setStatus('Dieses Gehege ist leer. Wähle zuerst einen Hasen zum Hoppeln.', 'warn');
        shake(index);
        sound('error');
        return;
      }
      selectHutch(index);
      return;
    }

    if (state.selected === index) {
      sound('soft');
      deselect();
      return;
    }

    const from = state.selected;
    const src = state.hutches[from];
    const dst = state.hutches[index];
    const rabbit = src[src.length - 1];

    if (dst.length >= CAP) {
      setStatus(`Das Gehege ist voll (${CAP} Hasen). Wähle eins mit freiem Platz.`, 'warn');
      shake(index);
      nudge(from);
      sound('error');
      return;
    }

    if (dst.length && dst[dst.length - 1].color !== rabbit.color) {
      const rabbitName = COLORS[rabbit.color].name;
      const topName = COLORS[dst[dst.length - 1].color].name;
      setStatus(`Der ${rabbitName}-Hase kann nicht zu ${topName}. Er braucht ${rabbitName} oder ein leeres Gehege.`, 'warn');
      shake(index);
      nudge(from);
      sound('error');
      return;
    }

    moveRabbit(from, index, rabbit);
  }

  function moveRabbit(from, to, rabbit) {
    const rect = bunnyRect(rabbit.id);
    state.hutches[from].pop();
    state.hutches[to].push(rabbit);
    state.moves++;
    state.history.push({ from, to });
    state.selected = -1;
    state.hint = null;

    renderBoard({ movedId: rabbit.id, fromRect: rect, focusIndex: to });
    updateMoves(true);
    updateTools();
    sound('hop');
    haptic(14);

    if (isSolved()) {
      finishLevel();
      return;
    }

    const grouped = groupedColorCount();
    const total = state.colorCount;
    if (!hasLegalMove()) {
      setStatus('Keine Züge mehr möglich. Mit „Zurück“ oder „Neu“ findest du einen Weg.', 'warn');
    } else {
      setStatus(`Hopp! ${grouped} von ${total} Farben kuscheln schon.`, grouped > 0 ? 'good' : '');
    }
  }

  function undoMove() {
    if (state.win || !state.history.length || anyOverlayOpen()) return;
    clearHint();
    const last = state.history.pop();
    const rabbit = state.hutches[last.to][state.hutches[last.to].length - 1];
    const rect = bunnyRect(rabbit.id);
    state.hutches[last.to].pop();
    state.hutches[last.from].push(rabbit);
    state.moves = Math.max(0, state.moves - 1);
    state.selected = -1;
    renderBoard({ movedId: rabbit.id, fromRect: rect, focusIndex: last.from });
    updateMoves();
    updateTools();
    setStatus('Zurückgehoppelt. Probier es noch einmal.');
    sound('soft');
    haptic(8);
  }

  function resetLevel(options = {}) {
    const { announce = true } = options;
    window.clearTimeout(winTimer);
    window.clearTimeout(hintTimer);
    state.hutches = cloneColors(state.initial).map((stack) => stack.map((color) => ({ id: ++rabbitId, color })));
    state.selected = -1;
    state.moves = 0;
    state.history = [];
    state.win = false;
    state.hint = null;
    winOverlay.hidden = true;
    renderBoard({ enter: !reducedMotion });
    updateMoves();
    updateTools();
    syncInert();
    if (announce) setStatus('Frisch sortiert! Tippe den obersten Hasen an, der hoppeln soll.');
  }

  function showHint() {
    if (state.win || anyOverlayOpen()) return;
    clearHint();
    const move = solveFirstMove(state.hutches.map((stack) => stack.map((rabbit) => rabbit.color)));
    if (!move) {
      setStatus('Gerade geht es nicht weiter. Mit „Zurück“ oder „Neu“ findest du einen Weg.', 'warn');
      sound('error');
      return;
    }

    state.selected = move.from;
    updateSelectionUI();
    hutchEls[move.from]?.classList.add('hint-source');
    hutchEls[move.to]?.classList.add('hint-target');
    state.hint = move;

    const rabbit = state.hutches[move.from][state.hutches[move.from].length - 1];
    const rabbitName = COLORS[rabbit.color].name;
    const dst = state.hutches[move.to];
    if (!dst.length) {
      setStatus(`Tipp: Der ${rabbitName}-Hase kann ins freie Gehege hoppeln.`, 'good');
    } else {
      setStatus(`Tipp: Der ${rabbitName}-Hase kann zu den anderen ${rabbitName}-Hasen hoppeln.`, 'good');
    }
    nudge(move.from);
    nudge(move.to);
    sound('select');
    hintTimer = window.setTimeout(() => {
      hutchEls[move.from]?.classList.remove('hint-source');
      hutchEls[move.to]?.classList.remove('hint-target');
    }, 6000);
  }

  /* ------------------------------------------------------------------------
     Level lifecycle
     ------------------------------------------------------------------------ */

  function loadLevel(index, options = {}) {
    const clamped = Math.max(0, Math.min(LEVELS.length - 1, index));
    window.clearTimeout(winTimer);
    window.clearTimeout(hintTimer);
    const level = LEVELS[clamped];
    state.levelIndex = clamped;
    state.level = level;
    state.initial = cloneColors(level.stacks);
    state.colorCount = level.colors || new Set(level.stacks.flat()).size;
    state.hutches = cloneColors(level.stacks).map((stack) => stack.map((color) => ({ id: ++rabbitId, color })));
    state.selected = -1;
    state.moves = 0;
    state.history = [];
    state.win = false;
    state.hint = null;

    if (level.id <= progress.unlocked) progress.lastLevel = level.id;
    saveProgress();

    levelKicker.textContent = `Wiese ${level.id} von ${LEVELS.length}`;
    levelNameEl.textContent = level.name;
    winOverlay.hidden = true;
    renderBoard({ enter: !reducedMotion });
    updateMoves();
    updateTools();
    syncInert();
    setStatus('Tippe den obersten Hasen an, der hoppeln soll.');
    fillHeroBunnies();
    if (options.focus) focusBoard();
  }

  function finishLevel() {
    state.win = true;
    updateTools();
    hutchEls.forEach((hutch, index) => {
      if (state.hutches[index].length) hutch.classList.add('solved');
    });

    const threshold3 = parForThreeStars(state.level.par);
    const stars = state.moves <= threshold3 ? 3 : state.moves <= parForTwoStars(state.level.par) ? 2 : 1;
    const id = state.level.id;
    const previous = progress.best[id];
    const isBest = !previous || state.moves < previous.moves;
    if (isBest) {
      progress.best[id] = {
        moves: state.moves,
        stars: Math.max(stars, previous ? previous.stars || 0 : 0)
      };
    } else {
      previous.stars = Math.max(previous.stars || 0, stars);
    }
    progress.unlocked = Math.max(progress.unlocked, Math.min(LEVELS.length, id + 1));
    progress.lastLevel = id;
    saveProgress();

    setStatus('Alle Hasen kuscheln!', 'good');
    sound('win');

    winTimer = window.setTimeout(() => {
      showWinOverlay(stars, isBest, threshold3);
      celebrate();
    }, reducedMotion ? 80 : 640);
  }

  function parForThreeStars(par) {
    return par + Math.max(2, Math.round(par * 0.12));
  }

  function parForTwoStars(par) {
    return Math.round(par * 1.55) + 3;
  }

  function starSvg(filled) {
    return `<svg class="star ${filled ? 'on' : ''}" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.7l2.8 5.7 6.3.9-4.6 4.4 1.1 6.3L12 17l-5.6 3 1.1-6.3-4.6-4.4 6.3-.9L12 2.7Z" fill="currentColor"/></svg>`;
  }

  function showWinOverlay(stars, isBest, threshold3) {
    const level = state.level;
    winKicker.textContent = `Wiese ${level.id} · ${level.name}`;
    winStars.innerHTML = [1, 2, 3].map((n) => starSvg(n <= stars)).join('');
    winStars.setAttribute('aria-label', `${stars} von 3 Sternen`);

    const best = progress.best[level.id];
    let text;
    if (stars < 3) {
      text = `${state.moves} Züge. Für 3 Sterne brauchst du höchstens ${threshold3} Züge.`;
      if (best && best.moves < state.moves) text += ` Bestwert: ${best.moves} Züge.`;
    } else if (isBest) {
      text = `Neuer Bestwert: ${state.moves} Züge – perfekt sortiert!`;
    } else {
      text = `Perfekt sortiert in ${state.moves} Zügen. Bestwert: ${best ? best.moves : state.moves} Züge.`;
    }
    winText.textContent = text;

    const colors = [...new Set(level.stacks.flat())].slice(0, 3);
    winBunnies.innerHTML = colors.map((color, index) => `<span class="win-bunny" style="z-index:${3 - index}">${bunnySvg(color, `win-${level.id}-${index}`)}</span>`).join('');

    const isLast = state.levelIndex >= LEVELS.length - 1;
    nextBtn.textContent = isLast ? 'Wiesen ansehen' : 'Nächste Wiese';
    winOverlay.hidden = false;
    syncInert();
    window.setTimeout(() => nextBtn.focus({ preventScroll: true }), 40);
  }

  /* ------------------------------------------------------------------------
     Level selection & intro
     ------------------------------------------------------------------------ */

  function renderLevelGrid() {
    levelGrid.innerHTML = LEVELS.map((level, index) => {
      const unlocked = level.id <= progress.unlocked;
      const best = progress.best[level.id];
      const stars = best ? best.stars || 0 : 0;
      const done = Boolean(best);
      const current = index === state.levelIndex;
      const starMarkup = unlocked
        ? `<span class="level-stars" aria-hidden="true">${[1, 2, 3].map((n) => `<span class="${n <= stars ? 'on' : ''}">★</span>`).join('')}</span>`
        : `<span class="level-lock" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg></span>`;
      const label = unlocked
        ? `Wiese ${level.id}, ${level.name}${best ? `, Bestwert ${best.moves} Züge, ${stars} Sterne` : ', noch nicht geschafft'}`
        : `Wiese ${level.id}, gesperrt`;
      return `
        <button class="level-card ${done ? 'done' : ''} ${current ? 'current' : ''}" type="button" data-level="${index}" ${unlocked ? '' : 'disabled'} aria-label="${label}">
          <span class="level-num">${level.id}</span>
          <span class="level-name">${level.name}</span>
          ${starMarkup}
          <span class="level-best">${unlocked ? (best ? `${best.moves} Züge` : '&nbsp;') : '&nbsp;'}</span>
        </button>`;
    }).join('');
  }

  function openLevels(from) {
    levelsReturn = from || 'game';
    renderLevelGrid();
    if (!winOverlay.hidden) winOverlay.hidden = true;
    levelsOverlay.hidden = false;
    syncInert();
    window.setTimeout(() => closeLevelsBtn.focus({ preventScroll: true }), 40);
  }

  function closeLevels() {
    if (levelsOverlay.hidden) return;
    levelsOverlay.hidden = true;
    if (levelsReturn === 'win' && state.win) {
      winOverlay.hidden = false;
      syncInert();
      nextBtn.focus({ preventScroll: true });
      return;
    }
    syncInert();
    if (!introOverlay.hidden) {
      startBtn.focus({ preventScroll: true });
    } else {
      focusBoard();
    }
  }

  function selectLevel(index) {
    levelsOverlay.hidden = true;
    introOverlay.hidden = true;
    winOverlay.hidden = true;
    syncInert();
    loadLevel(index, { focus: true });
    sound('select');
  }

  function showIntro() {
    updateIntroCopy();
    introOverlay.hidden = false;
    syncInert();
    window.setTimeout(() => startBtn.focus({ preventScroll: true }), 60);
  }

  function dismissIntro() {
    introOverlay.hidden = true;
    syncInert();
    focusBoard();
    sound('start');
  }

  function updateIntroCopy() {
    const level = LEVELS[state.levelIndex];
    if (progress.unlocked > 1 || state.levelIndex > 0) {
      introProgress.textContent = `Weiter geht es auf Wiese ${level.id} · ${level.name}`;
      startBtn.textContent = 'Weiterspielen';
    } else {
      introProgress.textContent = '18 Wiesen voller Hasen warten auf dich.';
      startBtn.textContent = 'Loshoppeln';
    }
  }

  function fillHeroBunnies() {
    const colors = state.level ? [...new Set(state.level.stacks.flat())].slice(0, 3) : ['orange', 'pink', 'mint'];
    heroBunnies.innerHTML = colors
      .map((color, index) => `<span class="hero-bunny">${bunnySvg(color, `hero-${index}`)}</span>`)
      .join('');
  }

  /* ------------------------------------------------------------------------
     Overlays, focus & inert
     ------------------------------------------------------------------------ */

  function anyOverlayOpen() {
    return !introOverlay.hidden || !levelsOverlay.hidden || !winOverlay.hidden;
  }

  function syncInert() {
    const open = anyOverlayOpen();
    appEl.inert = open;
    if (open) appEl.setAttribute('aria-hidden', 'true');
    else appEl.removeAttribute('aria-hidden');
  }

  function focusBoard() {
    const target = boardEl.querySelector('.hutch') || boardEl;
    target.focus({ preventScroll: true });
  }

  function topOverlay() {
    if (!winOverlay.hidden) return winOverlay;
    if (!levelsOverlay.hidden) return levelsOverlay;
    if (!introOverlay.hidden) return introOverlay;
    return null;
  }

  function trapFocus(event) {
    if (event.key !== 'Tab') return;
    const overlay = topOverlay();
    if (!overlay) return;
    const focusable = Array.from(overlay.querySelectorAll('button:not(:disabled), [href], [tabindex]:not([tabindex="-1"])'))
      .filter((el) => el.offsetParent !== null || el === document.activeElement);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  /* ------------------------------------------------------------------------
     Audio & haptics
     ------------------------------------------------------------------------ */

  function ensureAudio() {
    if (!progress.sound) return null;
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return null;
    if (!audioCtx) {
      try {
        audioCtx = new AudioCtor();
      } catch {
        return null;
      }
    }
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
    return audioCtx;
  }

  function tone(freq, duration, options = {}) {
    if (!progress.sound) return;
    const ctx = ensureAudio();
    if (!ctx) return;
    const { type = 'sine', volume = 0.05, slide = 0, delay = 0 } = options;
    const start = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (slide) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(45, freq + slide), start + duration);
    }
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + duration + 0.03);
  }

  function sound(kind) {
    if (!progress.sound) return;
    switch (kind) {
      case 'select':
        tone(540, 0.09, { type: 'triangle', volume: 0.035, slide: 120 });
        break;
      case 'hop':
        tone(300, 0.16, { type: 'sine', volume: 0.06, slide: 280 });
        tone(620, 0.08, { type: 'triangle', volume: 0.025, slide: 90, delay: 0.04 });
        break;
      case 'error':
        tone(155, 0.12, { type: 'square', volume: 0.022, slide: -25 });
        break;
      case 'soft':
        tone(420, 0.07, { type: 'sine', volume: 0.025, slide: -60 });
        break;
      case 'start':
        [392, 523, 659].forEach((freq, index) => {
          tone(freq, 0.14, { type: 'triangle', volume: 0.035, delay: index * 0.07 });
        });
        break;
      case 'win':
        [523, 659, 784, 1047].forEach((freq, index) => {
          tone(freq, 0.22, { type: 'triangle', volume: 0.045, delay: index * 0.1 });
        });
        break;
      default:
        break;
    }
  }

  function haptic(duration) {
    if (progress.sound && navigator.vibrate) {
      try {
        navigator.vibrate(duration);
      } catch {
        /* ignored */
      }
    }
  }

  function updateSoundButton() {
    soundBtn.setAttribute('aria-pressed', progress.sound ? 'true' : 'false');
    soundBtn.setAttribute('aria-label', progress.sound ? 'Ton ausschalten' : 'Ton einschalten');
    soundBtn.title = progress.sound ? 'Ton ausschalten' : 'Ton einschalten';
  }

  function toggleSound() {
    progress.sound = !progress.sound;
    updateSoundButton();
    saveProgress();
    if (progress.sound) {
      ensureAudio();
      sound('select');
    }
  }

  /* ------------------------------------------------------------------------
     Confetti
     ------------------------------------------------------------------------ */

  const confetti = {
    ctx: confettiCanvas.getContext('2d'),
    pieces: [],
    frame: 0,
    start: 0,
    width: 0,
    height: 0
  };

  function resizeConfetti() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    confetti.width = window.innerWidth;
    confetti.height = window.innerHeight;
    confettiCanvas.width = Math.round(confetti.width * dpr);
    confettiCanvas.height = Math.round(confetti.height * dpr);
    confetti.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function celebrate() {
    if (reducedMotion) return;
    resizeConfetti();
    const palette = ['#ef8a49', '#e6799c', '#a78bda', '#5cbaa2', '#66a9dd', '#ecc84d', '#fff6dc'];
    confetti.pieces = Array.from({ length: 120 }, () => ({
      x: confetti.width * (0.16 + Math.random() * 0.68),
      y: -20 - Math.random() * 140,
      vx: (Math.random() - 0.5) * 2.6,
      vy: 1.6 + Math.random() * 3.6,
      size: 4 + Math.random() * 7,
      rotation: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 0.28,
      color: palette[Math.floor(Math.random() * palette.length)],
      shape: Math.random() > 0.42 ? 'rect' : 'circle',
      drag: 0.994
    }));
    confetti.start = performance.now();
    cancelAnimationFrame(confetti.frame);
    confetti.frame = requestAnimationFrame(drawConfetti);
  }

  function drawConfetti(now) {
    const elapsed = now - confetti.start;
    const ctx = confetti.ctx;
    ctx.clearRect(0, 0, confetti.width, confetti.height);
    let alive = 0;

    for (const piece of confetti.pieces) {
      piece.vx *= piece.drag;
      piece.vy += 0.045;
      piece.x += piece.vx;
      piece.y += piece.vy;
      piece.rotation += piece.spin;
      if (piece.y > confetti.height + 30 || piece.x < -40 || piece.x > confetti.width + 40) continue;
      alive++;
      ctx.save();
      ctx.translate(piece.x, piece.y);
      ctx.rotate(piece.rotation);
      ctx.fillStyle = piece.color;
      ctx.globalAlpha = Math.min(1, Math.max(0, (confetti.height + 20 - piece.y) / 80));
      if (piece.shape === 'rect') {
        ctx.fillRect(-piece.size / 2, -piece.size / 4, piece.size, piece.size / 2);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, piece.size / 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    if (alive > 0 && elapsed < 4600) {
      confetti.frame = requestAnimationFrame(drawConfetti);
    } else {
      ctx.clearRect(0, 0, confetti.width, confetti.height);
      confetti.pieces = [];
    }
  }

  /* ------------------------------------------------------------------------
     Events
     ------------------------------------------------------------------------ */

  levelsBtn.addEventListener('click', () => openLevels('game'));
  helpBtn.addEventListener('click', () => {
    updateIntroCopy();
    lastFocused = document.activeElement;
    showIntro();
  });
  introLevelsBtn.addEventListener('click', () => {
    lastFocused = document.activeElement;
    openLevels('intro');
  });
  startBtn.addEventListener('click', () => {
    ensureAudio();
    dismissIntro();
  });
  closeLevelsBtn.addEventListener('click', closeLevels);

  levelGrid.addEventListener('click', (event) => {
    const card = event.target.closest('[data-level]');
    if (!card || card.disabled) return;
    selectLevel(Number(card.dataset.level));
  });

  hintBtn.addEventListener('click', () => {
    ensureAudio();
    showHint();
  });
  undoBtn.addEventListener('click', undoMove);
  restartBtn.addEventListener('click', () => {
    ensureAudio();
    resetLevel();
    sound('soft');
  });
  soundBtn.addEventListener('click', toggleSound);

  nextBtn.addEventListener('click', () => {
    ensureAudio();
    if (state.levelIndex >= LEVELS.length - 1) {
      openLevels('win');
      return;
    }
    winOverlay.hidden = true;
    syncInert();
    loadLevel(state.levelIndex + 1, { focus: true });
  });

  replayBtn.addEventListener('click', () => {
    ensureAudio();
    winOverlay.hidden = true;
    resetLevel();
    focusBoard();
  });

  winLevelsBtn.addEventListener('click', () => {
    openLevels('win');
  });

  introOverlay.addEventListener('click', (event) => {
    if (event.target === introOverlay) dismissIntro();
  });

  levelsOverlay.addEventListener('click', (event) => {
    if (event.target === levelsOverlay) closeLevels();
  });

  boardEl.addEventListener('keydown', (event) => {
    const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
    if (!keys.includes(event.key)) return;
    const hutch = event.target.closest('.hutch');
    if (!hutch) return;
    const index = Number(hutch.dataset.hutch);
    const cols = Number(getComputedStyle(boardEl).getPropertyValue('--cols')) || 1;
    let next = index;
    if (event.key === 'ArrowLeft') next = index - 1;
    if (event.key === 'ArrowRight') next = index + 1;
    if (event.key === 'ArrowUp') next = index - cols;
    if (event.key === 'ArrowDown') next = index + cols;
    if (next < 0 || next >= state.hutches.length || (event.key === 'ArrowLeft' && index % cols === 0) || (event.key === 'ArrowRight' && index % cols === cols - 1)) {
      return;
    }
    event.preventDefault();
    hutchEls[next]?.focus();
  });

  document.addEventListener('keydown', (event) => {
    trapFocus(event);
    if (event.key === 'Escape') {
      if (!levelsOverlay.hidden) {
        closeLevels();
        event.preventDefault();
        return;
      }
      if (!winOverlay.hidden) return;
      if (!introOverlay.hidden) {
        dismissIntro();
        event.preventDefault();
        return;
      }
      if (state.selected >= 0) {
        deselect();
        event.preventDefault();
      }
    }
  });

  document.addEventListener('pointerdown', () => {
    document.body.classList.add('no-focus-outline');
  }, { capture: true, passive: true });

  document.addEventListener('keydown', () => {
    document.body.classList.remove('no-focus-outline');
  }, true);

  let resizeFrame = 0;
  window.addEventListener('resize', () => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => {
      layoutBoard();
      if (!confetti.pieces.length) resizeConfetti();
    });
  });

  /* ------------------------------------------------------------------------
     Boot
     ------------------------------------------------------------------------ */

  function boot() {
    updateSoundButton();
    resizeConfetti();
    document.body.classList.add('no-focus-outline');

    let startIndex = Math.max(0, Math.min(progress.unlocked - 1, progress.lastLevel - 1));
    if (Number.isFinite(urlLevel)) {
      startIndex = Math.max(0, Math.min(LEVELS.length - 1, urlLevel - 1));
    }
    loadLevel(startIndex);

    if (noIntro) {
      introOverlay.hidden = true;
      syncInert();
    } else {
      updateIntroCopy();
      syncInert();
      window.setTimeout(() => startBtn.focus({ preventScroll: true }), 80);
    }
  }

  boot();
})();
