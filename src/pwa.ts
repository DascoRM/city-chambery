import { registerSW } from 'virtual:pwa-register';

/**
 * Mode hors-ligne (PWA) : enregistre le service worker généré par vite-plugin-pwa (vite.config.ts).
 * - première visite : le site, city.json et les modèles sont gardés sur l'appareil → la carte
 *   s'ouvre ensuite sans réseau, et se recharge instantanément ;
 * - nouvelle version publiée : un bandeau propose de mettre à jour (rien ne se recharge tout seul
 *   au milieu d'une exploration).
 * Seulement en production, et seulement en HTTPS ou sur localhost (règle des navigateurs).
 */
export function setupPwa(flash: (msg: string) => void): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  const update = registerSW({
    onNeedRefresh() {
      const bar = document.createElement('div');
      bar.className = 'update-bar card';
      bar.innerHTML = '<span>Nouvelle version de la carte disponible</span><button class="btn">Mettre à jour</button><button class="icon" aria-label="Plus tard">✕</button>';
      bar.querySelector('.btn')!.addEventListener('click', () => update(true)); // active la nouvelle version et recharge
      bar.querySelector('.icon')!.addEventListener('click', () => bar.remove());
      document.body.appendChild(bar);
    },
    onOfflineReady() {
      flash('✓ Carte disponible hors-ligne');
    },
  });
}
