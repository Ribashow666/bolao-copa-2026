// O que o robô deve notificar agora (lógica pura, testada em tests/robo.test.js).
// "enviados" guarda o que já foi avisado; as marcas devolvidas vão pra push/enviados no banco.
import { calcPts } from '../js/pontos.js';
import { KNOWN_PLAYERS, PONTOS_ANTERIORES, classicoDe, multiDe, deduplicarJogos, rankingDe, posicoesDe,
  evolucaoDe, rankingPorDiaDe, kickoffJogo } from '../js/nucleo.js';
import { computeAchievements, BADGE_DEFS } from '../js/achievements.js';

const ROTULO = {exact: 'placar exato! 🎯', vg: 'vencedor + gols do vencedor', diff: 'vencedor + diferença', draw: 'empate certo',
  lg: 'vencedor + gols do perdedor', win: 'acertou o vencedor', almost: 'previu empate', miss: 'errou 🤡'};
const FIM = ['FT', 'AET', 'PEN'];
const JANELA_FIM = 12 * 3600000; // jogo que acabou há mais tempo que isso (ex: primeira vez do robô) só é marcado
// Mesmas regras do site (arquivo da Copa não entra: o robô só olha o bolão atual)
const anterior = n => PONTOS_ANTERIORES[n] || {pts: 0, exatos: 0};
const multi = j => multiDe(j, classicoDe(j));

export function montarEventos({jogosDb, palpites, users, chat, enviados = {}, agora}) {
  const jogos = deduplicarJogos(Object.entries(jogosDb || {}).map(([id, j]) => ({...j, _id: id, palpites: palpites?.[id] || {}, palpitou: {}})));
  const membros = Object.entries(users || {}).filter(([, u]) => u.aprovado === true && u.uid);
  const nomes = membros.map(([, u]) => u.displayName);
  const ranking = conta => rankingDe({jogos, fixos: KNOWN_PLAYERS, nomes, anterior, multi, conta}).sorted;
  const msgs = [], marcas = {};

  // 🏁 Fim de jogo: pontos de cada um e a mudança no ranking (igual ao resumo da Resenha)
  jogos.forEach(j => {
    if (!FIM.includes(j.status) || j.resultado?.casa == null || enviados.fim?.[j._id]) return;
    marcas[`fim/${j._id}`] = agora;
    const k = kickoffJogo(j) || 0;
    if (agora - k > JANELA_FIM) return;
    const antes = posicoesDe(ranking(x => x._id !== j._id && (kickoffJogo(x) || 0) <= k));
    const depois = posicoesDe(ranking(x => (kickoffJogo(x) || 0) <= k));
    const m = multi(j), placar = `${j.casa} ${j.resultado.casa}x${j.resultado.fora} ${j.fora}`;
    membros.forEach(([key, u]) => {
      const n = u.displayName, p = j.palpites[n], r = p && calcPts(j.resultado, p);
      const pos = !depois[n] ? '' : antes[n] && depois[n] < antes[n] ? ` · subiu pro ${depois[n]}º 📈`
        : antes[n] && depois[n] > antes[n] ? ` · caiu pro ${depois[n]}º 📉` : ` · você está em ${depois[n]}º`;
      const texto = r ? `Seu palpite ${p.casa}x${p.fora}: ${Math.round(r.pts * m)} pts (${ROTULO[r.tipo]}${m > 1 ? ` ×${m}` : ''})${pos}`
        : `Você não palpitou 😴${pos}`;
      msgs.push({para: key, titulo: `🏁 Fim de jogo: ${placar}`, texto, tag: `fim_${j._id}`});
    });
  });

  // 🙋 Cadastro novo: avisa os admins
  const admins = membros.filter(([, u]) => u.isAdmin === true).map(([k]) => k);
  Object.entries(users || {}).forEach(([key, u]) => {
    if (!u.uid || u.aprovado === true || enviados.cadastro?.[key]) return;
    marcas[`cadastro/${key}`] = agora;
    admins.forEach(a => msgs.push({para: a, titulo: '🙋 Novo cadastro', texto: `${u.displayName} pediu pra entrar no bolão. Aprove no Admin.`, tag: `cadastro_${key}`}));
  });

  // 🏆 Conquista nova (na primeira vez de cada um só registra o que já tinha, pra não avisar tudo de uma vez)
  const allPlayers = [...new Set([...KNOWN_PLAYERS, ...jogos.flatMap(j => Object.keys(j.palpites))])];
  const earned = computeAchievements(jogos, rankingPorDiaDe(evolucaoDe({jogos, fixos: KNOWN_PLAYERS, anterior, multi})), allPlayers);
  membros.forEach(([key, u]) => {
    const tem = [...(earned[u.displayName] || [])].sort(), atual = tem.join(','), antes = enviados.conquistas?.[key];
    if (antes === atual) return;
    marcas[`conquistas/${key}`] = atual;
    if (antes == null) return;
    const velhas = new Set(antes.split(','));
    tem.filter(id => !velhas.has(id)).forEach(id => {
      const b = BADGE_DEFS.find(b => b.id === id);
      if (b) msgs.push({para: key, titulo: `🏆 Conquista desbloqueada: ${b.name}`, texto: b.desc, tag: `conquista_${id}`});
    });
  });

  // 💬 Marcação na Resenha (@Milho). Na primeira vez só guarda até onde já leu.
  const lido = enviados.chatTs;
  const ultimo = Math.max(lido || 0, ...(chat || []).map(c => c.ts || 0));
  if (ultimo !== lido) marcas.chatTs = ultimo;
  if (lido != null) (chat || []).filter(c => c.ts > lido && !c.apagada && c.texto).forEach(c => {
    const marcados = new Set([...c.texto.matchAll(/@([A-Za-z0-9]{2,20})/g)].map(x => x[1].toLowerCase()));
    membros.forEach(([key]) => {
      if (marcados.has(key) && key !== c.key)
        msgs.push({para: key, titulo: `💬 ${c.nome} te marcou na Resenha`, texto: c.texto.slice(0, 200), tag: `chat_${key}`});
    });
  });

  return {msgs, marcas};
}
