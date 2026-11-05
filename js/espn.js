// ESPN: busca e tradução dos jogos (sem Firebase nem tela). Usado pelo site (main.js) e pelo robô (robo/).
// API pública (não oficial, sem chave) do site da ESPN. Cobre Série A/B, Copa do Brasil, Copa do Nordeste,
// amistosos e Eliminatórias. NÃO cobre Série C/D nem Pernambucano: esses jogos entram pelo cadastro manual.
export const ESPN = 'https://site.api.espn.com/apis/site/v2/sports/soccer/all';
// IDs dos times na ESPN (conferidos em out/2026)
export const NOSSOS_TIMES = [
  {key:'sport',     nome:'Sport',      espnId:7635},
  {key:'nautico',   nome:'Náutico',    espnId:7633},
  {key:'santacruz', nome:'Santa Cruz', espnId:4929},
  {key:'brasil',    nome:'Brasil',     espnId:205},
];

export const STATUS_FIM = ['FT','AET','PEN','CANC','PST'];
export const STATUS_AO_VIVO = ['1H','HT','2H','ET','BT','P','INT'];


// Timestamp → data/hora em BRT (UTC-3)
export function paraBRT(ts) {
  const d = new Date(ts - 3*3600000);
  return { data: d.toISOString().substring(0,10), hora: d.toISOString().substring(11,16) };
}

// Nome da competição em português. A ESPN manda "2026 Brasileiro Serie B", "2026 International Friendly"...
export function nomeCompeticao(nome) {
  const n = (nome||'').replace(/^\d{4}\s+/, '').trim();
  const l = n.toLowerCase();
  const serie = l.match(/brasileir\w* serie ([a-d])/);
  if (serie)                         return `Brasileirão Série ${serie[1].toUpperCase()}`;
  if (l.includes('copa do brasil'))  return 'Copa do Brasil';
  if (l.includes('nordeste'))        return 'Copa do Nordeste';
  if (l.includes('pernambucano'))    return 'Pernambucano';
  if (l.includes('libertadores'))    return 'Libertadores';
  if (l.includes('sudamericana'))    return 'Sul-Americana';
  if (l.includes('qualifying'))      return 'Eliminatórias';
  if (l.includes('friendly'))        return 'Amistoso';
  if (l.includes('copa am'))         return 'Copa América';
  if (l.includes('world cup'))       return 'Copa do Mundo';
  return n || 'Outros';
}

// Fase em português. Em pontos corridos a ESPN repete o nome da liga no lugar da fase → sem fase.
// "Third Round" da Copa do Brasil é a 3ª fase, não disputa de 3º lugar.
const ORDINAIS = {first:1, second:2, third:3, fourth:4, fifth:5, sixth:6};
export function nomeFase(fase, liga) {
  const r = (fase||'').toLowerCase().trim();
  if (!r || r === (liga||'').toLowerCase().trim()) return '';
  if (r.includes('group'))         return 'Fase de Grupos';
  if (r.includes('round of 32'))   return '16 avos de Final';
  if (r.includes('round of 16'))   return 'Oitavas de Final';
  if (r.includes('quarter'))       return 'Quartas de Final';
  if (r.includes('semi'))          return 'Semifinal';
  if (r.includes('3rd') || r.includes('third place')) return 'Disputa de 3º Lugar';
  if (/^finals?$/.test(r))         return '🏆 Final';
  const ord = r.match(/^(first|second|third|fourth|fifth|sixth) round/);
  if (ord) return `${ORDINAIS[ord[1]]}ª Fase`;
  return fase;
}

// Status da ESPN → códigos que o resto do app já usa (NS, 1H, HT, 2H, FT, AET, PEN...)
export function statusEspn(t) {
  const n = t?.name || '';
  if (n.includes('POSTPONED')) return 'PST';
  if (n.includes('CANCELED') || n.includes('ABANDONED')) return 'CANC';
  if (t?.state === 'pre') return 'NS';
  if (t?.state === 'in') {
    if (n.includes('HALFTIME')) return 'HT';
    if (n.includes('SHOOTOUT')) return 'P';
    if (n.includes('OVERTIME') || n.includes('EXTRA')) return 'ET';
    if (n.includes('SECOND')) return '2H';
    return '1H';
  }
  if (n.includes('PEN')) return 'PEN';
  if (n.includes('AET')) return 'AET';
  return 'FT';
}

// Placar sem pênaltis (com prorrogação, se houve). No schedule o score vem como objeto; no summary, como string.
export function placarEspn(competidores, status) {
  if (['NS','PST','CANC'].includes(status)) return null;
  const gols = lado => {
    const s = competidores.find(c => c.homeAway === lado)?.score;
    const v = typeof s === 'object' ? s?.value : s;
    return v === '' || v == null || isNaN(+v) ? null : +v;
  };
  const casa = gols('home'), fora = gols('away');
  return casa == null || fora == null ? null : {casa, fora};
}

export async function espnGet(path) {
  const resp = await fetch(ESPN + path);
  if (!resp.ok) throw new Error(`ESPN HTTP ${resp.status}`);
  return resp.json();
}

export function eventoParaJogo(ev) {
  const nossos = Object.fromEntries(NOSSOS_TIMES.map(t => [String(t.espnId), t.nome]));
  const comp = ev.competitions?.[0] || {};
  const lado = h => comp.competitors?.find(c => c.homeAway === h) || {};
  const nome = c => nossos[c.team?.id] || c.team?.displayName || '?';
  const kickoff = Date.parse(ev.date);
  const status = statusEspn(comp.status?.type);
  const liga = ev.season?.displayName || ev.league?.name || '';
  return {
    espnId: ev.id, kickoff, ...paraBRT(kickoff),
    casa: nome(lado('home')), fora: nome(lado('away')),
    logoCasa: lado('home').team?.logos?.[0]?.href || null, logoFora: lado('away').team?.logos?.[0]?.href || null,
    competicao: nomeCompeticao(liga), fase: nomeFase(ev.seasonType?.name, liga),
    status, resultado: placarEspn(comp.competitors || [], status),
  };
}

// Junta o jogo vindo da ESPN com o que já está no banco. Quem não é admin não pode mexer no horário,
// nem no placar fora da janela do apito até 4h depois do fim (as regras do banco recusam).
export function mesclarJogo(atual, j, {uid, admin, agora = Date.now()}) {
  const base = atual || {};
  // ESPN ainda sem placar mas o admin já lançou à mão: mantém o resultado e o status do admin
  const manual = !j.resultado && base.resultado?.casa != null;
  const novo = {
    ...base, ...j,
    resultado: j.resultado || base.resultado || {casa:null, fora:null},
    status: manual ? base.status : j.status,
    atualizadoPor: uid, // as regras exigem: fica registrado quem gravou
  };
  if (atual && !admin) {
    Object.assign(novo, {kickoff: base.kickoff, data: base.data, hora: base.hora});
    if (agora < base.kickoff) novo.resultado = base.resultado || {casa:null, fora:null};
    else if (['FT','AET','PEN'].includes(base.status) && agora > base.kickoff + 4*3600000)
      Object.assign(novo, {resultado: base.resultado || {casa:null, fora:null}, status: base.status});
  }
  return novo;
}

// Agenda dos 4 times: só entra jogo a partir do início do bolão (+ os que já estão no banco, pra atualizar placar)
export async function buscarAgenda(jogosDb, inicio) {
  // Sem "fixture=true" vêm os jogos já disputados/em andamento; com ele, os próximos
  const urls = NOSSOS_TIMES.flatMap(t => [`/teams/${t.espnId}/schedule`, `/teams/${t.espnId}/schedule?fixture=true`]);
  const porId = {}; // clássico (ex: Sport x Náutico) vem na lista dos dois times
  (await Promise.all(urls.map(espnGet))).forEach(r => (r.events||[]).forEach(ev => porId[ev.id] = ev));
  const jaTemos = new Set(Object.values(jogosDb).map(j => j.espnId));
  return Object.values(porId)
    .filter(ev => jaTemos.has(ev.id) || Date.parse(ev.date) >= inicio - 86400000)
    .map(eventoParaJogo);
}

// Jogos que podem estar rolando agora (5 min antes do apito até 3h depois)
export const emAndamentoDe = (jogosDb, agora) => Object.values(jogosDb).filter(j =>
  j.espnId && !STATUS_FIM.includes(j.status) && agora >= j.kickoff - 5*60000 && agora < j.kickoff + 180*60000);

// Ao vivo: só placar e status mudam; o resto do jogo continua igual
export const buscarAoVivo = emAndamento => Promise.all(emAndamento.map(async j => {
  const comp = (await espnGet(`/summary?event=${j.espnId}`)).header?.competitions?.[0] || {};
  const status = statusEspn(comp.status?.type);
  return {...j, status, resultado: placarEspn(comp.competitors || [], status)};
}));
