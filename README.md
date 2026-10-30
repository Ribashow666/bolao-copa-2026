# ⚽ Bolão Muita Paz – PE

Bolão da galera: jogos do **Sport, Náutico, Santa Cruz e Seleção**. Site estático (HTML + JavaScript puro) com Firebase.

🌐 **https://bolaomuitapaz.com.br** — hospedado no Netlify (publica sozinho a cada push no `main`). DNS no Registro.br, modo avançado: `A @ 75.2.60.5` e `CNAME www bolaopaz26.netlify.app`.

## Abas

- **Rank** — classificação, gráfico de evolução, Prêmio Vidente (mais placares exatos) e conquistas de cada jogador. Já soma os pontos da tabela antiga, de antes do site.
- **Jogos** — jogos de hoje, anteriores e próximos, com os palpites de todo mundo depois que o jogo começa.
- **Palpitar** — palpites abertos dos próximos 7 dias. Fecham no horário do jogo.
- **Resenha** — chat da galera, com o resumo automático de cada jogo que termina.
- **Vergonha** — Hall da Vergonha.
- **Copa 2026** — arquivo do bolão da Copa (só leitura).
- **Eleições** — bolão extra das eleições 2026 (Presidente e Governador de PE).
- **Admin** — sincronização, resultado manual, cadastro, edição e exclusão de jogo manual, aprovação de cadastro e eleições.

## Pontuação

| Acerto | Pontos |
|---|---|
| Placar exato | 25 |
| Vencedor + gols do vencedor | 18 |
| Vencedor + diferença de gols | 15 |
| Empate correto | 15 |
| Vencedor + gols do perdedor | 12 |
| Só o vencedor | 10 |
| Previu empate e não foi | 4 |

Multiplicadores: 16 avos ×1,25 · oitavas ×1,5 · quartas ×2 · semi e 3º lugar ×2,5 · final ×3 · clássico pernambucano ×2 (ou o da fase, se for maior).

## Como funciona

- **Jogos:** vêm da API pública da ESPN (agenda a cada 30 min, placar ao vivo a cada 2 min), buscada pelo celular de quem estiver com o site aberto. Série C/D e Pernambucano a ESPN não tem: o admin cadastra esses jogos à mão.
- **Banco:** Firebase Realtime Database. Quem pode fazer o quê está em [`database.rules.json`](database.rules.json); detalhes em [SEGURANCA.md](SEGURANCA.md).
- **Login:** Firebase Authentication, pelo apelido. Conta nova precisa da aprovação de um admin.

## Desenvolvimento

```bash
npm test                                    # testes da pontuação e das eleições (Node 20+)
npx firebase-tools deploy --only database   # publica as regras do banco
```

Para rodar localmente, sirva a pasta com qualquer servidor estático (ex: `npx serve .`). Abrir o `index.html` direto no navegador não funciona, por causa dos módulos JS.
