// Lembretes do app Android (lógica pura, testada em tests/): o que o celular deve avisar e quando.
// O app recebe a lista inteira toda vez e troca a anterior, então palpitar remove o "faltam 30 min" sozinho.
const MIN = 60000;
const BRT = 3 * 3600000;
export const MAX_LEMBRETES = 60;

// jogos: [{id, casa, fora, hora, kickoff, dia (dia de exibição AAAA-MM-DD), classico, palpitei}] — só jogos que não começaram
export function montarLembretes(jogos, agora) {
  const lista = [];
  const porDia = {};
  jogos.forEach(j => (porDia[j.dia] ??= []).push(j));

  // ☀️ Manhã do dia (9h de Recife), ou 1h antes do primeiro jogo se ele for cedo
  Object.entries(porDia).forEach(([dia, doDia]) => {
    const [y, m, d] = dia.split('-').map(Number);
    const quando = Math.min(Date.UTC(y, m - 1, d, 9) + BRT, ...doDia.map(j => j.kickoff - 60 * MIN));
    const texto = doDia.map(j => `${j.casa} x ${j.fora} ${j.hora}${j.classico ? ' 🔥' : ''}`).join(' · ');
    lista.push({id: `dia_${dia}`, quando, titulo: '☀️ Hoje tem jogo! Palpites abertos', texto});
  });

  jogos.forEach(j => {
    const jogo = `${j.casa} x ${j.fora}`;
    // ⏰ Só pra quem ainda não palpitou
    if (!j.palpitei) lista.push({id: `falta_${j.id}`, quando: j.kickoff - 30 * MIN,
      titulo: '⏰ Faltam 30 min e você não palpitou!', texto: `${jogo} às ${j.hora}. Corre que ainda dá tempo.`});
    // 🔓 No apito os palpites da galera aparecem
    lista.push({id: `apito_${j.id}`, quando: j.kickoff, titulo: '🔓 Começou! Veja os palpites da galera', texto: jogo});
  });

  return lista.filter(n => n.quando > agora).sort((a, b) => a.quando - b.quando).slice(0, MAX_LEMBRETES);
}
