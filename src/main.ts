import * as THREE from 'three';
import './style.css';
import poisContent from './content/pois.json';
import modelsContent from './content/models.json';
import natureContent from './content/nature.json';
import type { CityData, Place, Poi, PlacedPoi } from './types';
import { createStage } from './scene/stage';
import { buildCity } from './scene/city';
import { createTerrain } from './scene/terrain';
import { buildPlaceMarkers, buildPoiMarkers } from './scene/markers';
import { buildLabels } from './scene/labels';
import { createTiltShift } from './scene/tiltshift';
import { createDayNight } from './scene/daynight';
import { buildModels, hiddenBuildings, type ModelEntry } from './scene/models';
import { buildNature, type NatureConfig } from './scene/nature';
import { createClock } from './time/clock';
import { createOpenStates, type OpenState } from './time/openinghours';
import { placeCategory } from './scene/palette';
import { installTwoFingerGestures } from './scene/touch';
import { createAdaptiveResolution } from './scene/quality';
import { createPerfHud } from './ui/perfhud';
import { dataUrl } from './dataurl';
import { setupPwa } from './pwa';
import { createUi, showFatal } from './ui/ui';
import { loadDiscovered, resetDiscovered, saveDiscovered } from './state/progress';

const app = document.getElementById('app')!;

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
  const data = await loadCity();
  if (!data) {
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

  const terrain = createTerrain(data);
  const stage = createStage(app, data.bounds, terrain.heightAt);
  const { scene, camera, renderer, controls } = stage;
  const models = modelsContent as ModelEntry[];
  const city = buildCity(data, terrain, { hidden: hiddenBuildings(models) });
  scene.add(city.group);
  // Heure et saison (itération 31) : heure réelle de Chambéry par défaut
  const clock = createClock();
  let foliage = clock.state().foliage;
  city.trees.setFoliage(foliage);
  // Arbres modélisés dans certains parcs (src/content/nature.json) ; les arbres simples restent en repli
  let nature: Awaited<ReturnType<typeof buildNature>> | null = null;
  try {
    nature = await buildNature(natureContent as unknown as NatureConfig, data, city.trees.spots, terrain.heightAt, foliage);
    city.trees.hide(nature.replaced);
    scene.add(nature.group);
  } catch (e) {
    console.warn('[nature] arbres modélisés non chargés', e);
  }
  // Monuments modélisés (formes simples en code ou fichiers glTF)
  scene.add(await buildModels(models, pois, { night: city.night.uNight, data, heightAt: terrain.heightAt, minUnder: terrain.minUnder }));
  const labels = await buildLabels(data.labels ?? [], terrain.heightAt);
  // Effet maquette : les étiquettes passent par-dessus le flou pour rester lisibles
  const tiltShift = createTiltShift(renderer, scene, camera, labels.root);
  // Effet maquette toujours actif (plus d'interrupteur depuis l'itération 22)
  window.addEventListener('resize', () => tiltShift.setSize(app.clientWidth, app.clientHeight));
  // Densité de pixels plafonnée à 1,5 puis ajustée selon les images/s (scene/quality.ts)
  const quality = createAdaptiveResolution(renderer, () => tiltShift.setSize(app.clientWidth, app.clientHeight));
  tiltShift.setSize(app.clientWidth, app.clientHeight);
  // Compteur de performance : ajouter ?debug à l'adresse
  const perfHud = new URLSearchParams(location.search).has('debug') ? createPerfHud(renderer, () => quality.pixelRatio) : null;
  const poiLayer = buildPoiMarkers(pois, terrain.heightAt);
  scene.add(poiLayer.root);
  const placeLayer = buildPlaceMarkers(data.places, terrain.heightAt, data.buildings, terrain.minUnder);
  scene.add(placeLayer.root);

  let discovered = loadDiscovered();
  let placeIdx: number | null = null; // fiche de lieu ouverte
  const ui = createUi(app, pois, data.attribution, {
    onJournalPick: (id) => openPoi(id),
    onToggleCategory: (cat, v) => {
      placeLayer.setCategoryVisible(cat, v);
      // La fiche ouverte disparaît si sa catégorie est masquée
      if (!v && placeIdx !== null && placeCategory(placeLayer.places[placeIdx].kind).id === cat) closePlace();
    },
    onPlaceClosed: () => placeLayer.setActive(null),
    onCompass: () => stage.resetNorth(),
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
  // Mode hors-ligne (service worker, production uniquement)
  setupPwa(ui.flash);
  // Cycle jour/nuit : vraie course du soleil pour la date et l'heure de l'horloge
  const start = clock.state();
  const dayNight = createDayNight({
    scene, renderer, lights: stage.lights, size: stage.size, night: city.night,
    placeHalos: placeLayer.root.getObjectByName('placeHalos'),
  }, { day: start.day, hour: start.hour });

  // La nuit, seuls les lieux ouverts à l'heure choisie restent allumés (horaires OSM opening_hours)
  const openStatesAt = createOpenStates(data.places.map((p) => p.hours));
  let openStates: OpenState[] = [];
  let openKey = '';

  clock.onChange((c) => {
    dayNight.set(c.day, c.hour);
    ui.setClock(c, dayNight.getNight());
    const key = `${c.day.y}-${c.day.m}-${c.day.d} ${Math.floor(c.hour * 60)}`;
    if (key !== openKey) {
      openKey = key;
      openStates = openStatesAt(c.day, c.hour);
      placeLayer.setClosed(openStates.map((s) => s === 'closed'));
      if (placeIdx !== null) ui.setPlaceStatus(openStates[placeIdx]);
    }
    if (c.foliage !== foliage) {
      foliage = c.foliage;
      city.trees.setFoliage(foliage);
      renderer.shadowMap.needsUpdate = true;
      nature?.setFoliage(foliage).then(() => { renderer.shadowMap.needsUpdate = true; });
    }
  });

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
    stage.flyTo(poi.position[0], -poi.position[1]);
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
    placeLayer.setActive(null);
    ui.hidePlaceCard();
  };
  const anchorV = new THREE.Vector3();
  /** La fiche suit son épingle quand la caméra bouge. */
  const followPlace = () => {
    if (placeIdx === null) return;
    placeLayer.anchor(placeIdx, anchorV).project(camera);
    const r = renderer.domElement.getBoundingClientRect();
    const onScreen = anchorV.z < 1 && Math.abs(anchorV.x) <= 1.05 && Math.abs(anchorV.y) <= 1.05;
    ui.movePlaceCard(r.left + ((anchorV.x + 1) / 2) * r.width, r.top + ((1 - anchorV.y) / 2) * r.height, onScreen);
  };

  // --- Sélection à la souris / au doigt -----------------------------------
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const hitTargets = () => [...poiLayer.markers.map((m) => m.hit), ...placeLayer.root.children.filter((c) => c.userData.places)];

  type Hit = { poi: PlacedPoi } | { place: Place; index: number } | null;
  const pick = (clientX: number, clientY: number): Hit => {
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObjects(hitTargets(), false)[0];
    if (!hit) return null;
    if (hit.object.userData.poiId) return { poi: pois.find((p) => p.id === hit.object.userData.poiId)! };
    const places = hit.object.userData.places as Place[] | undefined;
    if (places && hit.instanceId !== undefined) return { place: places[hit.instanceId], index: hit.instanceId };
    return null;
  };

  // Outil de placement : chargé uniquement en dev, absent du build de production
  let placement: { handleClick(x: number, y: number): boolean; isActive(): boolean } | null = null;
  if (import.meta.env.DEV) {
    const { installPlacementTool } = await import('./dev/placement');
    placement = installPlacementTool({
      root: app, scene, camera, controls, canvas: renderer.domElement, pickTargets: city.group, data, pois,
      movePoiMarker: (id, pos) => poiLayer.markers.find((m) => m.poi.id === id)?.group.position.set(pos[0], terrain.heightAt(pos[0], pos[1]), -pos[1]),
    });
  }

  // Tactile : gestes à deux doigts (pincer, tourner, incliner) ; un doigt = déplacer (stage.ts)
  installTwoFingerGestures(renderer.domElement, camera, controls);
  // Double toucher : zoom vers l'endroit touché
  let lastTap: { t: number; x: number; y: number } | null = null;
  const zoomAtScreen = (clientX: number, clientY: number) => {
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObject(city.group, true)[0];
    stage.zoomTo(hit ? hit.point : controls.target.clone()); // hors du socle : zoom sur le centre de la vue
  };

  let down: { x: number; y: number } | null = null;
  renderer.domElement.addEventListener('pointerdown', (e) => (down = { x: e.clientX, y: e.clientY }));
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) return;
    if (e.pointerType === 'touch') {
      const now = performance.now();
      if (lastTap && now - lastTap.t < 320 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 30) {
        lastTap = null;
        zoomAtScreen(e.clientX, e.clientY);
        return;
      }
      lastTap = { t: now, x: e.clientX, y: e.clientY };
    }
    if (placement?.handleClick(e.clientX, e.clientY)) return;
    const h = pick(e.clientX, e.clientY);
    if (h && 'poi' in h) { closePlace(); openPoi(h.poi.id); }
    else if (h && 'place' in h) openPlace(h.index, true); // clic ou toucher : la fiche reste ouverte
    else if (ui.placeCardState().place) closePlace(); // clic dans le vide : on ferme
  });
  let hoverQueued: PointerEvent | null = null;
  renderer.domElement.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'mouse') hoverQueued = e;
  });
  renderer.domElement.addEventListener('pointerleave', () => {
    ui.showTooltip(null);
    if (!ui.placeCardState().pinned && ui.placeCardState().place) closePlace();
  });

  const hover = () => {
    if (!hoverQueued) return;
    const e = hoverQueued;
    hoverQueued = null;
    if (placement?.isActive()) return ui.showTooltip(null);
    const h = pick(e.clientX, e.clientY);
    renderer.domElement.style.cursor = h ? 'pointer' : 'grab';
    if (h && 'poi' in h) ui.showTooltip(discovered.has(h.poi.id) ? h.poi.title : '✦ Lieu mystère', e.clientX, e.clientY);
    else ui.showTooltip(null);
    // Bars, cafés, restaurants : la fiche apparaît au survol (sauf si une fiche est déjà épinglée par un clic)
    if (!ui.placeCardState().pinned) {
      if (h && 'place' in h) openPlace(h.index, false);
      else if (ui.placeCardState().place) closePlace();
    }
  };

  // --- Boucle de rendu ------------------------------------------------------
  const timer = new THREE.Timer();
  timer.connect(document);
  // Tout est en place (ville, arbres, monuments) : première carte des ombres
  renderer.shadowMap.needsUpdate = true;
  renderer.setAnimationLoop(() => {
    timer.update();
    const raw = timer.getDelta();
    const dt = Math.min(raw, 0.1);
    perfHud?.begin();
    quality.update(raw);
    stage.updateFlight(dt);
    controls.update();
    stage.clampTarget();
    poiLayer.animate(timer.getElapsed());
    placeLayer.animate(timer.getElapsed());
    city.update(timer.getElapsed());
    clock.update(dt);
    labels.update(camera);
    hover();
    followPlace();
    ui.setHeading(stage.heading());
    tiltShift.update(controls.target, stage.size * 1.2);
    tiltShift.render();
    perfHud?.end(raw);
  });

  // Accès debug depuis la console : window.diorama
  Object.assign(window, { diorama: { scene, camera, controls, data, pois, placeLayer, clock } });
}

main();
