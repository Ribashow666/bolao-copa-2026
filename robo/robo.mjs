// Robô do bolão: roda no GitHub Actions a cada 5 min (.github/workflows/robo.yml).
// 1) busca agenda e placar na ESPN (o placar não depende mais de alguém estar com o site aberto)
// 2) manda as notificações push pro app Android (regras em eventos.mjs)
// Usa a conta de serviço do Firebase (segredo FIREBASE_SERVICE_ACCOUNT no GitHub): ela passa por cima das regras do banco.
import admin from 'firebase-admin';
import { buscarAgenda, buscarAoVivo, emAndamentoDe, mesclarJogo } from '../js/espn.js';
import { montarEventos } from './eventos.mjs';

if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
  console.log('Sem o segredo FIREBASE_SERVICE_ACCOUNT: nada a fazer.');
  process.exit(0);
}
admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
  databaseURL: 'https://bolao-copa-2026-ef7f5-default-rtdb.firebaseio.com',
});
const db = admin.database();
const ler = async caminho => (await db.ref(caminho).get()).val();
const agora = Date.now();

// ── 1. Placar ──
const mp = (await ler('bolao/mp')) || {};
const jogosDb = mp.jogos || {};
const completa = agora - (mp.lastSync || 0) > 30 * 60000;
const emAndamento = emAndamentoDe(jogosDb, agora);
try {
  let novos = [];
  if (completa) {
    await db.ref('bolao/mp/lastSync').set(agora);
    novos = await buscarAgenda(jogosDb, mp.config?.inicio || agora);
  } else if (emAndamento.length) {
    await db.ref('bolao/mp/lastLiveSync').set(agora);
    novos = await buscarAoVivo(emAndamento);
  }
  // admin: o robô pode corrigir horário de jogo remarcado (o site de quem não é admin não pode)
  for (const j of novos) await db.ref(`bolao/mp/jogos/espn_${j.espnId}`).transaction(atual => mesclarJogo(atual, j, {uid: 'robo', admin: true}));
  console.log(`ESPN: ${novos.length} jogo(s) ${completa ? '(agenda)' : emAndamento.length ? '(ao vivo)' : ''}`);
} catch (e) {
  console.error('ESPN falhou (tenta de novo na próxima rodada):', e.message);
}

// ── 2. Notificações ──
const [jogos, palpites, users, chat, enviados, tokens] = await Promise.all([
  ler('bolao/mp/jogos'), ler('palpites'), ler('bolao/users'),
  db.ref('chat/mensagens').limitToLast(100).get().then(s => Object.values(s.val() || {})),
  ler('push/enviados'), ler('pushTokens'),
]);
const {msgs, marcas} = montarEventos({jogosDb: jogos || {}, palpites: palpites || {}, users: users || {}, chat, enviados: enviados || {}, agora});

const TOKEN_MORTO = ['messaging/registration-token-not-registered', 'messaging/invalid-registration-token', 'messaging/invalid-argument'];
const atualizar = {};
let enviadas = 0;
for (const m of msgs) {
  const uid = users?.[m.para]?.uid, lista = Object.keys(tokens?.[uid] || {});
  if (!lista.length) continue;
  // Só "data": quem monta a notificação é o app (mesmo visual dos lembretes)
  const r = await admin.messaging().sendEachForMulticast({tokens: lista, data: {titulo: m.titulo, texto: m.texto, tag: m.tag}, android: {priority: 'high'}});
  enviadas += r.successCount;
  r.responses.forEach((x, i) => { if (!x.success && TOKEN_MORTO.includes(x.error?.code)) atualizar[`pushTokens/${uid}/${lista[i]}`] = null; });
}
for (const [k, v] of Object.entries(marcas)) atualizar[`push/enviados/${k}`] = v;
if (Object.keys(atualizar).length) await db.ref().update(atualizar);
console.log(`Push: ${msgs.length} evento(s), ${enviadas} entregue(s), ${Object.values(atualizar).filter(v => v === null).length} celular(es) desconectado(s)`);
process.exit(0);
