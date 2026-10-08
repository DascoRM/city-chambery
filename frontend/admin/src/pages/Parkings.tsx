import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { api, ApiError } from '../api';
import type { AddedParking, AdminParkingEdits, CityParking, ParkingKind, ParkingOverride } from '../types';

/**
 * Retouches des parkings (EP008-US006), reprises à l'identique de l'admin d'origine (EP010-US004) : chercher un parking de la
 * carte, le retoucher (source obligatoire), ajouter un parking absent d'OpenStreetMap, retirer une retouche, lire le journal.
 * Aucun HTML n'est construit à partir de données : React échappe tout ce qu'il affiche.
 */
const EDITS_KEY = ['admin', 'parkings', 'edits'] as const;
const CITY_KEY = ['city', 'parkings'] as const;
const NOT_FOUND = 'Retouche introuvable (déjà retirée ?).';

const KIND_FR: Record<ParkingKind, string> = { surface: 'de surface', 'multi-storey': 'en silo', underground: 'souterrain', street: 'le long de la rue' };
const kindFr = (kind: string) => KIND_FR[kind as ParkingKind] ?? kind;

/** Résumé d'une retouche : « masqué, nom « … », payant, 149 places, … » */
export function summary(o: Omit<ParkingOverride, 'source'>): string {
  return [
    o.hide && 'masqué',
    o.name && `nom « ${o.name} »`,
    o.fee !== undefined && (o.fee ? 'payant' : 'gratuit'),
    o.capacity && `${o.capacity} places`,
    o.kind && kindFr(o.kind),
    o.pos && `position [${o.pos.join(', ')}]`,
    o.note && 'note',
  ].filter(Boolean).join(', ');
}

/** Parkings de la carte, lus dans le fichier statique /data/city.json (aucun appel de fonction) ; bouts de rue sans nom écartés */
async function loadCityParkings(): Promise<CityParking[]> {
  const res = await fetch('/data/city.json', { cache: 'no-store' });
  if (!res.ok) throw new Error('Impossible de lire la liste des parkings.');
  const city = (await res.json()) as { parkings?: CityParking[] };
  return (city.parkings ?? []).filter((p) => p.kind !== 'street' || p.name);
}

// Champs du formulaire (texte) → API : un champ vide n'est pas envoyé (JSON.stringify ignore undefined)
const text = (v: string) => (v.trim() === '' ? undefined : v.trim());
const num = (v: string) => (v.trim() === '' ? undefined : Number(v));
const fee = (v: string) => (v === 'paid' ? true : v === 'free' ? false : undefined);
const feeField = (f: boolean | undefined) => (f === undefined ? '' : f ? 'paid' : 'free');
const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

interface Msg { text: string; ok?: boolean }
function Message({ msg, error }: { msg: Msg; error?: string }) {
  return <p className={msg.ok && !error ? 'msg ok' : 'msg'} role="status">{error ?? msg.text}</p>;
}

export function Parkings() {
  const edits = useQuery({ queryKey: EDITS_KEY, queryFn: () => api<AdminParkingEdits>('GET', '/api/admin/parkings/edits') });
  const [selected, setSelected] = useState<CityParking | null>(null);
  // Chaque « Choisir » recrée le formulaire, même sur le parking déjà choisi : c'est la façon d'annuler une saisie
  const [pick, setPick] = useState(0);
  const choose = (p: CityParking) => { setSelected(p); setPick((n) => n + 1); };
  return (
    <section>
      <div className="card">
        <h2>Parkings : retouches</h2>
        <p className="hint">
          Les retouches sont publiées tout de suite (le site les lit au chargement, au plus 1 minute de délai) ; chacune demande
          une <b>source</b>. Pour une position, utilise sur le site <code>?debug</code> puis « 📍 Position ».
        </p>
        <Search overrides={edits.data?.overrides ?? {}} onPick={choose} />
        {selected && <OverrideForm key={`${selected.id}#${pick}`} parking={selected} current={edits.data?.overrides[selected.id]} />}
      </div>
      <AddForm />
      <EditList edits={edits.data} error={edits.error} />
    </section>
  );
}

function Search({ overrides, onPick }: { overrides: Record<string, ParkingOverride>; onPick: (p: CityParking) => void }) {
  const [q, setQ] = useState('');
  const [wanted, setWanted] = useState(false); // la liste (city.json, ≈ 1,4 Mo) n'est lue qu'au premier clic dans la recherche
  const city = useQuery({ queryKey: CITY_KEY, queryFn: loadCityParkings, enabled: wanted, staleTime: Infinity });
  const query = q.trim().toLowerCase();
  const found = useMemo(
    () => (query.length < 2 || !city.data ? [] : city.data.filter((p) => p.id.includes(query) || (p.name ?? '').toLowerCase().includes(query)).slice(0, 15)),
    [city.data, query],
  );
  return (
    <>
      <label htmlFor="pk-search">Chercher un parking (nom ou identifiant)</label>
      <input id="pk-search" type="search" autoComplete="off" placeholder="ex. Europe, way/37376434"
        value={q} onChange={(e) => setQ(e.target.value)} onFocus={() => { setWanted(true); if (city.isError) void city.refetch(); }} />
      {city.error && <p className="msg">{city.error.message}</p>}
      <ul className="results">
        {found.map((p) => (
          <li key={p.id}>
            <span><span>{p.name ?? 'Parking sans nom'}</span> <small>{kindFr(p.kind)} · {p.id}{overrides[p.id] ? ' · retouché' : ''}</small></span>
            <button type="button" onClick={() => onPick(p)}>Choisir</button>
          </li>
        ))}
        {query.length >= 2 && city.isLoading && <li>Chargement de la liste…</li>}
        {query.length >= 2 && city.data && !found.length && <li>Aucun parking trouvé.</li>}
      </ul>
    </>
  );
}

interface OverrideFields { hide: boolean; name: string; fee: string; capacity: string; kind: string; x: string; y: string; note: string; source: string }
const overrideFields = (o?: ParkingOverride): OverrideFields => ({
  hide: !!o?.hide, name: o?.name ?? '', fee: feeField(o?.fee), capacity: o?.capacity?.toString() ?? '', kind: o?.kind ?? '',
  x: o?.pos?.[0]?.toString() ?? '', y: o?.pos?.[1]?.toString() ?? '', note: o?.note ?? '', source: o?.source ?? '',
});

function OverrideForm({ parking, current }: { parking: CityParking; current?: ParkingOverride }) {
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset, formState } = useForm<OverrideFields>({ defaultValues: overrideFields(current) });
  const [msg, setMsg] = useState<Msg>({ text: '' });
  const ref = useRef<HTMLFormElement>(null);
  const save = useMutation({ mutationFn: (body: ParkingOverride) => api('PUT', `/api/admin/parkings/overrides/${parking.id}`, { body }) });
  const remove = useMutation({ mutationFn: () => api('DELETE', `/api/admin/parkings/edits/${parking.id}`, { notFound: NOT_FOUND }) });
  const refresh = () => queryClient.invalidateQueries({ queryKey: EDITS_KEY });
  /** La retouche de ce parking devient tout de suite l'état connu : pendant la relecture (ou si elle échoue), le formulaire
   *  ne revient pas à l'ancienne valeur, qu'un nouvel enregistrement republierait sans le dire */
  const publish = (override: ParkingOverride | undefined) =>
    queryClient.setQueryData<AdminParkingEdits>(EDITS_KEY, (old) => {
      if (!old) return old;
      const overrides = { ...old.overrides };
      if (override) overrides[parking.id] = override;
      else delete overrides[parking.id];
      return { ...old, overrides };
    });

  useEffect(() => { ref.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }); }, []);
  // Retouches relues (après un enregistrement, ou arrivées après le choix du parking) : le formulaire les reprend s'il n'est pas en cours de saisie
  const { isDirty } = formState;
  useEffect(() => { if (!isDirty) reset(overrideFields(current)); }, [current, isDirty, reset]);

  const onSubmit = handleSubmit(async (f) => {
    const x = num(f.x), y = num(f.y);
    if ((x === undefined) !== (y === undefined)) return setMsg({ text: 'Position : il faut x et y.' });
    const body: ParkingOverride = {
      hide: f.hide || undefined, name: text(f.name), fee: fee(f.fee), capacity: num(f.capacity), kind: text(f.kind) as ParkingKind | undefined,
      pos: x === undefined || y === undefined ? undefined : [x, y], note: text(f.note), source: f.source.trim(),
    };
    try {
      await save.mutateAsync(body);
      publish(body);
      reset(overrideFields(body));
      setMsg({ text: 'Retouche enregistrée et publiée.', ok: true });
      await refresh();
    } catch (e) {
      setMsg({ text: message(e) });
    }
  });

  async function onRemove() {
    if (!confirm('Retirer cette retouche ?')) return;
    try {
      await remove.mutateAsync();
      publish(undefined);
      reset(overrideFields(undefined));
      setMsg({ text: 'Retouche retirée.', ok: true });
      await refresh();
    } catch (e) {
      setMsg({ text: message(e) });
    }
  }

  const feeText = parking.fee === true ? 'payant' : parking.fee === false ? 'gratuit' : 'tarif inconnu';
  const places = parking.capacity ? `${parking.capacity} places` : parking.est ? `≈ ${parking.est} places (estimé)` : 'places inconnues';
  return (
    <form ref={ref} onSubmit={onSubmit} aria-label="Retouche du parking">
      <h3>{parking.name ?? 'Parking sans nom'} · {parking.id}</h3>
      <p className="hint">
        Données OpenStreetMap : {kindFr(parking.kind)}, {feeText}, {places}, position [{parking.pos.join(', ')}].
        {current?.source ? ` Retouche actuelle : ${summary(current)} (source : ${current.source}).` : ''}
      </p>
      <label className="check"><input type="checkbox" {...register('hide')} /> Masquer ce parking (il n'existe pas, doublon…)</label>
      <div className="grid">
        <label>Nom<input maxLength={80} {...register('name')} /></label>
        <label>Tarif<select {...register('fee')}><option value="">inchangé</option><option value="paid">payant</option><option value="free">gratuit</option></select></label>
        <label>Places<input type="number" min={1} max={10000} step={1} {...register('capacity')} /></label>
        <label>Type<select {...register('kind')}>
          <option value="">inchangé</option>
          {(['surface', 'multi-storey', 'underground', 'street'] as const).map((k) => <option key={k} value={k}>{KIND_FR[k]}</option>)}
        </select></label>
        <label>Position x (m)<input type="number" step={0.1} {...register('x')} /></label>
        <label>Position y (m)<input type="number" step={0.1} {...register('y')} /></label>
      </div>
      <label>Note affichée dans la fiche<input maxLength={300} {...register('note')} /></label>
      <label>Source (obligatoire)<input maxLength={300} required placeholder="lien, document, « vu sur place le … »"
        {...register('source', { validate: (v) => v.trim() !== '' || 'La source est obligatoire.' })} /></label>
      <div className="bar">
        <button type="submit" disabled={save.isPending}>Enregistrer la retouche</button>
        {current && <button type="button" className="ghost" onClick={() => void onRemove()} disabled={remove.isPending}>Retirer la retouche</button>}
      </div>
      <Message msg={msg} error={formState.errors.source?.message} />
    </form>
  );
}

interface AddFields { id: string; kind: ParkingKind; x: string; y: string; name: string; fee: string; capacity: string; note: string; source: string }
const ADD_DEFAULTS: AddFields = { id: '', kind: 'surface', x: '', y: '', name: '', fee: '', capacity: '', note: '', source: '' };
const coordinate = (v: string) => (v.trim() !== '' && Number.isFinite(Number(v))) || 'Position : il faut x et y (mètres).';

function AddForm() {
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset, formState } = useForm<AddFields>({ defaultValues: ADD_DEFAULTS });
  const [msg, setMsg] = useState<Msg>({ text: '' });
  const add = useMutation({ mutationFn: (body: AddedParking) => api('POST', '/api/admin/parkings/added', { body }) });

  const onSubmit = handleSubmit(async (f) => {
    const body: AddedParking = {
      id: `custom/${f.id.trim()}`, kind: f.kind, pos: [Number(f.x), Number(f.y)], name: text(f.name), fee: fee(f.fee),
      capacity: num(f.capacity), note: text(f.note), source: f.source.trim(),
    };
    try {
      await add.mutateAsync(body);
      setMsg({ text: 'Parking ajouté et publié.', ok: true });
      reset(ADD_DEFAULTS);
      await queryClient.invalidateQueries({ queryKey: EDITS_KEY });
    } catch (e) {
      setMsg({ text: message(e) });
    }
  });

  const { errors } = formState;
  const error = errors.id?.message ?? errors.x?.message ?? errors.y?.message ?? errors.source?.message;
  return (
    <div className="card">
      <h2>Ajouter un parking absent d'OpenStreetMap</h2>
      <form onSubmit={onSubmit} aria-label="Ajout d'un parking">
        <div className="grid">
          <label>Identifiant<input required placeholder="ex. parking-du-rosaire"
            {...register('id', { pattern: { value: /^[a-z0-9-]{2,60}$/, message: 'Identifiant : 2 à 60 caractères (minuscules, chiffres, tirets).' } })} /></label>
          <label>Type<select {...register('kind')}>
            {(['surface', 'multi-storey', 'underground'] as const).map((k) => <option key={k} value={k}>{KIND_FR[k]}</option>)}
          </select></label>
          <label>Position x (m)<input type="number" step={0.1} required {...register('x', { validate: coordinate })} /></label>
          <label>Position y (m)<input type="number" step={0.1} required {...register('y', { validate: coordinate })} /></label>
          <label>Nom<input maxLength={80} {...register('name')} /></label>
          <label>Tarif<select {...register('fee')}><option value="">inconnu</option><option value="paid">payant</option><option value="free">gratuit</option></select></label>
          <label>Places<input type="number" min={1} max={10000} step={1} {...register('capacity')} /></label>
        </div>
        <label>Note<input maxLength={300} {...register('note')} /></label>
        <label>Source (obligatoire)<input maxLength={300} required {...register('source', { validate: (v) => v.trim() !== '' || 'La source est obligatoire.' })} /></label>
        <button type="submit" disabled={add.isPending}>Ajouter</button>
        <Message msg={msg} error={error} />
      </form>
    </div>
  );
}

function EditList({ edits, error }: { edits?: AdminParkingEdits; error: Error | null }) {
  const queryClient = useQueryClient();
  const remove = useMutation({ mutationFn: (id: string) => api('DELETE', `/api/admin/parkings/edits/${id}`, { notFound: NOT_FOUND }) });

  async function onRemove(id: string) {
    if (!confirm(`Retirer la retouche de ${id} ?`)) return;
    try {
      await remove.mutateAsync(id);
      queryClient.setQueryData<AdminParkingEdits>(EDITS_KEY, (old) => {
        if (!old) return old;
        const overrides = { ...old.overrides };
        delete overrides[id];
        return { ...old, overrides, added: old.added.filter((a) => a.id !== id) };
      });
      await queryClient.invalidateQueries({ queryKey: EDITS_KEY });
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 401)) alert(message(e));
    }
  }

  const rows = edits
    ? [
        ...Object.entries(edits.overrides).map(([id, o]) => ({ id, what: summary(o), source: o.source })),
        ...edits.added.map((a) => ({ id: a.id, what: `ajout : ${a.name ?? 'sans nom'}, ${kindFr(a.kind)}, [${a.pos.join(', ')}]`, source: a.source })),
      ]
    : [];
  return (
    <div className="card">
      <h2>Retouches publiées</h2>
      <ul className="results">
        {error && <li>{error.message}</li>}
        {rows.map((r) => (
          <li key={r.id}>
            <span><span>{r.id} : {r.what}</span> <small>source : {r.source}</small></span>
            <button type="button" className="ghost" onClick={() => void onRemove(r.id)}>Retirer</button>
          </li>
        ))}
        {edits && !rows.length && <li>Aucune retouche pour l’instant.</li>}
      </ul>
      <h2 className="later">Journal</h2>
      <ul className="log">
        {edits?.log.map((l) => (
          <li key={l.id}>
            <span>{new Date(l.at).toLocaleString('fr-FR')} · {l.action} · {l.target}</span> <small>{l.source ? `source : ${l.source}` : ''}</small>
          </li>
        ))}
      </ul>
    </div>
  );
}
