import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
    import { getDatabase, ref, onValue, set, update, push, get, runTransaction, remove }
      from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

    const FB_CONFIG = {
      apiKey: "AIzaSyCFS5qEkn3WmoXlWPHi7gw9ScywnrzrEAs",
      authDomain: "bolao-copa-2026-ef7f5.firebaseapp.com",
      databaseURL: "https://bolao-copa-2026-ef7f5-default-rtdb.firebaseio.com",
      projectId: "bolao-copa-2026-ef7f5",
      storageBucket: "bolao-copa-2026-ef7f5.firebasestorage.app",
      messagingSenderId: "331660975900",
      appId: "1:331660975900:web:08417e790f5251982e24d9"
    };
    const API_KEY = "4e4ac3b282130db442facab71b110737";
    const WC_LEAGUE = 1;
    const WC_SEASON = 2026;

    const fbApp = initializeApp(FB_CONFIG);
    const db = getDatabase(fbApp);

    // ── CONSTANTS ──────────────────────────────────────────────────
    const KNOWN_PLAYERS = ['Milho', 'Wly', 'Igor', 'Jucas', 'Wendel', 'Pedru', 'Vini', 'Melk'];
    const EMOJIS = { Milho: '🌽', Wly: '🦅', Igor: '🐺', Jucas: '🦁', Wendel: '⚡', Pedru: '🦊', Vini: '🐆', Melk: '🌊' };
    const FLAGS = {
      'Brazil': '🇧🇷', 'Argentina': '🇦🇷', 'France': '🇫🇷', 'Germany': '🇩🇪',
      'England': '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'Spain': '🇪🇸', 'Portugal': '🇵🇹', 'Uruguay': '🇺🇾',
      'Mexico': '🇲🇽', 'United States': '🇺🇸', 'Japan': '🇯🇵', 'Morocco': '🇲🇦',
      'Netherlands': '🇳🇱', 'Belgium': '🇧🇪', 'Croatia': '🇭🇷', 'Senegal': '🇸🇳',
      'Australia': '🇦🇺', 'South Korea': '🇰🇷', 'Colombia': '🇨🇴', 'Ecuador': '🇪🇨',
      'Canada': '🇨🇦', 'Switzerland': '🇨🇭', 'Poland': '🇵🇱', 'Ghana': '🇬🇭',
      'Tunisia': '🇹🇳', 'Cameroon': '🇨🇲', 'Costa Rica': '🇨🇷', 'Saudi Arabia': '🇸🇦',
      'Iran': '🇮🇷', 'Serbia': '🇷🇸', 'Denmark': '🇩🇰', 'Norway': '🇳🇴',
      'Sweden': '🇸🇪', 'Italy': '🇮🇹', 'Chile': '🇨🇱', 'Paraguay': '🇵🇾',
      'Bolivia': '🇧🇴', 'Venezuela': '🇻🇪', 'Peru': '🇵🇪', 'Scotland': '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
      'Wales': '🏴󠁧󠁢󠁷󠁬󠁳󠁿', 'Czech Republic': '🇨🇿', 'South Africa': '🇿🇦',
      'Turkey': '🇹🇷', 'Ukraine': '🇺🇦', 'Austria': '🇦🇹', 'Greece': '🇬🇷',
      'Honduras': '🇭🇳', 'Panama': '🇵🇦', 'Jamaica': '🇯🇲', 'Algeria': '🇩🇿',
      'Egypt': '🇪🇬', 'Nigeria': '🇳🇬', 'Ivory Coast': '🇨🇮', 'New Zealand': '🇳🇿',
      'Uzbekistan': '🇺🇿', 'Qatar': '🇶🇦', 'Mali': '🇲🇱', 'Indonesia': '🇮🇩',
    };
    const PTS = { EXATO: 25, VG: 18, DIFF: 15, DRAW: 15, LG: 12, WIN: 10, ALMOST: 4 };

    // ── MULTIPLICADORES DE FASE ────────────────────────────────────
    function getMulti(fase) {
      if (!fase) return 1;
      const f = fase.toLowerCase();
      if (f.includes('final') && f.includes('🏆')) return 3;       // 🏆 Final
      if (f.includes('semifinal') || f.includes('semi')) return 2.5;
      if (f.includes('3º lugar') || f.includes('3o lugar') || f.includes('disputa')) return 2.5;
      if (f.includes('quarta') || f.includes('quarter')) return 2;
      if (f.includes('oitava') || f.includes('round of 16')) return 1.5;
      if (f.includes('16') || f.includes('trinta') || f.includes('round of 32')) return 1.25;
      return 1; // grupos e qualquer outra fase
    }

    // ── STATE ──────────────────────────────────────────────────────
    let currentUser = null;
    let currentTab = 'ranking';
    let filterFase = 'Todos';
    let dbData = { jogos: {}, users: {}, lastSync: null };
    let syncTimer = null;
    let countdownTimer = null;

    // ── HELPERS ────────────────────────────────────────────────────
    async function hashPassword(pass) {
      const buf = await crypto.subtle.digest('SHA-256',
        new TextEncoder().encode(pass + 'bolao2026salt'));
      return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    const flag = t => FLAGS[t] || '🏳';
    const emo = n => EMOJIS[n] || '👤';
    const fmtDate = d => { if (!d) return ''; const [, m, day] = d.split('-'); return `${day}/${m}`; };
    const fmtTime = t => t ? t.substring(0, 5) : '';
    const toKey = s => s.toLowerCase().trim()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');

    // ── PONTUAÇÃO ──────────────────────────────────────────────────
    function calcPts(real, pal) {
      if (real?.casa == null) return null;
      const rc = +real.casa, rf = +real.fora, pc = +pal.casa, pf = +pal.fora;
      if ([rc, rf, pc, pf].some(isNaN)) return null;
      if (rc === pc && rf === pf) return { pts: PTS.EXATO, tipo: 'exact' };
      const pD = pc === pf, rD = rc === rf;
      if (pD && !rD) return { pts: PTS.ALMOST, tipo: 'almost' };
      if (rD && pD) return { pts: PTS.DRAW, tipo: 'draw' };
      const rWC = rc > rf, pWC = pc > pf;
      if (rWC !== pWC) return { pts: 0, tipo: 'miss' };
      const wg = rWC ? rc : rf, lg = rWC ? rf : rc, pwg = pWC ? pc : pf, plg = pWC ? pf : pc;
      if (pwg === wg) return { pts: PTS.VG, tipo: 'vg' };
      if ((rc - rf) === (pc - pf)) return { pts: PTS.DIFF, tipo: 'diff' };
      if (plg === lg) return { pts: PTS.LG, tipo: 'lg' };
      return { pts: PTS.WIN, tipo: 'win' };
    }
    const ptsClass = t => ({
      exact: 'pts-exact', vg: 'pts-vg', diff: 'pts-diff', draw: 'pts-draw',
      lg: 'pts-lg', win: 'pts-win', almost: 'pts-almost', miss: 'pts-zero'
    }[t] || 'pts-zero');
    const ptsLabel = t => ({
      exact: 'Exato!', vg: 'Venc+G✓', diff: 'Venc+Dif', draw: 'Emp✓',
      lg: 'Venc+Gl', win: 'Venc✓', almost: '~Emp', miss: '—'
    }[t] || '—');

    // ── DEADLINE ───────────────────────────────────────────────────
    function jogoAberto(jogo) {
      if (!jogo.data || !jogo.hora) return false;
      const s = jogo.status || 'NS';
      if (['FT', 'AET', 'PEN', '1H', 'HT', '2H', 'ET', 'BT', 'P', 'INT'].includes(s)) return false;
      const [h, mi] = jogo.hora.split(':').map(Number);
      const [y, mo, d] = jogo.data.split('-').map(Number);
      const kickoffUTC = Date.UTC(y, mo - 1, d, h + 3, mi, 0);
      return Date.now() < kickoffUTC;
    }

    function tempoParaJogo(jogo) {
      if (!jogo.data || !jogo.hora) return null;
      const [h, mi] = jogo.hora.split(':').map(Number);
      const [y, mo, d] = jogo.data.split('-').map(Number);
      const kickoffUTC = Date.UTC(y, mo - 1, d, h + 3, mi, 0);
      const diff = kickoffUTC - Date.now();
      if (diff <= 0) return null;
      const totalMin = Math.floor(diff / 60000);
      const hrs = Math.floor(totalMin / 60), min = totalMin % 60;
      if (hrs > 48) return null;
      if (hrs > 0) return `${hrs}h ${min}min`;
      return `${min}min`;
    }

    // ── RANKING ────────────────────────────────────────────────────
    function computeRanking() {
      const pts = {}, exact = {};
      KNOWN_PLAYERS.forEach(j => { pts[j] = 0; exact[j] = 0; });
      Object.values(dbData.users || {}).forEach(u => {
        if (!pts[u.displayName]) { pts[u.displayName] = 0; exact[u.displayName] = 0; }
      });
      Object.values(dbData.jogos || {}).forEach(jogo => {
        if (jogo.resultado?.casa == null) return;
        const multi = getMulti(jogo.fase);
        Object.entries(jogo.palpites || {}).forEach(([jogador, p]) => {
          const r = calcPts(jogo.resultado, p);
          if (r) {
            pts[jogador] = (pts[jogador] || 0) + (r.pts * multi);
            if (r.tipo === 'exact') exact[jogador] = (exact[jogador] || 0) + 1;
          }
        });
      });
      const allPalPlayers = new Set();
      Object.values(dbData.jogos || {}).forEach(j => Object.keys(j.palpites || {}).forEach(n => allPalPlayers.add(n)));
      const visible = Object.entries(pts).filter(([n]) => KNOWN_PLAYERS.includes(n) || allPalPlayers.has(n));
      return { sorted: visible.sort((a, b) => b[1] - a[1]), exact };
    }

    function getJogos() {
      return Object.entries(dbData.jogos || {})
        .map(([id, j]) => ({ ...j, _id: id }))
        .sort((a, b) => {
          const dd = a.data > b.data ? 1 : a.data < b.data ? -1 : 0;
          return dd || ((a.hora || '') > (b.hora || '') ? 1 : -1);
        });
    }

    // ── UI HELPERS ─────────────────────────────────────────────────
    function showToast(msg, isErr = false) {
      const t = document.getElementById('toast');
      t.textContent = msg;
      t.className = 'toast show' + (isErr ? ' err' : '');
      clearTimeout(t._to);
      t._to = setTimeout(() => t.classList.remove('show'), 2800);
    }

    function setSyncBar(type, msg) {
      const b = document.getElementById('sync-bar');
      if (!msg) { b.className = 'sync-bar'; b.style.display = 'none'; return; }
      b.className = `sync-bar show ${type}`; b.textContent = msg; b.style.display = 'block';
    }

    function clearAuthErrors() {
      ['login-user-err', 'login-pass-err', 'login-global-err',
        'reg-user-err', 'reg-pass-err', 'reg-pass2-err', 'reg-global-err']
        .forEach(id => { const el = document.getElementById(id); if (el) el.textContent = ''; });
      document.querySelectorAll('.form-input').forEach(el => el.classList.remove('error'));
    }

    // ── AUTH ───────────────────────────────────────────────────────
    window.switchAuth = mode => {
      const isLogin = mode === 'login';
      document.getElementById('login-form').style.display = isLogin ? 'block' : 'none';
      document.getElementById('register-form').style.display = isLogin ? 'none' : 'block';
      document.getElementById('tab-login-btn').classList.toggle('active', isLogin);
      document.getElementById('tab-reg-btn').classList.toggle('active', !isLogin);
      clearAuthErrors();
    };

    window.doLogin = async () => {
      clearAuthErrors();
      const username = document.getElementById('login-user').value.trim();
      const pass = document.getElementById('login-pass').value;
      let ok = true;
      if (!username) { document.getElementById('login-user-err').textContent = 'Campo obrigatório'; document.getElementById('login-user').classList.add('error'); ok = false; }
      if (!pass) { document.getElementById('login-pass-err').textContent = 'Campo obrigatório'; document.getElementById('login-pass').classList.add('error'); ok = false; }
      if (!ok) return;
      const btn = document.getElementById('btn-login');
      btn.disabled = true; btn.textContent = 'Entrando...';
      try {
        const userKey = toKey(username);
        const snap = await get(ref(db, `bolao/users/${userKey}`));
        if (!snap.exists()) {
          document.getElementById('login-global-err').textContent = 'Usuário não encontrado. Crie uma conta.'; return;
        }
        const ud = snap.val();
        if (await hashPassword(pass) !== ud.passwordHash) {
          document.getElementById('login-pass-err').textContent = 'Senha incorreta';
          document.getElementById('login-pass').classList.add('error'); return;
        }
        currentUser = { username: ud.displayName, key: userKey, isAdmin: ud.isAdmin || false };
        localStorage.setItem('bolao_session', JSON.stringify(currentUser));
        bootApp();
      } catch (e) {
        document.getElementById('login-global-err').textContent = 'Erro de conexão. Tente novamente.';
      } finally {
        btn.disabled = false; btn.textContent = 'Entrar';
      }
    };

    window.doRegister = async () => {
      clearAuthErrors();
      const username = document.getElementById('reg-user').value.trim();
      const pass = document.getElementById('reg-pass').value;
      const pass2 = document.getElementById('reg-pass2').value;
      let ok = true;
      if (!username || username.length < 2) { document.getElementById('reg-user-err').textContent = 'Mínimo 2 caracteres'; document.getElementById('reg-user').classList.add('error'); ok = false; }
      if (username.length > 20) { document.getElementById('reg-user-err').textContent = 'Máximo 20 caracteres'; document.getElementById('reg-user').classList.add('error'); ok = false; }
      if (!pass || pass.length < 6) { document.getElementById('reg-pass-err').textContent = 'Mínimo 6 caracteres'; document.getElementById('reg-pass').classList.add('error'); ok = false; }
      if (pass !== pass2) { document.getElementById('reg-pass2-err').textContent = 'As senhas não coincidem'; document.getElementById('reg-pass2').classList.add('error'); ok = false; }
      if (!ok) return;
      const btn = document.getElementById('btn-reg');
      btn.disabled = true; btn.textContent = 'Criando...';
      try {
        const userKey = toKey(username);
        const snap = await get(ref(db, `bolao/users/${userKey}`));
        if (snap.exists()) {
          document.getElementById('reg-user-err').textContent = 'Este nome já está em uso';
          document.getElementById('reg-user').classList.add('error'); return;
        }
        const hash = await hashPassword(pass);
        const usersSnap = await get(ref(db, 'bolao/users'));
        const isFirstUser = !usersSnap.exists() || !Object.keys(usersSnap.val() || {}).length;
        await set(ref(db, `bolao/users/${userKey}`), {
          displayName: username,
          passwordHash: hash,
          isAdmin: isFirstUser,
          createdAt: Date.now()
        });
        currentUser = { username, key: userKey, isAdmin: isFirstUser };
        localStorage.setItem('bolao_session', JSON.stringify(currentUser));
        showToast(isFirstUser ? 'Conta criada! Você é o admin 🔑' : `Bem-vindo, ${username}! ⚽`);
        bootApp();
      } catch (e) {
        document.getElementById('reg-global-err').textContent = 'Erro ao criar conta. Tente novamente.';
      } finally {
        btn.disabled = false; btn.textContent = 'Criar Conta';
      }
    };

    window.doLogout = () => {
      currentUser = null;
      localStorage.removeItem('bolao_session');
      clearInterval(countdownTimer);
      document.getElementById('app').style.display = 'none';
      document.getElementById('auth-screen').style.display = 'flex';
      clearAuthErrors();
      document.getElementById('login-user').value = '';
      document.getElementById('login-pass').value = '';
    };

    // ── BOOT ───────────────────────────────────────────────────────
    function bootApp() {
      document.getElementById('auth-screen').style.display = 'none';
      document.getElementById('app').style.display = 'block';
      document.getElementById('user-av').textContent = currentUser.username[0].toUpperCase();
      document.getElementById('user-nm-hdr').textContent = currentUser.username;
      // Sempre começa no ranking — evita aba inválida de sessão anterior
      currentTab = 'ranking';
      // Populate flag selects in modal
      const flagOpts = Object.entries(FLAGS).map(([n, f]) => `<option value="${n}">${f} ${n}</option>`).join('');
      document.getElementById('modal-casa').innerHTML = flagOpts;
      document.getElementById('modal-fora').innerHTML = flagOpts;
      get(ref(db, `bolao/users/${currentUser.key}`)).then(snap => {
        if (snap.exists()) {
          const freshAdmin = snap.val().isAdmin || false;
          if (freshAdmin !== currentUser.isAdmin) {
            currentUser.isAdmin = freshAdmin;
            localStorage.setItem('bolao_session', JSON.stringify(currentUser));
            updateAdminTab();
            render();
          }
        }
      });
      updateAdminTab();
      // Sincroniza visual das tabs com currentTab
      ['ranking', 'jogos', 'palpitar', 'admin'].forEach(t => {
        const el = document.getElementById(`tab-${t}`);
        if (el) el.classList.toggle('active', t === currentTab);
      });
      render();
      syncFromApi(true);
      clearInterval(countdownTimer);
      countdownTimer = setInterval(() => { if (currentTab === 'palpitar') render(); }, 30000);
    }

    function updateAdminTab() {
      const tabsInner = document.querySelector('.tabs-inner');
      const existing = document.getElementById('tab-admin');
      if (currentUser?.isAdmin) {
        if (!existing) {
          const btn = document.createElement('button');
          btn.className = 'tab-btn'; btn.id = 'tab-admin';
          btn.onclick = () => showTab('admin');
          btn.textContent = '⚙️ Admin';
          tabsInner.appendChild(btn);
        }
      } else {
        if (existing) existing.remove();
        if (currentTab === 'admin') { currentTab = 'ranking'; }
      }
    }

    // ── FIREBASE LISTENER ──────────────────────────────────────────
    function startListening() {
      onValue(ref(db, 'bolao'), snap => {
        dbData = snap.val() || { jogos: {}, users: {} };
        if (!dbData.jogos) dbData.jogos = {};
        if (!dbData.users) dbData.users = {};
        if (currentUser) render();
      });
      onValue(ref(db, '.info/connected'), snap => {
        if (snap.val() === false) setSyncBar('offline', '⚠️ Sem conexão — tentando reconectar...');
        else if (currentUser) setSyncBar('', '');
      });
    }

    // ── API-FOOTBALL SYNC ──────────────────────────────────────────
    async function syncFromApi(force = false) {
      const now = Date.now(), last = dbData.lastSync || 0;
      if (!force && (now - last) < 120000) return;
      setSyncBar('syncing', '🔄 Buscando jogos da Copa...');
      try {
        const [nxt, pst] = await Promise.all([
          fetch(`https://v3.football.api-sports.io/fixtures?league=${WC_LEAGUE}&season=${WC_SEASON}&next=20`,
            { headers: { 'x-apisports-key': API_KEY } }).then(r => r.json()),
          fetch(`https://v3.football.api-sports.io/fixtures?league=${WC_LEAGUE}&season=${WC_SEASON}&last=30`,
            { headers: { 'x-apisports-key': API_KEY } }).then(r => r.json()),
        ]);
        const seen = new Set();
        const fixtures = [...(nxt.response || []), ...(pst.response || [])].filter(f => {
          if (seen.has(f.fixture.id)) return false; seen.add(f.fixture.id); return true;
        });
        if (!fixtures.length) {
          setSyncBar('ok', '✓ Aguardando início da Copa');
          setTimeout(() => setSyncBar('', ''), 5000); return;
        }
        let liveCount = 0;
        const writes = fixtures.map(f => {
          const fid = `api_${f.fixture.id}`;
          const s = f.fixture.status.short;
          const isLive = ['1H', 'HT', '2H', 'ET', 'BT', 'P', 'INT'].includes(s);
          const isDone = ['FT', 'AET', 'PEN'].includes(s);
          if (isLive) liveCount++;
          const round = f.league.round || '';
          const fase = round
            .replace('Group Stage - ', 'Grupo ')
            .replace('Round of 32', 'Oitavas de 32')
            .replace('Round of 16', 'Oitavas de Final')
            .replace('Quarter-finals', 'Quartas de Final')
            .replace('Semi-finals', 'Semifinais')
            .replace('3rd Place Final', '3º Lugar')
            .replace(/^Final$/, '🏆 Final');
          const utcD = new Date(f.fixture.date);
          const brtD = new Date(utcD.getTime() - 3 * 3600000);
          const data = brtD.toISOString().substring(0, 10);
          const hora = brtD.toISOString().substring(11, 16);
          return runTransaction(ref(db, `bolao/jogos/${fid}`), current => {
            const base = current || {};
            return {
              ...base,
              apiId: f.fixture.id,
              casa: f.teams.home.name,
              fora: f.teams.away.name,
              data, hora, fase, status: s,
              resultado: (isDone || isLive)
                ? { casa: f.goals.home, fora: f.goals.away }
                : (base.resultado || { casa: null, fora: null }),
              palpites: base.palpites || {},
            };
          });
        });
        await Promise.all(writes);
        await set(ref(db, 'bolao/lastSync'), now);
        clearInterval(syncTimer);
        if (liveCount > 0) {
          setSyncBar('live', `🔴 ${liveCount} jogo(s) ao vivo — atualizando a cada 2 min`);
          syncTimer = setInterval(() => syncFromApi(true), 120000);
        } else {
          setSyncBar('ok', `✓ ${fixtures.length} jogos carregados`);
          setTimeout(() => setSyncBar('', ''), 4000);
          syncTimer = setInterval(() => syncFromApi(false), 300000);
        }
      } catch (e) {
        console.error('Sync error:', e);
        setSyncBar('offline', '⚠️ Erro ao buscar jogos da API');
        setTimeout(() => setSyncBar('', ''), 6000);
      }
    }

    // ── TABS ───────────────────────────────────────────────────────
    window.showTab = tab => {
      currentTab = tab;
      ['ranking', 'jogos', 'palpitar', 'admin'].forEach(t => {
        const el = document.getElementById(`tab-${t}`);
        if (el) el.classList.toggle('active', t === tab);
      });
      render();
    };
    window.setFilter = fase => { filterFase = fase; render(); };

    // ── RENDER ─────────────────────────────────────────────────────
    function render() {
      const el = document.getElementById('content');
      if (!el) return;
      if (currentTab === 'ranking') el.innerHTML = renderRanking();
      if (currentTab === 'jogos') el.innerHTML = renderJogos();
      if (currentTab === 'palpitar') el.innerHTML = renderPalpitar();
      if (currentTab === 'admin') el.innerHTML = renderAdmin();
    }

    // ── RANKING ────────────────────────────────────────────────────
    function renderRanking() {
      const { sorted, exact } = computeRanking();
      const M = ['🥇', '🥈', '🥉'], C = ['gold', 'silver', 'bronze'];
      let h = `<div class="sec-title">🏆 Classificação</div><div class="podium-grid">`;
      sorted.slice(0, 3).forEach(([n, p], i) => {
        h += `<div class="podium-card ${C[i]}">
      <span class="p-medal">${M[i]}</span>
      <div style="font-size:16px">${emo(n)}</div>
      <div class="p-name">${n}</div>
      <div class="p-pts">${p}</div>
      <div class="p-lbl">pts</div>
    </div>`;
      });
      h += `</div><div class="rank-list">`;
      sorted.slice(3).forEach(([n, p], i) => {
        h += `<div class="rank-item">
      <span class="rank-pos">${i + 4}º</span>
      <span style="font-size:16px">${emo(n)}</span>
      <span class="rank-name">${n}</span>
      <div style="text-align:right">
        <div class="rank-pts">${p}</div>
        <div style="font-size:10px;color:var(--text2)">pontos</div>
      </div>
    </div>`;
      });
      h += `</div><div class="vidente-box">
    <div class="vidente-title">⭐ Prêmio Vidente 🔮 <span style="font-size:10px;font-weight:400;color:var(--text2)">(mais placares exatos)</span></div>`;
      const vid = Object.entries(exact).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
      if (!vid.length) h += `<div style="color:var(--text2);font-size:12px">Nenhum placar exato ainda.</div>`;
      vid.forEach(([n, c], i) => {
        h += `<div class="vidente-item">
      <span style="font-weight:600;font-size:13px">${['🥇', '🥈', '🥉'][i] || ''} ${emo(n)} ${n}</span>
      <div style="display:flex;align-items:baseline;gap:3px">
        <span class="vidente-count">${c}</span>
        <span style="font-size:10px;color:var(--text2)">exatos</span>
      </div>
    </div>`;
      });
      h += `</div><div class="pts-legend">
    <div class="pts-legend-title">📋 Sistema de Pontuação</div>
    <div class="pts-grid">`;
      [
        ['Placar exato', '25pts', 'pts-exact'],
        ['Vencedor + gols do vencedor', '18pts', 'pts-vg'],
        ['Vencedor + diferença de gols', '15pts', 'pts-diff'],
        ['Empate correto', '15pts', 'pts-draw'],
        ['Vencedor + gols do perdedor', '12pts', 'pts-lg'],
        ['Acertou o vencedor', '10pts', 'pts-win'],
        ['Previu empate (mas não foi)', '4pts', 'pts-almost'],
        ['Errou tudo', '0pts', 'pts-zero'],
      ].forEach(([l, p, c]) => {
        h += `<div class="pts-row"><span>${l}</span><span class="${c}" style="font-weight:700;white-space:nowrap">${p}</span></div>`;
      });
      h += `</div>
    <div style="margin-top:11px;padding-top:10px;border-top:1px solid var(--border)">
      <div style="font-family:'Bebas Neue',sans-serif;font-size:13px;color:var(--gold);letter-spacing:1px;margin-bottom:7px">📈 Multiplicadores por Fase</div>
      <div class="pts-grid">`;
      [
        ['🌎 Fase de Grupos', '×1'],
        ['🎟️ 16 Avos de Final', '×1,25'],
        ['🔥 Oitavas de Final', '×1,5'],
        ['💥 Quartas de Final', '×2'],
        ['⚔️ Semifinais', '×2,5'],
        ['🥉 Disputa de 3º Lugar', '×2,5'],
        ['🏆 Final', '×3'],
      ].forEach(([l, m]) => {
        h += `<div class="pts-row"><span>${l}</span><span style="font-weight:700;color:var(--gold);white-space:nowrap">${m}</span></div>`;
      });
      h += `</div></div></div>`;
      return h;
    }

    // ── JOGOS ──────────────────────────────────────────────────────
    function renderJogos() {
      const jogos = getJogos();
      const fases = ['Todos', ...new Set(jogos.map(j => j.fase))];
      let h = `<div class="sec-title">⚽ Jogos da Copa</div><div class="filter-bar">`;
      fases.forEach(f => {
        h += `<button class="filter-btn ${filterFase === f ? 'active' : ''}" onclick="setFilter('${f}')">${f}</button>`;
      });
      h += `</div>`;
      const list = filterFase === 'Todos' ? jogos : jogos.filter(j => j.fase === filterFase);
      if (!list.length) { h += `<div class="empty">Nenhum jogo disponível.<br>Sincronize com a API no Admin.</div>`; return h; }
      list.forEach(jogo => {
        const s = jogo.status || 'NS';
        const isLive = ['1H', 'HT', '2H', 'ET', 'BT', 'P', 'INT'].includes(s);
        const isDone = ['FT', 'AET', 'PEN'].includes(s);
        const temRes = isDone || (jogo.resultado?.casa != null);
        const aberto = jogoAberto(jogo);
        const badge = isLive ? `<span class="badge badge-live"><span class="live-dot"></span>AO VIVO</span>`
          : isDone ? `<span class="badge badge-enc">✓ Encerrado</span>`
            : aberto ? `<span class="badge badge-pend">Aberto</span>`
              : `<span class="badge badge-fechado">🔒 Fechado</span>`;
        const c = temRes ? jogo.resultado.casa : '-';
        const f = temRes ? jogo.resultado.fora : '-';
        h += `<div class="match-card">
      <div class="match-hdr">
        <span class="match-date">📅 ${fmtDate(jogo.data)} · ${fmtTime(jogo.hora)}</span>
        <div style="display:flex;gap:5px;align-items:center">
          <span class="match-stage">${jogo.fase}</span>${badge}
        </div>
      </div>
      <div class="match-body">
        <div class="scoreboard">
          <div class="team-info"><div class="team-flag">${flag(jogo.casa)}</div><div class="team-name">${jogo.casa}</div></div>
          <div class="score-box">
            <div class="score-num">${c}</div>
            <div class="score-div">x</div>
            <div class="score-num">${f}</div>
          </div>
          <div class="team-info"><div class="team-flag">${flag(jogo.fora)}</div><div class="team-name">${jogo.fora}</div></div>
        </div>
      </div>`;
        const pals = Object.entries(jogo.palpites || {});
        if (pals.length) {
          h += `<div class="match-pals"><div class="pals-title">📝 Palpites</div><div class="pals-grid">`;
          pals.forEach(([jogador, p]) => {
            const r = temRes ? calcPts(jogo.resultado, p) : null;
            const multi = getMulti(jogo.fase);
            const ptsFinais = r ? r.pts * multi : null;
            h += `<div class="pal-item">
          <span class="pal-player">${emo(jogador)} ${jogador}</span>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:1px">
            <span class="pal-score">
              ${aberto ? '❓❓' : `${p.casa}x${p.fora}`}
            </span>
            ${r ? `<span style="font-size:10px" class="${ptsClass(r.tipo)}">${ptsLabel(r.tipo)} ${ptsFinais}pts${multi > 1 ? ` <span style="opacity:.7">×${multi}</span>` : ''}</span>` : ''}
          </div>
        </div>`;
          });
          h += `</div></div>`;
        }
        h += `</div>`;
      });
      return h;
    }

    // ── PALPITAR ───────────────────────────────────────────────────
    function renderPalpitar() {
      const jogos = getJogos();
      const abertos = jogos.filter(j => jogoAberto(j));
      const fechados = jogos.filter(j => {
        const s = j.status || 'NS';
        return !['FT', 'AET', 'PEN'].includes(s) && !jogoAberto(j);
      });

      let h = `<div class="sec-title">✏️ Meus Palpites</div>`;

      if (!abertos.length && !fechados.length) {
        h += `<div class="empty">✅ Todos os jogos já encerraram.<br>Novos jogos aparecem aqui automaticamente.</div>`;
        return h;
      }

      if (abertos.length) {
        abertos.forEach(jogo => {
          const meu = (jogo.palpites || {})[currentUser.username];
          const tempo = tempoParaJogo(jogo);
          h += `<div class="palpitar-card">
        <div class="pal-hdr">
          <span style="font-weight:600;font-size:11px;color:var(--gold)">${jogo.fase}</span>
          <span style="font-size:10px;color:var(--text2)">📅 ${fmtDate(jogo.data)} · ${fmtTime(jogo.hora)}</span>
        </div>
        <div class="pal-match-row">
          <div class="pal-team"><div class="pal-flag">${flag(jogo.casa)}</div><div class="pal-name">${jogo.casa}</div></div>
          <span style="font-family:'Bebas Neue',sans-serif;font-size:16px;color:var(--text2)">VS</span>
          <div class="pal-team"><div class="pal-flag">${flag(jogo.fora)}</div><div class="pal-name">${jogo.fora}</div></div>
        </div>
        <div class="my-pal-section">
          <div class="my-pal-label">${emo(currentUser.username)} ${currentUser.username} — seu palpite</div>
          <div class="my-pal-row">
            <input class="sc-in" type="number" min="0" max="20" placeholder="0" id="pc_${jogo._id}" value="${meu != null ? meu.casa : ''}">
            <span class="sc-x">x</span>
            <input class="sc-in" type="number" min="0" max="20" placeholder="0" id="pf_${jogo._id}" value="${meu != null ? meu.fora : ''}">
            <button class="btn-salvar" onclick="salvarPalpite('${jogo._id}')">Salvar</button>
            ${tempo ? `<span class="countdown">⏳ ${tempo}</span>` : ''}
          </div>
          ${meu != null ? `<div style="font-size:10px;color:var(--text2);margin-top:6px">✅ Palpite atual: <strong>${meu.casa}x${meu.fora}</strong></div>` : ''}
        </div>
      </div>`;
        });
      }

      if (fechados.length) {
        h += `<div style="font-family:'Bebas Neue',sans-serif;font-size:14px;color:#c084fc;letter-spacing:1px;margin:16px 0 8px">🔒 Palpites Fechados</div>`;
        fechados.forEach(jogo => {
          const meu = (jogo.palpites || {})[currentUser.username];
          h += `<div class="palpitar-card" style="opacity:.75">
        <div class="pal-hdr">
          <span style="font-weight:600;font-size:11px;color:#c084fc">${jogo.fase}</span>
          <span style="font-size:10px;color:var(--text2)">📅 ${fmtDate(jogo.data)} · ${fmtTime(jogo.hora)}</span>
        </div>
        <div class="pal-match-row">
          <div class="pal-team"><div class="pal-flag">${flag(jogo.casa)}</div><div class="pal-name">${jogo.casa}</div></div>
          <span style="font-family:'Bebas Neue',sans-serif;font-size:16px;color:var(--text2)">VS</span>
          <div class="pal-team"><div class="pal-flag">${flag(jogo.fora)}</div><div class="pal-name">${jogo.fora}</div></div>
        </div>
        <div class="my-pal-section">
          ${meu != null
              ? `<div style="font-size:12px;color:var(--text2)">✅ Seu palpite: <strong style="color:var(--text)">${meu.casa}x${meu.fora}</strong></div>`
              : `<div class="locked-msg">🔒 Prazo encerrado — palpite não registrado</div>`
            }
        </div>
      </div>`;
        });
      }

      return h;
    }

    // ── ADMIN ──────────────────────────────────────────────────────
    function renderAdmin() {
      const isAdmin = currentUser?.isAdmin;

      if (!isAdmin) {
        return `
      <div style="text-align:center;padding:48px 20px">
        <div style="font-size:64px;margin-bottom:16px">🚨</div>
        <div style="font-family:'Bebas Neue',sans-serif;font-size:32px;color:var(--red);letter-spacing:2px;margin-bottom:8px">ÁREA RESTRITA</div>
        <div style="font-size:14px;color:var(--text2);margin-bottom:24px;line-height:1.7">
          Ei, <strong style="color:var(--text)">${currentUser.username}</strong>! Tentando espiar o admin? 👀<br>
          Isso aqui é só pra quem manda no pedaço.<br>
          <span style="font-size:12px">Volta pro seu palpite antes que alguém te veja.</span>
        </div>
        <div style="font-family:'Bebas Neue',sans-serif;font-size:16px;color:var(--gold);letter-spacing:1px;margin-bottom:20px">🔒 Acesso negado. Tente de novo em: nunca.</div>
        <button class="btn-salvar" onclick="showTab('palpitar')">✏️ Ir Palpitar</button>
      </div>`;
      }

      let h = `<div class="sec-title">⚙️ Admin</div>`;

      // Sync status
      const ls = dbData.lastSync
        ? new Date(dbData.lastSync).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        : 'nunca';
      h += `<div class="admin-box">
    <div class="admin-box-title">🔄 Sincronização com API</div>
    <div style="font-size:12px;color:var(--text2);background:var(--surface2);border-radius:7px;padding:10px 12px;line-height:1.7">
      <strong style="color:var(--text)">Última sync:</strong> ${ls} &nbsp;·&nbsp;
      <strong style="color:var(--text)">Jogos no banco:</strong> ${Object.keys(dbData.jogos || {}).length}
    </div>
    <div style="display:flex;gap:7px;margin-top:10px;flex-wrap:wrap">
      <button class="btn-sm" onclick="forcSync()">🔄 Sincronizar agora</button>
      <button class="btn-danger" onclick="if(confirm('Apagar todos os jogos e palpites?'))zerarTudo()">🗑️ Zerar tudo</button>
    </div>
  </div>`;

      // ── GERENCIAR JOGOS (NOVO) ──────────────────────────────────
      const todosJogos = getJogos();
      h += `<div class="admin-box">
    <div class="admin-box-title">🗂️ Gerenciar Jogos</div>
    <div style="font-size:11px;color:var(--text2);margin-bottom:11px">Edite dados, apague jogos ou remova palpites individuais.</div>`;

      if (!todosJogos.length) {
        h += `<div style="font-size:12px;color:var(--text2)">Nenhum jogo cadastrado ainda.</div>`;
      } else {
        todosJogos.forEach(jogo => {
          const numPals = Object.keys(jogo.palpites || {}).length;
          const palsEncoded = encodeURIComponent(JSON.stringify(jogo.palpites || {}));
          h += `<div class="jogo-manage-row">
        <div class="jogo-manage-header">
          <div>
            <div class="jogo-manage-title">${flag(jogo.casa)} ${jogo.casa} x ${jogo.fora} ${flag(jogo.fora)}</div>
            <div class="jogo-manage-meta">📅 ${fmtDate(jogo.data)} · ${fmtTime(jogo.hora)} · ${jogo.fase}</div>
          </div>
          <div class="jogo-manage-actions">
            <button class="btn-warn" onclick="abrirEditarJogo('${jogo._id}')">✏️ Editar</button>
            <button class="btn-danger" onclick="apagarJogo('${jogo._id}','${jogo.casa} x ${jogo.fora}')">🗑️ Apagar</button>
          </div>
        </div>`;

          // Palpites do jogo
          const pals = Object.entries(jogo.palpites || {});
          if (pals.length) {
            h += `<div class="jogo-palpites-list">
          <div class="jogo-palpites-title">📝 ${numPals} palpite(s)</div>`;
            pals.forEach(([jogador, p]) => {
              const safeJogador = jogador.replace(/'/g, "\\'");
              h += `<div class="palpite-manage-row">
            <span class="palpite-manage-name">${emo(jogador)} ${jogador}</span>
            <div style="display:flex;align-items:center;gap:8px">
              <span class="palpite-manage-score">${p.casa}x${p.fora}</span>
              <button class="btn-danger" style="padding:3px 8px;font-size:10px" onclick="apagarPalpite('${jogo._id}','${safeJogador}')">✕</button>
            </div>
          </div>`;
            });
            h += `</div>`;
          } else {
            h += `<div style="font-size:11px;color:var(--text2);padding-top:6px;border-top:1px solid var(--border);margin-top:6px">Sem palpites ainda.</div>`;
          }

          h += `</div>`;
        });
      }
      h += `</div>`;

      // Inserir resultado manual
      const semRes = getJogos().filter(j => !['FT', 'AET', 'PEN'].includes(j.status || 'NS'));
      if (semRes.length) {
        h += `<div class="admin-box"><div class="admin-box-title">📝 Inserir Resultado Manual</div>
      <div style="font-size:11px;color:var(--text2);margin-bottom:10px">Use para corrigir ou adiantar resultado antes da API atualizar.</div>`;
        semRes.slice(0, 15).forEach(jogo => {
          h += `<div class="res-row">
        <div class="res-match-name">${flag(jogo.casa)} ${jogo.casa} x ${jogo.fora} ${flag(jogo.fora)}
          <span style="color:var(--text2);font-weight:400"> — ${fmtDate(jogo.data)} · ${jogo.fase}</span>
        </div>
        <div class="res-inputs">
          <span class="res-team">${jogo.casa}</span>
          <input class="res-in" type="number" min="0" max="20" placeholder="0" id="rc_${jogo._id}">
          <span class="res-x">x</span>
          <input class="res-in" type="number" min="0" max="20" placeholder="0" id="rf_${jogo._id}">
          <span class="res-team">${jogo.fora}</span>
          <button class="btn-sm" onclick="salvarRes('${jogo._id}')">Salvar</button>
        </div>
      </div>`;
        });
        h += `</div>`;
      }

      // Resultados registrados
      const comRes = getJogos().filter(j => j.resultado?.casa != null);
      if (comRes.length) {
        h += `<div class="admin-box"><div class="admin-box-title">✅ Resultados Registrados</div>`;
        comRes.forEach(jogo => {
          h += `<div style="display:flex;align-items:center;justify-content:space-between;background:var(--surface2);border-radius:7px;padding:8px 11px;margin-bottom:5px;flex-wrap:wrap;gap:6px">
        <div>
          <span style="font-weight:600;font-size:12px">${flag(jogo.casa)} ${jogo.casa} ${jogo.resultado.casa}x${jogo.resultado.fora} ${jogo.fora} ${flag(jogo.fora)}</span>
          <span style="font-size:10px;color:var(--text2);display:block">${fmtDate(jogo.data)} · ${jogo.fase}</span>
        </div>
        <button class="btn-danger" onclick="resetRes('${jogo._id}')">✏️ Editar</button>
      </div>`;
        });
        h += `</div>`;
      }

      // Usuários
      const users = Object.entries(dbData.users || {});
      h += `<div class="admin-box"><div class="admin-box-title">👥 Usuários (${users.length})</div>`;
      if (!users.length) h += `<div style="color:var(--text2);font-size:12px">Nenhum usuário cadastrado.</div>`;
      users.sort((a, b) => a[0] > b[0] ? 1 : -1).forEach(([key, u]) => {
        const isMe = key === currentUser.key;
        h += `<div class="user-list-item">
      <div>
        <span class="user-list-name">${emo(u.displayName)} ${u.displayName}
          ${isMe ? '<span style="font-size:10px;color:var(--text2)"> (você)</span>' : ''}
        </span>
        <span class="user-list-meta">Desde ${new Date(u.createdAt).toLocaleDateString('pt-BR')}</span>
      </div>
      <div style="display:flex;align-items:center;gap:6px">
        ${u.isAdmin ? `<span class="admin-badge">Admin</span>` : ''}
        ${isAdmin && !isMe && !u.isAdmin ? `<button class="btn-sm" style="font-size:10px;padding:4px 9px" onclick="toggleAdmin('${key}',true)">+Admin</button>` : ''}
        ${isAdmin && !isMe && u.isAdmin ? `<button class="btn-danger" style="padding:4px 9px;font-size:10px" onclick="toggleAdmin('${key}',false)">−Admin</button>` : ''}
      </div>
    </div>`;
      });
      h += `</div>`;

      // Adicionar jogo manual
      const flagOpts = Object.entries(FLAGS).map(([n, f]) => `<option value="${n}">${f} ${n}</option>`).join('');
      h += `<div class="admin-box"><div class="admin-box-title">➕ Adicionar Jogo Manual</div>
    <div style="font-size:11px;color:var(--text2);margin-bottom:10px">Use quando a API não tiver o jogo ou para adiantar cadastro.</div>
    <div class="form-grid">
      <div class="form-group-admin"><label class="form-label-admin">Mandante</label><select class="form-select-admin" id="new_casa">${flagOpts}</select></div>
      <div class="form-group-admin"><label class="form-label-admin">Visitante</label><select class="form-select-admin" id="new_fora">${flagOpts}</select></div>
      <div class="form-group-admin"><label class="form-label-admin">Data</label><input type="date" class="form-input-admin" id="new_data"></div>
      <div class="form-group-admin"><label class="form-label-admin">Hora (BRT)</label><input type="time" class="form-input-admin" id="new_hora" value="16:00"></div>
      <div class="form-group-admin full"><label class="form-label-admin">Fase / Grupo</label><input type="text" class="form-input-admin" id="new_fase" placeholder="ex: Grupo A, Oitavas de Final, Final..."></div>
    </div>
    <button class="btn-sm" style="margin-top:10px;padding:9px 22px" onclick="addJogo()">➕ Adicionar Jogo</button>
  </div>`;

      h += `<div class="admin-box"><div class="admin-box-title">🔑 Alterar Minha Senha</div>
    <div class="form-grid" style="gap:8px">
      <div class="form-group-admin full">
        <label class="form-label-admin">Nova Senha</label>
        <input class="form-input-admin" type="password" id="new-pass" placeholder="mínimo 6 caracteres">
      </div>
      <div class="form-group-admin full">
        <label class="form-label-admin">Confirmar Nova Senha</label>
        <input class="form-input-admin" type="password" id="new-pass2" placeholder="repita">
      </div>
    </div>
    <button class="btn-sm" style="margin-top:10px" onclick="changePassword()">🔑 Alterar Senha</button>
  </div>`;

      return h;
    }

    // ── ACTIONS ────────────────────────────────────────────────────
    window.forcSync = async () => { showToast('Sincronizando...'); await syncFromApi(true); };

    window.salvarPalpite = async id => {
      const jogoEntry = Object.entries(dbData.jogos || {}).find(([k]) => k === id);
      if (jogoEntry && !jogoAberto({ ...jogoEntry[1], _id: jogoEntry[0] })) {
        showToast('⏰ Prazo encerrado para este jogo!', true); return;
      }
      const c = document.getElementById(`pc_${id}`)?.value;
      const f = document.getElementById(`pf_${id}`)?.value;
      if (c === '' || f === '') { showToast('Preencha os dois placares!', true); return; }
      if (+c < 0 || +f < 0 || +c > 20 || +f > 20) { showToast('Placar inválido!', true); return; }
      await update(ref(db, `bolao/jogos/${id}/palpites/${currentUser.username}`), { casa: +c, fora: +f });
      showToast(`Palpite salvo! ${c}x${f} ✅`);
    };

    window.salvarRes = async id => {
      const c = document.getElementById(`rc_${id}`)?.value;
      const f = document.getElementById(`rf_${id}`)?.value;
      if (c === '' || f === '') { showToast('Preencha o placar!', true); return; }
      await update(ref(db, `bolao/jogos/${id}/resultado`), { casa: +c, fora: +f });
      await update(ref(db, `bolao/jogos/${id}`), { status: 'FT' });
      showToast('Resultado salvo! 🎯');
    };

    window.resetRes = async id => {
      await update(ref(db, `bolao/jogos/${id}/resultado`), { casa: null, fora: null });
      await update(ref(db, `bolao/jogos/${id}`), { status: 'NS' });
      showToast('Resultado removido para edição.');
    };

    window.toggleAdmin = async (key, makeAdmin) => {
      await update(ref(db, `bolao/users/${key}`), { isAdmin: makeAdmin });
      showToast(makeAdmin ? 'Admin concedido! 🔑' : 'Admin removido.');
    };

    window.changePassword = async () => {
      const p1 = document.getElementById('new-pass')?.value;
      const p2 = document.getElementById('new-pass2')?.value;
      if (!p1 || p1.length < 6) { showToast('Mínimo 6 caracteres!', true); return; }
      if (p1 !== p2) { showToast('Senhas não coincidem!', true); return; }
      const hash = await hashPassword(p1);
      await update(ref(db, `bolao/users/${currentUser.key}`), { passwordHash: hash });
      showToast('Senha alterada! ✅');
      document.getElementById('new-pass').value = '';
      document.getElementById('new-pass2').value = '';
    };

    window.addJogo = async () => {
      const casa = document.getElementById('new_casa')?.value;
      const fora = document.getElementById('new_fora')?.value;
      const data = document.getElementById('new_data')?.value;
      const hora = document.getElementById('new_hora')?.value;
      const fase = document.getElementById('new_fase')?.value?.trim();
      if (!data || !fase) { showToast('Preencha data e fase!', true); return; }
      if (casa === fora) { showToast('Times devem ser diferentes!', true); return; }
      await push(ref(db, 'bolao/jogos'), {
        casa, fora, data, hora, fase,
        status: 'NS',
        resultado: { casa: null, fora: null },
        palpites: {}
      });
      showToast(`${casa} x ${fora} adicionado! ⚽`);
      document.getElementById('new_data').value = '';
      document.getElementById('new_fase').value = '';
    };

    window.zerarTudo = async () => {
      await set(ref(db, 'bolao/jogos'), {});
      await set(ref(db, 'bolao/lastSync'), null);
      showToast('Dados zerados.');
    };

    // ── GERENCIAR JOGOS: APAGAR JOGO ───────────────────────────────
    window.apagarJogo = async (id, nome) => {
      if (!confirm(`Apagar o jogo "${nome}" e todos os palpites dele?\n\nEssa ação não pode ser desfeita.`)) return;
      await remove(ref(db, `bolao/jogos/${id}`));
      showToast(`Jogo apagado. 🗑️`);
    };

    // ── GERENCIAR JOGOS: APAGAR PALPITE ───────────────────────────
    window.apagarPalpite = async (jogoId, jogador) => {
      if (!confirm(`Apagar o palpite de "${jogador}"?\n\nEssa ação não pode ser desfeita.`)) return;
      await remove(ref(db, `bolao/jogos/${jogoId}/palpites/${jogador}`));
      showToast(`Palpite de ${jogador} apagado.`);
    };

    // ── GERENCIAR JOGOS: ABRIR MODAL EDITAR ───────────────────────
    window.abrirEditarJogo = (id) => {
      const jogo = dbData.jogos?.[id];
      if (!jogo) { showToast('Jogo não encontrado.', true); return; }
      document.getElementById('modal-jogo-id').value = id;
      document.getElementById('modal-data').value = jogo.data || '';
      document.getElementById('modal-hora').value = jogo.hora || '';
      document.getElementById('modal-fase').value = jogo.fase || '';
      // Set selects
      const casaSel = document.getElementById('modal-casa');
      const foraSel = document.getElementById('modal-fora');
      for (let o of casaSel.options) { if (o.value === jogo.casa) { o.selected = true; break; } }
      for (let o of foraSel.options) { if (o.value === jogo.fora) { o.selected = true; break; } }
      document.getElementById('modal-editar').style.display = 'flex';
    };

    window.fecharModal = () => {
      document.getElementById('modal-editar').style.display = 'none';
    };

    // Fechar modal clicando fora
    document.getElementById('modal-editar').addEventListener('click', e => {
      if (e.target === document.getElementById('modal-editar')) fecharModal();
    });

    // ── GERENCIAR JOGOS: SALVAR EDIÇÃO ────────────────────────────
    window.salvarEdicaoJogo = async () => {
      const id = document.getElementById('modal-jogo-id').value;
      const casa = document.getElementById('modal-casa').value;
      const fora = document.getElementById('modal-fora').value;
      const data = document.getElementById('modal-data').value;
      const hora = document.getElementById('modal-hora').value;
      const fase = document.getElementById('modal-fase').value.trim();
      if (!data || !fase) { showToast('Preencha data e fase!', true); return; }
      if (casa === fora) { showToast('Times devem ser diferentes!', true); return; }
      await update(ref(db, `bolao/jogos/${id}`), { casa, fora, data, hora, fase });
      showToast('Jogo atualizado! ✅');
      fecharModal();
    };

    // ── INIT ───────────────────────────────────────────────────────
    startListening();
    setTimeout(() => {
      document.getElementById('loading-screen').style.display = 'none';
      const sess = localStorage.getItem('bolao_session');
      if (sess) {
        try {
          currentUser = JSON.parse(sess);
          bootApp();
        } catch { localStorage.removeItem('bolao_session'); }
      }
      if (!currentUser) document.getElementById('auth-screen').style.display = 'flex';
    }, 1200);