// Núcleo do bolão (lógica pura, sem Firebase nem tela): jogos, clássico, ranking e evolução.
// Usado pelo site (main.js) e pelo robô das notificações (robo/), pra os dois contarem os pontos igual.
import { calcPts, getMulti } from "./pontos.js";

export const KNOWN_PLAYERS = ['Milho','Wly','Igor','Jucas','Wendel','Pedru','Vini','Melk','Gilles'];
// Pontos da tabela antiga (antes do site), somados ao que o site calcula. Vai até NAU 0x2 NOV.
export const PONTOS_ANTERIORES = {Wly:{pts:615, exatos:9}, Igor:{pts:511, exatos:7}, Milho:{pts:497, exatos:7}, Jucas:{pts:427, exatos:8}, Wendel:{pts:348, exatos:4}};

export const toKey = s => s.toLowerCase().trim().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,'');

// Clássico pernambucano (Sport, Náutico, Santa Cruz entre si) vale ×2 — só de CLASSICO_DESDE em diante,
// pra não mudar os pontos de jogo que já foi contado. Se for mata-mata, fica o multiplicador maior.
const CLASSICO_DESDE = '2026-10-12';
const TIMES_CLASSICO = {sport:'sport', sport_recife:'sport', nautico:'nautico', santa_cruz:'santacruz'};
export const classicoDe = j => (j.data||'') >= CLASSICO_DESDE &&
  !!TIMES_CLASSICO[toKey(j.casa||'')] && !!TIMES_CLASSICO[toKey(j.fora||'')] &&
  TIMES_CLASSICO[toKey(j.casa)] !== TIMES_CLASSICO[toKey(j.fora)];
export const multiDe = (j, classico) => classico ? Math.max(2, getMulti(j.fase)) : getMulti(j.fase);

// data + hora (BRT) → timestamp
export function kickoffDe(data, hora) {
  const [h, mi] = hora.split(':').map(Number);
  const [y, mo, d] = data.split('-').map(Number);
  return Date.UTC(y, mo-1, d, h+3, mi, 0);
}
// As regras do banco usam o campo kickoff pra fechar os palpites: a tela usa o mesmo valor
export const kickoffJogo = jogo => jogo.kickoff || (jogo.data && jogo.hora ? kickoffDe(jogo.data, jogo.hora) : null);

// ── "Dia de exibição" do jogo: jogos de madrugada (antes das 06h) aparecem no dia anterior ──
export function diaExibicao(jogo) {
  if (!jogo.hora) return jogo.data;
  const [h] = jogo.hora.split(':').map(Number);
  if (h < 6) {
    const d = new Date(jogo.data + 'T12:00:00');
    d.setDate(d.getDate() - 1);
    return d.toISOString().substring(0, 10);
  }
  return jogo.data;
}

// Normaliza nome de time pra comparar entre fontes diferentes (maiúsc., acento, espaço)
export const normTeam = s => (s||'').toLowerCase().trim()
  .normalize('NFD').replace(/[̀-ͯ]/g,'')
  .replace(/\s+/g,' ');

// ── Aliases: mesma seleção, nomes diferentes entre fontes (API oficial FIFA vs nomes "comuns") ──
// Causa raiz do bug: "Turkey" (cadastro manual/fonte antiga) x "Türkiye" (API openfootball)
// não batem em normTeam(), então nunca são vistos como o mesmo jogo e a duplicata sempre volta.
const TEAM_ALIASES = {
  'turkey':'turkiye', 'turkiye':'turkiye',
  'usa':'unitedstates', 'us':'unitedstates', 'united states':'unitedstates', 'united states of america':'unitedstates',
  'south korea':'korearepublic', 'korea republic':'korearepublic', 'korea, republic of':'korearepublic',
  'ivory coast':'cotedivoire', "cote d'ivoire":'cotedivoire', 'cote divoire':'cotedivoire',
  'bosnia and herzegovina':'bosniaherzegovina', 'bosnia & herzegovina':'bosniaherzegovina', 'bosnia':'bosniaherzegovina',
  'czech republic':'czechia', 'czechia':'czechia',
  'cape verde':'capeverde', 'cabo verde':'capeverde',
  'dr congo':'congodr', 'democratic republic of the congo':'congodr', 'congo dr':'congodr',
  'north macedonia':'macedonia', 'macedonia':'macedonia',
};

// Chave canônica do time: resolve aliases por cima da normalização, pra unir times com nomes diferentes
export function canonTeam(name) {
  const nt = normTeam(name);
  return TEAM_ALIASES[nt] || nt.replace(/\s+/g, '');
}

// "Quanto de informação" um registro de jogo tem — usado pra decidir qual cópia manter
function scoreJogo(j) {
  return (j.resultado?.casa != null ? 2 : 0) + Object.keys(j.palpites||{}).length;
}

// Agrupa uma lista de jogos (com _id) por casa+fora, tolerando até 1 dia de diferença de data
export function agruparJogos(lista) {
  const groups = [];
  for (const j of lista) {
    const ct = canonTeam(j.casa), ft = canonTeam(j.fora);
    const jDate = j.data ? new Date(j.data+'T00:00:00') : null;
    const target = groups.find(g => {
      if (g.ct !== ct || g.ft !== ft) return false;
      if (!jDate || !g.date) return true;
      return Math.abs((jDate - g.date) / 86400000) <= 1;
    });
    if (target) target.items.push(j);
    else groups.push({ct, ft, date: jDate, items: [j]});
  }
  return groups;
}

// Fase "Copa do Mundo" é só um fallback genérico (quando a fonte não trouxe group/round).
// Ao mesclar duplicatas, sempre preferimos a fase específica de qualquer cópia que a tenha.
function bestFase(items) {
  const generic = f => !f || f === 'Copa do Mundo';
  const specific = items.find(it => !generic(it.fase));
  return specific ? specific.fase : (items[0].fase || '');
}

// ── DEDUPLICAR jogos ({...jogo, _id, palpites, palpitou}) por casa+fora, tolerando até 1 dia de diferença de data
//    (jogos vindos de fontes/fusos diferentes podem cair em datas vizinhas). Devolve em ordem de data/hora. ──
export function deduplicarJogos(lista) {
  const all = [...lista].sort((a,b)=>{
    const dd = a.data>b.data ? 1 : a.data<b.data ? -1 : 0;
    return dd || ((a.hora||'')>(b.hora||'') ? 1 : -1);
  });
  return agruparJogos(all).map(g => {
    let best = g.items[0], bestScore = scoreJogo(best);
    g.items.slice(1).forEach(item => {
      const s = scoreJogo(item);
      if (s > bestScore) { best = item; bestScore = s; }
    });
    // Mescla palpites de todas as cópias do mesmo jogo, pra ninguém perder o voto
    const palpitesMerged = {};
    const palpitouMerged = {};
    g.items.forEach(item => { Object.assign(palpitesMerged, item.palpites||{}); Object.assign(palpitouMerged, item.palpitou||{}); });
    return {...best, fase: bestFase(g.items), palpites: palpitesMerged, palpitou: palpitouMerged};
  });
}

// Ranking: fixos e nomes (cadastrados) aparecem com os pontos anteriores; conta(jogo) escolhe quais jogos entram
export function rankingDe({jogos, fixos, nomes = [], anterior, multi, conta = () => true}) {
  const pts={}, exact={};
  fixos.forEach(j=>{pts[j]=anterior(j).pts; exact[j]=anterior(j).exatos;});
  nomes.forEach(n=>{
    if(pts[n]==null) { pts[n]=anterior(n).pts; exact[n]=anterior(n).exatos; }
  });
  jogos.forEach(jogo=>{
    if (jogo.resultado?.casa == null || !conta(jogo)) return;
    const m = multi(jogo);
    Object.entries(jogo.palpites||{}).forEach(([jogador,p])=>{
      const r=calcPts(jogo.resultado,p);
      if(r){
        pts[jogador]=(pts[jogador]||0)+(r.pts*m);
        if(r.tipo==='exact') exact[jogador]=(exact[jogador]||0)+1;
      }
    });
  });
  const allPalPlayers = new Set();
  jogos.forEach(j=>Object.keys(j.palpites||{}).forEach(n=>allPalPlayers.add(n)));
  const visible = Object.entries(pts).filter(([n])=>fixos.includes(n)||allPalPlayers.has(n));
  return {sorted: visible.sort((a,b)=>b[1]-a[1]), exact};
}

// Posição de cada um (empate divide a posição): {nome: 1, ...}
export const posicoesDe = sorted => Object.fromEntries(sorted.map(([n, p]) => [n, 1 + sorted.filter(([, q]) => q > p).length]));

// ── Evolução de pontos acumulados por jogador, agrupado por dia de exibição ──
export function evolucaoDe({jogos: todos, fixos, anterior, multi}) {
  const jogos = todos
    .filter(j => j.resultado?.casa != null)
    .sort((a,b)=>{
      const da=diaExibicao(a), db_=diaExibicao(b);
      return da>db_ ? 1 : da<db_ ? -1 : 0;
    });

  const allPalPlayers = new Set();
  jogos.forEach(j=>Object.keys(j.palpites||{}).forEach(n=>allPalPlayers.add(n)));
  const jogadores = [...new Set([...fixos, ...allPalPlayers])];

  const dias = [...new Set(jogos.map(j=>diaExibicao(j)))].sort();
  if (!dias.length) return {dias:[], series:{}};

  const acumulado = {};
  jogadores.forEach(j=>acumulado[j]=anterior(j).pts);

  const series = {};
  jogadores.forEach(j=>series[j]=[]);

  dias.forEach(dia=>{
    const jogosDoDia = jogos.filter(j=>diaExibicao(j)===dia);
    jogosDoDia.forEach(jogo=>{
      const m = multi(jogo);
      Object.entries(jogo.palpites||{}).forEach(([jogador,p])=>{
        const r = calcPts(jogo.resultado,p);
        if (r) acumulado[jogador] = (acumulado[jogador]||0) + (r.pts*m);
      });
    });
    jogadores.forEach(j=>series[j].push(acumulado[j]));
  });

  return {dias, series};
}

export function rankingPorDiaDe({dias, series}) {
  const rankings = {};
  dias.forEach((dia, idx) => {
    const rankingDia = Object.entries(series)
      .map(([jogador, pontos]) => ({jogador, pontos: pontos[idx]}))
      .sort((a, b) => b.pontos - a.pontos);
    rankings[dia] = {};
    rankingDia.forEach((item, pos) => { rankings[dia][item.jogador] = pos + 1; });
  });
  return rankings;
}
