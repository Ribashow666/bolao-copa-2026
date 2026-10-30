// Regras de pontuação do bolão (lógica pura, sem Firebase: usada pelo main.js, achievements.js e pelos testes)

export const PTS = {EXATO:25, VG:18, DIFF:15, DRAW:15, LG:12, WIN:10, ALMOST:4};
const PTS_TIPO = {exact:PTS.EXATO, vg:PTS.VG, diff:PTS.DIFF, draw:PTS.DRAW, lg:PTS.LG, win:PTS.WIN, almost:PTS.ALMOST, miss:0};

// Tipo de acerto do palpite: exact, vg, diff, draw, lg, win, almost (previu empate e não foi) ou miss
export function classify(real, pal) {
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

export function calcPts(real, pal) {
  const tipo = classify(real, pal);
  return tipo && {pts: PTS_TIPO[tipo], tipo};
}

// Multiplicador só pro mata-mata. Checa por palavra-chave (não por número), senão "Rodada 32" viraria ×1,25.
export function getMulti(fase) {
  if (!fase) return 1;
  const f = fase.toLowerCase();
  if (f.includes('semi')) return 2.5;
  if (f.includes('3º lugar')) return 2.5;
  if (f.includes('quarta')) return 2;
  // "Oitavas de 32" = nome antigo do mata-mata de 32 da Copa: tem que continuar ×1,25 pro ranking da Copa não mudar
  if (f.includes('16 avos') || f.includes('oitavas de 32')) return 1.25;
  if (f.includes('oitava')) return 1.5;
  if (f.includes('🏆') || /\bfinal\b/.test(f)) return 3;
  return 1;
}
