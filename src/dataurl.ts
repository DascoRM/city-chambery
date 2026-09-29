/**
 * Adresse d'un fichier de données ou de modèle, avec la version des données (`?v=…`).
 * Le serveur (deploy/nginx.conf) garde ces adresses en cache un an : quand les données changent,
 * la version change, donc l'adresse aussi, et le navigateur recharge le nouveau fichier.
 */
export const dataUrl = (path: string) => `${import.meta.env.BASE_URL}${path}?v=${__DATA_VERSION__}`;
