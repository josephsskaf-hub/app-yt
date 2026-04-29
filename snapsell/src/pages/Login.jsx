import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';

export default function Login() {
  const { signIn } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async e => {
    e.preventDefault();
    setBusy(true); setErr('');
    const { error } = await signIn(email, pw);
    setBusy(false);
    if (error) { setErr(error.message); return; }
    nav('/dashboard');
  };

  return (
    <div className="form">
      <div className="auth-hero">
        <h1>Welcome back</h1>
        <p>Log in to manage your listings.</p>
      </div>
      <form onSubmit={submit}>
        <div className="field"><label>Email</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" /></div>
        <div className="field"><label>Password</label><input type="password" value={pw} onChange={e => setPw(e.target.value)} required autoComplete="current-password" /></div>
        {err && <div style={{ color: 'var(--bad)', marginBottom: 12, fontSize: 14 }}>{err}</div>}
        <button className="btn" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
      <div className="auth-switch">No account? <Link to="/signup">Create one</Link></div>
    </div>
  );
}
