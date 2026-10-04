// ═══════════════════════════════════════════════════════════════════
//  Bolão Eleições 2026 — jogo extra do Bolão Muita Paz
//  Presidente + Governador de PE · 1º e 2º turno
//  Dados no Firebase: bolao/eleicoes/{config, resultados, palpites}
// ═══════════════════════════════════════════════════════════════════

// ── Pontuação (ajuste aqui se o grupo quiser outras regras) ──────────
export const PTS = {
  PRIMEIRO: 20,        // acertou quem fica em 1º
  SEGUNDO: 15,         // acertou quem fica em 2º
  TROCADO: 5,          // escolheu um dos 2 primeiros, mas na posição errada
  HAVERA_T2: 10,       // acertou se haverá (ou não) 2º turno
  VENCEDOR_T2: 30,     // acertou o vencedor do 2º turno
  PCT: [[1, 15], [2.5, 10], [5, 5]],  // erro máx. em p.p. na % do vencedor → pontos
};

// Fecha 08:00 (horário de Brasília/Recife) — quando as urnas abrem
export const LOCK_DEFAULT = {
  t1: '2026-10-04T08:00:00-03:00',
  t2: '2026-10-25T08:00:00-03:00',
};

export const RACES = {
  pres: { nome: 'Presidente',       icon: '🇧🇷', vice: true  },
  gov:  { nome: 'Governador de PE', icon: '🏛️', vice: false },
};

const keyOf = s => String(s).toLowerCase().trim().normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
const mk = (nome, partido, num, vice = '') => ({ id: keyOf(nome), nome, partido, num, vice });

// Candidatos registrados (fonte: TSE via imprensa, 02/10/2026).
// Marçal (PRTB) ficou de fora: registro indeferido pelo TSE em 11/09.
// O admin pode editar tudo isso pelo app, sem mexer no código.
export const DEFAULT_CANDS = {
  pres: [
    mk('Lula', 'PT', 13, 'Geraldo Alckmin'),
    mk('Flávio Bolsonaro', 'PL', 22, 'Alfredo Gaspar'),
    mk('Ronaldo Caiado', 'PSD', 55, 'Gilberto Kassab'),
    mk('Romeu Zema', 'Novo', 30, 'Eduardo Girão'),
    mk('Renan Santos', 'Missão', 14, 'Aroldo Medina'),
    mk('Augusto Cury', 'Avante', 70, 'Júlio Delgado'),
    mk('Edmilson Costa', 'PCB', 21, 'Cleusa Santos'),
    mk('Hertz Dias', 'PSTU', 16, 'Vanessa Portugal'),
    mk('Samara Martins', 'UP', 80, 'Raquel Brício'),
    mk('Wilson Grassi', 'Democrata', 35, 'Suêd Haidar'),
    mk('Clariana Barão', 'DC', 27, 'Fabiana Torquato'),
    mk('Rui Costa Pimenta', 'PCO', 29, 'Antônio Carlos Silva'),
  ],
  gov: [
    mk('Raquel Lyra', 'PSD', 55),
    mk('João Campos', 'PSB', 40),
    mk('Ivan Moraes', 'PSOL', 50),
    mk('Maria Camila', 'UP', 80),
    mk('Renan Hallais', 'Missão', 14),
    mk('Jeremias Cosmo', 'Democrata', 35),
    mk('Guilherme Fonseca', 'PSTU', 16),
    mk('Victor Assis', 'PCO', 29),
  ],
};

// ── Lógica pura (testável sem Firebase) ─────────────────────────────
const fmt = n => (Math.round(n * 100) / 100).toString().replace('.', ',');
const bandPts = err => { for (const [lim, p] of PTS.PCT) if (err <= lim + 1e-9) return p; return 0; };

// A partir dos % lançados pelo admin, descobre 1º, 2º, se há 2º turno e o vencedor.
export function resultInfo(cands, res) {
  const r1 = res?.t1;
  if (!r1) return null;
  const list = cands.map(x => ({ ...x, pct: Number(r1[x.id]) || 0 })).sort((a, b) => b.pct - a.pct);
  if (list.length < 2 || list[0].pct <= 0) return null;
  const haT2 = list[0].pct <= 50;               // só vence no 1º turno com MAIS de 50% dos válidos
  const finalistas = haT2 ? [list[0], list[1]] : [];
  let venc = null;
  if (haT2 && res.t2) {
    const [a, b] = finalistas;
    const pa = Number(res.t2[a.id]) || 0, pb = Number(res.t2[b.id]) || 0;
    if (pa + pb > 0) venc = pa >= pb ? { ...a, pct: pa } : { ...b, pct: pb };
  }
  return { list, primeiro: list[0], segundo: list[1], haT2, finalistas, venc };
}

export function calcT1(p, info) {
  if (!p || !info) return null;
  let pts = 0; const d = [];
  const add = (txt, v, ok) => { pts += v; d.push({ txt, v, ok }); };
  if (p.primeiro === info.primeiro.id) add('1º colocado', PTS.PRIMEIRO, true);
  else if (p.primeiro === info.segundo.id) add('1º colocado (ficou em 2º)', PTS.TROCADO, 'part');
  else add('1º colocado', 0, false);
  if (p.segundo === info.segundo.id) add('2º colocado', PTS.SEGUNDO, true);
  else if (p.segundo === info.primeiro.id) add('2º colocado (ficou em 1º)', PTS.TROCADO, 'part');
  else add('2º colocado', 0, false);
  const previuT2 = Number(p.pct) <= 50;
  add('Haverá 2º turno?', previuT2 === info.haT2 ? PTS.HAVERA_T2 : 0, previuT2 === info.haT2);
  const err = Math.abs(Number(p.pct) - info.primeiro.pct), bp = bandPts(err);
  add(`% do 1º (erro de ${fmt(err)} p.p.)`, bp, bp === PTS.PCT[0][1] ? true : bp > 0 ? 'part' : false);
  return { pts, d };
}

export function calcT2(p, info) {
  if (!p || !info?.venc) return null;
  let pts = 0; const d = [];
  const add = (txt, v, ok) => { pts += v; d.push({ txt, v, ok }); };
  const okV = p.vencedor === info.venc.id;
  add('Vencedor do 2º turno', okV ? PTS.VENCEDOR_T2 : 0, okV);
  const err = Math.abs(Number(p.pct) - info.venc.pct), bp = bandPts(err);
  add(`% do vencedor (erro de ${fmt(err)} p.p.)`, bp, bp === PTS.PCT[0][1] ? true : bp > 0 ? 'part' : false);
  return { pts, d };
}

// ── Integração com o app ────────────────────────────────────────────
export function initEleicoes(ctx) {
  const { db, ref, set, update, getUser, getData, showToast, rerender, emo } = ctx;
  const S = { view: 'palpitar', draft: {} };   // draft: valor digitado por id de campo (sobrevive a re-render)

  const E = () => getData().eleicoes || {};
  const me = () => getUser();
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = s => { const n = parseFloat(String(s).replace(',', '.')); return isNaN(n) ? null : n; };
  const dv = (id, saved) => S.draft[id] ?? saved ?? '';
  const clearDraft = prefix => Object.keys(S.draft).filter(k => k.startsWith(prefix)).forEach(k => delete S.draft[k]);

  const cands = race => {
    const c = E().config?.cands?.[race];
    const arr = c ? Object.values(c) : DEFAULT_CANDS[race];
    return arr.map(x => ({ ...x, id: x.id || keyOf(x.nome) }));
  };
  const lock = t => E().config?.lock?.[t] || LOCK_DEFAULT[t];
  const isOpen = t => Date.now() < Date.parse(lock(t));
  const fmtLock = iso => new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Recife', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', ' ·');
  const restante = iso => {
    const ms = Date.parse(iso) - Date.now();
    if (ms <= 0) return '';
    const m = Math.floor(ms / 60000), d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60);
    return d > 0 ? `faltam ${d}d ${h}h` : h > 0 ? `faltam ${h}h ${m % 60}min` : `faltam ${Math.max(m, 1)}min`;
  };
  const infoOf = race => resultInfo(cands(race), E().resultados?.[race]);
  const nameOf = (race, id) => cands(race).find(x => x.id === id)?.nome || '—';

  function calcRace(race, pal) {
    const info = infoOf(race);
    const t1 = calcT1(pal?.t1, info), t2 = calcT2(pal?.t2, info);
    return { t1, t2, total: (t1?.pts || 0) + (t2?.pts || 0), info };
  }

  function computeRank() {
    const rows = Object.entries(E().palpites || {}).map(([k, v]) => {
      const pres = calcRace('pres', v.pres), gov = calcRace('gov', v.gov);
      return { k, nome: getData().users?.[k]?.displayName || v.nome || k, pres: pres.total, gov: gov.total, total: pres.total + gov.total };
    });
    return rows.sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome));
  }

  // ── Pedaços de UI ──
  const field = (label, inner) => `<div class="el-field"><label class="form-label">${label}</label>${inner}</div>`;
  const lockBadge = t => isOpen(t)
    ? `<span class="el-lock open">🟢 aberto até ${fmtLock(lock(t))} · ${restante(lock(t))}</span>`
    : `<span class="el-lock closed">🔒 encerrado em ${fmtLock(lock(t))}</span>`;
  const mark = ok => ok === true ? '✅' : ok === 'part' ? '🟡' : '❌';
  const breakdown = sc => sc ? `<div class="el-bd-wrap">${sc.d.map(x => `<div class="el-bd"><span>${mark(x.ok)} ${esc(x.txt)}</span><b>+${x.v}</b></div>`).join('')}<div class="el-bd total"><span>Total</span><b>${sc.pts} pts</b></div></div>` : '';
  const options = (cs, selected) => `<option value="">— escolha —</option>` + cs.map(x =>
    `<option value="${x.id}" ${selected === x.id ? 'selected' : ''}>${esc(x.nome)} (${esc(x.partido)} ${esc(x.num)})</option>`).join('');
  const select = (id, cs, saved) => `<select class="form-input" id="${id}" onchange="elDraft('${id}',this.value)">${options(cs, dv(id, saved))}</select>`;
  const pctInput = (id, saved) => `<input class="form-input" id="${id}" type="text" inputmode="decimal" placeholder="ex: 46,5" value="${esc(dv(id, saved != null ? String(saved).replace('.', ',') : ''))}" oninput="elDraft('${id}',this.value)">`;

  function blockT1(race, cs, info, p, sc) {
    let h = `<div class="el-round"><div class="el-round-hdr"><span>1º TURNO · 4 de outubro</span>${lockBadge('t1')}</div>`;
    if (isOpen('t1')) {
      h += field('🥇 Quem fica em 1º?', select(`el_${race}_t1_primeiro`, cs, p?.primeiro));
      h += field('🥈 Quem fica em 2º?', select(`el_${race}_t1_segundo`, cs, p?.segundo));
      h += field('📊 % de votos válidos do 1º colocado', pctInput(`el_${race}_t1_pct`, p?.pct) +
        `<div class="el-hint">Acima de 50% = vence no 1º turno (sem 2º turno). Até 50% = vai pro 2º turno.</div>`);
      h += `<button class="btn-salvar" onclick="elSalvarT1('${race}')">${p ? 'Atualizar palpite' : 'Salvar palpite'} ✅</button>`;
      if (p) h += ` <span class="el-saved">✔ palpite salvo</span>`;
    } else if (p) {
      h += `<div class="el-meu">🥇 ${esc(nameOf(race, p.primeiro))} · 🥈 ${esc(nameOf(race, p.segundo))} · 📊 ${fmt(p.pct)}%</div>`;
      h += info ? breakdown(sc) : `<div class="el-wait">⏳ Aguardando o resultado do 1º turno.</div>`;
    } else h += `<div class="el-none">Você não palpitou neste turno 😬</div>`;
    return h + `</div>`;
  }

  function blockT2(race, info, p, sc) {
    let h = `<div class="el-round"><div class="el-round-hdr"><span>2º TURNO · 25 de outubro</span>${info?.haT2 ? lockBadge('t2') : ''}</div>`;
    if (!info) return h + `<div class="el-wait">⏳ Os finalistas aparecem aqui assim que o resultado do 1º turno for lançado.</div></div>`;
    if (!info.haT2) return h + `<div class="el-wait">🎉 ${esc(info.primeiro.nome)} venceu no 1º turno (${fmt(info.primeiro.pct)}%). Não há 2º turno.</div></div>`;
    const [a, b] = info.finalistas;
    h += `<div class="el-versus"><span>${esc(a.nome)} <em>${fmt(a.pct)}%</em></span><i>vs</i><span>${esc(b.nome)} <em>${fmt(b.pct)}%</em></span></div>`;
    if (isOpen('t2')) {
      h += field('🏆 Quem vence o 2º turno?', select(`el_${race}_t2_vencedor`, info.finalistas, p?.vencedor));
      h += field('📊 % de votos válidos do vencedor', pctInput(`el_${race}_t2_pct`, p?.pct));
      h += `<button class="btn-salvar" onclick="elSalvarT2('${race}')">${p ? 'Atualizar palpite' : 'Salvar palpite'} ✅</button>`;
      if (p) h += ` <span class="el-saved">✔ palpite salvo</span>`;
    } else if (p) {
      h += `<div class="el-meu">🏆 ${esc(nameOf(race, p.vencedor))} · 📊 ${fmt(p.pct)}%</div>`;
      h += info.venc ? breakdown(sc) : `<div class="el-wait">⏳ Aguardando o resultado do 2º turno.</div>`;
    } else h += `<div class="el-none">Você não palpitou neste turno 😬</div>`;
    return h + `</div>`;
  }

  function raceCard(race) {
    const R = RACES[race], cs = cands(race), pal = E().palpites?.[me().key]?.[race] || {};
    const sc = calcRace(race, pal);
    return `<div class="el-card"><div class="el-card-hdr"><span class="el-card-title">${R.icon} ${R.nome}</span><span class="el-card-pts">${sc.total} pts</span></div>` +
      blockT1(race, cs, sc.info, pal.t1, sc.t1) + blockT2(race, sc.info, pal.t2, sc.t2) + `</div>`;
  }

  function viewPalpitar() { return Object.keys(RACES).map(raceCard).join(''); }

  function viewRanking() {
    const rows = computeRank();
    if (!rows.length) return `<div class="empty" style="padding:36px 20px">Ninguém palpitou ainda. Seja o primeiro! 🗳️</div>`;
    const M = ['🥇', '🥈', '🥉'], C = ['gold', 'silver', 'bronze'];
    let h = '';
    if (!rows.some(r => r.total > 0)) h += `<div class="el-wait" style="margin-bottom:12px">Os pontos aparecem conforme os resultados forem lançados.</div>`;
    h += `<div class="podium-grid">` + rows.slice(0, 3).map((r, i) =>
      `<div class="podium-card ${C[i]}"><span class="p-medal">${M[i]}</span><div style="font-size:16px">${emo(r.nome)}</div><div class="p-name">${esc(r.nome)}</div><div class="p-pts">${r.total}</div><div class="p-lbl">pts</div></div>`).join('') + `</div>`;
    h += `<div class="rank-list">` + rows.slice(3).map((r, i) =>
      `<div class="rank-item"><span class="rank-pos">${i + 4}º</span><span style="font-size:16px">${emo(r.nome)}</span><span class="rank-name">${esc(r.nome)}</span><div style="text-align:right"><div class="rank-pts">${r.total}</div><div style="font-size:10px;color:var(--text2)">🇧🇷 ${r.pres} · 🏛️ ${r.gov}</div></div></div>`).join('') + `</div>`;
    h += `<div class="el-hint" style="margin-top:10px;text-align:center">Pódio: 🇧🇷 Presidente + 🏛️ Governador de PE somados. Ranking separado do Bolão da Copa.</div>`;
    return h;
  }

  function viewGalera() {
    const users = getData().users || {}, pals = E().palpites || {};
    let h = '';
    Object.keys(RACES).forEach(race => {
      const R = RACES[race], info = infoOf(race);
      h += `<div class="el-card"><div class="el-card-hdr"><span class="el-card-title">${R.icon} ${R.nome}</span></div>`;
      [['t1', '1º TURNO'], ['t2', '2º TURNO']].forEach(([t, titulo]) => {
        if (t === 't2' && !info?.haT2) return;
        h += `<div class="el-round"><div class="el-round-hdr"><span>${titulo}</span>${lockBadge(t)}</div>`;
        if (isOpen(t)) { h += `<div class="el-wait">🔒 Os palpites da galera aparecem quando o prazo fechar (${fmtLock(lock(t))}).</div></div>`; return; }
        const feitos = Object.entries(pals).filter(([, v]) => v[race]?.[t]);
        feitos.forEach(([k, v]) => {
          const nome = users[k]?.displayName || v.nome || k, p = v[race][t];
          const sc = t === 't1' ? calcT1(p, info) : calcT2(p, info);
          const txt = t === 't1' ? `🥇 ${esc(nameOf(race, p.primeiro))} · 🥈 ${esc(nameOf(race, p.segundo))} · 📊 ${fmt(p.pct)}%`
                                 : `🏆 ${esc(nameOf(race, p.vencedor))} · 📊 ${fmt(p.pct)}%`;
          h += `<div class="el-gal-row"><div class="el-gal-nome">${emo(nome)} ${esc(nome)}</div><div class="el-gal-txt">${txt}</div>${sc ? `<div class="el-gal-pts">+${sc.pts}</div>` : ''}</div>`;
        });
        const sem = Object.entries(users).filter(([k]) => !pals[k]?.[race]?.[t]).map(([, u]) => esc(u.displayName));
        if (sem.length) h += `<div class="el-hint">Sem palpite: ${sem.join(', ')}</div>`;
        h += `</div>`;
      });
      h += `</div>`;
    });
    return h;
  }

  function viewRegras() {
    const row = (l, p) => `<div class="pts-row"><span>${l}</span><span style="font-weight:700;color:var(--gold);white-space:nowrap">${p}</span></div>`;
    return `<div class="pts-legend"><div class="pts-legend-title">📋 Como funciona</div>
      <div class="el-hint" style="margin-bottom:10px">Para cada disputa (Presidente e Governador de PE) você palpita no 1º turno e, se houver, no 2º. Palpites fecham às 08h do dia da votação (horário de Recife). Os palpites dos outros só aparecem depois do fechamento.</div>
      <div style="font-family:'Bebas Neue',sans-serif;font-size:13px;color:var(--gold);letter-spacing:1px;margin-bottom:7px">1º TURNO</div><div class="pts-grid">
        ${row('Acertou o 1º colocado', PTS.PRIMEIRO + ' pts')}${row('Acertou o 2º colocado', PTS.SEGUNDO + ' pts')}
        ${row('Escolheu um dos 2 primeiros, posição trocada', PTS.TROCADO + ' pts')}${row('Acertou se haverá 2º turno', PTS.HAVERA_T2 + ' pts')}
        ${row('% do 1º colocado: erro até 1 p.p.', PTS.PCT[0][1] + ' pts')}${row('… erro até 2,5 p.p.', PTS.PCT[1][1] + ' pts')}${row('… erro até 5 p.p.', PTS.PCT[2][1] + ' pts')}
      </div>
      <div style="margin-top:11px;padding-top:10px;border-top:1px solid var(--border)"><div style="font-family:'Bebas Neue',sans-serif;font-size:13px;color:var(--gold);letter-spacing:1px;margin-bottom:7px">2º TURNO</div><div class="pts-grid">
        ${row('Acertou o vencedor', PTS.VENCEDOR_T2 + ' pts')}${row('% do vencedor: erro até 1 / 2,5 / 5 p.p.', PTS.PCT.map(x => x[1]).join(' / ') + ' pts')}
      </div></div>
      <div class="el-hint" style="margin-top:11px">Percentuais são sobre votos válidos (sem brancos e nulos). Se o 1º colocado passar de 50% no 1º turno, não há 2º turno. Seu palpite de % acima de 50% significa "vence no 1º turno"; até 50%, "vai pro 2º turno". Máximo por disputa: ${PTS.PRIMEIRO + PTS.SEGUNDO + PTS.HAVERA_T2 + PTS.PCT[0][1] + PTS.VENCEDOR_T2 + PTS.PCT[0][1]} pts.</div></div>`;
  }

  function renderEleicoes() {
    const views = [['palpitar', '✏️ Palpitar'], ['ranking', '🏆 Ranking'], ['galera', '👀 Galera'], ['regras', '📋 Regras']];
    return `<div class="sec-title">🗳️ Bolão Eleições 2026</div>
      <div class="el-sub">Jogo extra · Presidente e Governador de PE · 1º turno 04/10 · 2º turno 25/10</div>
      <div class="el-seg">${views.map(([k, l]) => `<button class="el-seg-btn ${S.view === k ? 'active' : ''}" onclick="elView('${k}')">${l}</button>`).join('')}</div>` +
      (S.view === 'ranking' ? viewRanking() : S.view === 'galera' ? viewGalera() : S.view === 'regras' ? viewRegras() : viewPalpitar());
  }

  // ── Admin ──
  const adminInput = (id, saved, attrs = '') => `<input class="form-input-admin" id="${id}" ${attrs} value="${esc(dv(id, saved))}" oninput="elDraft('${id}',this.value)">`;

  function renderEleicoesAdmin() {
    let h = `<div class="admin-box"><div class="admin-box-title">🗳️ Eleições — Prazos dos palpites</div>
      <div class="el-hint" style="margin-bottom:9px">Horário de Recife/Brasília. Padrão: 08:00 do dia da votação.</div>
      <div class="form-grid">
        <div class="form-group-admin"><label class="form-label-admin">Fecha 1º turno</label>${adminInput('el_lock_t1', lock('t1').slice(0, 16), 'type="datetime-local"')}</div>
        <div class="form-group-admin"><label class="form-label-admin">Fecha 2º turno</label>${adminInput('el_lock_t2', lock('t2').slice(0, 16), 'type="datetime-local"')}</div>
      </div><button class="btn-sm" style="margin-top:10px" onclick="elSalvarPrazos()">💾 Salvar prazos</button></div>`;

    Object.keys(RACES).forEach(race => {
      const R = RACES[race], cs = cands(race), info = infoOf(race), res = E().resultados?.[race] || {};
      const linhas = cs.map(x => [x.nome, x.partido, x.num, x.vice].filter((v, i) => i < 3 || v).join(' | ')).join('\n');
      h += `<div class="admin-box"><div class="admin-box-title">${R.icon} ${R.nome} — Candidatos</div>
        <div class="el-hint" style="margin-bottom:8px">Um por linha: <b>Nome | Partido | Número${R.vice ? ' | Vice' : ''}</b>. Se alguém já palpitou, evite renomear (o palpite segue o nome).</div>
        <textarea class="form-input-admin el-ta" id="el_cands_${race}" rows="${Math.min(cs.length + 1, 14)}" oninput="elDraft('el_cands_${race}',this.value)">${esc(dv('el_cands_' + race, linhas))}</textarea>
        <div style="display:flex;gap:7px;margin-top:9px;flex-wrap:wrap"><button class="btn-sm" onclick="elSalvarCands('${race}')">💾 Salvar candidatos</button><button class="btn-danger" onclick="elResetCands('${race}')">↩ Lista original</button></div></div>`;

      h += `<div class="admin-box"><div class="admin-box-title">${R.icon} ${R.nome} — Resultado do 1º turno</div>
        <div class="el-hint" style="margin-bottom:8px">% de votos válidos de cada candidato (copie do TSE/G1, ex: 48,32). Deixe em branco quem teve ~0.</div>
        <div class="el-res-grid">${cs.map(x => `<label class="el-res-row"><span>${esc(x.nome)} <small>${esc(x.partido)}</small></span>${adminInput(`el_r1_${race}_${x.id}`, res.t1?.[x.id] != null ? String(res.t1[x.id]).replace('.', ',') : '', 'type="text" inputmode="decimal" placeholder="0,00"')}</label>`).join('')}</div>
        <div style="display:flex;gap:7px;margin-top:10px;flex-wrap:wrap"><button class="btn-sm" onclick="elSalvarRes1('${race}')">💾 Salvar 1º turno</button>
        ${res.t1 || res.t2 ? `<button class="btn-danger" onclick="elLimparRes('${race}')">🗑 Limpar resultados</button>` : ''}</div>
        ${info ? `<div class="el-hint" style="margin-top:9px">${info.haT2 ? `➡️ 2º turno: <b>${esc(info.finalistas[0].nome)}</b> x <b>${esc(info.finalistas[1].nome)}</b>` : `🏁 <b>${esc(info.primeiro.nome)}</b> eleito no 1º turno (${fmt(info.primeiro.pct)}%)`}</div>` : ''}</div>`;

      if (info?.haT2) {
        h += `<div class="admin-box"><div class="admin-box-title">${R.icon} ${R.nome} — Resultado do 2º turno</div>
          <div class="el-res-grid">${info.finalistas.map(x => `<label class="el-res-row"><span>${esc(x.nome)} <small>${esc(x.partido)}</small></span>${adminInput(`el_r2_${race}_${x.id}`, res.t2?.[x.id] != null ? String(res.t2[x.id]).replace('.', ',') : '', 'type="text" inputmode="decimal" placeholder="0,00"')}</label>`).join('')}</div>
          <button class="btn-sm" style="margin-top:10px" onclick="elSalvarRes2('${race}')">💾 Salvar 2º turno</button></div>`;
      }
    });
    h += `<div class="admin-box"><div class="admin-box-title">⚠️ Eleições — Zona de perigo</div>
      <button class="btn-danger" onclick="elZerar()">Zerar palpites e resultados das eleições</button></div>`;
    return h;
  }

  // ── Handlers (window.* porque o HTML usa onclick inline, como no resto do app) ──
  window.elView = v => { S.view = v; rerender(); };
  window.elDraft = (id, v) => { S.draft[id] = v; };

  window.elSalvarT1 = async race => {
    if (!isOpen('t1')) { showToast('⏰ Prazo do 1º turno encerrado!', true); return; }
    const g = k => document.getElementById(`el_${race}_t1_${k}`)?.value ?? '';
    const primeiro = g('primeiro'), segundo = g('segundo'), pct = num(g('pct'));
    if (!primeiro || !segundo) { showToast('Escolha o 1º e o 2º colocado!', true); return; }
    if (primeiro === segundo) { showToast('1º e 2º precisam ser diferentes!', true); return; }
    if (pct == null || pct < 0 || pct > 100) { showToast('% inválida (use 0 a 100)!', true); return; }
    try {
      await update(ref(db, `bolao/eleicoes/palpites/${me().key}`), { nome: me().username, [`${race}/t1`]: { primeiro, segundo, pct, ts: Date.now() } });
      clearDraft(`el_${race}_t1_`);
      showToast('Palpite salvo! 🗳️✅');
    } catch (e) { showToast('Erro ao salvar. Tente de novo.', true); }
  };

  window.elSalvarT2 = async race => {
    if (!isOpen('t2')) { showToast('⏰ Prazo do 2º turno encerrado!', true); return; }
    const g = k => document.getElementById(`el_${race}_t2_${k}`)?.value ?? '';
    const vencedor = g('vencedor'), pct = num(g('pct'));
    if (!vencedor) { showToast('Escolha o vencedor!', true); return; }
    if (pct == null || pct < 50 || pct > 100) { showToast('O vencedor tem de 50 a 100% dos válidos!', true); return; }
    try {
      await update(ref(db, `bolao/eleicoes/palpites/${me().key}`), { nome: me().username, [`${race}/t2`]: { vencedor, pct, ts: Date.now() } });
      clearDraft(`el_${race}_t2_`);
      showToast('Palpite salvo! 🗳️✅');
    } catch (e) { showToast('Erro ao salvar. Tente de novo.', true); }
  };

  const soAdmin = () => { if (!me()?.isAdmin) { showToast('Só admin 🔒', true); return false; } return true; };

  window.elSalvarPrazos = async () => {
    if (!soAdmin()) return;
    const v = id => document.getElementById(id)?.value;
    const t1 = v('el_lock_t1'), t2 = v('el_lock_t2');
    if (!t1 || !t2) { showToast('Preencha os dois prazos!', true); return; }
    await set(ref(db, 'bolao/eleicoes/config/lock'), { t1: `${t1}:00-03:00`, t2: `${t2}:00-03:00` });
    clearDraft('el_lock_'); showToast('Prazos salvos! ⏰');
  };

  window.elSalvarCands = async race => {
    if (!soAdmin()) return;
    const linhas = (document.getElementById(`el_cands_${race}`)?.value || '').split('\n').map(l => l.trim()).filter(Boolean);
    const lista = linhas.map(l => { const [nome, partido, numero, vice] = l.split('|').map(s => s.trim()); return { nome, partido: partido || '', num: numero || '', vice: vice || '' }; });
    if (lista.length < 2) { showToast('Mínimo de 2 candidatos!', true); return; }
    if (lista.some(x => !x.nome)) { showToast('Tem linha sem nome!', true); return; }
    lista.forEach(x => { x.id = keyOf(x.nome); });
    if (new Set(lista.map(x => x.id)).size !== lista.length) { showToast('Nome repetido na lista!', true); return; }
    await set(ref(db, `bolao/eleicoes/config/cands/${race}`), lista);
    clearDraft(`el_cands_${race}`); showToast('Candidatos salvos! ✅');
  };

  window.elResetCands = async race => {
    if (!soAdmin() || !confirm('Voltar para a lista original de candidatos?')) return;
    await set(ref(db, `bolao/eleicoes/config/cands/${race}`), null);
    clearDraft(`el_cands_${race}`); showToast('Lista original restaurada.');
  };

  const lerPcts = (race, prefix, cs) => {
    const out = {}; let soma = 0;
    for (const x of cs) {
      const raw = document.getElementById(`${prefix}_${race}_${x.id}`)?.value ?? '';
      if (raw.trim() === '') continue;
      const n = num(raw);
      if (n == null || n < 0 || n > 100) { showToast(`% inválida em ${x.nome}`, true); return null; }
      out[x.id] = n; soma += n;
    }
    return { out, soma };
  };

  window.elSalvarRes1 = async race => {
    if (!soAdmin()) return;
    const r = lerPcts(race, 'el_r1', cands(race));
    if (!r) return;
    if (Object.keys(r.out).length < 2) { showToast('Lance pelo menos 2 candidatos!', true); return; }
    await set(ref(db, `bolao/eleicoes/resultados/${race}/t1`), r.out);
    clearDraft(`el_r1_${race}_`);
    showToast(r.soma < 97 || r.soma > 101 ? `Salvo, mas a soma deu ${fmt(r.soma)}% — confira! 🤔` : 'Resultado do 1º turno salvo! 🎯', r.soma < 97 || r.soma > 101);
  };

  window.elSalvarRes2 = async race => {
    if (!soAdmin()) return;
    const info = infoOf(race);
    if (!info?.haT2) return;
    const r = lerPcts(race, 'el_r2', info.finalistas);
    if (!r) return;
    if (Object.keys(r.out).length < 2) { showToast('Lance os dois finalistas!', true); return; }
    await set(ref(db, `bolao/eleicoes/resultados/${race}/t2`), r.out);
    clearDraft(`el_r2_${race}_`);
    showToast(r.soma < 98 || r.soma > 101 ? `Salvo, mas a soma deu ${fmt(r.soma)}% — confira! 🤔` : 'Resultado do 2º turno salvo! 🏆', r.soma < 98 || r.soma > 101);
  };

  window.elLimparRes = async race => {
    if (!soAdmin() || !confirm('Apagar os resultados desta disputa?')) return;
    await set(ref(db, `bolao/eleicoes/resultados/${race}`), null);
    clearDraft(`el_r`); showToast('Resultados removidos.');
  };

  window.elZerar = async () => {
    if (!soAdmin() || !confirm('Apagar TODOS os palpites e resultados das eleições? (candidatos e prazos ficam)')) return;
    await set(ref(db, 'bolao/eleicoes/palpites'), null);
    await set(ref(db, 'bolao/eleicoes/resultados'), null);
    S.draft = {}; showToast('Eleições zeradas.');
  };

  return { renderEleicoes, renderEleicoesAdmin };
}
