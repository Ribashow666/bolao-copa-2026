import { initializeApp }    from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, onValue, set, update, push, get, runTransaction }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { BADGE_DEFS, RARITY_META, computeAchievements } from "./achievements.js";

const FB_CONFIG = {
  apiKey:"AIzaSyCFS5qEkn3WmoXlWPHi7gw9ScywnrzrEAs",
  authDomain:"bolao-copa-2026-ef7f5.firebaseapp.com",
  databaseURL:"https://bolao-copa-2026-ef7f5-default-rtdb.firebaseio.com",
  projectId:"bolao-copa-2026-ef7f5",
  storageBucket:"bolao-copa-2026-ef7f5.firebasestorage.app",
  messagingSenderId:"331660975900",
  appId:"1:331660975900:web:08417e790f5251982e24d9"
};
const fbApp = initializeApp(FB_CONFIG);
const db    = getDatabase(fbApp);

const KNOWN_PLAYERS = ['Milho','Wly','Igor','Jucas','Wendel','Pedru','Vini','Melk'];
const EMOJIS = {Milho:'🌽',Wly:'🦅',Igor:'🐺',Jucas:'🦁',Wendel:'⚡',Pedru:'🐉',Vini:'🐆',Melk:'🌊'};
const FLAGS = {
  'Brazil':'🇧🇷','Argentina':'🇦🇷','France':'🇫🇷','Germany':'🇩🇪',
  'England':'🏴','Spain':'🇪🇸','Portugal':'🇵🇹','Uruguay':'🇺🇾',
  'Mexico':'🇲🇽','United States':'🇺🇸','Japan':'🇯🇵','Morocco':'🇲🇦',
  'Netherlands':'🇳🇱','Belgium':'🇧🇪','Croatia':'🇭🇷','Senegal':'🇸🇳',
  'Australia':'🇦🇺','South Korea':'🇰🇷','Colombia':'🇨🇴','Ecuador':'🇪🇨',
  'Canada':'🇨🇦','Switzerland':'🇨🇭','Poland':'🇵🇱','Ghana':'🇬🇭',
  'Tunisia':'🇹🇳','Cameroon':'🇨🇲','Costa Rica':'🇨🇷','Saudi Arabia':'🇸🇦',
  'Iran':'🇮🇷','Serbia':'🇷🇸','Denmark':'🇩🇰','Norway':'🇳🇴',
  'Sweden':'🇸🇪','Italy':'🇮🇹','Chile':'🇨🇱','Paraguay':'🇵🇾',
  'Bolivia':'🇧🇴','Venezuela':'🇻🇪','Peru':'🇵🇪','Scotland':'🏴',
  'Wales':'🏴','Czech Republic':'🇨🇿','South Africa':'🇿🇦',
  'Turkey':'🇹🇷','Ukraine':'🇺🇦','Austria':'🇦🇹','Greece':'🇬🇷',
  'Honduras':'🇭🇳','Panama':'🇵🇦','Jamaica':'🇯🇲','Algeria':'🇩🇿',
  'Egypt':'🇪🇬','Nigeria':'🇳🇬','Ivory Coast':'🇨🇮','New Zealand':'🇳🇿',
  'Uzbekistan':'🇺🇿','Qatar':'🇶🇦','Mali':'🇲🇱','Indonesia':'🇮🇩',
  'Bosnia and Herzegovina':'🇧🇦','Bosnia & Herzegovina':'🇧🇦',
};
const PTS = {EXATO:25, VG:18, DIFF:15, DRAW:15, LG:12, WIN:10, ALMOST:4};

let currentUser = null;
let currentTab  = 'ranking';
let filterFase  = 'Todos';
let dbData      = {jogos:{}, users:{}, lastSync:null};
let syncTimer   = null;
let countdownTimer = null;

async function hashPassword(pass) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pass + 'bolao2026salt'));
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
}
const flag    = t => {
  if (FLAGS[t]) return FLAGS[t];
  const nt = normTeam(t);
  const found = Object.keys(FLAGS).find(k => normTeam(k) === nt);
  return found ? FLAGS[found] : '🏳';
};
const emo     = n => EMOJIS[n] || '👤';
const fmtDate = d => { if(!d) return ''; const [,m,day]=d.split('-'); return `${day}/${m}`; };
const fmtTime = t => t ? t.substring(0,5) : '';
const toKey   = s => s.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,'');

function calcPts(real, pal) {
  if (real?.casa == null) return null;
  const rc=+real.casa, rf=+real.fora, pc=+pal.casa, pf=+pal.fora;
  if ([rc,rf,pc,pf].some(isNaN)) return null;
  if (rc===pc && rf===pf)        return {pts:PTS.EXATO, tipo:'exact'};
  const pD=pc===pf, rD=rc===rf;
  if (pD && !rD)                 return {pts:PTS.ALMOST, tipo:'almost'};
  if (rD && !pD)                 return {pts:0,          tipo:'miss'};
  if (rD && pD)                  return {pts:PTS.DRAW,   tipo:'draw'};
  const rWC=rc>rf, pWC=pc>pf;
  if (rWC!==pWC)                 return {pts:0, tipo:'miss'};
  const wg=rWC?rc:rf, lg=rWC?rf:rc, pwg=pWC?pc:pf, plg=pWC?pf:pc;
  if (pwg===wg)                  return {pts:PTS.VG,   tipo:'vg'};
  if ((rc-rf)===(pc-pf))         return {pts:PTS.DIFF, tipo:'diff'};
  if (plg===lg)                  return {pts:PTS.LG,   tipo:'lg'};
  return {pts:PTS.WIN, tipo:'win'};
}
const ptsClass = t=>({exact:'pts-exact',vg:'pts-vg',diff:'pts-diff',draw:'pts-draw',lg:'pts-lg',win:'pts-win',almost:'pts-almost',miss:'pts-zero'}[t]||'pts-zero');
const ptsLabel = t=>({exact:'Exato!',vg:'Venc+G✓',diff:'Venc+Dif',draw:'Emp✓',lg:'Venc+Gl',win:'Venc✓',almost:'~Emp',miss:'—'}[t]||'—');

function getMulti(fase) {
  if (!fase) return 1;
  const f = fase.toLowerCase();
  if (f.includes('🏆') || (f.includes('final') && !f.includes('oitava') && !f.includes('quarta') && !f.includes('semi') && !f.includes('3'))) return 3;
  if (f.includes('semi')) return 2.5;
  if (f.includes('3º') || f.includes('3o')) return 2.5;
  if (f.includes('quarta')) return 2;
  if (f.includes('oitava')) return 1.5;
  return 1;
}

function jogoAberto(jogo) {
  if (!jogo.data || !jogo.hora) return false;
  const s = jogo.status || 'NS';
  if (['FT','AET','PEN','1H','HT','2H','ET','BT','P','INT'].includes(s)) return false;
  const [h, mi] = jogo.hora.split(':').map(Number);
  const [y, mo, d] = jogo.data.split('-').map(Number);
  const kickoffUTC = Date.UTC(y, mo-1, d, h+3, mi, 0);
  return Date.now() < kickoffUTC;
}

function tempoParaJogo(jogo) {
  if (!jogo.data || !jogo.hora) return null;
  const [h, mi] = jogo.hora.split(':').map(Number);
  const [y, mo, d] = jogo.data.split('-').map(Number);
  const kickoffUTC = Date.UTC(y, mo-1, d, h+3, mi, 0);
  const diff = kickoffUTC - Date.now();
  if (diff <= 0) return null;
  const totalMin = Math.floor(diff/60000);
  const hrs = Math.floor(totalMin/60), min = totalMin%60;
  if (hrs > 48) return null;
  if (hrs > 0) return `${hrs}h ${min}min`;
  return `${min}min`;
}

function todayBRT() {
  const brt = new Date(Date.now() - 3*3600000);
  return brt.toISOString().substring(0,10);
}

// ── Retorna o "dia de exibição" do jogo: jogos de madrugada (antes das 06h) aparecem no dia anterior ──
function diaExibicao(jogo) {
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
const normTeam = s => (s||'').toLowerCase().trim()
  .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .replace(/\s+/g,' ');

// "Quanto de informação" um registro de jogo tem — usado pra decidir qual cópia manter
function scoreJogo(j) {
  return (j.resultado?.casa != null ? 2 : 0) + Object.keys(j.palpites||{}).length;
}

// Agrupa uma lista de jogos (com _id) por casa+fora, tolerando até 1 dia de diferença de data.
// Reusado tanto pelo getJogos() (dedup em memória) quanto pelo admin (diagnóstico/limpeza no banco).
function agruparJogos(lista) {
  const groups = [];
  for (const j of lista) {
    const ct = normTeam(j.casa), ft = normTeam(j.fora);
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

// ── DEDUPLICAR jogos por casa+fora, tolerando até 1 dia de diferença de data
//    (jogos vindos de fontes/fusos diferentes podem cair em datas vizinhas) ──
function getJogos() {
  const all = Object.entries(dbData.jogos||{})
    .map(([id,j])=>({...j, _id:id}))
    .sort((a,b)=>{
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
    g.items.forEach(item => Object.assign(palpitesMerged, item.palpites||{}));
    return {...best, palpites: palpitesMerged};
  });
}

function computeRanking() {
  const pts={}, exact={};
  KNOWN_PLAYERS.forEach(j=>{pts[j]=0; exact[j]=0;});
  Object.values(dbData.users||{}).forEach(u=>{
    if(!pts[u.displayName]) { pts[u.displayName]=0; exact[u.displayName]=0; }
  });
  getJogos().forEach(jogo=>{
    if (jogo.resultado?.casa == null) return;
    const multi = getMulti(jogo.fase);
    Object.entries(jogo.palpites||{}).forEach(([jogador,p])=>{
      const r=calcPts(jogo.resultado,p);
      if(r){
        pts[jogador]=(pts[jogador]||0)+(r.pts*multi);
        if(r.tipo==='exact') exact[jogador]=(exact[jogador]||0)+1;
      }
    });
  });
  const allPalPlayers = new Set();
  getJogos().forEach(j=>Object.keys(j.palpites||{}).forEach(n=>allPalPlayers.add(n)));
  const visible = Object.entries(pts).filter(([n])=>KNOWN_PLAYERS.includes(n)||allPalPlayers.has(n));
  return {sorted: visible.sort((a,b)=>b[1]-a[1]), exact};
}

// ── Evolução de pontos acumulados por jogador, agrupado por dia de exibição ──
function computeEvolucao() {
  const jogos = getJogos()
    .filter(j => j.resultado?.casa != null)
    .sort((a,b)=>{
      const da=diaExibicao(a), db_=diaExibicao(b);
      return da>db_ ? 1 : da<db_ ? -1 : 0;
    });

  const allPalPlayers = new Set();
  jogos.forEach(j=>Object.keys(j.palpites||{}).forEach(n=>allPalPlayers.add(n)));
  const jogadores = [...new Set([...KNOWN_PLAYERS, ...allPalPlayers])];

  const dias = [...new Set(jogos.map(j=>diaExibicao(j)))].sort();
  if (!dias.length) return {dias:[], series:{}};

  const acumulado = {};
  jogadores.forEach(j=>acumulado[j]=0);

  const series = {};
  jogadores.forEach(j=>series[j]=[]);

  dias.forEach(dia=>{
    const jogosDoDia = jogos.filter(j=>diaExibicao(j)===dia);
    jogosDoDia.forEach(jogo=>{
      const multi = getMulti(jogo.fase);
      Object.entries(jogo.palpites||{}).forEach(([jogador,p])=>{
        const r = calcPts(jogo.resultado,p);
        if (r) acumulado[jogador] = (acumulado[jogador]||0) + (r.pts*multi);
      });
    });
    jogadores.forEach(j=>series[j].push(acumulado[j]));
  });

  return {dias, series};
}
function computeRankingPorDia() {
  const { dias, series } = computeEvolucao();

  const rankings = {};

  dias.forEach((dia, idx) => {
    const rankingDia = Object.entries(series)
      .map(([jogador, pontos]) => ({
        jogador,
        pontos: pontos[idx]
      }))
      .sort((a, b) => b.pontos - a.pontos);

    rankings[dia] = {};

    rankingDia.forEach((item, pos) => {
      rankings[dia][item.jogador] = pos + 1;
    });
  });

  return rankings;
}

function showToast(msg, isErr=false) {
  const t=document.getElementById('toast');
  t.textContent=msg;
  t.className='toast show'+(isErr?' err':'');
  clearTimeout(t._to);
  t._to=setTimeout(()=>t.classList.remove('show'), 2800);
}
function setSyncBar(type, msg) {
  const b=document.getElementById('sync-bar');
  if(!msg){b.className='sync-bar'; b.style.display='none'; return;}
  b.className=`sync-bar show ${type}`; b.textContent=msg; b.style.display='block';
}
function clearAuthErrors() {
  ['login-user-err','login-pass-err','login-global-err','reg-user-err','reg-pass-err','reg-pass2-err','reg-global-err']
    .forEach(id=>{ const el=document.getElementById(id); if(el) el.textContent=''; });
  document.querySelectorAll('.form-input').forEach(el=>el.classList.remove('error'));
}

window.switchAuth = mode => {
  const isLogin = mode==='login';
  document.getElementById('login-form').style.display    = isLogin?'block':'none';
  document.getElementById('register-form').style.display = isLogin?'none':'block';
  document.getElementById('tab-login-btn').classList.toggle('active', isLogin);
  document.getElementById('tab-reg-btn').classList.toggle('active', !isLogin);
  clearAuthErrors();
};
window.doLogin = async () => {
  clearAuthErrors();
  const username = document.getElementById('login-user').value.trim();
  const pass     = document.getElementById('login-pass').value;
  let ok=true;
  if (!username) { document.getElementById('login-user-err').textContent='Campo obrigatório'; document.getElementById('login-user').classList.add('error'); ok=false; }
  if (!pass)     { document.getElementById('login-pass-err').textContent='Campo obrigatório'; document.getElementById('login-pass').classList.add('error'); ok=false; }
  if (!ok) return;
  const btn=document.getElementById('btn-login');
  btn.disabled=true; btn.textContent='Entrando...';
  try {
    const userKey = toKey(username);
    const snap = await get(ref(db, `bolao/users/${userKey}`));
    if (!snap.exists()) { document.getElementById('login-global-err').textContent='Usuário não encontrado. Crie uma conta.'; return; }
    const ud = snap.val();
    if (await hashPassword(pass) !== ud.passwordHash) { document.getElementById('login-pass-err').textContent='Senha incorreta'; document.getElementById('login-pass').classList.add('error'); return; }
    currentUser = {username: ud.displayName, key: userKey, isAdmin: ud.isAdmin||false};
    localStorage.setItem('bolao_session', JSON.stringify(currentUser));
    bootApp();
  } catch(e) { document.getElementById('login-global-err').textContent='Erro de conexão. Tente novamente.'; }
  finally { btn.disabled=false; btn.textContent='Entrar'; }
};
window.doRegister = async () => {
  clearAuthErrors();
  const username = document.getElementById('reg-user').value.trim();
  const pass     = document.getElementById('reg-pass').value;
  const pass2    = document.getElementById('reg-pass2').value;
  let ok=true;
  if (!username||username.length<2)  { document.getElementById('reg-user-err').textContent='Mínimo 2 caracteres'; document.getElementById('reg-user').classList.add('error'); ok=false; }
  if (username.length>20)            { document.getElementById('reg-user-err').textContent='Máximo 20 caracteres'; document.getElementById('reg-user').classList.add('error'); ok=false; }
  if (!pass||pass.length<6)          { document.getElementById('reg-pass-err').textContent='Mínimo 6 caracteres'; document.getElementById('reg-pass').classList.add('error'); ok=false; }
  if (pass!==pass2)                  { document.getElementById('reg-pass2-err').textContent='As senhas não coincidem'; document.getElementById('reg-pass2').classList.add('error'); ok=false; }
  if (!ok) return;
  const btn=document.getElementById('btn-reg');
  btn.disabled=true; btn.textContent='Criando...';
  try {
    const userKey = toKey(username);
    const snap = await get(ref(db, `bolao/users/${userKey}`));
    if (snap.exists()) { document.getElementById('reg-user-err').textContent='Este nome já está em uso'; document.getElementById('reg-user').classList.add('error'); return; }
    const hash = await hashPassword(pass);
    const usersSnap = await get(ref(db,'bolao/users'));
    const isFirstUser = !usersSnap.exists() || !Object.keys(usersSnap.val()||{}).length;
    await set(ref(db, `bolao/users/${userKey}`), {displayName: username, passwordHash: hash, isAdmin: isFirstUser, createdAt: Date.now()});
    currentUser = {username, key: userKey, isAdmin: isFirstUser};
    localStorage.setItem('bolao_session', JSON.stringify(currentUser));
    showToast(isFirstUser ? 'Conta criada! Você é o admin 🔑' : `Bem-vindo, ${username}! ⚽`);
    bootApp();
  } catch(e) { document.getElementById('reg-global-err').textContent='Erro ao criar conta. Tente novamente.'; }
  finally { btn.disabled=false; btn.textContent='Criar Conta'; }
};
window.doLogout = () => {
  currentUser=null; localStorage.removeItem('bolao_session'); clearInterval(countdownTimer);
  document.getElementById('app').style.display='none';
  document.getElementById('auth-screen').style.display='flex';
  clearAuthErrors();
  document.getElementById('login-user').value='';
  document.getElementById('login-pass').value='';
};

function bootApp() {
  document.getElementById('auth-screen').style.display='none';
  document.getElementById('app').style.display='block';
  document.getElementById('user-av').textContent     = currentUser.username[0].toUpperCase();
  document.getElementById('user-nm-hdr').textContent = currentUser.username;
  currentTab = 'ranking';
  get(ref(db, `bolao/users/${currentUser.key}`)).then(snap=>{
    if (snap.exists()) {
      const freshAdmin = snap.val().isAdmin || false;
      if (freshAdmin !== currentUser.isAdmin) {
        currentUser.isAdmin = freshAdmin;
        localStorage.setItem('bolao_session', JSON.stringify(currentUser));
        updateAdminTab(); render();
      }
    }
  });
  updateAdminTab();
  ['ranking','jogos','palpitar','admin'].forEach(t=>{ const el=document.getElementById(`tab-${t}`); if(el) el.classList.toggle('active', t===currentTab); });
  render();
  syncFromApi(true);
  clearInterval(countdownTimer);
  countdownTimer = setInterval(()=>{ if(currentTab==='palpitar') render(); }, 30000);
}

function updateAdminTab() {
  const tabsInner = document.querySelector('.tabs-inner');
  const existing  = document.getElementById('tab-admin');
  if (currentUser?.isAdmin) {
    if (!existing) {
      const btn = document.createElement('button');
      btn.className='tab-btn'; btn.id='tab-admin'; btn.onclick=()=>showTab('admin'); btn.textContent='⚙️ Admin';
      tabsInner.appendChild(btn);
    }
  } else {
    if (existing) existing.remove();
    if (currentTab==='admin') currentTab='ranking';
  }
}

function startListening() {
  onValue(ref(db,'bolao'), snap=>{
    dbData = snap.val() || {jogos:{}, users:{}};
    if (!dbData.jogos) dbData.jogos={};
    if (!dbData.users) dbData.users={};
    if (currentUser) render();
  });
  onValue(ref(db,'.info/connected'), snap=>{
    if (snap.val()===false) setSyncBar('offline','⚠️ Sem conexão — tentando reconectar...');
    else if (currentUser) setSyncBar('','');
  });
}

function parseKickoffBRT(dateStr, timeStr) {
  const [timePart, tzPart] = (timeStr||'00:00 UTC+0').split(' ');
  const [hh, mm] = timePart.split(':').map(Number);
  const tzOffset = parseInt((tzPart||'UTC+0').replace('UTC','') || '0');
  const [y, mo, d] = dateStr.split('-').map(Number);
  const kickoffUTC = Date.UTC(y, mo-1, d, hh - tzOffset, mm, 0);
  const brtD = new Date(kickoffUTC - 3*3600000);
  return { data: brtD.toISOString().substring(0,10), hora: brtD.toISOString().substring(11,16), kickoffUTC };
}

function parseFase(group, round) {
  if (group) return group.replace('Group ','Grupo ');
  if (!round) return 'Copa do Mundo';
  const r = round.toLowerCase();
  if (r.includes('round of 32'))  return 'Oitavas de 32';
  if (r.includes('round of 16'))  return 'Oitavas de Final';
  if (r.includes('quarter'))      return 'Quartas de Final';
  if (r.includes('semi'))         return 'Semifinais';
  if (r.includes('3rd')||r.includes('third')) return '3º Lugar';
  if (r.includes('final'))        return '🏆 Final';
  return round;
}

// Normaliza nome de time para chave estável de dedup no Firebase
function teamKey(name) {
  return (name||'').toLowerCase().trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/\s+/g,'').replace(/[^a-z0-9]/g,'');
}

async function syncFromApi(force=false) {
  const now=Date.now(), last=dbData.lastSync||0;
  if (!force && (now-last)<120000) return;
  setSyncBar('syncing','🔄 Buscando jogos da Copa...');
  try {
    const URL = 'https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json';
    const resp = await fetch(URL);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const json = await resp.json();
    const matches = json.matches || [];
    if (!matches.length) { setSyncBar('ok','✓ Sem jogos disponíveis ainda'); setTimeout(()=>setSyncBar('',''),5000); return; }

    let liveCount=0;
    const validMatches = matches.filter(m => {
      const t1 = (m.team1||'').toLowerCase();
      const t2 = (m.team2||'').toLowerCase();
      return !['winner','loser','path','qualifier','tbd','tba'].some(k => t1.includes(k)||t2.includes(k));
    });

    const writes = validMatches.map(m => {
      const fid = `of_${teamKey(m.team1)}_${teamKey(m.team2)}_${(m.date||'').replace(/-/g,'')}`;
      const {data, hora, kickoffUTC} = parseKickoffBRT(m.date, m.time);
      const fase = parseFase(m.group, m.round);
      const sinceKickoff = now - kickoffUTC;
      const isLive = sinceKickoff >= 0 && sinceKickoff < 130*60000;
      const isDone = sinceKickoff >= 130*60000;
      if (isLive) liveCount++;
      // ── Checagem rígida: "" (string vazia) passa em "!= null" mas não é um placar real.
      //    Isso é o que causou jogos futuros virarem "0x0 encerrado" (placeholder da fonte/scraper).
      //    Também nunca aceitamos placar pra jogo cujo horário ainda não chegou.
      const scoreOk = m.score1 !== null && m.score1 !== undefined && m.score1 !== '' &&
                       m.score2 !== null && m.score2 !== undefined && m.score2 !== '' &&
                       !isNaN(+m.score1) && !isNaN(+m.score2);
      const hasScore = scoreOk && sinceKickoff >= 0;
      const status = isDone ? 'FT' : isLive ? '1H' : 'NS';
      return runTransaction(ref(db,`bolao/jogos/${fid}`), current => {
        const base = current || {};
        return {
          ...base,
          casa: m.team1, fora: m.team2,
          data, hora, fase, status,
          resultado: hasScore
            ? {casa: m.score1, fora: m.score2}
            : (base.resultado?.casa != null ? base.resultado : {casa:null, fora:null}),
          palpites: base.palpites || {},
        };
      });
    });

    await Promise.all(writes);
    await set(ref(db,'bolao/lastSync'), now);
    clearInterval(syncTimer);
    if (liveCount>0) {
      setSyncBar('live',`🔴 ${liveCount} jogo(s) ao vivo — atualizando a cada 2 min`);
      syncTimer=setInterval(()=>syncFromApi(true), 120000);
    } else {
      setSyncBar('ok',`✓ ${validMatches.length} jogos carregados`);
      setTimeout(()=>setSyncBar('',''), 4000);
      syncTimer=setInterval(()=>syncFromApi(false), 300000);
    }
  } catch(e) {
    console.error('Sync error:',e);
    setSyncBar('offline','⚠️ Erro ao buscar jogos. Adicione manualmente no Admin.');
    setTimeout(()=>setSyncBar('',''), 8000);
  }
}

window.showTab = tab => {
  currentTab = tab;
  
  // Atualiza visual de TODAS as abas
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.id === `tab-${tab}`);
  });

  render();
};
window.setFilter = fase => { filterFase=fase; render(); };

function render() {
  const el = document.getElementById('content');
  if (!el) return;

  if (currentTab === 'ranking')   { el.innerHTML = renderRanking(); initEvolucaoChart(); }
  else if (currentTab === 'jogos')     { el.innerHTML = renderJogos(); }
  else if (currentTab === 'palpitar')  { el.innerHTML = renderPalpitar(); }
  else if (currentTab === 'admin')     { el.innerHTML = renderAdmin(); }
  else if (currentTab === 'vergonha')  { el.innerHTML = renderVergonha(); }
}

let evolucaoChart = null;
function initEvolucaoChart() {
  const canvas = document.getElementById('evolucao-chart');
  if (!canvas || typeof Chart === 'undefined') return;

  const {dias, series} = computeEvolucao();
  const rankingPorDia = computeRankingPorDia();
  if (evolucaoChart) { evolucaoChart.destroy(); evolucaoChart=null; }

  if (!dias.length) return;

  const palette = ['#C9A84C','#4ade80','#f87171','#60a5fa','#c084fc','#fb923c','#2dd4bf','#f472b6'];
  const jogadores = Object.keys(series);

  const datasets = jogadores.map((j,i)=>({
    label: `${emo(j)} ${j}`,
    data: series[j],
    borderColor: palette[i%palette.length],
    backgroundColor: palette[i%palette.length],
    borderWidth: 2,
    pointRadius: 3,
    pointHoverRadius: 5,
    tension: 0.25,
    fill: false,
  }));

  const labels = dias.map(d=>fmtDate(d));

  evolucaoChart = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: '#F0EDD8', font: {size: 11}, boxWidth: 12, padding: 10 },
          onClick: (e, legendItem, legend) => {
            const idx = legendItem.datasetIndex;
            const ci = legend.chart;
            const meta = ci.getDatasetMeta(idx);
            meta.hidden = meta.hidden === null ? !ci.data.datasets[idx].hidden : !meta.hidden;
            ci.update();
          }
        },
        tooltip: {
  backgroundColor: '#0D3318',
  titleColor: '#C9A84C',
  bodyColor: '#F0EDD8',
  borderColor: '#1F5530',
  borderWidth: 1,

  itemSort: (a, b) => {
    const dia = dias[a.dataIndex];

    const jogadorA = a.dataset.label.replace(/^.+?\s/, '');
    const jogadorB = b.dataset.label.replace(/^.+?\s/, '');

    return rankingPorDia[dia][jogadorA] - rankingPorDia[dia][jogadorB];
  },

  callbacks: {
    label: function(context) {
      const jogador =
        context.dataset.label.replace(/^.+?\s/, '');

      const dia = dias[context.dataIndex];

      const pos =
        rankingPorDia[dia][jogador];

      const medalha =
        pos === 1 ? '🥇' :
        pos === 2 ? '🥈' :
        pos === 3 ? '🥉' :
        `${pos}º`;

      return `${medalha} ${jogador} - ${context.parsed.y} pts`;
    }
  }
}
      },
      scales: {
        x: { ticks:{color:'#A8C4A0', font:{size:10}}, grid:{color:'#1F5530'} },
        y: { ticks:{color:'#A8C4A0', font:{size:10}}, grid:{color:'#1F5530'}, beginAtZero:true }
      }
    }
  });
}

function renderRanking() {
  const {sorted,exact}=computeRanking();
  const M=['🥇','🥈','🥉'], C=['gold','silver','bronze'];
  let h=`<div class="sec-title">🏆 Classificação</div><div class="podium-grid">`;
  sorted.slice(0,3).forEach(([n,p],i)=>{
    h+=`<div class="podium-card ${C[i]}" style="cursor:pointer" onclick="showPlayerModal('${n}')"><span class="p-medal">${M[i]}</span><div style="font-size:16px">${emo(n)}</div><div class="p-name">${n}</div><div class="p-pts">${p}</div><div class="p-lbl">pts</div></div>`;
  });
  h+=`</div><div class="rank-list">`;
  sorted.slice(3).forEach(([n,p],i)=>{
    h+=`<div class="rank-item" style="cursor:pointer" onclick="showPlayerModal('${n}')"><span class="rank-pos">${i+4}º</span><span style="font-size:16px">${emo(n)}</span><span class="rank-name">${n}</span><div style="text-align:right"><div class="rank-pts">${p}</div><div style="font-size:10px;color:var(--text2)">pontos</div></div></div>`;
  });
  h+=`</div>`;

  // ── Evolução do ranking ──
  const {dias} = computeEvolucao();
  h+=`<div class="evolucao-box"><div class="evolucao-title">📈 Evolução do Ranking</div>`;
  if (!dias.length) {
    h+=`<div style="color:var(--text2);font-size:12px;padding:10px 0">Ainda sem jogos com resultado para mostrar evolução.</div>`;
  } else {
    h+=`<div class="evolucao-hint">Clique nos nomes abaixo do gráfico para esconder/mostrar jogadores.</div>
    <div class="evolucao-canvas-wrap"><canvas id="evolucao-chart"></canvas></div>`;
  }
  h+=`</div>`;

  h+=`<div class="vidente-box"><div class="vidente-title">⭐ Prêmio Vidente 🔮 <span style="font-size:10px;font-weight:400;color:var(--text2)">(mais placares exatos)</span></div>`;
  const vid=Object.entries(exact).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]);
  if (!vid.length) h+=`<div style="color:var(--text2);font-size:12px">Nenhum placar exato ainda.</div>`;
  vid.forEach(([n,c],i)=>{
    h+=`<div class="vidente-item"><span style="font-weight:600;font-size:13px">${['🥇','🥈','🥉'][i]||''} ${emo(n)} ${n}</span><div style="display:flex;align-items:baseline;gap:3px"><span class="vidente-count">${c}</span><span style="font-size:10px;color:var(--text2)">exatos</span></div></div>`;
  });
  h+=`</div><div class="pts-legend"><div class="pts-legend-title">📋 Sistema de Pontuação</div><div class="pts-grid">`;
  [['Placar exato','25pts','pts-exact'],['Vencedor + gols do vencedor','18pts','pts-vg'],['Vencedor + diferença de gols','15pts','pts-diff'],['Empate correto','15pts','pts-draw'],['Vencedor + gols do perdedor','12pts','pts-lg'],['Acertou o vencedor','10pts','pts-win'],['Previu empate (mas não foi)','4pts','pts-almost'],['Errou tudo','0pts','pts-zero']].forEach(([l,p,c])=>{
    h+=`<div class="pts-row"><span>${l}</span><span class="${c}" style="font-weight:700;white-space:nowrap">${p}</span></div>`;
  });
  h+=`</div><div style="margin-top:11px;padding-top:10px;border-top:1px solid var(--border)"><div style="font-family:'Bebas Neue',sans-serif;font-size:13px;color:var(--gold);letter-spacing:1px;margin-bottom:7px">📈 Multiplicadores por Fase</div><div class="pts-grid">`;
  [['🌎 Fase de Grupos','×1'],['🎟️ 16 Avos de Final','×1,25'],['🔥 Oitavas de Final','×1,5'],['💥 Quartas de Final','×2'],['⚔️ Semifinais','×2,5'],['🥉 Disputa de 3º Lugar','×2,5'],['🏆 Final','×3']].forEach(([l,m])=>{
    h+=`<div class="pts-row"><span>${l}</span><span style="font-weight:700;color:var(--gold);white-space:nowrap">${m}</span></div>`;
  });
  h+=`</div></div></div>`;
  return h;
}

function renderMatchCard(jogo, opts={}) {
  const s=jogo.status||'NS';
  const isLive=['1H','HT','2H','ET','BT','P','INT'].includes(s);
  const isDone=['FT','AET','PEN'].includes(s);
  const temRes = jogo.resultado?.casa != null && jogo.resultado?.fora != null;
  const aberto = jogoAberto(jogo);
  const badge  = isLive ? `<span class="badge badge-live"><span class="live-dot"></span>AO VIVO</span>`
               : isDone ? `<span class="badge badge-enc">✓ Encerrado</span>`
               : aberto ? `<span class="badge badge-pend">Aberto</span>`
               :          `<span class="badge badge-fechado">🔒 Fechado</span>`;
  const c = temRes ? jogo.resultado.casa : '-';
  const f = temRes ? jogo.resultado.fora : '-';
  const multi = getMulti(jogo.fase);
  let h=`<div class="match-card ${opts.highlight?'match-card-today':''}">
    <div class="match-hdr">
      <span class="match-date">📅 ${fmtDate(jogo.data)} · ${fmtTime(jogo.hora)}</span>
      <div style="display:flex;gap:5px;align-items:center"><span class="match-stage">${jogo.fase}</span>${badge}</div>
    </div>
    <div class="match-body">
      <div class="scoreboard">
        <div class="team-info"><div class="team-flag">${flag(jogo.casa)}</div><div class="team-name">${jogo.casa}</div></div>
        <div class="score-box"><div class="score-num">${c}</div><div class="score-div">x</div><div class="score-num">${f}</div></div>
        <div class="team-info"><div class="team-flag">${flag(jogo.fora)}</div><div class="team-name">${jogo.fora}</div></div>
      </div>
    </div>`;
  const pals=Object.entries(jogo.palpites||{});
  if (pals.length) {
    h+=`<div class="match-pals"><div class="pals-title">📝 Palpites</div><div class="pals-grid">`;
    pals.forEach(([jogador,p])=>{
      const r = temRes ? calcPts(jogo.resultado,p) : null;
      const ptsFinais = r ? Math.round(r.pts * multi) : null;
      const scoreStr = aberto ? '?x?' : `${p.casa}x${p.fora}`;
      h+=`<div class="pal-item"><span class="pal-player">${emo(jogador)} ${jogador}</span><div style="display:flex;flex-direction:column;align-items:flex-end;gap:1px"><span class="pal-score">${scoreStr}</span>${r ? `<span style="font-size:10px" class="${ptsClass(r.tipo)}">${ptsLabel(r.tipo)} ${ptsFinais}pts${multi>1?' ×'+multi:''}</span>` : ''}</div></div>`;
    });
    h+=`</div></div>`;
  }
  h+=`</div>`;
  return h;
}
function fmtDiaLong(data) {
  if (!data) return '';
  const [y, m, d] = data.split('-').map(Number);
  const dt = new Date(y, m-1, d);

  return dt.toLocaleDateString('pt-BR', {
    weekday:'long',
    day:'2-digit',
    month:'long'
  });
}

window.toggleDay = id => {
  const body = document.getElementById('day-body-'+id);
  const hdr  = document.getElementById('day-hdr-'+id);
  const chev = document.getElementById('day-chev-'+id);

  const isOpen = body.classList.contains('open');

  body.classList.toggle('open', !isOpen);
  hdr.classList.toggle('open', !isOpen);
  chev.classList.toggle('open', !isOpen);
};
function renderJogos() {
  const jogos  = getJogos();
  const hoje   = todayBRT();

  const fases = ['Todos', ...new Set(jogos.map(j => j.fase))];

  const filtrados =
    filterFase === 'Todos'
      ? jogos
      : jogos.filter(j => j.fase === filterFase);

  const jogosHoje     = filtrados.filter(j => diaExibicao(j) === hoje);
  const jogosPassados = filtrados.filter(j => diaExibicao(j) < hoje);
  const jogosFuturos  = filtrados.filter(j => diaExibicao(j) > hoje);

  const diasPassOrdenados =
    [...new Set(jogosPassados.map(j => diaExibicao(j)))]
      .sort()
      .reverse();

  const diaAnterior = diasPassOrdenados[0] || null;

  let h = '';

  // HOJE
  h += `<div class="today-header">📅 Jogos de Hoje</div>`;

  if (jogosHoje.length) {
    jogosHoje.forEach(j => {
      h += renderMatchCard(j, {highlight:true});
    });
  } else {
    h += `
      <div style="
        background:var(--surface);
        border:1px solid var(--border);
        border-radius:10px;
        padding:14px;
        margin-bottom:14px;
        text-align:center;
        color:var(--text2)">
        Nenhum jogo hoje.
      </div>
    `;
  }

  // FILTROS
  h += `<div class="today-header">⚽ Jogos da Copa</div>`;

  h += `<div class="filter-bar">`;
  fases.forEach(f => {
    h += `
      <button
        class="filter-btn ${filterFase===f?'active':''}"
        onclick="setFilter('${f}')">
        ${f}
      </button>
    `;
  });
  h += `</div>`;

  if (!filtrados.length) {
    h += `<div class="empty">Nenhum jogo disponível.</div>`;
    return h;
  }

  // ANTERIORES
  if (jogosPassados.length) {

    h += `
      <div class="today-header" style="margin-top:14px">
        📋 Jogos Anteriores
      </div>
    `;

    diasPassOrdenados.forEach(dia => {

      const lista =
        jogosPassados.filter(
          j => diaExibicao(j) === dia
        );

      const dayId =
        'past_' + dia.replace(/-/g,'');

      const temRes =
        lista.some(
          j => j.resultado?.casa != null
        );

      const isOpen =
        dia === diaAnterior;

      h += `
        <div class="day-accordion">

          <div
            class="day-accordion-hdr ${isOpen?'open':''}"
            id="day-hdr-${dayId}"
            onclick="toggleDay('${dayId}')">

            <div class="day-title">
              📅 ${fmtDiaLong(dia)}
            </div>

            <div class="day-meta">
              <span>
                ${lista.length} jogo${lista.length>1?'s':''}
              </span>

              ${
                temRes
                ? '<span style="color:#4ade80">✓ encerrado</span>'
                : '<span style="color:#c084fc">sem placar</span>'
              }

              <span
                class="day-chevron ${isOpen?'open':''}"
                id="day-chev-${dayId}">
                ▼
              </span>
            </div>

          </div>

          <div
            class="day-accordion-body ${isOpen?'open':''}"
            id="day-body-${dayId}">
      `;

      lista.forEach(j => {
        h += renderMatchCard(j);
      });

      h += `
          </div>
        </div>
      `;
    });
  }

  // FUTUROS
  if (jogosFuturos.length) {

    const diasFut =
      [...new Set(jogosFuturos.map(j => diaExibicao(j)))]
      .sort();

    h += `
      <div class="today-header" style="margin-top:14px">
        📅 Próximos Jogos
      </div>
    `;

    diasFut.forEach(dia => {

      const lista =
        jogosFuturos.filter(
          j => diaExibicao(j) === dia
        );

      const dayId =
        'fut_' + dia.replace(/-/g,'');

      const temAberto =
        lista.some(j => jogoAberto(j));

      h += `
        <div class="day-accordion">

          <div
            class="day-accordion-hdr"
            id="day-hdr-${dayId}"
            onclick="toggleDay('${dayId}')">

            <div class="day-title">
              📅 ${fmtDiaLong(dia)}
            </div>

            <div class="day-meta">

              <span>
                ${lista.length} jogo${lista.length>1?'s':''}
              </span>

              ${
                temAberto
                ? '<span style="color:#fbbf24">● aberto</span>'
                : ''
              }

              <span
                class="day-chevron"
                id="day-chev-${dayId}">
                ▼
              </span>

            </div>

          </div>

          <div
            class="day-accordion-body"
            id="day-body-${dayId}">
      `;

      lista.forEach(j => {
        h += renderMatchCard(j);
      });

      h += `
          </div>
        </div>
      `;
    });
  }

  return h;
}

function renderPalpitar() {
  const jogos = getJogos();
  const hoje  = todayBRT();
  const jogosHoje   = jogos.filter(j => diaExibicao(j) === hoje);
  const abertos     = jogosHoje.filter(j => jogoAberto(j));
  const fechadosHoje= jogosHoje.filter(j => !jogoAberto(j));
  const proximosDias= [...new Set(jogos.filter(j=>diaExibicao(j)>hoje).map(j=>diaExibicao(j)))].sort();
  const proximoDia  = proximosDias[0] || null;

  let h = `<div class="sec-title">✏️ Palpites de Hoje</div>`;

  if (!jogosHoje.length) {
    h += `<div class="empty" style="padding:40px 20px"><div style="font-size:40px;margin-bottom:12px">😴</div>Sem jogos hoje!<br>${proximoDia ? `<span style="color:var(--gold)">Próximos jogos: ${fmtDate(proximoDia)}</span><br><span style="font-size:11px">Os palpites aparecem aqui nesse dia.</span>` : 'Fique de olho!'}</div>`;
    return h;
  }

  if (abertos.length) {
    abertos.forEach(jogo => {
      const meu  = (jogo.palpites||{})[currentUser.username];
      const tempo = tempoParaJogo(jogo);
      h += `<div class="palpitar-card">
        <div class="pal-hdr"><span style="font-weight:600;font-size:11px;color:var(--gold)">${jogo.fase}</span><span style="font-size:10px;color:var(--text2)">📅 ${fmtDate(jogo.data)} · ${fmtTime(jogo.hora)}</span></div>
        <div class="pal-match-row">
          <div class="pal-team"><div class="pal-flag">${flag(jogo.casa)}</div><div class="pal-name">${jogo.casa}</div></div>
          <span style="font-family:'Bebas Neue',sans-serif;font-size:16px;color:var(--text2)">VS</span>
          <div class="pal-team"><div class="pal-flag">${flag(jogo.fora)}</div><div class="pal-name">${jogo.fora}</div></div>
        </div>
        <div class="my-pal-section">
          <div class="my-pal-label">${emo(currentUser.username)} ${currentUser.username} — seu palpite</div>
          <div class="my-pal-row">
            <input class="sc-in" type="number" min="0" max="20" placeholder="0" id="pc_${jogo._id}" value="${meu!=null?meu.casa:''}">
            <span class="sc-x">x</span>
            <input class="sc-in" type="number" min="0" max="20" placeholder="0" id="pf_${jogo._id}" value="${meu!=null?meu.fora:''}">
            <button class="btn-salvar" onclick="salvarPalpite('${jogo._id}')">Salvar</button>
            ${tempo ? `<span class="countdown">⏳ ${tempo}</span>` : ''}
          </div>
          ${meu!=null ? `<div style="font-size:10px;color:var(--text2);margin-top:6px">✅ Palpite atual: <strong>${meu.casa}x${meu.fora}</strong></div>` : ''}
        </div>
      </div>`;
    });
  }

  if (fechadosHoje.length) {
    h += `<div style="font-family:'Bebas Neue',sans-serif;font-size:14px;color:#c084fc;letter-spacing:1px;margin:16px 0 8px">🔒 Fechados / Em Andamento</div>`;
    fechadosHoje.forEach(jogo => {
      const meu = (jogo.palpites||{})[currentUser.username];
      const s   = jogo.status||'NS';
      const isDone=['FT','AET','PEN'].includes(s);
      const isLive=['1H','HT','2H','ET','BT','P','INT'].includes(s);
      h += `<div class="palpitar-card" style="opacity:.8">
        <div class="pal-hdr" style="background:${isLive?'#2a0000':isDone?'#0a2a0a':'var(--surface2)'}">
          <span style="font-weight:600;font-size:11px;color:${isLive?'#f87171':isDone?'#4ade80':'#c084fc'}">${jogo.fase}</span>
          <span style="font-size:10px;color:var(--text2)">📅 ${fmtDate(jogo.data)} · ${fmtTime(jogo.hora)}</span>
        </div>
        <div class="pal-match-row">
          <div class="pal-team"><div class="pal-flag">${flag(jogo.casa)}</div><div class="pal-name">${jogo.casa}</div></div>
          ${jogo.resultado?.casa!=null ? `<div style="text-align:center"><div style="font-family:'Bebas Neue',sans-serif;font-size:32px;color:var(--text)">${jogo.resultado.casa} x ${jogo.resultado.fora}</div>${isLive?'<div style="font-size:10px;color:#f87171">● AO VIVO</div>':''}</div>` : `<span style="font-family:'Bebas Neue',sans-serif;font-size:16px;color:var(--text2)">VS</span>`}
          <div class="pal-team"><div class="pal-flag">${flag(jogo.fora)}</div><div class="pal-name">${jogo.fora}</div></div>
        </div>
        <div class="my-pal-section">
          ${meu!=null ? `<div style="font-size:12px;color:var(--text2)">✅ Seu palpite: <strong style="color:var(--text)">${meu.casa}x${meu.fora}</strong></div>` : `<div class="locked-msg">🔒 Prazo encerrado — palpite não registrado</div>`}
        </div>
      </div>`;
    });
  }
  return h;
}

function renderAdmin() {
  const isAdmin = currentUser?.isAdmin;
  if (!isAdmin) {
    return `<div style="text-align:center;padding:48px 20px"><div style="font-size:64px;margin-bottom:16px">🚨</div><div style="font-family:'Bebas Neue',sans-serif;font-size:32px;color:var(--red);letter-spacing:2px;margin-bottom:8px">ÁREA RESTRITA</div><div style="font-size:14px;color:var(--text2);margin-bottom:24px;line-height:1.7">Ei, <strong style="color:var(--text)">${currentUser.username}</strong>! Tentando espiar o admin? 👀<br>Isso aqui é só pra quem manda no pedaço.</div><div style="font-family:'Bebas Neue',sans-serif;font-size:16px;color:var(--gold);letter-spacing:1px;margin-bottom:20px">🔒 Acesso negado. Tente de novo em: nunca.</div><button class="btn-salvar" onclick="showTab('palpitar')">✏️ Ir Palpitar</button></div>`;
  }
  let h=`<div class="sec-title">⚙️ Admin</div>`;
  const ls = dbData.lastSync ? new Date(dbData.lastSync).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}) : 'nunca';
  const hojeAdmin = todayBRT();
  const futurosComResultado = getJogos().filter(j => j.data > hojeAdmin && j.resultado?.casa != null);
  const jogosRawAdmin = Object.entries(dbData.jogos||{}).map(([id,j])=>({...j,_id:id}));
  const gruposDuplicados = agruparJogos(jogosRawAdmin).filter(g => g.items.length > 1);
  const totalCopiasExtra = gruposDuplicados.reduce((s,g)=>s+g.items.length-1, 0);
  h+=`<div class="admin-box"><div class="admin-box-title">🔄 Sincronização</div>
    <div style="font-size:12px;color:var(--text2);background:var(--surface2);border-radius:7px;padding:10px 12px;line-height:1.7"><strong style="color:var(--text)">Última sync:</strong> ${ls} &nbsp;·&nbsp; <strong style="color:var(--text)">Jogos (brutos):</strong> ${Object.keys(dbData.jogos||{}).length} &nbsp;·&nbsp; <strong style="color:var(--text)">Jogos (dedup):</strong> ${getJogos().length}</div>
    ${futurosComResultado.length ? `<div style="font-size:12px;color:#f87171;background:#2a0000;border:1px solid #991b1b;border-radius:7px;padding:10px 12px;line-height:1.7;margin-top:8px">⚠️ <strong>${futurosComResultado.length} jogo(s) com data futura já têm resultado preenchido</strong> — provavelmente placar fantasma (placeholder). Use o botão abaixo pra limpar.</div>` : ''}
    ${gruposDuplicados.length ? `<div style="font-size:12px;color:#fbbf24;background:#1a1800;border:1px solid #854d0e;border-radius:7px;padding:10px 12px;line-height:1.7;margin-top:8px">⚠️ <strong>${gruposDuplicados.length} jogo(s) com ${totalCopiasExtra} cópia(s) duplicada(s)</strong> no banco (provável resquício do scraper antigo). Use o botão abaixo pra mesclar palpites e remover as cópias extras.</div>` : ''}
    <div style="display:flex;gap:7px;margin-top:10px;flex-wrap:wrap">
      <button class="btn-sm" onclick="forcSync()">🔄 Sincronizar agora</button>
      ${futurosComResultado.length ? `<button class="btn-danger" style="padding:7px 14px" onclick="limparResultadosFuturos()">🧹 Limpar Resultados Futuros (${futurosComResultado.length})</button>` : ''}
      ${gruposDuplicados.length ? `<button class="btn-danger" style="padding:7px 14px" onclick="removerDuplicados()">🧹 Remover Duplicados (${totalCopiasExtra})</button>` : ''}
    </div></div>`;

  const semRes = getJogos().filter(j=>!['FT','AET','PEN'].includes(j.status||'NS') || j.resultado?.casa == null);
  if (semRes.length) {
    h+=`<div class="admin-box"><div class="admin-box-title">📝 Inserir Resultado Manual</div><div style="font-size:11px;color:var(--text2);margin-bottom:10px">Use para corrigir ou adiantar resultado antes da API atualizar.</div>`;
    semRes.slice(0,15).forEach(jogo=>{
      h+=`<div class="res-row"><div class="res-match-name">${flag(jogo.casa)} ${jogo.casa} x ${jogo.fora} ${flag(jogo.fora)} <span style="color:var(--text2);font-weight:400"> — ${fmtDate(jogo.data)} · ${jogo.fase}</span></div>
        <div class="res-inputs"><span class="res-team">${jogo.casa}</span><input class="res-in" type="number" min="0" max="20" placeholder="0" id="rc_${jogo._id}"><span class="res-x">x</span><input class="res-in" type="number" min="0" max="20" placeholder="0" id="rf_${jogo._id}"><span class="res-team">${jogo.fora}</span><button class="btn-sm" onclick="salvarRes('${jogo._id}')">Salvar</button></div></div>`;
    });
    h+=`</div>`;
  }
  const comRes = getJogos().filter(j=>j.resultado?.casa!=null && j.resultado?.fora!=null);
  if (comRes.length) {
    h+=`<div class="admin-box"><div class="admin-box-title">✅ Resultados Registrados</div>`;
    comRes.forEach(jogo=>{
      h+=`<div style="display:flex;align-items:center;justify-content:space-between;background:var(--surface2);border-radius:7px;padding:8px 11px;margin-bottom:5px;flex-wrap:wrap;gap:6px"><div><span style="font-weight:600;font-size:12px">${flag(jogo.casa)} ${jogo.casa} ${jogo.resultado.casa}x${jogo.resultado.fora} ${jogo.fora} ${flag(jogo.fora)}</span><span style="font-size:10px;color:var(--text2);display:block">${fmtDate(jogo.data)} · ${jogo.fase}</span></div><button class="btn-danger" onclick="resetRes('${jogo._id}')">✏️ Editar</button></div>`;
    });
    h+=`</div>`;
  }
  const users = Object.entries(dbData.users||{});
  h+=`<div class="admin-box"><div class="admin-box-title">👥 Usuários (${users.length})</div>`;
  if (!users.length) h+=`<div style="color:var(--text2);font-size:12px">Nenhum usuário cadastrado.</div>`;
  users.sort((a,b)=>a[0]>b[0]?1:-1).forEach(([key,u])=>{
    const isMe = key===currentUser.key;
    h+=`<div class="user-list-item"><div><span class="user-list-name">${emo(u.displayName)} ${u.displayName}${isMe?'<span style="font-size:10px;color:var(--text2)"> (você)</span>':''}</span><span class="user-list-meta">Desde ${new Date(u.createdAt).toLocaleDateString('pt-BR')}</span></div><div style="display:flex;align-items:center;gap:6px">${u.isAdmin?`<span class="admin-badge">Admin</span>`:''} ${isAdmin&&!isMe&&!u.isAdmin?`<button class="btn-sm" style="font-size:10px;padding:4px 9px" onclick="toggleAdmin('${key}',true)">+Admin</button>`:''} ${isAdmin&&!isMe&&u.isAdmin?`<button class="btn-danger" style="padding:4px 9px;font-size:10px" onclick="toggleAdmin('${key}',false)">−Admin</button>`:''}</div></div>`;
  });
  h+=`</div>`;
  const flagOpts = Object.entries(FLAGS).map(([n,f])=>`<option value="${n}">${f} ${n}</option>`).join('');
  h+=`<div class="admin-box"><div class="admin-box-title">➕ Adicionar Jogo Manual</div>
    <div style="font-size:11px;color:var(--text2);margin-bottom:10px">Use quando a API não tiver o jogo ou para adiantar cadastro.</div>
    <div class="form-grid">
      <div class="form-group-admin"><label class="form-label-admin">Mandante</label><select class="form-select-admin" id="new_casa">${flagOpts}</select></div>
      <div class="form-group-admin"><label class="form-label-admin">Visitante</label><select class="form-select-admin" id="new_fora">${flagOpts}</select></div>
      <div class="form-group-admin"><label class="form-label-admin">Data</label><input type="date" class="form-input-admin" id="new_data"></div>
      <div class="form-group-admin"><label class="form-label-admin">Hora (BRT)</label><input type="time" class="form-input-admin" id="new_hora" value="16:00"></div>
      <div class="form-group-admin full"><label class="form-label-admin">Fase / Grupo</label><input type="text" class="form-input-admin" id="new_fase" placeholder="ex: Grupo A, Oitavas de Final, Final..."></div>
    </div>
    <button class="btn-sm" style="margin-top:10px;padding:9px 22px" onclick="addJogo()">➕ Adicionar Jogo</button></div>`;
  h+=`<div class="admin-box"><div class="admin-box-title">🔑 Alterar Minha Senha</div>
    <div class="form-grid" style="gap:8px">
      <div class="form-group-admin full"><label class="form-label-admin">Nova Senha</label><input class="form-input-admin" type="password" id="new-pass" placeholder="mínimo 6 caracteres"></div>
      <div class="form-group-admin full"><label class="form-label-admin">Confirmar Nova Senha</label><input class="form-input-admin" type="password" id="new-pass2" placeholder="repita"></div>
    </div>
    <button class="btn-sm" style="margin-top:10px" onclick="changePassword()">🔑 Alterar Senha</button></div>`;
  return h;
}

window.forcSync = async () => { showToast('Sincronizando...'); await syncFromApi(true); };
window.limparResultadosFuturos = async () => {
  const hoje = todayBRT();
  const suspeitos = getJogos().filter(j => j.data > hoje && j.resultado?.casa != null);
  if (!suspeitos.length) { showToast('Nenhum resultado futuro suspeito. ✅'); return; }
  const ok = confirm(`Encontrados ${suspeitos.length} jogo(s) com data futura mas resultado já preenchido (provável placar fantasma). Limpar todos e reabrir pra palpite?`);
  if (!ok) return;
  for (const j of suspeitos) {
    await update(ref(db, `bolao/jogos/${j._id}/resultado`), {casa:null, fora:null});
    await update(ref(db, `bolao/jogos/${j._id}`), {status:'NS'});
  }
  showToast(`${suspeitos.length} resultado(s) futuro(s) limpo(s)! 🧹`);
};
window.removerDuplicados = async () => {
  const jogosRaw = Object.entries(dbData.jogos||{}).map(([id,j])=>({...j,_id:id}));
  const grupos = agruparJogos(jogosRaw).filter(g => g.items.length > 1);
  if (!grupos.length) { showToast('Nenhum jogo duplicado encontrado. ✅'); return; }
  const totalExtra = grupos.reduce((s,g)=>s+g.items.length-1, 0);
  const ok = confirm(`Encontrados ${grupos.length} jogo(s) com ${totalExtra} cópia(s) duplicada(s). Mesclar palpites na cópia mais completa e apagar as demais? Essa ação não pode ser desfeita.`);
  if (!ok) return;
  for (const g of grupos) {
    let best = g.items[0], bestScore = scoreJogo(best);
    g.items.slice(1).forEach(item => { const s = scoreJogo(item); if (s > bestScore) { best = item; bestScore = s; } });
    const palpitesMerged = {};
    g.items.forEach(item => Object.assign(palpitesMerged, item.palpites||{}));
    await update(ref(db, `bolao/jogos/${best._id}`), {palpites: palpitesMerged});
    for (const item of g.items) {
      if (item._id !== best._id) await set(ref(db, `bolao/jogos/${item._id}`), null);
    }
  }
  showToast(`${totalExtra} jogo(s) duplicado(s) removido(s)! 🧹`);
};
window.salvarPalpite = async id => {
  const jogoEntry = Object.entries(dbData.jogos||{}).find(([k])=>k===id);
  if (jogoEntry && !jogoAberto({...jogoEntry[1], _id:jogoEntry[0]})) { showToast('⏰ Prazo encerrado para este jogo!', true); return; }
  const c = document.getElementById(`pc_${id}`)?.value;
  const f = document.getElementById(`pf_${id}`)?.value;
  if (c===''||f==='') { showToast('Preencha os dois placares!', true); return; }
  if (+c<0||+f<0||+c>20||+f>20) { showToast('Placar inválido!', true); return; }
  await update(ref(db, `bolao/jogos/${id}/palpites/${currentUser.username}`), {casa:+c, fora:+f});
  showToast(`Palpite salvo! ${c}x${f} ✅`);
};
window.salvarRes = async id => {
  const c = document.getElementById(`rc_${id}`)?.value;
  const f = document.getElementById(`rf_${id}`)?.value;
  if (c===''||f==='') { showToast('Preencha o placar!', true); return; }
  await update(ref(db, `bolao/jogos/${id}/resultado`), {casa:+c, fora:+f});
  await update(ref(db, `bolao/jogos/${id}`), {status:'FT'});
  showToast('Resultado salvo! 🎯');
};
window.resetRes = async id => {
  await update(ref(db, `bolao/jogos/${id}/resultado`), {casa:null, fora:null});
  await update(ref(db, `bolao/jogos/${id}`), {status:'NS'});
  showToast('Resultado removido para edição.');
};
window.toggleAdmin = async (key, makeAdmin) => {
  await update(ref(db, `bolao/users/${key}`), {isAdmin: makeAdmin});
  showToast(makeAdmin ? 'Admin concedido! 🔑' : 'Admin removido.');
};
window.changePassword = async () => {
  const p1 = document.getElementById('new-pass')?.value;
  const p2 = document.getElementById('new-pass2')?.value;
  if (!p1||p1.length<6) { showToast('Mínimo 6 caracteres!', true); return; }
  if (p1!==p2)          { showToast('Senhas não coincidem!', true); return; }
  const hash = await hashPassword(p1);
  await update(ref(db, `bolao/users/${currentUser.key}`), {passwordHash: hash});
  showToast('Senha alterada! ✅');
  document.getElementById('new-pass').value='';
  document.getElementById('new-pass2').value='';
};
window.addJogo = async () => {
  const casa = document.getElementById('new_casa')?.value;
  const fora = document.getElementById('new_fora')?.value;
  const data = document.getElementById('new_data')?.value;
  const hora = document.getElementById('new_hora')?.value;
  const fase = document.getElementById('new_fase')?.value?.trim();
  if (!data || !fase) { showToast('Preencha data e fase!', true); return; }
  if (casa === fora)  { showToast('Times devem ser diferentes!', true); return; }
  await push(ref(db,'bolao/jogos'), {casa, fora, data, hora, fase, status:'NS', resultado:{casa:null, fora:null}, palpites:{}});
  showToast(`${casa} x ${fora} adicionado! ⚽`);
  document.getElementById('new_data').value = '';
  document.getElementById('new_fase').value = '';
};
window.zerarTudo = async () => {
  await set(ref(db,'bolao/jogos'), {});
  await set(ref(db,'bolao/lastSync'), null);
  showToast('Dados zerados.');
};

// ════════════════════════════════════════════════════════════════
// 🏆 Modal de Conquistas do Jogador
// ════════════════════════════════════════════════════════════════
window.showPlayerModal = (playerName) => {
  const jogos = getJogos();
  const rankingPorDia = computeRankingPorDia();
  const allPalPlayers = new Set();
  jogos.forEach(j => Object.keys(j.palpites||{}).forEach(n => allPalPlayers.add(n)));
  const allPlayers = [...new Set([...KNOWN_PLAYERS, ...allPalPlayers])];

  const earnedMap = computeAchievements(jogos, rankingPorDia, allPlayers);
  const earned = earnedMap[playerName] || new Set();

  const groups = ['ouro','prata','bronze','especial'];
  let body = '';
  groups.forEach(rarity => {
    const meta = RARITY_META[rarity];
    const defs = BADGE_DEFS.filter(b => b.rarity === rarity);
    if (!defs.length) return;
    body += `<div class="achv-group"><div class="achv-group-title" style="color:${meta.color}">${meta.icon} ${meta.label}</div><div class="achv-grid">`;
    defs.forEach(b => {
      const has = earned.has(b.id);
      body += `<div class="achv-chip ${has?'':'locked'}" style="border-color:${meta.color}">
        <span class="achv-chip-icon">${has?meta.icon:'🔒'}</span>
        <div class="achv-chip-text">
          <div class="achv-chip-name" style="color:${has?meta.color:'var(--text2)'}">${b.name}</div>
          <div class="achv-chip-desc">${b.desc}</div>
        </div>
      </div>`;
    });
    body += `</div></div>`;
  });
  if (!earned.size) {
    body += `<div class="achv-empty">Nenhuma conquista ainda — continue palpitando! ⚽</div>`;
  }

  const overlay = document.createElement('div');
  overlay.className = 'achv-overlay';
  overlay.id = 'achv-overlay';
  overlay.onclick = (e) => { if (e.target === overlay) closePlayerModal(); };
  overlay.innerHTML = `<div class="achv-modal">
    <div class="achv-modal-hdr">
      <div class="achv-modal-title">${emo(playerName)} ${playerName}</div>
      <button class="achv-close-btn" onclick="closePlayerModal()">✕</button>
    </div>
    ${body}
  </div>`;
  document.body.appendChild(overlay);
};

window.closePlayerModal = () => {
  document.getElementById('achv-overlay')?.remove();
};

startListening();
setTimeout(()=>{
  document.getElementById('loading-screen').style.display='none';
  const sess = localStorage.getItem('bolao_session');
  if (sess) { try { currentUser = JSON.parse(sess); bootApp(); } catch { localStorage.removeItem('bolao_session'); } }
  if (!currentUser) document.getElementById('auth-screen').style.display='flex';
}, 1200);
// ====================== HALL DA VERGONHA ======================

// ====================== HALL DA VERGONHA ======================

function computeHallDaVergonha() {
  const jogos = getJogos();
  const rankingPorDia = computeRankingPorDia();
  
  const allPlayers = [...new Set([
    ...KNOWN_PLAYERS,
    ...Object.values(dbData.users || {}).map(u => u.displayName)
  ])];

  const hall = {
    profetaReverso: [],
    peFrio: [],
    dormiuNoPonto: [],
    investidorOi: [],
    zebraMorto: [],
    maratonistaLanterna: [],
    apostadorCompulsivo: []
  };

  const stats = {};
  allPlayers.forEach(p => {
    stats[p] = {
      semPalpite: 0,
      exactErrados: 0,
      peFrio: 0,
      maxSeqSemPontos: 0,
      currentSeq: 0,
      zebraErrada: 0,
      diff3mais: 0,
    };
  });

  jogos.forEach(jogo => {
    const palpites = jogo.palpites || {};
    const temRes = jogo.resultado?.casa != null;

    allPlayers.forEach(player => {
      const pal = palpites[player];

      if (!pal) {
        stats[player].semPalpite++;
      } else {
        const diff = Math.abs(+pal.casa - +pal.fora);
        if (diff >= 3) stats[player].diff3mais++;

        if (temRes) {
          const tipo = classify(jogo.resultado, pal);

          if (tipo === 'almost') stats[player].exactErrados++;

          if (+pal.casa > +pal.fora && +jogo.resultado.casa < +jogo.resultado.fora) {
            stats[player].peFrio++;
          }

          const pts = calcPts(jogo.resultado, pal);
          if (pts && pts.pts === 0) {
            stats[player].currentSeq = (stats[player].currentSeq || 0) + 1;
            stats[player].maxSeqSemPontos = Math.max(stats[player].maxSeqSemPontos || 0, stats[player].currentSeq);
          } else {
            stats[player].currentSeq = 0;
          }
        }
      }
    });
  });

  // Maratonista da Lanterna
  allPlayers.forEach(player => {
    let count = 0;
    Object.values(rankingPorDia).forEach(rankDia => {
      if (rankDia[player] === Object.keys(rankDia).length) count++;
    });
    if (count >= 1) hall.maratonistaLanterna.push({player, count});
  });

  // Preenche Hall
  allPlayers.forEach(p => {
    const s = stats[p];
    if (s.semPalpite >= 1)     hall.dormiuNoPonto.push({player: p, count: s.semPalpite});
    if (s.exactErrados >= 1)   hall.profetaReverso.push({player: p, count: s.exactErrados});
    if (s.peFrio >= 1)         hall.peFrio.push({player: p, count: s.peFrio});
    if (s.maxSeqSemPontos >= 3) hall.investidorOi.push({player: p, count: s.maxSeqSemPontos});
    if (s.diff3mais >= 2)      hall.apostadorCompulsivo.push({player: p, count: s.diff3mais});
  });

  // Ordena Top 3
  Object.keys(hall).forEach(key => {
    hall[key].sort((a, b) => b.count - a.count);
    hall[key] = hall[key].slice(0, 3);
  });

  return hall;
}

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

function renderVergonha() {
  const hall = computeHallDaVergonha();
  let h = `<div class="sec-title">🤡 Hall da Vergonha</div>
           <div style="color:var(--text2);font-size:13px;margin-bottom:18px">Os destaques negativos do bolão</div>`;

  const categorias = [
    { emoji: '🤡', title: 'Profeta Reverso',     key: 'profetaReverso',     desc: 'Mais palpites exatos errados' },
    { emoji: '💀', title: 'Pé Frio',            key: 'peFrio',             desc: 'Mais vezes o time que escolheu perdeu' },
    { emoji: '📉', title: 'Investidor da Oi',   key: 'investidorOi',       desc: 'Maior sequência sem pontuar' },
    { emoji: '🎰', title: 'Apostador Compulsivo', key: 'apostadorCompulsivo', desc: 'Mais palpites com 3+ gols de diferença' },
    { emoji: '🏃', title: 'Maratonista da Lanterna', key: 'maratonistaLanterna', desc: 'Mais dias em último lugar' },
  ];

  let temConteudo = false;

  categorias.forEach(cat => {
    const data = hall[cat.key];
    if (!data || data.length === 0) return;

    temConteudo = true;
    h += `
      <div class="vergonha-box">
        <div class="vergonha-title">${cat.emoji} ${cat.title}</div>
        <div class="vergonha-desc">${cat.desc}</div>
        <div class="vergonha-list">
    `;

    data.forEach((item, i) => {
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉';
      h += `
        <div class="vergonha-item">
          <span class="vergonha-pos">${medal}</span>
          <span class="vergonha-name">${emo(item.player)} ${item.player}</span>
          <span class="vergonha-count">${item.count}x</span>
        </div>
      `;
    });

    h += `</div></div>`;
  });

  if (!temConteudo) {
    h += `<div class="empty">Ainda não há dados suficientes para o Hall da Vergonha.<br>Continue palpitando! 😂</div>`;
  }

  return h;
}

window.toggleAccordion = (id) => {
  const el = document.getElementById(id);
  if (!el) return;

  el.classList.toggle('hidden');

  const icon = document.querySelector(`[data-acc="${id}"]`);
  if (icon) {
    icon.textContent = el.classList.contains('hidden') ? '▶' : '▼';
  }
};