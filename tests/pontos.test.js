import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcPts, getMulti } from '../js/pontos.js';
import { resultInfo, calcT1, calcT2 } from '../js/eleicoes.js';

const pts = (rc, rf, pc, pf) => calcPts({casa: rc, fora: rf}, {casa: pc, fora: pf});

test('pontuação do palpite', () => {
  assert.deepEqual(pts(2, 1, 2, 1), {pts: 25, tipo: 'exact'});
  assert.deepEqual(pts(2, 1, 2, 0), {pts: 18, tipo: 'vg'});
  assert.deepEqual(pts(3, 1, 2, 0), {pts: 15, tipo: 'diff'});
  assert.deepEqual(pts(1, 1, 0, 0), {pts: 15, tipo: 'draw'});
  assert.deepEqual(pts(3, 1, 4, 1), {pts: 12, tipo: 'lg'});
  assert.deepEqual(pts(4, 0, 2, 1), {pts: 10, tipo: 'win'});
  assert.deepEqual(pts(2, 1, 1, 1), {pts: 4, tipo: 'almost'});
  assert.deepEqual(pts(1, 1, 2, 1), {pts: 0, tipo: 'miss'});
  assert.deepEqual(pts(0, 1, 2, 1), {pts: 0, tipo: 'miss'});
  assert.equal(calcPts({casa: null, fora: null}, {casa: 1, fora: 0}), null);
  assert.equal(calcPts({casa: 1, fora: 0}, undefined), null);
});

test('multiplicador por fase', () => {
  assert.equal(getMulti(''), 1);
  assert.equal(getMulti('Rodada 32'), 1);
  assert.equal(getMulti('16 avos de Final'), 1.25);
  assert.equal(getMulti('Oitavas de 32'), 1.25);
  assert.equal(getMulti('Oitavas de Final'), 1.5);
  assert.equal(getMulti('Quartas de Final'), 2);
  assert.equal(getMulti('Semifinal'), 2.5);
  assert.equal(getMulti('Disputa de 3º Lugar'), 2.5);
  assert.equal(getMulti('🏆 Final'), 3);
  assert.equal(getMulti('Final'), 3);
});

test('eleições: 1º e 2º turno', () => {
  const cands = [{id: 'a'}, {id: 'b'}, {id: 'c'}];
  const info = resultInfo(cands, {t1: {a: 45, b: 40, c: 15}, t2: {a: 48, b: 52}});
  assert.equal(info.haT2, true);
  assert.equal(info.venc.id, 'b');
  // acertou 1º e 2º, que há 2º turno e a % com erro de 1 p.p.
  assert.equal(calcT1({primeiro: 'a', segundo: 'b', pct: 46}, info).pts, 20 + 15 + 10 + 15);
  assert.equal(calcT2({vencedor: 'b', pct: 55}, info).pts, 30 + 5);
  assert.equal(resultInfo(cands, {t1: {a: 51, b: 40, c: 9}}).haT2, false);
});
