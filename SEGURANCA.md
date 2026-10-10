# Segurança do Bolão Muita Paz

## Como funciona

- **Login:** Firebase Authentication (e-mail/senha). Cada apelido vira um e-mail fictício `apelido@bolao-muitapaz.app`; nenhum e-mail é enviado.
- **Quem pode o quê:** quem decide são as regras do banco, em [`database.rules.json`](database.rules.json), não a tela. Resumo:
  - Sem login, ou com cadastro ainda não aprovado, não se lê nada do bolão.
  - Cada um só mexe no próprio perfil e nos próprios palpites, e só até o horário do jogo (`kickoff`).
  - Os palpites dos outros só aparecem depois que o jogo começa. Nas eleições, depois que o prazo do turno fecha.
  - Só admin aprova cadastro, dá admin, lança resultado à mão, cadastra jogo manual e mexe nas eleições.
  - Qualquer membro aprovado pode gravar os jogos da ESPN (é assim que o placar atualiza). Cada gravação registra quem gravou em `atualizadoPor`.
  - No chat, cada mensagem sai com o nome de quem mandou de verdade, com no máximo 300 caracteres e uma por segundo.

## Publicar mudanças nas regras

Pelo console: Firebase → Realtime Database → Regras → colar o conteúdo de `database.rules.json` → Publicar.

Pela linha de comando:

```bash
npx firebase-tools login
npx firebase-tools deploy --only database
```

## Tarefas de admin

- **Cadastro novo:** aparece em Admin → "Aguardando aprovação". Só aprove quem você sabe que é da galera.
- **Esqueceu a senha:** Admin → Usuários → "🔓 Novo acesso". Depois apague o usuário `apelido@bolao-muitapaz.app` no console do Firebase (Authentication → Users). A pessoa entra com o apelido e uma senha nova.
