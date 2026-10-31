import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CONFIG,
  UFO_TYPES,
  accuracyFactor,
  batteryDelta,
  clamp,
  distance,
  exposureDelta,
  formatClock,
  formatRecord,
  formatScore,
  makeDecoy,
  makeUfo,
  maxUfosForWave,
  mulberry32,
  nextUfoDelay,
  pad2,
  pickUfoKind,
  precisionFor,
  scoreCapture,
  waveForElapsed,
} from '../js/logic.mjs';

test('clamp keeps values inside the range', () => {
  assert.equal(clamp(-4, 0, 10), 0);
  assert.equal(clamp(4, 0, 10), 4);
  assert.equal(clamp(14, 0, 10), 10);
});

test('distance is euclidean', () => {
  assert.equal(distance(0, 0, 3, 4), 5);
});

test('number and time formatting is stable and localised', () => {
  assert.equal(formatScore(0), '0');
  assert.equal(formatScore(1250), '1.250');
  assert.equal(formatScore(1234567), '1.234.567');
  assert.equal(pad2(7), '07');
  assert.equal(formatClock(0), '23:47');
  assert.equal(formatClock(60), '23:48');
  assert.equal(formatClock(13 * 60), '00:00');
  assert.equal(formatRecord(0), '00:00');
  assert.equal(formatRecord(125), '02:05');
});

test('waves advance every thirty seconds and cap the UFO count', () => {
  assert.equal(waveForElapsed(0), 1);
  assert.equal(waveForElapsed(29.9), 1);
  assert.equal(waveForElapsed(30), 2);
  assert.equal(waveForElapsed(95), 4);
  assert.equal(maxUfosForWave(1), 1);
  assert.equal(maxUfosForWave(2), 2);
  assert.equal(maxUfosForWave(4), 3);
  assert.equal(maxUfosForWave(9), 4);
});

test('spawn delays shrink with the wave and stay bounded', () => {
  const random = mulberry32(42);
  for (let wave = 1; wave <= 10; wave += 1) {
    const delay = nextUfoDelay(wave, random);
    assert.ok(delay >= 2.6 * 0.78 - 1e-9);
    assert.ok(delay <= 5.4 * 1.28);
  }
});

test('accuracy falls off with distance but never collapses', () => {
  assert.equal(accuracyFactor(0, 100), 1);
  assert.ok(accuracyFactor(50, 100) < 1);
  assert.ok(accuracyFactor(100, 100) >= 0.24);
  assert.ok(accuracyFactor(500, 100) >= 0.24);
});

test('exposure only grows with battery and a sensible lock radius', () => {
  const close = exposureDelta(0.1, 0, 100, 2, 100);
  const far = exposureDelta(0.1, 90, 100, 2, 100);
  assert.ok(close > far);
  assert.equal(exposureDelta(0.1, 0, 100, 2, 0), 0);
  assert.equal(exposureDelta(0, 0, 100, 2, 100), 0);
});

test('battery drains while filming and regenerates otherwise', () => {
  const drained = batteryDelta(1, 50, true);
  const recharged = batteryDelta(1, 50, false);
  assert.equal(drained, 35);
  assert.equal(recharged, 60);
  assert.equal(batteryDelta(10, 5, true), 0);
  assert.equal(batteryDelta(10, 95, false), 100);
});

test('precision and score reward steady aim and combos', () => {
  assert.equal(precisionFor(10, 100), 1.5);
  assert.equal(precisionFor(40, 100), 1.25);
  assert.equal(precisionFor(90, 100), 1);
  assert.equal(scoreCapture(120, 1, 1), 120);
  assert.equal(scoreCapture(120, 4, 1.5), 720);
  assert.equal(scoreCapture(120, 0, 1), 120);
});

test('UFO factory stays on screen and scales for phones', () => {
  const random = mulberry32(7);
  for (const kind of Object.keys(UFO_TYPES)) {
    const ufo = makeUfo(kind, 390, 844, random);
    assert.equal(ufo.family, 'ufo');
    assert.ok(ufo.size > 0);
    assert.ok(ufo.lock > 0);
    assert.ok(ufo.x >= 0 && ufo.x <= 390);
    assert.ok(ufo.y >= 100 && ufo.y <= 844);
    assert.equal(ufo.dead, false);
    assert.ok(ufo.ttl > 0);
  }
});

test('decoy factory always exposes a lock radius', () => {
  const random = mulberry32(99);
  for (const kind of ['plane', 'satellite', 'meteor']) {
    const decoy = makeDecoy(kind, 1440, 900, random);
    assert.equal(decoy.family, 'decoy');
    assert.equal(typeof decoy.lock, 'number');
    assert.ok(decoy.lock > 0);
    assert.equal(decoy.dead, false);
  }
});

test('kind selection respects wave gates', () => {
  const random = mulberry32(123);
  for (let i = 0; i < 400; i += 1) {
    assert.notEqual(pickUfoKind(1, random), 'mothership');
    assert.notEqual(pickUfoKind(2, random), 'mothership');
  }
  const kinds = new Set();
  for (let i = 0; i < 500; i += 1) kinds.add(pickUfoKind(4, random));
  assert.equal(kinds.has('mothership'), true);
});

test('signal helpers and config remain sane', () => {
  assert.equal(CONFIG.startSignal, 100);
  assert.ok(CONFIG.batteryDrain > 0);
  assert.ok(CONFIG.comboWindow > 0);
});
