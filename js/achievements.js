// ════════════════════════════════════════════════════════════════
// 🏆 Sistema de Conquistas (Achievements)
// ════════════════════════════════════════════════════════════════

export const RARITY_META = {
  bronze:   { label: 'Bronze',   icon: '🥉', color: '#C08A4E' },
  prata:    { label: 'Prata',    icon: '🥈', color: '#B9C4CC' },
  ouro:     { label: 'Ouro',     icon: '🥇', color: '#E8C347' },
  especial: { label: 'Especial', icon: '🎭', color: '#B07CE0' },
};

export const BADGE_DEFS = [
  // 🥉 Bronze
  { id: 'sempre_online',         name: 'Sempre Online',           rarity: 'bronze',   desc: 'Envie 10 palpites' },
  { id: 'sequencia_3',           name: 'Sequência de 3',          rarity: 'bronze',   desc: 'Acerte o resultado em 3 jogos seguidos' },
  { id: 'sobreviveu_oitavas',    name: 'Sobreviveu às Oitavas',   rarity: 'bronze',   desc: 'Acerte 1 resultado do mata-mata (oitavas em diante)' },
  // 🥈 Prata
  { id: 'fiel_camisa',           name: 'Fiel à Camisa',           rarity: 'prata',    desc: 'Envie 50 palpites' },
  { id: 'sequencia_5',           name: 'Sequência de 5',          rarity: 'prata',    desc: 'Acerte o resultado em 5 jogos seguidos' },
  { id: 'cirurgiao',             name: 'Cirurgião',               rarity: 'prata',    desc: 'Acerte 5 placares exatos no total' },
  { id: 'nao_fugiu',             name: 'Não Fugiu de Nenhuma',    rarity: 'prata',    desc: 'Palpite em 100% dos jogos da fase de grupos' },
  { id: 'apostou_contra_todos',  name: 'Apostou Contra Todos',    rarity: 'prata',    desc: 'Acerte o vencedor quando 4+ do grupo palpitaram diferente' },
  // 🥇 Ouro
  { id: 'vidente',               name: 'Vidente',                 rarity: 'ouro',     desc: 'Seja o 1º a acertar um placar exato na temporada' },
  { id: 'olho_clinico',          name: 'Olho Clínico',            rarity: 'ouro',     desc: 'Acerte 3 placares exatos seguidos' },
  { id: 'bola_cristal_final',    name: 'Bola de Cristal da Final', rarity: 'ouro',    desc: 'Acerte o resultado da Final' },
  // 🎭 Especiais
  { id: 'mao_fria',              name: 'Mão Fria',                rarity: 'especial', desc: 'Erre tudo em 5 jogos seguidos' },
  { id: 'zero_chances',          name: 'Zero Chances',            rarity: 'especial', desc: 'Fique em último no ranking por 7 dias seguidos' },
];

const ZEBRA_MIN_DIFERENTES = 4; // "4+ do grupo palpitaram diferente"
const MIN_DIAS_ULTIMO      = 7; // dias seguidos em último lugar

// ── Classifica o tipo de resultado de um palpite (mesma lógica do calcPts) ──
function classify(real, pal) {
  if (real?.casa == null || !pal) return null;
  const rc = +real.casa, rf = +real.fora, pc = +pal.casa, pf = +pal.fora;
  if ([rc, rf, pc, pf].some(isNaN)) return null;
  if (rc === pc && rf === pf) return 'exact';
  const pD = pc === pf, rD = rc === rf;
  if (pD && !rD) return 'almost';
  if (rD && !pD) return 'miss';
  if (rD && pD)  return 'draw';
  const rWC = rc > rf, pWC = pc > pf;
  if (rWC !== pWC) return 'miss';
  const wg = rWC ? rc : rf, pwg = pWC ? pc : pf;
  if (pwg === wg) return 'vg';
  if ((rc - rf) === (pc - pf)) return 'diff';
  const lg = rWC ? rf : rc, plg = pWC ? pf : pc;
  if (plg === lg) return 'lg';
  return 'win';
}

// "Acertou o resultado" = acertou o vencedor OU acertou o empate (qualquer tipo com pts>0 exceto 'almost')
const RESULTADO_CORRETO = new Set(['exact', 'vg', 'diff', 'lg', 'win', 'draw']);
const isResultadoCorreto = tipo => RESULTADO_CORRETO.has(tipo);

const isMataMata = fase => /oitava|quarta|semi|3º|3o\b|final/i.test(fase || '');
const isFinal     = fase => /final/i.test(fase || '') && !/semi/i.test(fase || '') && !/3º|3o\b/i.test(fase || '');
const isGrupo     = fase => /grupo/i.test(fase || '');

// Mesma chave de ordenação cronológica usada no main.js (data + hora, ambos zero-padded)
const kickoffKey = j => `${j.data || ''}T${j.hora || '00:00'}`;

/**
 * Calcula as conquistas de todos os jogadores, de forma retroativa,
 * a partir da lista de jogos (já deduplicada e com resultados) e da
 * tabela de ranking por dia (para o badge "Zero Chances").
 *
 * @param {Array} jogos - resultado de getJogos(), cada item com {casa,fora,data,hora,fase,resultado,palpites}
 * @param {Object} rankingPorDia - resultado de computeRankingPorDia(): {dia: {jogador: posicao}}
 * @param {Array<string>} allPlayers - lista de todos os nomes de jogadores a considerar
 * @returns {Object} { [jogador]: Set<string badgeId> }
 */
export function computeAchievements(jogos, rankingPorDia, allPlayers) {
  const earned = {};
  allPlayers.forEach(p => { earned[p] = new Set(); });

  const jogosOrdenados = [...jogos].sort((a, b) => {
    const ka = kickoffKey(a), kb = kickoffKey(b);
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });

  const jogosComResultado = jogosOrdenados.filter(j => j.resultado?.casa != null);
  const jogosDeGrupo      = jogosOrdenados.filter(j => isGrupo(j.fase));

  // ── 1º placar exato da temporada (Vidente) — retroativo, premia quem foi o 1º ──
  for (const jogo of jogosComResultado) {
    const acertantes = Object.entries(jogo.palpites || {})
      .filter(([, pal]) => classify(jogo.resultado, pal) === 'exact')
      .map(([nome]) => nome);
    if (acertantes.length) {
      acertantes.forEach(nome => earned[nome]?.add('vidente'));
      break; // só o primeiro jogo com exato conta
    }
  }

  // ── Por jogador: contagens, sequências e flags ──
  allPlayers.forEach(player => {
    const jogosDoJogador = jogosOrdenados.filter(j => (j.palpites || {})[player]);
    const totalPalpites  = jogosDoJogador.length;
    if (totalPalpites >= 10) earned[player].add('sempre_online');
    if (totalPalpites >= 50) earned[player].add('fiel_camisa');

    // "Não Fugiu de Nenhuma" — palpitou em 100% dos jogos de grupo já cadastrados
    if (jogosDeGrupo.length && jogosDeGrupo.every(j => (j.palpites || {})[player])) {
      earned[player].add('nao_fugiu');
    }

    const decididos = jogosDoJogador.filter(j => j.resultado?.casa != null);

    let curWinSeq = 0, maxWinSeq = 0;
    let curExactSeq = 0, maxExactSeq = 0;
    let curMissSeq = 0, maxMissSeq = 0;
    let exactCount = 0;

    decididos.forEach(jogo => {
      const pal  = jogo.palpites[player];
      const tipo = classify(jogo.resultado, pal);
      if (!tipo) return;
      const correto = isResultadoCorreto(tipo);

      curWinSeq = correto ? curWinSeq + 1 : 0;
      maxWinSeq = Math.max(maxWinSeq, curWinSeq);

      if (tipo === 'exact') {
        exactCount++;
        curExactSeq++;
        maxExactSeq = Math.max(maxExactSeq, curExactSeq);
      } else {
        curExactSeq = 0;
      }

      curMissSeq = tipo === 'miss' ? curMissSeq + 1 : 0;
      maxMissSeq = Math.max(maxMissSeq, curMissSeq);

      if (correto && isMataMata(jogo.fase)) earned[player].add('sobreviveu_oitavas');
      if (correto && isFinal(jogo.fase))    earned[player].add('bola_cristal_final');

      // Zebra: acertou o vencedor quando 4+ do grupo palpitaram diferente
      if (correto) {
        const myWC   = (+pal.casa) > (+pal.fora);
        const myDraw = (+pal.casa) === (+pal.fora);
        let diferentes = 0;
        Object.entries(jogo.palpites).forEach(([outro, op]) => {
          if (outro === player) return;
          const oc = +op.casa, of = +op.fora;
          if (isNaN(oc) || isNaN(of)) return;
          const oWC = oc > of, oDraw = oc === of;
          const mesmaEscolha = (myDraw && oDraw) || (!myDraw && !oDraw && myWC === oWC);
          if (!mesmaEscolha) diferentes++;
        });
        if (diferentes >= ZEBRA_MIN_DIFERENTES) earned[player].add('apostou_contra_todos');
      }
    });

    if (maxWinSeq >= 3) earned[player].add('sequencia_3');
    if (maxWinSeq >= 5) earned[player].add('sequencia_5');
    if (exactCount >= 5) earned[player].add('cirurgiao');
    if (maxExactSeq >= 3) earned[player].add('olho_clinico');
    if (maxMissSeq >= 5) earned[player].add('mao_fria');
  });

  // ── Zero Chances — último colocado por 7 dias seguidos ──
  const dias = Object.keys(rankingPorDia || {}).sort();
  if (dias.length) {
    const totalJogadores = allPlayers.length;
    allPlayers.forEach(player => {
      let streak = 0, maxStreak = 0;
      dias.forEach(dia => {
        const pos = rankingPorDia[dia]?.[player];
        if (pos === totalJogadores) { streak++; maxStreak = Math.max(maxStreak, streak); }
        else streak = 0;
      });
      if (maxStreak >= MIN_DIAS_ULTIMO) earned[player].add('zero_chances');
    });
  }

  return earned;
}