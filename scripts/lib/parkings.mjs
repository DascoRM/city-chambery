/**
 * Parkings d'OpenStreetMap (EP006-US001) : extraction, classement, fusion des doublons, estimation de capacité.
 * Rien d'inventé : géométrie et tags viennent d'OSM ; une capacité n'est estimée (d'après la surface) que pour les
 * parkings de surface sans capacité, et l'estimation est marquée `est` (jamais mêlée à `capacity`).
 */
const SQM_PER_SPACE = 28; // mesuré sur Roissard : 138 places estimées pour 149 réelles (±30 %)
const MIN_ESTIMATE_AREA = 300; // m² : en dessous, ce sont des poches anonymes
const MERGE_DISTANCE = 40; // m : un nœud nommé comme un polygone voisin est le même parking

const STREET = new Set(['lane', 'street_side', 'on_kerb', 'half_on_kerb', 'shoulder']);

function kindOf(t) {
  const level = parseFloat(t.level ?? t.layer ?? '0');
  if (t.parking === 'underground' || t.location === 'underground' || level < 0 || parseFloat(t.layer ?? '0') < 0) return 'underground';
  if (t.parking === 'multi-storey' || t.parking === 'rooftop') return 'multi-storey';
  if (STREET.has(t.parking)) return 'street';
  return 'surface';
}

function accessOf(t) {
  const a = t.access;
  if (!a) return 'unknown';
  if (['yes', 'public', 'permissive'].includes(a)) return 'public';
  if (['private', 'no'].includes(a)) return 'private';
  if (['customers', 'destination', 'delivery'].includes(a)) return 'customers';
  if (['permit', 'residents'].includes(a)) return 'subscribers';
  return 'unknown';
}

const int = (v) => { const n = parseInt(String(v ?? ''), 10); return Number.isFinite(n) && n > 0 ? n : undefined; };

/**
 * @param elements éléments Overpass
 * @param h { polygonsOf, clipPoly, area, project, rp, centroid, norm, inside(p) }
 */
export function buildParkings(elements, h) {
  const stats = { osm: 0, kept: 0, street: 0, merged: 0, privateDropped: 0, tinyDropped: 0, overlapDropped: 0 };
  const polys = []; // { el, t, kind, access, rings, areaM2 }
  const nodes = []; // nœuds amenity=parking
  const entrances = [];

  for (const el of elements) {
    const t = el.tags ?? {};
    if (t.amenity === 'parking_entrance' && el.type === 'node') { entrances.push(h.project(el.lat, el.lon)); continue; }
    if (t.amenity !== 'parking') continue;
    stats.osm++;
    if (el.type === 'node') { nodes.push({ el, t, pos: h.project(el.lat, el.lon) }); continue; }
    for (const poly of h.polygonsOf(el)) {
      const raw = Math.abs(h.area(poly.outer)); // mesurée avant rognage au socle
      const c = h.clipPoly(poly);
      if (!c) continue;
      polys.push({ el, t, kind: kindOf(t), access: accessOf(t), c, areaM2: raw });
    }
  }

  // Rapprochement : un nœud du même parking qu'un polygone voisin (même nom, ou même capacité) est absorbé,
  // et lui prête les tags qui lui manquent (le polygone du Château n'a pas de type ; son nœud dit « souterrain »)
  const near = (p, ring) => {
    let best = Infinity;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [ax, ay] = ring[j], [bx, by] = ring[i];
      const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
      const t = l2 ? Math.max(0, Math.min(1, ((p[0] - ax) * dx + (p[1] - ay) * dy) / l2)) : 0;
      best = Math.min(best, Math.hypot(p[0] - ax - dx * t, p[1] - ay - dy * t));
    }
    return best;
  };
  const absorbed = new Map(); // polygone → nœuds
  const lonely = [];
  for (const n of nodes) {
    let host = null;
    for (const p of polys) {
      if (p.kind === 'street') continue;
      const sameName = n.t.name && p.t.name && h.norm(n.t.name) === h.norm(p.t.name);
      const sameCap = n.t.capacity && p.t.capacity && n.t.capacity === p.t.capacity;
      if (!(sameName || sameCap)) continue;
      if (near(n.pos, p.c.outer) <= MERGE_DISTANCE) { host = p; break; }
    }
    if (host) {
      (absorbed.get(host) ?? absorbed.set(host, []).get(host)).push(n);
      stats.merged++;
    } else if (h.inside(n.pos)) lonely.push(n);
  }

  // Polygone nu (aucun nom, capacité ni type) posé sur un parking renseigné : c'est le même parking, dessiné deux fois
  // (La Falaise : un polygone du silo et un polygone nu de 2 241 m² juste dessus)
  const inRing = (pt, ring) => {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i], [xj, yj] = ring[j];
      if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  };
  const bare = (p) => !p.t.name && !p.t.capacity && !p.t.parking && p.kind !== 'street';
  const informed = (p) => p.kind !== 'street' && (p.t.name || p.t.capacity || p.t.parking);
  const dropped = new Set();
  for (const p of polys) {
    if (!bare(p)) continue;
    const c = h.centroid(p.c.outer);
    const host = polys.find((q) => q !== p && informed(q) && (inRing(c, q.c.outer) || inRing(h.centroid(q.c.outer), p.c.outer)));
    if (host) { dropped.add(p); stats.overlapDropped++; }
  }
  const out = [];
  for (const p of polys) {
    if (dropped.has(p)) continue;
    const nodesOf = absorbed.get(p) ?? [];
    const tags = { ...Object.assign({}, ...nodesOf.map((n) => n.t)), ...p.t }; // le polygone prime, le nœud complète
    // Les tags du nœud complètent seulement ce qui manque, y compris le type (« souterrain »)
    let kind = p.kind;
    if (p.kind === 'surface' && !p.t.parking && nodesOf.length) kind = nodesOf.map((n) => kindOf(n.t)).find((k) => k !== 'surface') ?? kind;
    if (kind === 'underground' && p.kind !== 'underground' && !p.t.parking) kind = 'underground';
    const access = p.t.access ? p.access : nodesOf.length ? accessOf(tags) : p.access;
    const capacity = int(tags.capacity);
    const named = !!tags.name;
    const isStreet = kind === 'street';
    // Filtre : la voirie est un décor ; hors voirie, on garde les nommés, ceux à capacité et les polygones > 300 m²
    if (!isStreet && !named && !capacity && p.areaM2 <= MIN_ESTIMATE_AREA) { stats.tinyDropped++; continue; }
    // Les parkings privés n'intéressent personne (décision de Dasco, 06/10) : hors export
    if (access === 'private') { stats.privateDropped++; continue; }
    const item = {
      id: `${p.el.type}/${p.el.id}`,
      kind,
      access,
      ...(tags.fee ? { fee: tags.fee === 'yes' } : {}),
      ...(named && !isStreet ? { name: tags.name } : {}),
      ...(capacity && !isStreet ? { capacity } : {}),
      ...(int(tags['building:levels']) && kind === 'multi-storey' ? { levels: int(tags['building:levels']) } : {}),
      ...(int(tags['capacity:disabled']) ? { disabled: int(tags['capacity:disabled']) } : {}),
      ...(tags.maxheight ? { maxHeight: tags.maxheight } : {}),
      outer: p.c.outer,
      ...(p.c.holes.length ? { holes: p.c.holes } : {}),
      pos: h.rp(h.centroid(p.c.outer)),
      areaM2: Math.round(p.areaM2),
    };
    if (!capacity && kind === 'surface' && p.areaM2 > MIN_ESTIMATE_AREA) item.est = Math.round(p.areaM2 / SQM_PER_SPACE);
    if (nodesOf.length) item.dupOf = nodesOf.map((n) => `node/${n.el.id}`);
    if (isStreet) stats.street++;
    out.push(item);
  }
  // Nœuds seuls (Halles, Ducs…) : un point, que le rendu posera
  for (const n of lonely) {
    const capacity = int(n.t.capacity);
    if (!n.t.name && !capacity) continue;
    const kind = kindOf(n.t);
    const access = accessOf(n.t);
    if (access === 'private') { stats.privateDropped++; continue; }
    out.push({
      id: `node/${n.el.id}`, kind, access,
      ...(n.t.fee ? { fee: n.t.fee === 'yes' } : {}),
      ...(n.t.name ? { name: n.t.name } : {}),
      ...(capacity ? { capacity } : {}),
      pos: h.rp(n.pos),
    });
  }
  // Entrées : rattachées au parking le plus proche à moins de 30 m
  for (const e of entrances) {
    if (!h.inside(e)) continue;
    let best = null, bd = 30;
    for (const it of out) {
      if (it.kind === 'street') continue;
      const d = it.outer ? near(e, it.outer) : Math.hypot(e[0] - it.pos[0], e[1] - it.pos[1]);
      if (d < bd) { bd = d; best = it; }
    }
    if (best) (best.entrances ??= []).push(h.rp(e));
  }
  stats.kept = out.length;
  return { parkings: out, stats };
}
