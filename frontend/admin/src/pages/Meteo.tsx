import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm, useWatch } from 'react-hook-form';
import {
  WEATHER_CONDITION_FR, adminWeatherResponse, weatherCondition, weatherOverride, weatherOverrideInput,
  type AdminWeatherResponse, type WeatherCondition, type WeatherOverride, type WeatherOverrideInput,
} from '../../../../contrat/meteo.js';
import { api, issuesText } from '../api';

/**
 * Météo (EP009-US012) : ce que reçoivent les visiteurs, le relevé brut de la source, l'état de l'instance de l'API qui répond,
 * et le forçage pour les démos (ou la coupure), vu par tous les visiteurs pendant une durée limitée. Aucun HTML n'est
 * construit à partir de données : React échappe tout ce qu'il affiche.
 */
const METEO_KEY = ['admin', 'meteo'] as const;
/** Au-delà, un relevé est « ancien » : même seuil que la puce de la carte (OLD_AFTER_S, frontend/carte/src/weather/state.ts) */
const OLD_AFTER_MS = 3600_000;
const CONDITIONS = weatherCondition.options;
const DURATIONS: [number, string][] = [[15, '15 min'], [30, '30 min'], [60, '1 h'], [120, '2 h'], [240, '4 h'], [360, '6 h']];
/** Valeurs brutes d'Open-Meteo (`current`, pas de 15 min) : libellé et unité */
const RAW: Record<string, [string, string]> = {
  time: ['Pas du modèle', ''], interval: ['Durée du pas', 's'], temperature_2m: ['Température à 2 m', '°C'], weather_code: ['Code WMO', ''],
  cloud_cover: ['Couverture nuageuse', '%'], precipitation: ['Précipitations sur le pas', 'mm'], snowfall: ['Neige sur le pas', 'cm'],
  wind_speed_10m: ['Vent à 10 m', 'km/h'], wind_direction_10m: ['Vent venant de', '°'], wind_gusts_10m: ['Rafales', 'km/h'],
  visibility: ['Visibilité', 'm'], lightning_potential: ['Potentiel d’éclair', 'J/kg'],
};

/** Heure de Chambéry : « 10:05 » */
const hm = (ms: number) => new Date(ms).toLocaleTimeString('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit' });
const ago = (ms: number) => {
  const m = Math.round(ms / 60000);
  return m < 1 ? 'à l’instant' : m < 60 ? `il y a ${m} min` : `il y a ${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`;
};
const message = (e: unknown) => (e instanceof Error ? e.message : String(e));
/** Nombre à la française : « 0,67 », « 39 180 » ; coordonnées au dix-millième */
const n = (x: number, digits = 2) => x.toLocaleString('fr-FR', { maximumFractionDigits: digits });

type Badge = { text: string; cls: 'ok' | 'warn' | 'info' };
/** Pastille de ce que voient les visiteurs : Direct, Ancien relevé, Forcée, Coupée ou Indisponible */
export function badgeOf(d: AdminWeatherResponse, nowMs: number): Badge {
  if (d.publicCode === 'meteo-desactivee') return { text: 'Coupée', cls: 'warn' };
  const p = d.public;
  if (!p) return { text: 'Indisponible', cls: 'warn' };
  if (p.forced) return { text: 'Forcée', cls: 'info' };
  if (p.stale || nowMs - Date.parse(p.observedAt) > OLD_AFTER_MS) return { text: 'Ancien relevé', cls: 'warn' };
  return { text: 'Direct', cls: 'ok' };
}

interface ForceFields { mode: 'forcee' | 'coupee'; condition: string; intensity: string; windKmh: string; windFromDeg: string; minutes: string; note: string }
const FORCE_DEFAULTS: ForceFields = { mode: 'forcee', condition: '', intensity: '', windKmh: '', windFromDeg: '', minutes: '60', note: '' };
const num = (v: string) => (v.trim() === '' ? undefined : Number(v));

/**
 * Lien « Aperçu sur la carte » : `?weather=` utilise les mêmes valeurs types que le forçage (WEATHER_PRESETS du contrat), donc
 * le même rendu, sans réseau et pour soi seul ; null sans condition
 */
export function previewHref(f: Pick<ForceFields, 'condition' | 'intensity' | 'windKmh' | 'windFromDeg'>): string | null {
  const c = weatherCondition.safeParse(f.condition);
  if (!c.success) return null;
  const q = new URLSearchParams({ weather: c.data });
  for (const [k, v] of [['intensity', f.intensity], ['wind', f.windKmh], ['windfrom', f.windFromDeg]] as const) if (v?.trim()) q.set(k, v.trim());
  return `/?${q}`;
}

/** « Neige (intensité 0,9), jusqu’à 11:30, par admin » */
function overrideText(o: WeatherOverride): string {
  const what = o.mode === 'coupee' ? 'Météo coupée' : `Météo forcée : ${WEATHER_CONDITION_FR[o.condition as WeatherCondition]}${o.intensity !== undefined ? ` (intensité ${n(o.intensity)})` : ''}`;
  return `${what}, jusqu’à ${hm(Date.parse(o.until))}, par ${o.by}${o.note ? `. Motif : ${o.note}` : ''}.`;
}

export function Meteo() {
  // Relue toutes les 60 s tant que la page est ouverte (et seulement si l'onglet est visible)
  const state = useQuery({ queryKey: METEO_KEY, queryFn: () => api('GET', '/api/admin/weather', { schema: adminWeatherResponse }), refetchInterval: 60_000 });
  const d = state.data;
  const nowMs = Date.now();
  return (
    <section>
      <div className="bar">
        <button type="button" onClick={() => void state.refetch()} disabled={state.isFetching}>{state.isFetching ? 'Actualisation…' : 'Actualiser'}</button>
      </div>
      {state.error && <p className="msg" role="alert">{state.error.message}</p>}
      {d && (
        <>
          <Visitors d={d} nowMs={nowMs} />
          <Raw d={d} />
          <Instance d={d} />
        </>
      )}
      <Force override={d?.override ?? null} />
    </section>
  );
}

function Visitors({ d, nowMs }: { d: AdminWeatherResponse; nowMs: number }) {
  const b = badgeOf(d, nowMs);
  const p = d.public;
  return (
    <div className="card">
      <h2>Ce que voient les visiteurs <span className={`badge ${b.cls}`}>{b.text}</span></h2>
      {p ? (
        <dl>
          <dt>Météo</dt><dd>{WEATHER_CONDITION_FR[p.condition]}{p.temperatureC !== null ? `, ${Math.round(p.temperatureC)} °C` : ''}</dd>
          {p.forced
            ? <><dt>Démo</dt><dd>forcée depuis l’administration, jusqu’à {p.forcedUntil ? hm(Date.parse(p.forcedUntil)) : '?'}</dd></>
            : <><dt>Relevé</dt><dd>modèle {p.model ?? '?'}, valable pour {hm(Date.parse(p.observedAt))} ({ago(nowMs - Date.parse(p.observedAt))}){p.stale ? ' : la source ne répond plus, dernier bon relevé' : ''}</dd></>}
          <dt>Intensités</dt><dd>nuages {n(p.cloudCover)}, pluie {n(p.rainIntensity)}, neige {n(p.snowIntensity)}, brouillard {n(p.fog)}{p.thunder ? ', orage' : ''}</dd>
          <dt>Vent</dt><dd>{Math.round(p.windKmh)} km/h, venant de {Math.round(p.windFromDeg)}°</dd>
        </dl>
      ) : (
        <p className="hint">{d.publicCode === 'meteo-desactivee'
          ? 'Météo coupée depuis l’administration : la carte garde son ciel par défaut.'
          : 'Pas de relevé de moins de 3 h : la carte garde son ciel par défaut.'}</p>
      )}
    </div>
  );
}

function Raw({ d }: { d: AdminWeatherResponse }) {
  const u = d.upstream;
  return (
    <div className="card">
      <h2>Relevé brut de la source</h2>
      {u ? (
        <>
          <p className="hint">
            Open-Meteo, modèle {u.model}, point de grille {n(u.grid.lat, 4)} ; {n(u.grid.lon, 4)}{u.grid.elevationM !== null ? ` (altitude ${n(u.grid.elevationM)} m)` : ''},
            lu à {hm(Date.parse(u.fetchedAt))}. Ce relevé est montré même pendant un forçage.
          </p>
          <table>
            <tbody>
              {Object.entries(u.raw).map(([k, v]) => {
                const [label, unit] = RAW[k] ?? [k, ''];
                const value = v === null ? '—' : k === 'time' ? hm(v * 1000) : `${n(v)}${unit ? ` ${unit}` : ''}`;
                return <tr key={k}><td>{label}</td><td className="n">{value}</td></tr>;
              })}
            </tbody>
          </table>
        </>
      ) : <p className="hint">Pas encore de relevé sur cette instance (la source n’a pas répondu).</p>}
    </div>
  );
}

function Instance({ d }: { d: AdminWeatherResponse }) {
  const i = d.instance;
  return (
    <div className="card">
      <h2>Cette instance de l’API</h2>
      <p className="hint">Compteurs depuis le démarrage de cette instance, ce ne sont pas des totaux.</p>
      <dl>
        <dt>Démarrée</dt><dd>{new Date(i.startedAt).toLocaleString('fr-FR')}</dd>
        <dt>Appels à la source</dt><dd>{i.upstreamCalls}</dd>
        <dt>Échecs</dt><dd className={i.upstreamFailures ? 'warn' : undefined}>{i.upstreamFailures}</dd>
        {i.lastError && <><dt>Dernière erreur</dt><dd className="warn">{i.lastError}{i.lastErrorAt ? ` (${new Date(i.lastErrorAt).toLocaleString('fr-FR')})` : ''}</dd></>}
        <dt>Réglages</dt><dd>point {n(d.config.lat, 4)} ; {n(d.config.lon, 4)}, relevé gardé {d.config.freshS / 60} min au plus, cache du CDN {d.config.cdnMaxAgeS} s</dd>
      </dl>
    </div>
  );
}

interface Msg { text: string; ok?: boolean }

function Force({ override }: { override: WeatherOverride | null }) {
  const queryClient = useQueryClient();
  const { register, handleSubmit, control } = useForm<ForceFields>({ defaultValues: FORCE_DEFAULTS });
  const f = useWatch({ control }) as ForceFields;
  const [msg, setMsg] = useState<Msg>({ text: '' });
  const put = useMutation({ mutationFn: (body: WeatherOverrideInput) => api('PUT', '/api/admin/weather/override', { body, schema: weatherOverride }) });
  const del = useMutation({ mutationFn: () => api('DELETE', '/api/admin/weather/override', { notFound: 'Aucun forçage en cours (déjà terminé ?).' }) });
  /** Le forçage écrit devient tout de suite l'état connu, puis l'écran est relu */
  const publish = async (o: WeatherOverride | null) => {
    queryClient.setQueryData<AdminWeatherResponse>(METEO_KEY, (old) => old && { ...old, override: o });
    await queryClient.invalidateQueries({ queryKey: METEO_KEY });
  };

  const onSubmit = handleSubmit(async (v) => {
    const forcee = v.mode === 'forcee';
    // Mêmes règles que le serveur (contrat), avant l'envoi : un champ refusé est signalé tout de suite, en français
    const checked = weatherOverrideInput.safeParse(Object.fromEntries(Object.entries({
      mode: v.mode, condition: forcee && v.condition ? v.condition : undefined,
      intensity: forcee ? num(v.intensity) : undefined, windKmh: forcee ? num(v.windKmh) : undefined, windFromDeg: forcee ? num(v.windFromDeg) : undefined,
      minutes: Number(v.minutes), note: v.note.trim() || undefined,
    }).filter(([, x]) => x !== undefined)));
    if (!checked.success) return setMsg({ text: issuesText(checked.error.issues) });
    try {
      const o = await put.mutateAsync(checked.data);
      setMsg({ ok: true, text: `${o.mode === 'coupee' ? 'Météo coupée' : `Météo forcée (${WEATHER_CONDITION_FR[o.condition as WeatherCondition]})`} jusqu’à ${hm(Date.parse(o.until))}.` });
      await publish(o);
    } catch (e) {
      setMsg({ text: message(e) });
    }
  });

  async function onBackToReal() {
    try {
      await del.mutateAsync();
      setMsg({ ok: true, text: 'Retour à la météo réelle.' });
    } catch (e) {
      setMsg({ text: message(e) });
    }
    await publish(null);
  }

  const href = f.mode === 'forcee' ? previewHref(f) : null;
  return (
    <div className="card">
      <h2>Forcer la météo</h2>
      {override && (
        <div className="bar current">
          <p>{overrideText(override)}</p>
          <button type="button" className="ghost" onClick={() => void onBackToReal()} disabled={del.isPending}>Revenir à la météo réelle</button>
        </div>
      )}
      <form onSubmit={onSubmit} aria-label="Forçage de la météo">
        <div className="radios">
          <label className="check"><input type="radio" value="forcee" {...register('mode')} /> Forcer une météo</label>
          <label className="check"><input type="radio" value="coupee" {...register('mode')} /> Couper la météo</label>
        </div>
        <div className="grid">
          {/* Champs du forçage masqués quand on coupe (pas `disabled` : React Hook Form les passerait à undefined) */}
          {f.mode === 'forcee' && (
            <>
              <label>Condition<select {...register('condition')}>
                <option value="">choisir…</option>
                {CONDITIONS.map((c) => <option key={c} value={c}>{WEATHER_CONDITION_FR[c]}</option>)}
              </select></label>
              <label>Intensité (0 à 1)<input type="number" min={0} max={1} step={0.05} placeholder="valeur type" {...register('intensity')} /></label>
              <label>Vent (km/h)<input type="number" min={0} max={150} step={1} placeholder="10" {...register('windKmh')} /></label>
              <label>Vent venant de (°)<input type="number" min={0} max={360} step={1} placeholder="270 (ouest)" {...register('windFromDeg')} /></label>
            </>
          )}
          <label>Durée<select {...register('minutes')}>
            {DURATIONS.map(([m, label]) => <option key={m} value={m}>{label}</option>)}
          </select></label>
        </div>
        <label>Motif (facultatif)<input maxLength={200} placeholder="ex. démo avec les amis" {...register('note')} /></label>
        <p className="hint">
          Visible par tous les visiteurs d’ici 1 à 2 minutes (une carte déjà ouverte : à sa prochaine relecture), puis retour
          automatique à la météo réelle à la fin. Le motif est enregistré dans le journal : pas de donnée personnelle.
        </p>
        <div className="bar">
          <button type="submit" disabled={put.isPending}>{f.mode === 'coupee' ? 'Couper pour tous' : 'Forcer pour tous'}</button>
          {href && <a className="preview" href={href} target="_blank" rel="noopener noreferrer">Aperçu sur la carte</a>}
        </div>
        <p className={msg.ok ? 'msg ok' : 'msg'} role="status">{msg.text}</p>
      </form>
    </div>
  );
}
