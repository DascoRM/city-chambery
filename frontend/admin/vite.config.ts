import { defineConfig, type Plugin } from 'vite';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('.', import.meta.url));

/**
 * Politique de contenu de l'administration. Elle est aussi envoyée en en-tête par Vercel (vercel.json, avec
 * `frame-ancestors 'none'`, qui n'est valable qu'en en-tête) ; la balise ci-dessous la garde partout ailleurs (vite preview,
 * tout serveur statique). Seulement au build : en dev, Vite injecte des <style> que `style-src 'self'` bloquerait.
 */
export const CSP = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'";

function cspMeta(): Plugin {
  return {
    name: 'admin-csp-meta',
    apply: 'build',
    transformIndexHtml: () => [{ tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP }, injectTo: 'head-prepend' }],
  };
}

/**
 * Administration (EP010) : application React servie sous /admin/. Construite APRÈS la carte, dans dist/admin/ : le service
 * worker de la carte, généré pendant son build, ne la connaît donc pas. Pas de plugin React (conflit de versions de Babel avec
 * vite-plugin-pwa) : Vite compile le JSX lui-même ; seul le « Fast Refresh » manque en dev (la page se recharge).
 *
 * En dev : `npm run dev:admin` (http://localhost:5174/admin/), avec l'API (`npm run api:dev`) et la carte (`npm run dev`,
 * port 5173) qui sert /data/city.json, comme en production où tout est à la même adresse.
 */
export default defineConfig({
  root: ROOT,
  base: '/admin/',
  publicDir: false,
  oxc: { jsx: { runtime: 'automatic' } },
  plugins: [cspMeta()],
  server: {
    port: 5174,
    strictPort: true,
    proxy: { '/api': 'http://localhost:8787', '/data': 'http://localhost:5173' },
  },
  build: {
    outDir: resolve(ROOT, '../../dist/admin'),
    emptyOutDir: true, // dist/admin/ est hors de la racine de l'admin : Vite ne le vide pas sans cette option
    rolldownOptions: {
      // « use client » (TanStack Query) ne sert qu'au rendu côté serveur de React, que l'admin n'utilise pas
      onwarn(warning, warn) {
        if (warning.code !== 'MODULE_LEVEL_DIRECTIVE') warn(warning);
      },
    },
  },
});
