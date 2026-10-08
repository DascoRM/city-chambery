// Page d'administration (EP008-US005). Aucun HTML n'est construit à partir de données : tout passe par textContent.
const KEY = 'diorama-admin-token';
const $ = (id) => document.getElementById(id);
const store = { get: () => { try { return sessionStorage.getItem(KEY); } catch { return null; } }, set: (v) => { try { v ? sessionStorage.setItem(KEY, v) : sessionStorage.removeItem(KEY); } catch { /* stockage indisponible : la session ne survit pas au rechargement */ } } };

const DB_LABEL = {
  ok: ['Connectée', 'ok'],
  'non-configuree': ['Non configurée (DATABASE_URL absente)', 'warn'],
  'desactivee-en-previsualisation': ['Désactivée en prévisualisation (DATABASE_URL_PREVIEW absente)', 'warn'],
  erreur: ['Erreur de connexion', 'warn'],
};
const size = (b) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} Mo` : `${Math.max(1, Math.round(b / 1024))} Ko`);

function row(dl, label, value, cls) {
  const dt = document.createElement('dt'); dt.textContent = label;
  const dd = document.createElement('dd'); dd.textContent = value; if (cls) dd.className = cls;
  dl.append(dt, dd);
}

async function load(token) {
  const res = await fetch('/api/admin/status', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
  if (res.status === 401) throw new Error('Jeton refusé.');
  if (res.status === 429) throw new Error('Trop de tentatives : réessaie dans une minute.');
  if (res.status === 404) throw new Error("L'administration n'est pas configurée (ADMIN_TOKEN absent côté serveur).");
  if (!res.ok) throw new Error(`Erreur ${res.status}.`);
  return res.json();
}

function show(data) {
  const app = $('app'); app.replaceChildren();
  row(app, 'Version', data.version); row(app, 'Environnement', data.env); row(app, 'Node.js', data.node); row(app, 'Région', data.region ?? 'locale');
  const db = $('db'); db.replaceChildren();
  const [label, cls] = DB_LABEL[data.db.status] ?? [data.db.status, 'warn'];
  row(db, 'État', label, cls);
  const table = $('tables'); const body = table.querySelector('tbody'); body.replaceChildren();
  if (data.db.status === 'ok') {
    row(db, 'Taille', size(data.db.sizeBytes));
    for (const t of data.db.tables) {
      const tr = document.createElement('tr');
      const a = document.createElement('td'); a.textContent = t.name;
      const b = document.createElement('td'); b.className = 'n'; b.textContent = String(t.rows);
      tr.append(a, b); body.append(tr);
    }
  }
  table.hidden = data.db.status !== 'ok';
  $('login').hidden = true; $('board').hidden = false;
}

async function enter(token, quiet) {
  try { show(await load(token)); store.set(token); $('login-msg').textContent = ''; }
  catch (e) { store.set(null); $('board').hidden = true; $('login').hidden = false; if (!quiet) $('login-msg').textContent = e.message; }
}

$('login').addEventListener('submit', (e) => { e.preventDefault(); const t = $('token').value.trim(); $('token').value = ''; if (t) void enter(t, false); });
$('refresh').addEventListener('click', () => { const t = store.get(); if (t) void enter(t, false); });
$('logout').addEventListener('click', () => { store.set(null); $('board').hidden = true; $('login').hidden = false; });
const saved = store.get(); if (saved) void enter(saved, true);
