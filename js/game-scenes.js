/* ==========================================================================
   DER LETZTE SCHULTAG – Regie: vier Akte und ein Tod-Trank
   ========================================================================== */
(() => {
'use strict';
const S = window.SG;
const {
  clamp, lerp, rand, randInt, pick, easeOut, easeInOut, TAU,
  setAct, setMeter, showMeter, say, setControls, stats, sfx, burst, floater, particle,
  initAudio, ui
} = S;

const fmt = n => (Math.round(n * 10) / 10).toFixed(1).replace('.', ',');

// --------------------------------------------------------------------------
// Akt 1 – Der Blick
// --------------------------------------------------------------------------
function startAct1() {
  S.input.stare = S.input.run = S.input.left = S.input.right = false;
  S.pointerSteer = 0;
  S.scene = 'act1'; S.sceneT = 0; S.shake = 0; S.flash = .35;
  S.a1 = {
    t: 0, phase: 'lesson', p: 0, stare: 0, stareTotal: 0,
    teacherX: 290, teacherFacing: -1, teacherAnger: 0,
    playerX: 690, playerY: 452, spin: 0,
    bubble: '', bubbleT: 0, broken: false, fade: 0,
    flag: {}, beat: .6
  };
  S.showChoices(false);
  setAct(1, 'DER BLICK');
  showMeter(true); setMeter('BLICKKONTAKT', 0, 'red');
  setControls('stare');
  say('ERZÄHLER', 'Mathe, 5. Stunde. Noch eine Minute bis zu den Ferien.');
}

function bubble(a, text, dur = 1.8) { a.bubble = text; a.bubbleT = dur; }

function beginCharge() {
  const a = S.a1;
  a.phase = 'charge'; a.p = 0; a.teacherFacing = 1;
  bubble(a, 'RAUS MIT DIR!', 2.4);
  say('ERZÄHLER', 'Herr Müller hat genug. Er kommt näher. Sehr viel näher.');
  sfx.angry(); sfx.step(); S.shake = 7;
}

function updateAct1(dt) {
  const a = S.a1; if (!a) return;
  a.t += dt;
  if (a.bubbleT > 0) a.bubbleT -= dt;

  if (a.phase === 'lesson') {
    a.stare = clamp(a.stare + (S.input.stare ? dt / 2.8 : -dt * .3), 0, 1);
    if (S.input.stare) { a.stareTotal += dt; stats.stare += dt; }
    a.teacherX = 290 + 250 * easeInOut(a.stare);
    a.teacherFacing = a.stare > .06 ? 1 : -1;
    a.teacherAnger = a.stare;
    setMeter('BLICKKONTAKT', a.stare, 'red');

    if (a.stare > .2 && a.beat > 0) {
      a.beat -= dt;
      if (a.beat <= 0) { sfx.heartbeat(); a.beat = .5; }
    }
    if (a.t > 2.4 && !a.flag.second) {
      a.flag.second = true;
      say('ERZÄHLER', 'Herr Müller schreibt an die Tafel. Alle passen auf. Du nicht.');
    }
    if (a.stare > .28 && !a.flag.b1) { a.flag.b1 = true; bubble(a, '…?', 1.5); say('HERR MÜLLER', 'Was guckst du so?'); }
    if (a.stare > .58 && !a.flag.b2) { a.flag.b2 = true; bubble(a, 'WAS?!', 1.8); say('HERR MÜLLER', 'Hast du ein Problem?!'); sfx.angry(); }
    if (a.stare > .84 && !a.flag.b3) { a.flag.b3 = true; bubble(a, 'DANN KOMM ICH HALT RÜBER!', 2.3); say('HERR MÜLLER', 'DANN KOMM ICH HALT RÜBER!'); sfx.angry(); S.shake = 5; }
    if (a.stare >= 1) beginCharge();
    return;
  }

  if (a.phase === 'charge') {
    a.p += dt;
    const p = a.p;
    if (p < .5) {
      a.teacherX = lerp(540, 652, easeOut(p / .5));
      S.shake = Math.max(S.shake, 4);
      if (!a.flag.step2 && p > .25) { a.flag.step2 = true; sfx.step(); burst(a.teacherX - 20, 440, 6, { color: '#c9b79a', shape: 'circle', size: 5, vy: -70, g: 120, life: .5 }); }
    } else {
      a.teacherX = 652;
      if (!a.flag.grab) { a.flag.grab = true; say('ERZÄHLER', 'Er packt dich am Kragen.'); sfx.thud(); S.shake = 9; }
      a.playerY = lerp(452, 342, easeOut(clamp((p - .5) / .4, 0, 1)));
    }
    if (p > .9) {
      a.spin += dt * 10;
      if (!a.flag.spin) { a.flag.spin = true; say('HERR MÜLLER', 'Du fliegst jetzt. Durch das Fenster.'); }
    }
    if (p > 1.45) {
      const k = clamp((p - 1.45) / .5, 0, 1);
      a.playerX = lerp(690, 906, easeInOut(k));
      a.playerY = lerp(342, 244, easeInOut(k));
      a.spin += dt * 11;
      if (!a.flag.whoosh) { a.flag.whoosh = true; sfx.whoosh(); }
    }
    if (p > 1.82 && !a.broken) {
      a.broken = true; a.playerX = 906; a.playerY = 244;
      sfx.glass(); S.shake = 18; S.flash = .95;
      burst(902, 218, 30, { shape: 'shard', color: '#dff7ff', size: rand(4, 10), vy: rand(-240, 80), vx: rand(-260, 70), g: 720, life: rand(.6, 1.3) });
      burst(902, 240, 18, { shape: 'circle', color: '#bdeeff', size: rand(2, 5), vy: rand(-180, 90), vx: rand(-160, 120), g: 500, life: .8 });
      say('ERZÄHLER', 'Er wirft dich aus dem Fenster. Durch das Fenster.');
    }
    if (p > 2.2) a.fade = clamp((p - 2.2) / .55, 0, 1);
    if (p > 2.78) startAct2();
  }
}

// --------------------------------------------------------------------------
// Akt 2 – Der Flug
// --------------------------------------------------------------------------
function startAct2() {
  S.input.stare = S.input.run = S.input.left = S.input.right = false;
  S.pointerSteer = 0;
  const types = [
    { id: 'busch', name: 'BUSCH' },
    { id: 'pool', name: 'PLANSCHBECKEN' },
    { id: 'laub', name: 'LAUBHAUFEN' }
  ];
  const type = pick(types);
  S.scene = 'act2'; S.sceneT = 0; S.flash = 1; S.shake = 0;
  S.a2 = {
    t: 0, phase: 'flight', p: 0, x: 826, y: 190, tilt: 0, rot: 0,
    targetX: rand(230, 750), type: type.id, typeName: type.name,
    quality: '', fade: 0, flag: {}, splash: 0
  };
  S.showChoices(false);
  setAct(2, 'DER FLUG');
  showMeter(true); setMeter('FLUGWEITE', 0, 'blue');
  setControls('flight');
  say('ERZÄHLER', 'Du fliegst. Durch die Luft. Über den Schulhof. Das war nicht geplant.');
  floater('WUUUSCH!', 640, 170, '#ffffff', 30, { life: 1.1 });
}

function landAct2() {
  const a = S.a2;
  const d = Math.abs(a.x - a.targetX);
  const q = d <= 64 ? 'PERFEKT' : d <= 134 ? 'KNAPP' : 'AUA';
  a.phase = 'landed'; a.p = 0; a.quality = q;
  stats.flight = (10.4 + a.x / 110 + (q === 'PERFEKT' ? 2.6 : 0));
  stats.landing = q === 'AUA' ? 'SCHULHOF (AUA)' : a.typeName + (q === 'KNAPP' ? ' (knapp)' : '');
  setMeter('FLUGWEITE', 1, 'blue');
  setControls('none');
  S.shake = q === 'AUA' ? 12 : 6;
  sfx.thud();

  const tx = a.targetX;
  if (a.type === 'pool') {
    burst(tx, 452, 26, { shape: 'circle', color: '#8fd8ef', size: rand(3, 9), vy: rand(-260, -80), vx: rand(-150, 150), g: 600, life: .9 });
    floater('PLATSCH!', tx, 400, '#bdeeff', 34);
    sfx.whoosh();
  } else if (a.type === 'laub') {
    burst(tx, 448, 24, { shape: 'leaf', color: pick(['#e8a94e', '#c6742c', '#f0c26c']), size: rand(4, 9), vy: rand(-220, -60), vx: rand(-170, 170), g: 500, life: 1 });
    floater('RASCHEL!', tx, 400, '#f5c16c', 32);
  } else {
    burst(tx, 448, 22, { shape: 'leaf', color: '#4c956c', size: rand(4, 9), vy: rand(-220, -60), vx: rand(-170, 170), g: 500, life: 1 });
    floater('PLUMPS!', tx, 400, '#9fe6a8', 32);
  }

  if (q === 'PERFEKT') say('ERZÄHLER', `PLATSCH! Weich gelandet im ${a.typeName}. 10 von 10 Punkten.`);
  else if (q === 'KNAPP') say('ERZÄHLER', `WUMM! Knapp daneben. Aber der ${a.typeName} hat dich noch erwischt.`);
  else say('ERZÄHLER', `AUA. Das war der Schulhof. Nicht der ${a.typeName}. Immerhin: Du lebst.`);
}

function updateAct2(dt) {
  const a = S.a2; if (!a) return;
  a.t += dt;
  if (a.phase === 'flight') {
    let steer = (S.input.left ? -1 : 0) + (S.input.right ? 1 : 0);
    if (!steer && S.pointerSteer) steer = S.pointerSteer;
    a.x = clamp(a.x + steer * 330 * dt, 80, 872);
    a.tilt = lerp(a.tilt, steer * .32, Math.min(1, dt * 9));
    const k = clamp(a.t / 3.0, 0, 1);
    a.y = 190 + (450 - 190) * k * k;
    a.rot = k * TAU * 2.2;
    setMeter('FLUGWEITE', k, 'blue');
    if (Math.random() < dt * 28) particle(a.x + rand(-18, 18), a.y - 40, { color: 'rgba(255,255,255,.7)', size: rand(1, 3), vy: rand(30, 90), vx: rand(-20, 20), g: -20, life: .4, shape: 'circle' });
    if (a.t > 1.1 && !a.flag.steer) { a.flag.steer = true; say('ERZÄHLER', 'LENKE MIT ← → oder den Pfeiltasten. Lande weich!'); }
    if (a.t > 2.3 && !a.flag.near) { a.flag.near = true; say('ERZÄHLER', 'Der Boden kommt näher. Sehr viel näher.'); }
    if (k >= 1) landAct2();
    return;
  }
  a.p += dt;
  a.splash = Math.min(1, a.splash + dt * 3);
  if (a.p > 1.35) a.fade = clamp((a.p - 1.35) / .55, 0, 1);
  if (a.p > 1.98) startAct3();
}

// --------------------------------------------------------------------------
// Akt 3 – Der Tod-Trank
// --------------------------------------------------------------------------
function startAct3() {
  S.input.stare = S.input.run = S.input.left = S.input.right = false;
  S.pointerSteer = 0;
  const defs = [
    { id: 'kaffee', label: 'KAFFEE', color: '#6b4226', skull: false },
    { id: 'tod', label: 'TOD-TRANK', color: '#5fcf72', skull: true },
    { id: 'saft', label: 'HUSTEN-SAFT', color: '#a05bd6', skull: false }
  ];
  for (let i = defs.length - 1; i > 0; i--) {
    const j = randInt(0, i); [defs[i], defs[j]] = [defs[j], defs[i]];
  }
  const xs = [545, 645, 745];
  defs.forEach((d, i) => { d.x = xs[i]; });
  S.scene = 'act3'; S.sceneT = 0; S.flash = .7; S.shake = 0;
  S.hoverBottle = null;
  S.a3 = {
    t: 0, phase: 'choice', p: 0, bottles: defs, auto: 0, chosen: null,
    green: false, fell: false, ghost: false, bell: false, kids: false,
    fade: 0, flag: {}, dust: 0
  };
  S.showChoices(true);
  setAct(3, 'DER TRANK');
  showMeter(false);
  setControls('none');
  say('ERZÄHLER', 'Herr Müller lehnt sich aus dem Fenster. Er hat drei Flaschen dabei. Natürlich hat er.');
}

function chooseBottle(b) {
  const a = S.a3; if (!a || a.phase !== 'choice' || !b) return;
  S.a3.auto = 0; S.a3.p = 0; S.a3.chosen = b;
  S.showChoices(false);
  if (b.id === 'tod') {
    a.phase = 'drink';
    sfx.glug(); sfx.click();
    say('ERZÄHLER', 'Herr Müller greift die grüne Flasche. Ohne nachzudenken.');
  } else {
    a.phase = 'wrong';
    stats.wrong++;
    sfx.wrong();
    if (b.id === 'kaffee') {
      say('ERZÄHLER', 'Herr Müller trinkt den Kaffee. Er zittert. Er sieht jetzt alles gleichzeitig.');
      floater('ZU VIEL KAFFEE!', 640, 240, '#ffd76a', 27, { life: 1.7 });
    } else {
      say('ERZÄHLER', 'Herr Müller trinkt den Hustensaft. Es macht "RÜLPS".');
      floater('RÜLPS.', 640, 250, '#c9a0ef', 32, { life: 1.7 });
      burst(640, 280, 12, { color: '#b98ad6', shape: 'circle', size: rand(4, 10), vx: rand(-50, 50), vy: rand(-70, -20), g: -20, life: 1 });
    }
  }
}

function updateAct3(dt) {
  const a = S.a3; if (!a) return;
  a.t += dt;
  if (a.phase === 'choice') {
    a.auto += dt;
    if (a.t > 1.7 && !a.flag.ask) { a.flag.ask = true; say('HERR MÜLLER', 'Na? Welchen soll ich trinken?'); }
    if (a.t > 5 && !a.flag.hint) { a.flag.hint = true; say('ERZÄHLER', 'Tippe eine Flasche an. Die mit dem Totenkopf ist meistens eine gute Idee.'); }
    if (a.auto > 16 && !a.chosen) {
      say('HERR MÜLLER', 'Dann nehme ich eben den grünen. Der sieht gesund aus.');
      chooseBottle(a.bottles.find(b => b.id === 'tod'));
    }
    return;
  }
  a.p += dt;
  if (a.phase === 'wrong') {
    if (a.p > 1.7) {
      a.phase = 'choice'; a.chosen = null; a.auto = 0;
      S.showChoices(true);
      say('ERZÄHLER', 'Falscher Trank. Er lebt noch. Nochmal!');
      floater('NOCHMAL!', 640, 220, '#fff', 28, { life: 1.1 });
    }
    return;
  }
  if (a.phase === 'drink') {
    if (a.p > .9 && !a.green) {
      a.green = true; sfx.dead();
      floater('GLUG GLUG GLUG', 640, 235, '#9fe6a8', 28, { life: 1.9 });
      burst(640, 300, 10, { shape: 'star', color: '#9fe6a8', size: rand(3, 6), vy: rand(-80, -20), g: 40, life: 1.2 });
    }
    if (a.p > 1.55 && !a.fell) {
      a.fell = true; sfx.thud(); S.shake = 9;
      burst(660, 345, 18, { color: '#d8c4a6', shape: 'circle', size: rand(3, 8), vy: rand(-90, -20), vx: rand(-90, 90), g: 180, life: .9 });
      say('ERZÄHLER', 'Herr Müller wird grün. Dann sehr grün. Dann kippt er hintenüber.');
    }
    if (a.p > 2.15 && !a.ghost) {
      a.ghost = true; sfx.ghost();
      floater('…', 650, 160, '#e9f6ff', 52, { life: 1.8 });
      say('ERZÄHLER', 'Seine Seele verlässt den Körper. Sie sieht ehrlich erleichtert aus.');
    }
    if (a.p > 2.8 && !a.bell) {
      a.bell = true; sfx.schoolBell();
      floater('DING! DING!', 400, 190, '#ffd76a', 22, { life: 2.2 });
      say('ERZÄHLER', 'DING DING DING! Die Schulglocke läutet.');
    }
    if (a.p > 3.7 && !a.kids) {
      a.kids = true; sfx.cheer(); S.shake = 4;
      say('DU', 'Das ist das Zeichen. FERIEN!');
      burst(200, 180, 8, { color: '#ffc145', shape: 'star', size: 5, vy: -40, g: 20, life: 1.4 });
    }
    if (a.p > 5.1) a.fade = clamp((a.p - 5.1) / .6, 0, 1);
    if (a.p > 5.78) startAct4();
  }
}

// --------------------------------------------------------------------------
// Akt 4 – Ferien
// --------------------------------------------------------------------------
function startAct4() {
  S.input.stare = S.input.run = S.input.left = S.input.right = false;
  S.pointerSteer = 0;
  const palettes = [
    ['#e4572e', '#3f88c5', '#553a29'], ['#4c956c', '#f4b942', '#7a4b2a'],
    ['#3f88c5', '#e4572e', '#2f3b52'], ['#f4b942', '#6b4e9b', '#5a3b28'],
    ['#d1495b', '#2f6c4a', '#3c2a20'], ['#6b4e9b', '#ffc145', '#2c2433'],
    ['#2f6c4a', '#e4572e', '#7d5233'], ['#e4572e', '#2c2433', '#f0bd87']
  ];
  const kids = palettes.map((p, i) => ({
    off: -320 + i * 92 + rand(-24, 24),
    s: rand(.82, 1.02),
    phase: rand(0, 10),
    shirt: p[0], pants: p[1], hair: p[2],
    hairStyle: pick(['short', 'curly', 'ponytail', 'short']),
    skin: pick(['#f0bd87', '#d9a066', '#8d5524', '#efc59a']),
    jump: rand(0, 2)
  }));
  S.scene = 'act4'; S.sceneT = 0; S.flash = .6; S.shake = 0;
  S.a4 = {
    t: 0, phase: 'run', distance: 0, playerX: 500, cam: 40,
    walk: 0, speed: 0, tap: 0, gateT: 0, flag: {}, kids, dust: 0
  };
  stats.run = 0;
  S.showChoices(false);
  setAct(4, 'FERIEN');
  showMeter(true); setMeter('NACH HAUSE', 0, 'green');
  setControls('run');
  say('ERZÄHLER', 'Die Türen fliegen auf. Alle rennen nach Hause. Die Schule ist heute eindeutig vorbei.');
}

function tapRun() {
  if (S.scene === 'act4' && S.a4 && S.a4.phase === 'run') {
    S.a4.tap = Math.min(.06, S.a4.tap + .012);
    stats.taps++;
  }
}

function updateAct4(dt) {
  const a = S.a4; if (!a) return;
  a.t += dt;
  stats.run = a.t;
  if (a.phase === 'run') {
    a.tap = Math.max(0, a.tap - dt * 1.6);
    a.speed = .082 + (S.input.run ? .05 : 0) + a.tap;
    a.distance = clamp(a.distance + a.speed * dt, 0, 1);
    a.playerX = 500 + a.distance * 1250;
    a.cam = clamp(a.playerX - 460, 0, 1000);
    a.walk += dt * (6 + a.speed * 35);
    setMeter('NACH HAUSE', a.distance, 'green');
    a.dust -= dt;
    if (a.dust <= 0) {
      a.dust = .12;
      burst(a.playerX - a.cam - 12, 468, 1, { color: 'rgba(220,200,166,.8)', shape: 'circle', size: rand(3, 6), vx: rand(-90, -20), vy: rand(-40, -5), g: 40, life: .55 });
    }
    if (a.distance > .25 && !a.flag.f1) { a.flag.f1 = true; say('ERZÄHLER', 'Keine Hausaufgaben. Sechs Wochen lang. Kein Mathe. Kein Müller.'); }
    if (a.distance > .55 && !a.flag.f2) { a.flag.f2 = true; say('DU', 'TSCHÜSS SCHULE! TSCHÜSS MATHE! TSCHÜSS MÜLLER!'); }
    if (a.distance > .82 && !a.flag.f3) { a.flag.f3 = true; say('ERZÄHLER', 'FAST DA! Das Tor! Das wunderschöne, ferienbunte Tor!'); sfx.cheer(); }
    if (a.distance >= 1) {
      a.phase = 'gate'; a.gateT = 0;
      sfx.cheer(); sfx.confetti(); S.shake = 8;
      say('DU', 'FERIEN!!!');
      setControls('none');
      for (let i = 0; i < 60; i++) particle(rand(120, 900), rand(80, 300), { shape: 'confetti', color: pick(['#e4572e', '#ffc145', '#4c956c', '#3f88c5', '#6b4e9b', '#f8f0dc']), size: rand(4, 9), vx: rand(-80, 80), vy: rand(-40, 60), g: 80, life: rand(1.5, 3), vr: rand(-12, 12) });
    }
  } else {
    a.gateT += dt;
    a.walk += dt * 7;
    if (a.gateT < 2.4 && Math.random() < dt * 18) {
      particle(rand(100, 900), rand(100, 340), { shape: 'confetti', color: pick(['#e4572e', '#ffc145', '#4c956c', '#3f88c5', '#6b4e9b', '#f8f0dc']), size: rand(4, 8), vx: rand(-50, 50), vy: rand(20, 80), g: 60, life: rand(1.5, 2.8), vr: rand(-10, 10) });
    }
    if (a.gateT > 2.8) showEnd();
  }
}

// --------------------------------------------------------------------------
// Ende
// --------------------------------------------------------------------------
function showEnd() {
  if (S.scene === 'end') return;
  S.scene = 'end';
  S.showChoices(false);
  ui.hud.classList.add('hidden');
  ui.end.classList.remove('hidden');
  sfx.confetti();

  let points = 100;
  if (S.a2 && S.a2.quality !== 'PERFEKT') points -= S.a2.quality === 'AUA' ? 20 : 10;
  points -= stats.wrong * 9;
  points -= Math.max(0, Math.round((stats.run - 10) * 2));
  if (stats.taps < 6) points -= 5;
  const grade = points >= 93 ? 'A+' : points >= 84 ? 'A' : points >= 71 ? 'B' : points >= 58 ? 'C' : 'D';

  ui.statStare.textContent = fmt(stats.stare) + ' s';
  ui.statFlight.textContent = fmt(stats.flight) + ' m';
  ui.statLand.textContent = stats.landing || '–';
  ui.statPotion.textContent = stats.wrong === 0 ? 'TOD-TRANK' : `TOD-TRANK (${stats.wrong + 1}.)`;
  ui.statRun.textContent = fmt(stats.run) + ' s';
  ui.statGrade.textContent = grade;

  const extra = stats.wrong > 0 ? ` Mit ${stats.wrong} Fehlgriff${stats.wrong > 1 ? 'en' : ''}.` : '';
  ui.endLine.textContent = `Du hast Herrn Müller ${fmt(stats.stare)} Sekunden lang angestarrt. Er hat dich aus dem Fenster geworfen. Dann hat er den Tod-Trank getrunken. Jetzt sind Ferien.${extra}`;
}

// --------------------------------------------------------------------------
// Start / Titel / Debug
// --------------------------------------------------------------------------
function resetStats() {
  stats.stare = 0; stats.flight = 0; stats.landing = ''; stats.wrong = 0; stats.run = 0; stats.taps = 0;
}
function clearFx() {
  S.particles.length = 0; S.floaters.length = 0;
  S.flash = 0; S.shake = 0;
}
function startGame() {
  initAudio(); sfx.click();
  clearFx(); resetStats();
  ui.title.classList.add('hidden');
  ui.end.classList.add('hidden');
  ui.hud.classList.remove('hidden');
  ui.muteBtn.textContent = '🔊';
  startAct1();
}
function goTitle() {
  clearFx(); resetStats();
  S.scene = 'title'; S.sceneT = 0;
  S.a1 = S.a2 = S.a3 = S.a4 = null;
  S.showChoices(false);
  ui.hud.classList.add('hidden');
  ui.end.classList.add('hidden');
  ui.title.classList.remove('hidden');
}
function gotoAct(n) {
  initAudio();
  clearFx(); resetStats();
  ui.title.classList.add('hidden');
  ui.end.classList.add('hidden');
  ui.hud.classList.remove('hidden');
  if (n === 1) startAct1();
  else if (n === 2) { clearFx(); startAct2(); S.flash = 0; }
  else if (n === 3) { clearFx(); startAct3(); S.flash = 0; }
  else if (n === 4) { clearFx(); startAct4(); S.flash = 0; }
  else if (n === 5) { startAct4(); S.a4.distance = 1; S.a4.phase = 'gate'; S.a4.gateT = 0; showEnd(); }
}

function update(dt) {
  S.time += dt;
  S.sceneT += dt;
  S.shake = Math.max(0, S.shake - dt * 30);
  S.flash = Math.max(0, S.flash - dt * 1.55);
  S.updateParticles(dt);

  if (S.scene === 'act1') updateAct1(dt);
  else if (S.scene === 'act2') updateAct2(dt);
  else if (S.scene === 'act3') updateAct3(dt);
  else if (S.scene === 'act4') updateAct4(dt);
}

Object.assign(S, {
  startGame, goTitle, gotoAct, update, tapRun, showEnd, chooseBottle,
  startAct1, startAct2, startAct3, startAct4, resetStats, clearFx, fmt
});
})();
