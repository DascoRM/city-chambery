import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { eq } from 'drizzle-orm';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { appMeta } from './schema';

/**
 * Test d'intégration de la base SANS Neon, sans Docker, sans réseau : PGlite est un vrai PostgreSQL qui tourne dans le
 * processus de test. Les migrations du dépôt sont rejouées dessus : si elles passent ici, elles sont du SQL PostgreSQL
 * standard (condition pour pouvoir quitter Neon un jour, ADR-001).
 */
const migrationsFolder = fileURLToPath(new URL('./migrations', import.meta.url)); // (et non .pathname : les accents du chemin y sont encodés)

describe('migrations sur un PostgreSQL local (PGlite)', () => {
  it('créent le schéma, sont rejouables et le schéma sert aux requêtes', async () => {
    const client = new PGlite();
    const db = drizzle(client);
    await migrate(db, { migrationsFolder });
    await migrate(db, { migrationsFolder }); // rejouable : rien à refaire, pas d'erreur

    await db.insert(appMeta).values({ key: 'schema', value: '1' });
    await db.insert(appMeta).values({ key: 'schema', value: '2' }).onConflictDoUpdate({ target: appMeta.key, set: { value: '2' } });
    const rows = await db.select().from(appMeta).where(eq(appMeta.key, 'schema'));
    expect(rows).toHaveLength(1);
    expect(rows[0].value).toBe('2');
    expect(rows[0].updatedAt).toBeInstanceOf(Date);
    await client.close();
  });
});
