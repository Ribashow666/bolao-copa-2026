import { test } from 'node:test';
import assert from 'node:assert/strict';
import { montarLembretes, MAX_LEMBRETES } from '../js/lembretes.js';

const brt = (dia, hora) => Date.parse(`${dia}T${hora}:00-03:00`);
const jogo = (id, dia, hora, extra = {}) => ({id, casa: 'Sport', fora: 'Náutico', hora, kickoff: brt(dia, hora), dia, classico: false, palpitei: false, ...extra});

test('manhã às 9h, 30 min antes e no apito', () => {
  const l = montarLembretes([jogo('a', '2026-11-05', '16:00', {classico: true})], brt('2026-11-05', '07:00'));
  assert.deepEqual(l.map(n => [n.id, n.quando]), [
    ['dia_2026-11-05', brt('2026-11-05', '09:00')],
    ['falta_a', brt('2026-11-05', '15:30')],
    ['apito_a', brt('2026-11-05', '16:00')],
  ]);
  assert.match(l[0].texto, /Sport x Náutico 16:00 🔥/);
});

test('quem já palpitou não recebe o "faltam 30 min"', () => {
  const l = montarLembretes([jogo('a', '2026-11-05', '16:00', {palpitei: true})], brt('2026-11-05', '07:00'));
  assert.ok(!l.some(n => n.id === 'falta_a'));
});

test('jogo cedo: aviso da manhã 1h antes; o que já passou some', () => {
  const l = montarLembretes([jogo('a', '2026-11-05', '08:00'), jogo('b', '2026-11-05', '20:00')], brt('2026-11-05', '07:45'));
  assert.ok(!l.some(n => n.id.startsWith('dia_')));          // seria 07:00, já passou
  assert.equal(l[0].id, 'apito_a');                           // 07:30 (falta_a) também passou
  const cedo = montarLembretes([jogo('a', '2026-11-05', '08:00')], brt('2026-11-05', '05:00'));
  assert.equal(cedo[0].quando, brt('2026-11-05', '07:00'));
});

test('um aviso de manhã por dia, com todos os jogos; limite de quantidade', () => {
  const l = montarLembretes([jogo('a', '2026-11-05', '16:00'), jogo('b', '2026-11-05', '21:30')], brt('2026-11-04', '12:00'));
  assert.equal(l.filter(n => n.id.startsWith('dia_')).length, 1);
  assert.match(l[0].texto, /16:00 · Sport x Náutico 21:30/);
  const muitos = Array.from({length: 40}, (_, i) => jogo(`j${i}`, '2026-12-01', '16:00'));
  assert.equal(montarLembretes(muitos, brt('2026-11-04', '12:00')).length, MAX_LEMBRETES);
});
