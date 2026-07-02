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
  { id: 'estreante',             name: 'Estreante',               rarity: 'bronze',   desc: 'Palpite no primeiro jogo da temporada' },
  { id: 'chute_certeiro',        name: 'Chute Certeiro',          rarity: 'bronze',   desc: 'Acerte seu primeiro placar exato' },
  { id: 'base_solida',           name: 'Base Sólida',             rarity: 'bronze',   desc: 'Acerte o resultado de 5 jogos da fase de grupos' },
  { id: 'apostador_nato',        name: 'Apostador Nato',          rarity: 'bronze',   desc: 'Envie 25 palpites' },
  // 🥈 Prata
  { id: 'fiel_camisa',           name: 'Fiel à Camisa',           rarity: 'prata',    desc: 'Envie 50 palpites' },
  { id: 'sequencia_5',           name: 'Sequência de 5',          rarity: 'prata',    desc: 'Acerte o resultado em 5 jogos seguidos' },
  { id: 'cirurgiao',             name: 'Cirurgião',               rarity: 'prata',    desc: 'Acerte 5 placares exatos no total' },
  { id: 'apostou_contra_todos',  name: 'Apostou Contra Todos',    rarity: 'prata',    desc: 'Acerte o vencedor quando 4+ do grupo palpitaram diferente' },
  { id: 'faro_fino',             name: 'Faro Fino',               rarity: 'prata',    desc: 'Acerte o resultado de 3 jogos do mata-mata (oitavas em diante)' },
  { id: 'semis_blindado',        name: 'Blindado nas Semis',      rarity: 'prata',    desc: 'Acerte o resultado de uma semifinal' },
  { id: 'disputa_terceiro',      name: 'Ninguém Liga pro Terceiro', rarity: 'prata',  desc: 'Acerte o resultado do jogo de 3º lugar' },
  { id: 'meio_caminho',          name: 'Meio do Caminho',         rarity: 'prata',    desc: 'Acerte o resultado de 25 jogos no total' },
  // 🥇 Ouro
  { id: 'vidente',               name: 'Vidente',                 rarity: 'ouro',     desc: 'Seja o 1º a acertar um placar exato na temporada' },
  { id: 'olho_clinico',          name: 'Olho Clínico',            rarity: 'ouro',     desc: 'Acerte 3 placares exatos seguidos' },
  { id: 'bola_cristal_final',    name: 'Bola de Cristal da Final', rarity: 'ouro',    desc: 'Acerte o resultado da Final' },
  { id: 'sniper',                name: 'Sniper',                  rarity: 'ouro',     desc: 'Acerte 10 placares exatos no total' },
  { id: 'rodada_impecavel',      name: 'Rodada Impecável',        rarity: 'ouro',     desc: 'Acerte o resultado de todos os jogos de um mesmo dia (mín. 3 jogos)' },
  { id: 'vidente_final',         name: 'Vidente da Final',        rarity: 'ouro',     desc: 'Acerte o placar EXATO da Final' },
  { id: 'fase_grupos_perfeita',  name: 'Fase de Grupos Perfeita', rarity: 'ouro',     desc: 'Acerte o resultado de todos os jogos de grupo que você palpitou (mín. 6)' },
  // 🎭 Especiais
  { id: 'mao_fria',              name: 'Mão Fria',                rarity: 'especial', desc: 'Erre tudo em 5 jogos seguidos' },
  { id: 'zero_chances',          name: 'Zero Chances',            rarity: 'especial', desc: 'Fique em último no ranking por 7 dias seguidos' },
  { id: 'fenix',                 name: 'Fênix',                   rarity: 'especial', desc: 'Esteve em último lugar em algum momento e terminou no top 3' },
  { id: 'casa_sempre_ganha',     name: 'Casa Sempre Ganha',       rarity: 'especial', desc: 'Coloque o time da casa vencendo em 80%+ dos seus palpites (mín. 10)' },
  { id: 'contrario_de_tudo',     name: 'O Contrário de Tudo',     rarity: 'especial', desc: 'Discorde da maioria do grupo em 10+ jogos' },
];

const ZEBRA_MIN_DIFERENTES = 4; // "4+ do grupo palpitaram diferente"
const MIN_DIAS_ULTIMO      = 7; // dias seguidos em último lugar
const MIN_JOGOS_RODADA     = 3; // mínimo de jogos num dia pra valer "Rodada Impecável"
const MIN_JOGOS_GRUPO_PERF = 6; // mínimo de jogos de grupo pra valer "Fase de Grupos Perfeita"
const MIN_PALPITES_CASA    = 10; // mínimo de palpites pra valer "Casa Sempre Ganha"
const MIN_DIVERGENCIAS     = 10; // mínimo de vezes discordando do grupo
const MIN_GRUPO_BASE       = 5;  // mínimo de acertos de grupo pra "Base Sólida"
const MIN_PALPITES_NATO    = 25; // mínimo de palpites pra "Apostador Nato"
const MIN_MATA_MATA_FARO   = 3;  // mínimo de acertos de mata-mata pra "Faro Fino"
const MIN_TOTAL_MEIO       = 25; // mínimo de acertos totais pra "Meio do Caminho"

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
const isSemi      = fase => /semi/i.test(fase || '');
const isTerceiro  = fase => /3º|3o\b/i.test(fase || '');
const isGrupo     = fase => /grupo/i.test(fase || '');

// Mesma chave de ordenação cronológica usada no main.js (data + hora, ambos zero-padded)
const kickoffKey = j => `${j.data || ''}T${j.hora || '00:00'}`;

// ── Verifica se um jogador "discordou da maioria" num jogo (mesma escolha ganhador/empate) ──
function divergiuDoGrupo(jogo, player) {
  const pal = jogo.palpites?.[player];
  if (!pal) return 0;
  const pc = +pal.casa, pf = +pal.fora;
  if (isNaN(pc) || isNaN(pf)) return 0;
  const myWC = pc > pf, myDraw = pc === pf;
  let diferentes = 0;
  Object.entries(jogo.palpites).forEach(([outro, op]) => {
    if (outro === player) return;
    const oc = +op.casa, of = +op.fora;
    if (isNaN(oc) || isNaN(of)) return;
    const oWC = oc > of, oDraw = oc === of;
    const mesmaEscolha = (myDraw && oDraw) || (!myDraw && !oDraw && myWC === oWC);
    if (!mesmaEscolha) diferentes++;
  });
  return diferentes;
}

/**
 * Calcula as conquistas de todos os jogadores, de forma retroativa,
 * a partir da lista de jogos (já deduplicada e com resultados) e da
 * tabela de ranking por dia (para os badges "Zero Chances" e "Fênix").
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

  // ── Estreante — palpitou no primeiríssimo jogo da temporada ──
  const primeiroJogo = jogosOrdenados[0];
  if (primeiroJogo) {
    allPlayers.forEach(player => {
      if ((primeiroJogo.palpites || {})[player]) earned[player].add('estreante');
    });
  }

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

  // ── Rodada Impecável — acertou o resultado de todos os jogos de um mesmo dia ──
  const jogosPorDia = {};
  jogosComResultado.forEach(j => {
    if (!j.data) return;
    (jogosPorDia[j.data] ??= []).push(j);
  });
  Object.values(jogosPorDia).forEach(jogosDoDia => {
    if (jogosDoDia.length < MIN_JOGOS_RODADA) return;
    allPlayers.forEach(player => {
      const participou = jogosDoDia.every(j => (j.palpites || {})[player]);
      if (!participou) return;
      const todosCorretos = jogosDoDia.every(j => isResultadoCorreto(classify(j.resultado, j.palpites[player])));
      if (todosCorretos) earned[player].add('rodada_impecavel');
    });
  });

  // ── Por jogador: contagens, sequências e flags ──
  allPlayers.forEach(player => {
    const jogosDoJogador = jogosOrdenados.filter(j => (j.palpites || {})[player]);
    const totalPalpites  = jogosDoJogador.length;
    if (totalPalpites >= 10) earned[player].add('sempre_online');
    if (totalPalpites >= 25) earned[player].add('apostador_nato');
    if (totalPalpites >= 50) earned[player].add('fiel_camisa');

    const decididos = jogosDoJogador.filter(j => j.resultado?.casa != null);

    let curWinSeq = 0, maxWinSeq = 0;
    let curExactSeq = 0, maxExactSeq = 0;
    let curMissSeq = 0, maxMissSeq = 0;
    let exactCount = 0;
    let casaVenceCount = 0, casaValidCount = 0;
    let divergeCount = 0;
    let grupoCorretoCount = 0;
    let mataMataCorretoCount = 0;
    let totalCorretoCount = 0;

    // ── Fase de Grupos Perfeita ──
    const grupoDecididos = decididos.filter(j => isGrupo(j.fase));
    if (grupoDecididos.length >= MIN_JOGOS_GRUPO_PERF) {
      const todosGrupoCorretos = grupoDecididos.every(j => isResultadoCorreto(classify(j.resultado, j.palpites[player])));
      if (todosGrupoCorretos) earned[player].add('fase_grupos_perfeita');
    }

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
        if (isFinal(jogo.fase)) earned[player].add('vidente_final');
      } else {
        curExactSeq = 0;
      }
      if (exactCount >= 1) earned[player].add('chute_certeiro');

      curMissSeq = tipo === 'miss' ? curMissSeq + 1 : 0;
      maxMissSeq = Math.max(maxMissSeq, curMissSeq);

      if (correto) {
        totalCorretoCount++;
        if (isGrupo(jogo.fase)) grupoCorretoCount++;
        if (isMataMata(jogo.fase)) mataMataCorretoCount++;
        if (isMataMata(jogo.fase)) earned[player].add('sobreviveu_oitavas');
        if (isFinal(jogo.fase))    earned[player].add('bola_cristal_final');
        if (isSemi(jogo.fase))     earned[player].add('semis_blindado');
        if (isTerceiro(jogo.fase)) earned[player].add('disputa_terceiro');
      }

      // Casa Sempre Ganha
      const pc = +pal.casa, pf = +pal.fora;
      if (!isNaN(pc) && !isNaN(pf)) {
        casaValidCount++;
        if (pc > pf) casaVenceCount++;
      }

      // Zebra / divergência do grupo
      const diferentes = divergiuDoGrupo(jogo, player);
      if (diferentes >= 1) divergeCount++;
      if (correto && diferentes >= ZEBRA_MIN_DIFERENTES) earned[player].add('apostou_contra_todos');
    });

    if (maxWinSeq >= 3) earned[player].add('sequencia_3');
    if (maxWinSeq >= 5) earned[player].add('sequencia_5');
    if (exactCount >= 5) earned[player].add('cirurgiao');
    if (exactCount >= 10) earned[player].add('sniper');
    if (maxExactSeq >= 3) earned[player].add('olho_clinico');
    if (maxMissSeq >= 5) earned[player].add('mao_fria');
    if (grupoCorretoCount >= MIN_GRUPO_BASE) earned[player].add('base_solida');
    if (mataMataCorretoCount >= MIN_MATA_MATA_FARO) earned[player].add('faro_fino');
    if (totalCorretoCount >= MIN_TOTAL_MEIO) earned[player].add('meio_caminho');
    if (casaValidCount >= MIN_PALPITES_CASA && (casaVenceCount / casaValidCount) >= 0.8) {
      earned[player].add('casa_sempre_ganha');
    }
    if (divergeCount >= MIN_DIVERGENCIAS) earned[player].add('contrario_de_tudo');
  });

  // ── Zero Chances e Fênix — usam o ranking por dia ──
  const dias = Object.keys(rankingPorDia || {}).sort();
  if (dias.length) {
    const totalJogadores = allPlayers.length;
    const ultimoDia = dias[dias.length - 1];
    allPlayers.forEach(player => {
      let streak = 0, maxStreak = 0;
      let esteveEmUltimo = false;
      dias.forEach(dia => {
        const pos = rankingPorDia[dia]?.[player];
        if (pos === totalJogadores) {
          streak++; maxStreak = Math.max(maxStreak, streak);
          esteveEmUltimo = true;
        } else {
          streak = 0;
        }
      });
      if (maxStreak >= MIN_DIAS_ULTIMO) earned[player].add('zero_chances');

      const posFinal = rankingPorDia[ultimoDia]?.[player];
      if (esteveEmUltimo && posFinal != null && posFinal <= 3) {
        earned[player].add('fenix');
      }
    });
  }

  return earned;
}