import * as THREE from 'three';
import './style.css';
import poisContent from '../content/pois.json';
import modelsContent from '../content/models.json';
import natureContent from '../content/nature.json';
import mascotContent from '../content/mascot.json';
import placeHours from '../content/place-hours.json';
import buildingsContent from '../content/buildings.json';
import type { CityData, Poi, PlacedPoi, Ticker } from './types';
import { createStage } from './scene/stage';
import { buildCity } from './scene/city';
import { createTerrain } from './scene/terrain';
import { buildPlaceMarkers, buildPoiMarkers } from './scene/markers';
import { buildLabels } from './scene/labels';
import { createLoading } from './ui/loading';
import { createLobby, type LobbyContent } from './ui/lobby';
import { loadLobbySkip } from './state/lobby';
import { buildStreetNames, type StreetNamesConfig } from './scene/street-names';
import { buildAwnings, type AwningConfig } from './scene/facades';
import { createTiltShift } from './scene/tiltshift';
import { createDayNight } from './scene/daynight';
import { buildModels, hiddenBuildings, type ModelEntry } from './scene/models';
import { buildPeople, type PeopleConfig } from './scene/people';
import { buildWalkways } from './scene/walkways';
import { buildPathfinder, type PathConfig, type Pathfinder } from './scene/avatar-path';
import { createBalade, type Balade, type BaladeConfig } from './game/balade';
import { createCutaway, type Cutaway, type CutawayConfig } from './scene/cutaway';
import { buildParkingSigns, type ParkingSigns, type ParkingSignsConfig } from './scene/parkings';
import { parkingCard } from './ui/parking-card';
import { applyParkingEdits, fetchPublishedEdits, mergeParkingEdits, type ParkingEdits } from './scene/parking-edits';
import parkingsContent from '../content/parkings.json';
import { buildAvatar, type Avatar, type AvatarConfig } from './scene/avatar';
import avatarContent from '../content/avatar.json';
import { buildBirds, type BirdsConfig } from './scene/birds';
import { buildChimneys, type SmokeConfig } from './scene/chimneys';
import { buildFlags, type FlagSpec } from './scene/flags';
import lifeContent from '../content/life.json';
import streetsContent from '../content/streets.json';
import lobbyContent from '../content/lobby.json';
import { buildNature, type NatureConfig } from './scene/nature';
import { buildHerd, type Herd, type MascotConfig } from './scene/mascot';
import { createClock } from './time/clock';
import { createOpenStates, type OpenState } from './time/openinghours';
import { placeCategory } from './scene/palette';
import { createAdaptiveResolution, qualityLevel } from './scene/quality';
import { dataUrl } from './dataurl';
import { setupPwa } from './pwa';
import { createUi, showFatal } from './ui/ui';
import { loadDiscovered, resetDiscovered, saveDiscovered } from './state/progress';
import { setupGame } from './game/setup';
import { installInteraction, type PlacementTool } from './interaction';
import type { RainProto } from './dev/rain-proto';

const app = document.getElementById('app')!;
/** Mode debug : ajouter ?debug à l'adresse (compteur de perf, debug des éléphants, window.diorama) */
const DEBUG = new URLSearchParams(location.search).has('debug');

async function loadCity(): Promise<CityData | null> {
  try {
    const res = await fetch(dataUrl('data/city.json'));
    if (!res.ok) return null;
    return (await res.json()) as CityData;
  } catch {
    return null;
  }
}

async function main() {
  // Écran initial (index.html) → lobby (EP004) : le lobby apparaît tout de suite et la ville charge derrière.
  // ?lobby=0 : pas de lobby ; ?lobby=1 : toujours ; en mode ?debug : pas de lobby, sauf ?lobby=1
  const loading = createLoading();
  const lobbyParam = new URLSearchParams(location.search).get('lobby');
  const lobbyAtStart = lobbyParam === '1' || (lobbyParam !== '0' && !DEBUG && !loadLobbySkip());
  const lobby = createLobby(
    app,
    lobbyContent as unknown as LobbyContent,
    { places: (poisContent as Poi[]).filter((p) => !p.draft || import.meta.env.DEV).length, elephants: (mascotContent as unknown as MascotConfig).game.count },
    loadLobbySkip(),
    lobbyAtStart,
  );
  if (lobbyAtStart) {
    loading.onChange(lobby.setProgress);
    loading.hideBoot();
  }
  await loading.set(3, 'données');
  // Retouches publiées par l'administration (EP008) : demandées en même temps que la ville, jamais bloquantes (1,5 s au plus)
  const published = fetchPublishedEdits();
  const data = await loadCity();
  if (data) {
    const pub = await published;
    applyParkingEdits(data, mergeParkingEdits(parkingsContent as unknown as ParkingEdits, pub.edits));
    if (DEBUG) {
      if (pub.edits) console.info(`[parkings] retouches publiées : ${Object.keys(pub.edits.overrides ?? {}).length} retouche(s), ${(pub.edits.added ?? []).length} ajout(s), en ${pub.ms} ms`);
      else console.info(`[parkings] retouches publiées non reçues (${pub.reason}, ${pub.ms} ms) : le site part avec parkings.json seul`);
    }
  }
  if (!data) {
    lobby.destroy();
    loading.hideBoot();
    showFatal(app, 'Données de la ville absentes', 'Lance <code>npm run data</code> pour télécharger les bâtiments depuis OpenStreetMap, puis recharge la page.');
    return;
  }

  // Lieux d'histoire : position OSM (ancrage) ou position manuelle
  const pois: PlacedPoi[] = (poisContent as Poi[]).flatMap((p) => {
    if (p.draft && !import.meta.env.DEV) return []; // brouillons masqués en production
    const position = p.pos ?? data.anchors[p.id]?.pos;
    if (!position) {
      console.warn(`[POI] « ${p.title} » sans position : ajuste osm.match ou ajoute pos dans pois.json`);
      return [];
    }
    return [{ ...p, position }];
  });

  await loading.set(10, 'relief');
  const terrain = createTerrain(data);
  const stage = createStage(app, data.bounds, terrain.heightAt);
  const { scene, camera, renderer, controls } = stage;
  const models = modelsContent as ModelEntry[];
  const hidden = hiddenBuildings(models); // bâtiments remplacés par un monument modélisé
  await loading.set(18, 'bâtiments');
  const city = buildCity(data, terrain, { hidden });
  scene.add(city.group);
  // Heure et saison (itération 31) : heure réelle de Chambéry par défaut
  const clock = createClock();
  let foliage = clock.state().foliage;
  city.trees.setFoliage(foliage);
  // Arbres modélisés dans certains parcs (content/nature.json) ; les arbres simples restent en repli
  await loading.set(42, 'arbres');
  let nature: Awaited<ReturnType<typeof buildNature>> | null = null;
  try {
    nature = await buildNature(natureContent as unknown as NatureConfig, data, city.trees.spots, terrain.heightAt, foliage);
    city.trees.hide(nature.replaced);
    scene.add(nature.group);
  } catch (e) {
    console.warn('[nature] arbres modélisés non chargés', e);
  }
  // Monuments modélisés (formes simples en code ou fichiers glTF)
  await loading.set(54, 'monuments');
  const modelsRoot = await buildModels(models, pois, { night: city.night.uNight, data, heightAt: terrain.heightAt, minUnder: terrain.minUnder });
  scene.add(modelsRoot);
  // Les quatre éléphants échappés de la fontaine, sur les rues et chemins (content/mascot.json)
  const mascot = mascotContent as unknown as MascotConfig;
  await loading.set(64, 'éléphants');
  let herd: Herd | null = null;
  try {
    herd = await buildHerd(mascot, data, terrain.heightAt);
    if (herd) scene.add(herd.group);
  } catch (e) {
    console.warn('[mascottes] non chargées', e);
  }
  // Passants (EP001-US001) : décor, sur leur propre réseau de voies
  await loading.set(72, 'passants');
  let people: ReturnType<typeof buildPeople> = null;
  let pathfinder: Pathfinder | null = null;
  let avatar: Avatar | null = null;
  let balade: Balade | null = null;
  let cutaway: Cutaway | null = null;
  try {
    // Un seul réseau de voies, partagé par les passants et le chemin de l'avatar (EP005-US001)
    const peopleCfg = lifeContent.people as unknown as PeopleConfig;
    const walkways = buildWalkways(data, peopleCfg.network);
    pathfinder = buildPathfinder(walkways, data, avatarContent.path as PathConfig, peopleCfg.network.avoid);
    // L'avatar reste caché tant que le mode balade (US003) n'existe pas ; en debug : diorama.avatar.place(x, y) puis .goTo(x, y)
    avatar = buildAvatar(avatarContent.avatar as AvatarConfig, terrain.heightAt, pathfinder);
    scene.add(avatar.group);
    people = buildPeople(peopleCfg, data, terrain.heightAt, { camera, focus: () => controls.target, hour: () => clock.state().hour }, walkways);
    if (people) {
      scene.add(people.group);
      if (DEBUG) console.info(`[passants] ${people.count} sur un réseau de ${people.nodes} nœuds`);
    }
  } catch (e) {
    console.warn('[passants] non créés', e);
  }
  // Pigeons et oiseaux (EP001-US004) : de jour, sur les places et au-dessus de la cathédrale et du château
  let birds: ReturnType<typeof buildBirds> = null;
  try {
    birds = buildBirds(lifeContent.birds as unknown as BirdsConfig, data, terrain.heightAt, city.night, { camera, focus: () => controls.target });
    if (birds) scene.add(birds.group);
  } catch (e) {
    console.warn('[oiseaux] non créés', e);
  }
  // Vent de beau temps (content/life.json) : un seul objet pour la fumée et les drapeaux, que la météo fera varier (EP009-US009)
  const wind = { ...lifeContent.smoke.wind };
  // Cheminées et fumée (EP001-US005) : la fumée suit la saison de l'horloge
  await loading.set(80, 'cheminées');
  let chimneys: ReturnType<typeof buildChimneys> = null;
  try {
    chimneys = buildChimneys({ ...(lifeContent.smoke as unknown as SmokeConfig), wind }, data, {
      minUnder: terrain.minUnder, hidden, night: city.night, season: () => clock.state().current, focus: () => controls.target,
    });
    if (chimneys) scene.add(chimneys.group);
  } catch (e) {
    console.warn('[cheminées] non créées', e);
  }
  // Drapeaux de la Savoie sur le château et l'hôtel de ville (EP001-US006), posés sur le point le plus haut du toit
  let flags: ReturnType<typeof buildFlags> = null;
  try {
    flags = buildFlags(lifeContent.flags.list as FlagSpec[], data, { targets: [modelsRoot, city.group], wind });
    if (flags) {
      scene.add(flags.group);
      if (DEBUG) console.info('[drapeaux]', flags.placed.map((f) => `${f.id} à ${f.top.toFixed(1)} m`).join(', '));
    }
  } catch (e) {
    console.warn('[drapeaux] non créés', e);
  }
  await loading.set(86, 'noms de rues');
  const labels = await buildLabels(data.labels ?? [], terrain.heightAt);
  // Noms de rues peints au sol, visibles seulement en zoomant (EP002) ; texture construite à l'approche
  const streetNames = buildStreetNames(data.streetLabels, terrain.heightAt, city.night, streetsContent as unknown as StreetNamesConfig, { camera, focus: () => controls.target }, DEBUG);
  if (streetNames) scene.add(streetNames.group);
  // Effet maquette : les étiquettes passent par-dessus le flou pour rester lisibles
  const tiltShift = createTiltShift(renderer, scene, camera, labels.root);
  // Effet maquette toujours actif (plus d'interrupteur depuis l'itération 22)
  // Rectangle du canevas gardé en mémoire : le relire à chaque image (fiche, bulle, survol)
  // forcerait le navigateur à recalculer la mise en page après chaque écriture de style
  let canvasRect = renderer.domElement.getBoundingClientRect();
  window.addEventListener('resize', () => {
    tiltShift.setSize(app.clientWidth, app.clientHeight);
    canvasRect = renderer.domElement.getBoundingClientRect();
  });
  // Densité de pixels plafonnée à 1,5 puis ajustée selon les images/s (scene/quality.ts)
  const quality = createAdaptiveResolution(renderer, () => tiltShift.setSize(app.clientWidth, app.clientHeight));
  tiltShift.setSize(app.clientWidth, app.clientHeight);
  // Compteur de performance : ajouter ?debug à l'adresse (code chargé seulement dans ce cas)
  const perfHud = DEBUG ? (await import('./ui/perfhud')).createPerfHud(renderer, () => quality.pixelRatio, qualityLevel()) : null;
  await loading.set(92, 'lieux');
  const poiLayer = buildPoiMarkers(pois, terrain.heightAt);
  scene.add(poiLayer.root);
  const placeLayer = buildPlaceMarkers(data.places, terrain.heightAt, data.buildings, terrain.minUnder);
  scene.add(placeLayer.root);
  // Auvents des bars, cafés et restaurants (pièces du pack de bâtiments) ; s'ils ne se chargent pas, la carte reste sans
  let awnings: Awaited<ReturnType<typeof buildAwnings>> | null = null;
  try {
    awnings = await buildAwnings({ data, heightAt: terrain.heightAt, minUnder: terrain.minUnder, hidden, config: buildingsContent.awning as AwningConfig });
    scene.add(awnings.group);
    if (DEBUG) console.info(`[auvents] ${awnings.stats.placed} posés, ignorés :`, awnings.stats.skipped);
  } catch (e) {
    console.warn('[auvents] non chargés', e);
  }
  await loading.set(97, 'interface');
  let parkingsOn = false;
  let parkingSel: string | null = null; // fiche de parking ouverte
  const hitTargets: THREE.Object3D[] = []; // zones de clic (le tableau est partagé avec interaction.ts)
  const parkingSigns: ParkingSigns | null = buildParkingSigns(avatarContent.parkingSigns as ParkingSignsConfig, data, terrain.heightAt, terrain.minUnder, city.night.uNight, hidden, city.group.getObjectByName('buildings')?.userData as { tops?: Float32Array; roofAt?: (bi: number, x: number, z: number) => number } | undefined);
  if (parkingSigns) scene.add(parkingSigns.group);
  let lastGlow = -1;
  const groundNode = () => city.group.getObjectByName('terrain');
  let discovered = loadDiscovered();
  let placeIdx: number | null = null; // fiche de lieu ouverte
  // Modèle de la mascotte sous licence CC BY 3.0 : crédit obligatoire, affiché avec les autres
  const ui = createUi(app, pois, `${data.attribution} · Éléphant : jeremy (Poly Pizza), CC BY 3.0`, {
    onJournalPick: (id) => openPoi(id),
    onToggleCategory: (cat, v) => {
      placeLayer.setCategoryVisible(cat, v);
      awnings?.setCategoryVisible(cat, v);
      people?.setCategoryVisible(cat, v);
      // La fiche ouverte disparaît si sa catégorie est masquée
      if (!v && placeIdx !== null && placeCategory(placeLayer.places[placeIdx].kind).id === cat) closePlace();
    },
    onPlaceClosed: () => { placeLayer.setActive(null); parkingSel = null; },
    onCompass: () => stage.resetNorth(),
    onLobby: () => lobby.open(),
    onBalade: () => balade?.toggle(),
    onParkings: () => {
      parkingsOn = !parkingsOn;
      (city.group.getObjectByName('terrain')?.userData.setParkings as ((on: boolean) => void) | undefined)?.(parkingsOn);
      ui.setParkings(parkingsOn);
      if (parkingSigns) {
        parkingSigns.group.visible = parkingsOn;
        // Les zones de clic des panneaux ne comptent que couche allumée
        for (const h of parkingSigns.hits) { const k = hitTargets.indexOf(h); if (parkingsOn && k < 0) hitTargets.push(h); else if (!parkingsOn && k >= 0) hitTargets.splice(k, 1); }
        if (!parkingsOn && parkingSel) closePlace();
      }
      if (parkingsOn) {
        const off = (data.parkings ?? []).filter((p) => p.kind !== 'street');
        const known = off.filter((p) => p.capacity).length;
        ui.flash(`🅿️ ${off.length} parkings repérés, dont ${known} qui avouent leur nombre de places`);
      }
      lastGlow = -1;
    },
    onRecenter: () => balade?.recenter(),
    onHour: (h) => clock.setHour(h),
    onPlay: (p) => clock.setPlaying(p),
    onLive: () => clock.live(),
    onSeason: () => clock.nextSeason(),
    onReset: () => {
      resetDiscovered();
      discovered = new Set();
      syncFound();
      ui.hidePanel();
      ui.flash('Exploration remise à zéro');
    },
  });
  // Mode balade (EP005) : un avatar qu'on dirige, la caméra le suit ; départ à la fontaine des Éléphants
  if (avatar) {
    cutaway = createCutaway(avatarContent.cutaway as CutawayConfig, data, city.fade, terrain.minUnder, modelsRoot, hidden, camera, (out) => avatar!.aim(out));
    balade = createBalade({ camera: avatarContent.camera } as BaladeConfig, stage, avatar, renderer.domElement, data.anchors.elephants?.pos ?? [0, 0], { ...ui, setCutaway: (on) => cutaway?.setActive(on) });
  }
  if (data.parkings?.length) ui.showParkingsButton();
  // Mode hors-ligne (service worker, production uniquement)
  setupPwa(ui.flash);
  // Cycle jour/nuit : vraie course du soleil pour la date et l'heure de l'horloge
  const start = clock.state();
  const dayNight = createDayNight({
    scene, renderer, lights: stage.lights, size: stage.size, night: city.night,
    placeHalos: placeLayer.root.getObjectByName('placeHalos'),
    litCurve: lifeContent.windows.litCurve as [number, number][],
  }, { day: start.day, hour: start.hour });

  // La nuit, seuls les lieux ouverts à l'heure choisie restent allumés (horaires OSM opening_hours)
  // Fiche : seulement les vraies horaires. Éclairage (et plus tard les groupes de passants) : les vraies, à défaut
  // les horaires PROVISOIRES (fictifs) de content/place-hours.json, jamais affichés aux visiteurs
  const provisional = (placeHours as { hours: Record<string, string> }).hours;
  const openStatesAt = createOpenStates(data.places.map((p) => p.hours));
  const litStatesAt = createOpenStates(data.places.map((p) => p.hours ?? provisional[p.id]));
  let openStates: OpenState[] = [];
  let openKey = '';

  clock.onChange((c) => {
    dayNight.set(c.day, c.hour);
    ui.setClock(c, dayNight.getNight());
    const key = `${c.day.y}-${c.day.m}-${c.day.d} ${Math.floor(c.hour * 60)}`;
    if (key !== openKey) {
      openKey = key;
      openStates = openStatesAt(c.day, c.hour);
      const lit = litStatesAt(c.day, c.hour);
      placeLayer.setClosed(lit.map((s) => s === 'closed'));
      people?.setOpen(lit.map((s) => s === 'open')); // les groupes de passants : seulement devant les lieux ouverts (horaires OSM ou provisoires)
      if (placeIdx !== null) ui.setPlaceStatus(openStates[placeIdx]);
    }
    if (c.foliage !== foliage) {
      foliage = c.foliage;
      city.trees.setFoliage(foliage);
      renderer.shadowMap.needsUpdate = true;
      nature?.setFoliage(foliage).then(() => { renderer.shadowMap.needsUpdate = true; });
    }
  });

  // --- Mini-jeu « Ramène les éléphants à la fontaine » (itération 35) --------
  const game = setupGame({
    scene, camera, canvasRect: () => canvasRect, herd,
    fountain: modelsRoot.getObjectByName('fontaine-des-elephants'),
    game: mascot.game,
    ui,
    // En balade, la caméra quitte l'avatar pour suivre l'éléphant jusqu'à la fontaine, puis revient (release)
    flyTo: (x, z) => { if (balade?.active()) balade.detour(x, z); else stage.flyTo(x, z, 160); },
    release: () => balade?.release(),
  });
  const { hunt, slots } = game;
  // Mode debug (?debug) : faisceaux au-dessus des éléphants et panneau pour les retrouver ;
  // chargé à la demande, comme l'outil de placement : absent du fichier principal
  let herdDebug: Ticker | null = null;
  if (DEBUG && herd) {
    const { installHerdDebug } = await import('./dev/herd-debug');
    herdDebug = installHerdDebug({ root: app, scene, herd, home: data.anchors[mascot.start]?.pos ?? [0, 0], flyTo: (x, z) => stage.flyTo(x, z, 160) });
  }

  const syncFound = () => {
    poiLayer.markers.forEach((m) => m.setFound(discovered.has(m.poi.id)));
    ui.setFound(discovered);
  };
  syncFound();

  function openPoi(id: string) {
    const poi = pois.find((p) => p.id === id);
    if (!poi) return;
    const isNew = !discovered.has(id);
    if (isNew) {
      discovered.add(id);
      saveDiscovered(discovered);
      syncFound();
      ui.flash(discovered.size === pois.length ? '🏆 Tous les lieux sont découverts !' : `✦ Nouveau lieu découvert : ${poi.title}`);
    }
    if (!balade?.active()) stage.flyTo(poi.position[0], -poi.position[1]); // en balade, la caméra reste sur l'avatar
    ui.showPoi(poi, isNew);
  }

  // --- Fiche des bars, cafés, restaurants ---------------------------------
  const openPlace = (i: number, pin: boolean) => {
    placeIdx = i;
    placeLayer.setActive(i);
    ui.showPlaceCard(placeLayer.places[i], pin, openStates[i]);
  };
  const closePlace = () => {
    placeIdx = null;
    parkingSel = null;
    placeLayer.setActive(null);
    ui.hidePlaceCard();
  };
  const anchorV = new THREE.Vector3();
  /** La fiche suit son épingle quand la caméra bouge. */
  const followPlace = () => {
    if (placeIdx === null && !parkingSel) return;
    if (placeIdx !== null) placeLayer.anchor(placeIdx, anchorV).project(camera);
    else if (!parkingSigns?.anchor(parkingSel!, anchorV)) return;
    else anchorV.project(camera);
    const r = canvasRect;
    const onScreen = anchorV.z < 1 && Math.abs(anchorV.x) <= 1.05 && Math.abs(anchorV.y) <= 1.05;
    ui.movePlaceCard(r.left + ((anchorV.x + 1) / 2) * r.width, r.top + ((1 - anchorV.y) / 2) * r.height, onScreen);
  };

  // Outil de placement : chargé uniquement en dev, absent du build de production
  let placement: PlacementTool | null = null;
  if (import.meta.env.DEV) {
    const { installPlacementTool } = await import('./dev/placement');
    placement = installPlacementTool({
      root: app, scene, camera, controls, canvas: renderer.domElement, pickTargets: city.group, data, pois,
      movePoiMarker: (id, pos) => poiLayer.markers.find((m) => m.poi.id === id)?.group.position.set(pos[0], terrain.heightAt(pos[0], pos[1]), -pos[1]),
    });
  } else if (DEBUG) {
    // Production en mode ?debug : outil de position en lecture seule (clic = position copiée), à coller dans la conversation
    const { installPositionPicker } = await import('./dev/position-picker');
    placement = installPositionPicker({ root: app, scene, camera, canvas: renderer.domElement, pickTargets: city.group, data, heightAt: terrain.heightAt, flash: ui.flash });
  }

  // --- Sélection à la souris / au doigt (src/interaction.ts) ---------------
  // Zones de clic : lieux d'histoire, bars / cafés / restaurants ; les panneaux de parking s'y ajoutent couche allumée
  hitTargets.unshift(...poiLayer.markers.map((m) => m.hit), ...placeLayer.root.children.filter((c) => c.userData.places));
  const interaction = installInteraction({
    canvas: renderer.domElement, camera, controls, canvasRect: () => canvasRect, pois,
    targets: hitTargets,
    ground: city.group,
    zoomTo: (p) => stage.zoomTo(p),
    hunt, placement,
    walking: () => !!balade?.active(),
    onGround: (x, y) => {
      // Une fiche ouverte se ferme d'abord : un toucher = une seule action
      if (ui.placeCardState().place) return false;
      if (ui.panelOpen()) { ui.hidePanel(); return true; }
      return balade ? balade.goTo(x, y) || true : false;
    },
    tooltip: ui.showTooltip,
    onSelect: (h) => {
      if (h && 'poi' in h) {
        closePlace();
        // En balade, l'avatar marche jusqu'au lieu : la fiche s'ouvre à l'arrivée (hors de portée : tout de suite)
        const id = h.poi.id;
        if (balade?.active() && balade.goTo(h.poi.position[0], h.poi.position[1], () => openPoi(id))) return;
        openPoi(id);
      }
      else if (h && 'place' in h) { parkingSel = null; openPlace(h.index, true); } // clic ou toucher : la fiche reste ouverte
      else if (h && 'parking' in h) {
        const p = parkingSigns?.parkings.find((x) => x.id === h.parking);
        if (!p) return;
        closePlace();
        parkingSel = p.id;
        const card = parkingCard(p, data.osmDate ?? data.generatedAt);
        if (DEBUG) card.source += ` · ${p.id}`; // l'identifiant sert aux retouches (content/parkings.json)
        ui.showParkingCard(card);
      }
      else if (ui.placeCardState().place) closePlace(); // clic dans le vide : on ferme
    },
    onHover: (h, x, y) => {
      if (h && 'poi' in h) ui.showTooltip(discovered.has(h.poi.id) ? h.poi.title : '✦ Lieu mystère', x, y);
      else if (h && 'parking' in h) ui.showTooltip(`🅿️ ${parkingSigns?.parkings.find((p) => p.id === h.parking)?.name ?? 'Parking'}`, x, y);
      else ui.showTooltip(null);
      // Bars, cafés, restaurants : la fiche apparaît au survol (sauf si une fiche est déjà épinglée par un clic)
      if (!ui.placeCardState().pinned) {
        if (h && 'place' in h) openPlace(h.index, false);
        else if (ui.placeCardState().place) closePlace();
      }
    },
    onLeave: () => {
      if (!ui.placeCardState().pinned && ui.placeCardState().place) closePlace();
    },
  });

  // --- Boucle de rendu ------------------------------------------------------
  // Modules animés, dans l'ordre d'appel ; ajouter un module = ajouter une ligne
  const tickers: Ticker[] = [
    { update: (_, t) => poiLayer.animate(t) },
    { update: (_, t) => placeLayer.animate(t), moving: placeLayer.moving },
    { update: (_, t) => city.update(t) },
    ...(herd ? [herd] : []),
    ...(people ? [people] : []),
    ...(balade ? [balade] : []),
    ...(cutaway ? [cutaway] : []),
    {
      // La nuit, les parkings s'allument doucement (sinon la couleur disparaît avec la lumière)
      update: () => {
        if (!parkingsOn) return;
        const k = Math.round(city.night.uNight.value * 20) / 20;
        if (k !== lastGlow) { lastGlow = k; (groundNode()?.userData.setParkingGlow as ((k: number) => void) | undefined)?.(k * 0.7); }
      },
    },
    ...(avatar ? [avatar] : []),
    ...(birds ? [birds] : []),
    ...(chimneys ? [chimneys] : []),
    ...(flags ? [flags] : []),
    game.ticker,
    ...(herdDebug ? [herdDebug] : []),
    clock,
    ...(streetNames ? [streetNames] : []),
    { update: () => labels.update(camera) },
    interaction, // survol
    { update: followPlace },
    { update: () => ui.setHeading(stage.heading()) },
  ];
  // Cadence (TI-02) : les éléphants marchent en permanence, on ne peut pas arrêter le rendu ; au repos,
  // on le limite à 30 images/s. Pleine vitesse quand la caméra bouge (et 0,5 s après), quand
  // l'utilisateur la prend en main, ou quand un module dit qu'il bouge (Ticker.moving)
  const IDLE_FRAME = 1 / 30 - 0.004; // marge : sur un écran 60 Hz, une image sur deux exactement
  const CAMERA_TAIL = 0.5;
  let pending = 0; // temps écoulé depuis la dernière image dessinée
  let still = 0; // temps depuis le dernier mouvement de caméra
  let wasBusy = false;
  const lastPos = camera.position.clone(), lastTarget = controls.target.clone();
  controls.addEventListener('start', () => { still = 0; });
  const timer = new THREE.Timer();
  timer.connect(document);
  // Lobby : la caméra se pose sur le vieux centre (la vie y est visible : passants, oiseaux, fumée) et tourne doucement
  const lobbyView = () => {
    const a = data.anchors.chateau?.pos, b = data.anchors.elephants?.pos;
    const cx = a && b ? (a[0] + b[0]) / 2 : (data.bounds.minX + data.bounds.maxX) / 2;
    const cy = a && b ? (a[1] + b[1]) / 2 : (data.bounds.minY + data.bounds.maxY) / 2;
    controls.target.set(cx, terrain.heightAt(cx, cy), -cy);
    camera.position.copy(controls.target).addScaledVector(new THREE.Vector3(-0.5, 0.58, 0.64).normalize(), 430);
    controls.autoRotate = !matchMedia('(prefers-reduced-motion: reduce)').matches;
    controls.autoRotateSpeed = 0.5;
    controls.update();
  };
  if (lobby.isOpen()) lobbyView();
  lobby.setCredits(`${data.attribution} · Éléphant : jeremy (Poly Pizza), CC BY 3.0`);
  lobby.onEnter(() => {
    controls.autoRotate = false;
    ui.showHint(); // le lobby n'explique pas les gestes : l'aide s'affiche à l'entrée sur la carte
    ui.flushFlash(); // le message de départ du jeu, retenu pendant le lobby
  });
  // Tout est en place (ville, arbres, monuments) : première carte des ombres
  renderer.shadowMap.needsUpdate = true;
  renderer.setAnimationLoop(() => {
    timer.update();
    pending += timer.getDelta();
    const busy = still < CAMERA_TAIL || tickers.some((m) => m.moving?.());
    if (!busy && pending < IDLE_FRAME) return;
    const raw = pending;
    pending = 0;
    const dt = Math.min(raw, 0.1);
    const t = timer.getElapsed();
    perfHud?.begin();
    // La première image après le repos dure ≈ 33 ms voulues : pas une mesure de lenteur
    quality.update(raw, busy && wasBusy);
    wasBusy = busy;
    stage.updateFlight(dt);
    controls.update(controls.autoRotate ? dt : undefined);
    stage.clampTarget();
    if (camera.position.distanceToSquared(lastPos) > 1e-6 || controls.target.distanceToSquared(lastTarget) > 1e-6) {
      still = 0;
      lastPos.copy(camera.position);
      lastTarget.copy(controls.target);
    } else still += raw;
    // Derrière le lobby, la caméra tourne doucement : 30 images/s suffisent (cadence au repos)
    if (lobby.isOpen()) still = CAMERA_TAIL;
    for (const m of tickers) m.update(dt, t);
    tiltShift.update(controls.target, stage.size * 1.2);
    tiltShift.render();
    perfHud?.end(raw, busy);
  });

  // Pluie prototype pour la mesure sur téléphone (EP009-US001) : ?debug&rain=2500 ; code chargé à la demande, ajouté
  // après le démarrage (comme la météo le sera) : le compteur montre son coût et l'éventuel à-coup de son apparition
  const rainCount = DEBUG ? Number(new URLSearchParams(location.search).get('rain')) : 0;
  let rainProto: RainProto | null = null;
  if (rainCount > 0) {
    import('./dev/rain-proto')
      .then(({ installRainProto }) => {
        rainProto = installRainProto({ scene, camera, focus: () => controls.target, bounds: data.bounds, count: rainCount });
        tickers.push(rainProto);
      })
      .catch((e) => console.warn('[pluie prototype] non chargée', e));
  }

  // La ville est prête : « Explorer la carte » s'active (ou la carte s'ouvre directement sans lobby)
  await loading.set(100, '');
  lobby.setReady();
  if (!lobbyAtStart) loading.hideBoot();

  // Accès debug depuis la console : window.diorama (en dev ou avec ?debug seulement)
  // perf : mesures du compteur (scripts de mesure) ; rain : pluie prototype (?debug&rain=N), arrivée après le démarrage
  if (import.meta.env.DEV || DEBUG) Object.assign(window, { diorama: { lobby, loading, scene, camera, controls, data, pois, placeLayer, awnings, people, pathfinder, avatar, balade, cutaway, parkingSigns, birds, chimneys, flags, clock, herd, hunt, slots, renderer, stage, perf: perfHud, get rain() { return rainProto; } } });
}

main();
