import { useQuery } from '@tanstack/react-query';
import { api } from '../api';
import { STATUS_KEY } from '../auth';
import { adminStatusResponse, type DbStatus } from '../../../../contrat/sante.js';

const DB_LABEL: Record<DbStatus, [string, 'ok' | 'warn']> = {
  ok: ['Connectée', 'ok'],
  'non-configuree': ['Non configurée (DATABASE_URL absente)', 'warn'],
  'desactivee-en-previsualisation': ['Désactivée en prévisualisation (DATABASE_URL_PREVIEW absente)', 'warn'],
  erreur: ['Erreur de connexion', 'warn'],
};

const size = (bytes: number) => (bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} Mo` : `${Math.max(1, Math.round(bytes / 1024))} Ko`);

/** Tableau de bord : état de l'application et de la base (EP008-US005). Usage et quotas viendront avec EP008-US008. */
export function Dashboard() {
  // 30 s de fraîcheur : l'état reçu à la connexion n'est pas redemandé aussitôt (chaque lecture interroge la base) ;
  // « Actualiser » relit quand même
  const status = useQuery({ queryKey: STATUS_KEY, queryFn: () => api('GET', '/api/admin/status', { schema: adminStatusResponse }), staleTime: 30_000 });
  const data = status.data;
  const db = data?.db;
  const [label, cls] = db ? (DB_LABEL[db.status] ?? [db.status, 'warn']) : ['', 'warn'];

  return (
    <section>
      <div className="bar">
        <button type="button" onClick={() => void status.refetch()} disabled={status.isFetching}>
          {status.isFetching ? 'Actualisation…' : 'Actualiser'}
        </button>
      </div>
      {status.error && <p className="msg" role="alert">{status.error.message}</p>}
      {data && db && (
        <>
          <div className="card">
            <h2>Application</h2>
            <dl>
              <dt>Version</dt><dd>{data.version}</dd>
              <dt>Environnement</dt><dd>{data.env}</dd>
              <dt>Node.js</dt><dd>{data.node}</dd>
              <dt>Région</dt><dd>{data.region ?? 'locale'}</dd>
            </dl>
          </div>
          <div className="card">
            <h2>Base de données</h2>
            <dl>
              <dt>État</dt><dd className={cls}>{label}</dd>
              {db.status === 'ok' && (
                <>
                  <dt>Taille</dt><dd>{size(db.sizeBytes)}</dd>
                  <dt>Migrations</dt>
                  {db.missing.length
                    ? <dd className="warn">à appliquer : tables absentes {db.missing.join(', ')} (npm run db:migrate)</dd>
                    : <dd className="ok">à jour</dd>}
                </>
              )}
            </dl>
            {db.status === 'ok' && db.tables && (
              <table>
                <thead><tr><th>Table</th><th className="n">Lignes</th></tr></thead>
                <tbody>
                  {db.tables.map((t) => (<tr key={t.name}><td>{t.name}</td><td className="n">{t.rows}</td></tr>))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </section>
  );
}
