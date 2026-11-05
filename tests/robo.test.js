import { test } from 'node:test';
import assert from 'node:assert/strict';
import { montarEventos } from '../robo/eventos.mjs';

const H = 3600000;
const agora = Date.parse('2026-11-07T23:30:00-03:00');
const users = {
  milho: {displayName: 'Milho', uid: 'u1', aprovado: true, isAdmin: true},
  wly:   {displayName: 'Wly',   uid: 'u2', aprovado: true},
  novo:  {displayName: 'Novo',  uid: 'u3'},                       // aguardando aprovação
};
const jogo = (extra = {}) => ({casa: 'Náutico', fora: 'CRB', data: '2026-11-07', hora: '21:30',
  kickoff: Date.parse('2026-11-07T21:30:00-03:00'), status: 'FT', resultado: {casa: 2, fora: 1}, ...extra});
const base = (extra = {}) => ({jogosDb: {espn_1: jogo()}, palpites: {espn_1: {Milho: {casa: 2, fora: 1}}}, users, chat: [],
  enviados: {chatTs: 0, cadastro: {novo: 1}, conquistas: {milho: '', wly: ''}}, agora, ...extra});
const para = (msgs, k) => msgs.filter(m => m.para === k);

test('fim de jogo: pontos de quem palpitou e aviso de quem não palpitou', () => {
  const {msgs, marcas} = montarEventos(base());
  const fim = msgs.filter(m => m.tag === 'fim_espn_1');
  assert.equal(fim.length, 2);
  assert.match(para(fim, 'milho')[0].texto, /Seu palpite 2x1: 25 pts \(placar exato! 🎯\)/);
  assert.match(para(fim, 'wly')[0].texto, /Você não palpitou/);
  assert.match(fim[0].titulo, /Náutico 2x1 CRB/);
  assert.ok(marcas['fim/espn_1']);
});

test('fim de jogo não repete, e jogo antigo só é marcado', () => {
  assert.equal(montarEventos(base({enviados: {chatTs: 0, cadastro: {novo: 1}, conquistas: {milho: '', wly: ''}, fim: {espn_1: 1}}})).msgs
    .filter(m => m.tag.startsWith('fim')).length, 0);
  const velho = montarEventos(base({agora: agora + 24 * H}));
  assert.equal(velho.msgs.filter(m => m.tag.startsWith('fim')).length, 0);
  assert.ok(velho.marcas['fim/espn_1']);
});

test('jogo sem resultado ou em andamento não avisa', () => {
  const {msgs} = montarEventos(base({jogosDb: {espn_1: jogo({status: '2H'})}}));
  assert.equal(msgs.filter(m => m.tag.startsWith('fim')).length, 0);
});

test('cadastro novo avisa só os admins, uma vez', () => {
  const {msgs, marcas} = montarEventos(base({enviados: {chatTs: 0, conquistas: {milho: '', wly: ''}}}));
  const cad = msgs.filter(m => m.tag === 'cadastro_novo');
  assert.deepEqual(cad.map(m => m.para), ['milho']);
  assert.ok(marcas['cadastro/novo']);
});

test('conquista: primeira vez só registra; depois avisa a nova', () => {
  const primeira = montarEventos(base({enviados: {chatTs: 0, cadastro: {novo: 1}}}));
  assert.equal(primeira.msgs.filter(m => m.tag.startsWith('conquista')).length, 0);
  assert.match(primeira.marcas['conquistas/milho'], /chute_certeiro/);
  const depois = montarEventos(base());
  assert.ok(para(depois.msgs, 'milho').some(m => m.titulo === '🏆 Conquista desbloqueada: Chute Certeiro'));
});

test('marcação na Resenha: avisa o marcado, nunca quem escreveu, nem mensagem já lida', () => {
  const chat = [{nome: 'Wly', key: 'wly', ts: 10, texto: 'e aí @milho, vai palpitar não? @Wly'},
                {nome: 'Wly', key: 'wly', ts: 5, texto: '@milho velha'}];
  const {msgs, marcas} = montarEventos(base({chat, enviados: {chatTs: 7, cadastro: {novo: 1}, conquistas: {milho: '', wly: ''}}}));
  const ch = msgs.filter(m => m.tag.startsWith('chat'));
  assert.deepEqual(ch.map(m => m.para), ['milho']);
  assert.match(ch[0].titulo, /Wly te marcou/);
  assert.equal(marcas.chatTs, 10);
  // primeira vez do robô: só guarda até onde leu
  assert.equal(montarEventos(base({chat, enviados: {cadastro: {novo: 1}, conquistas: {milho: '', wly: ''}}})).msgs.filter(m => m.tag.startsWith('chat')).length, 0);
});
