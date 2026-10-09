import { useState, type FormEvent } from 'react';
import { useAuth } from '../auth';

/** Connexion par le jeton d'administration (ADMIN_TOKEN, variable Vercel). Le champ est vidé à chaque essai. */
export function Login() {
  const { login, notice } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const field = e.currentTarget.elements.namedItem('token') as HTMLInputElement;
    const token = field.value.trim(); // un jeton collé depuis le terminal garde souvent un retour à la ligne
    field.value = '';
    if (!token) return;
    setBusy(true);
    setError('');
    try {
      await login(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card" autoComplete="off" onSubmit={onSubmit}>
      <label htmlFor="token">Jeton d'administration</label>
      <input id="token" name="token" type="password" autoComplete="off" spellCheck={false} required />
      <button type="submit" disabled={busy}>{busy ? 'Connexion…' : 'Se connecter'}</button>
      <p className="msg" role="alert">{error || notice}</p>
    </form>
  );
}
