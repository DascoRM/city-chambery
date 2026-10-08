/**
 * Statistiques de la base pour l'administration : taille et nombre de lignes par table. Ne dépend d'aucun pilote : on lui
 * passe une fonction qui exécute une requête SQL et renvoie des lignes (postgres.js en production, PGlite dans les tests).
 */
export type Rows = Record<string, unknown>[];
export type RunSql = (text: string) => Promise<Rows>;

const quote = (name: string) => `"${name.replaceAll('"', '""')}"`;

export interface DbStats {
  sizeBytes: number;
  tables: { name: string; rows: number }[];
}

export async function dbStats(run: RunSql): Promise<DbStats> {
  const [size] = await run('select pg_database_size(current_database())::bigint as bytes');
  const names = await run("select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by table_name");
  const tables = [];
  for (const { table_name } of names) {
    const [row] = await run(`select count(*)::bigint as n from public.${quote(String(table_name))}`);
    tables.push({ name: String(table_name), rows: Number(row.n) });
  }
  return { sizeBytes: Number(size.bytes), tables };
}
