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
  if (res.ok) return res.json();
  let body = null;
  try { body = await res.json(); } catch { /* réponse qui n'est pas du JSON : page de la plateforme, pas de l'API */ }
  if (res.status === 401) throw new Error('Jeton refusé.');
  if (res.status === 429) throw new Error('Trop de tentatives : réessaie dans une minute.');
  if (body?.code === 'admin-non-configuree') throw new Error("L'administration n'est pas configurée : ADMIN_TOKEN n'est pas vu par ce déploiement (variable absente pour cet environnement, ou ajoutée après le déploiement : redéployer).");
  if (res.status === 404) throw new Error(body ? "Route de l'API introuvable (404)." : "L'API ne répond pas à cette adresse (404 de la plateforme, pas de l'API).");
  throw new Error(`Erreur ${res.status}${body?.error ? ` : ${body.error}` : ''}.`);
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
    if (data.db.missing?.length) row(db, 'Migrations', `à appliquer : tables absentes ${data.db.missing.join(', ')} (npm run db:migrate)`, 'warn');
    else row(db, 'Migrations', 'à jour', 'ok');
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

// --- Parkings : retouches (EP008-US006) ------------------------------------------------------------
const KIND_FR = { surface: 'de surface', 'multi-storey': 'en silo', underground: 'souterrain', street: 'le long de la rue' };
let parkings = [];
let edits = { overrides: {}, added: [] };
let selected = null;

const el = (tag, text, cls) => { const e = document.createElement(tag); if (text !== undefined) e.textContent = text; if (cls) e.className = cls; return e; };
const token = () => store.get();
async function api(method, path, body) {
  const res = await fetch(path, { method, cache: 'no-store', headers: { Authorization: `Bearer ${token()}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  let data = null;
  try { data = await res.json(); } catch { /* pas de JSON */ }
  if (!res.ok) {
    const detail = Array.isArray(data?.issues) ? data.issues.map((i) => `${(i.path ?? []).join('.') || 'formulaire'} : ${i.message}`).join(' ; ') : '';
    if (data?.code === 'migrations-manquantes') throw new Error('La base n’a pas reçu les dernières migrations : lancer « npm run db:migrate » sur cette base.');
    throw new Error(data?.code === 'base-indisponible' ? 'Base indisponible.' : `${data?.error ?? `Erreur ${res.status}`}${detail ? ` (${detail})` : ''}`);
  }
  return data;
}
const say = (id, text, ok) => { const m = $(id); m.textContent = text; m.className = ok ? 'msg ok' : 'msg'; };
const num = (id) => { const v = $(id).value.trim(); return v === '' ? undefined : Number(v); };
const txt = (id) => { const v = $(id).value.trim(); return v === '' ? undefined : v; };
const fee = (id) => ({ paid: true, free: false })[$(id).value];
const summary = (o) => [o.hide && 'masqué', o.name && `nom « ${o.name} »`, o.fee !== undefined && (o.fee ? 'payant' : 'gratuit'), o.capacity && `${o.capacity} places`, o.kind && KIND_FR[o.kind], o.pos && `position [${o.pos.join(', ')}]`, o.note && 'note'].filter(Boolean).join(', ');

async function loadParkings() {
  if (parkings.length) return;
  const city = await (await fetch('/data/city.json', { cache: 'no-store' })).json();
  parkings = (city.parkings ?? []).filter((p) => p.kind !== 'street' || p.name);
}

function renderResults() {
  const q = $('pk-search').value.trim().toLowerCase();
  const list = $('pk-results'); list.replaceChildren();
  if (q.length < 2) return;
  const found = parkings.filter((p) => p.id.includes(q) || (p.name ?? '').toLowerCase().includes(q)).slice(0, 15);
  for (const p of found) {
    const li = el('li');
    const left = el('span'); left.append(el('span', p.name ?? 'Parking sans nom'), document.createTextNode(' '), el('small', `${KIND_FR[p.kind] ?? p.kind} · ${p.id}${edits.overrides[p.id] ? ' · retouché' : ''}`));
    const b = el('button', 'Choisir'); b.type = 'button'; b.addEventListener('click', () => select(p));
    li.append(left, b); list.append(li);
  }
  if (!found.length) list.append(el('li', 'Aucun parking trouvé.'));
}

function select(p) {
  selected = p;
  const o = edits.overrides[p.id] ?? {};
  $('pk-title').textContent = `${p.name ?? 'Parking sans nom'} · ${p.id}`;
  $('pk-current').textContent = `Données OpenStreetMap : ${KIND_FR[p.kind] ?? p.kind}, ${p.fee === true ? 'payant' : p.fee === false ? 'gratuit' : 'tarif inconnu'}, ${p.capacity ? `${p.capacity} places` : p.est ? `≈ ${p.est} places (estimé)` : 'places inconnues'}, position [${p.pos.join(', ')}].${o.source ? ` Retouche actuelle : ${summary(o)} (source : ${o.source}).` : ''}`;
  $('f-hide').checked = !!o.hide; $('f-name').value = o.name ?? ''; $('f-fee').value = o.fee === undefined ? '' : o.fee ? 'paid' : 'free';
  $('f-capacity').value = o.capacity ?? ''; $('f-kind').value = o.kind ?? ''; $('f-x').value = o.pos?.[0] ?? ''; $('f-y').value = o.pos?.[1] ?? '';
  $('f-note').value = o.note ?? ''; $('f-source').value = o.source ?? '';
  $('pk-remove').hidden = !edits.overrides[p.id];
  say('pk-msg', '');
  $('pk-form').hidden = false;
  $('pk-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderEdits(data) {
  edits = { overrides: data.overrides ?? {}, added: data.added ?? [] };
  const list = $('edits'); list.replaceChildren();
  const rows = [...Object.entries(edits.overrides).map(([id, o]) => [id, summary(o), o.source]), ...edits.added.map((a) => [a.id, `ajout : ${a.name ?? 'sans nom'}, ${KIND_FR[a.kind]}, [${a.pos.join(', ')}]`, a.source])];
  for (const [id, what, source] of rows) {
    const li = el('li');
    const left = el('span'); left.append(el('span', `${id} : ${what}`), document.createTextNode(' '), el('small', `source : ${source}`));
    const b = el('button', 'Retirer', 'ghost'); b.type = 'button';
    b.addEventListener('click', async () => { if (!confirm(`Retirer la retouche de ${id} ?`)) return; try { await api('DELETE', `/api/admin/parkings/edits/${id}`); await refreshEdits(); } catch (e) { alert(e.message); } });
    li.append(left, b); list.append(li);
  }
  if (!rows.length) list.append(el('li', 'Aucune retouche pour l’instant.'));
  const log = $('log'); log.replaceChildren();
  for (const l of data.log ?? []) {
    const li = el('li');
    li.append(el('span', `${new Date(l.at).toLocaleString('fr-FR')} · ${l.action} · ${l.target}`), document.createTextNode(' '), el('small', l.source ? `source : ${l.source}` : ''));
    log.append(li);
  }
}

async function refreshEdits() {
  try { renderEdits(await api('GET', '/api/admin/parkings/edits')); }
  catch (e) { $('edits').replaceChildren(el('li', e.message)); }
}

$('pk-search').addEventListener('input', renderResults);
$('pk-search').addEventListener('focus', () => { loadParkings().then(renderResults).catch(() => say('pk-msg', 'Impossible de lire la liste des parkings.')); });

$('pk-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!selected) return;
  const x = num('f-x'), y = num('f-y');
  if ((x === undefined) !== (y === undefined)) return say('pk-msg', 'Position : il faut x et y.');
  const body = { hide: $('f-hide').checked || undefined, name: txt('f-name'), fee: fee('f-fee'), capacity: num('f-capacity'), kind: txt('f-kind'), pos: x === undefined ? undefined : [x, y], note: txt('f-note'), source: txt('f-source') };
  try { await api('PUT', `/api/admin/parkings/overrides/${selected.id}`, body); say('pk-msg', 'Retouche enregistrée et publiée.', true); await refreshEdits(); $('pk-remove').hidden = false; }
  catch (err) { say('pk-msg', err.message); }
});
$('pk-remove').addEventListener('click', async () => {
  if (!selected || !confirm('Retirer cette retouche ?')) return;
  try { await api('DELETE', `/api/admin/parkings/edits/${selected.id}`); say('pk-msg', 'Retouche retirée.', true); await refreshEdits(); $('pk-remove').hidden = true; }
  catch (err) { say('pk-msg', err.message); }
});
$('add-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const body = { id: `custom/${txt('a-id') ?? ''}`, kind: $('a-kind').value, pos: [num('a-x'), num('a-y')], name: txt('a-name'), fee: fee('a-fee'), capacity: num('a-capacity'), note: txt('a-note'), source: txt('a-source') };
  try { await api('POST', '/api/admin/parkings/added', body); say('add-msg', 'Parking ajouté et publié.', true); e.target.reset(); await refreshEdits(); }
  catch (err) { say('add-msg', err.message); }
});

// Le tableau de bord s'affiche après la connexion : on charge alors les retouches
new MutationObserver(() => { if (!$('board').hidden) void refreshEdits(); }).observe($('board'), { attributes: true, attributeFilter: ['hidden'] });
