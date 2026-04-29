import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';

export default function Signup() {
  const { signUp } = useAuth();
  const nav = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async e => {
    e.preventDefault();
    setBusy(true); setErr('');
    const { error } = await signUp(email, pw, name);
    setBusy(false);
    if (error) { setErr(error.message); return; }
    nav('/dashboard');
  };

  return (
    <div className="form">
      <div className="auth-hero">
        <h1>Create your account</h1>
        <p>Free for buyers. Sellers pay $5/mo for unlimited listings.</p>
      </div>
      <form onSubmit={submit}>
        <div className="field"><label>Full name</label><input value={name} onChange={e => setName(e.target.value)} required autoComplete="name" /></div>
        <div className="field"><label>Email</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" /></div>
        <div className="field"><label>Password (min 8 chars)</label><input type="password" minLength={8} value={pw} onChange={e => setPw(e.target.value)} required autoComplete="new-password" /></div>
        {err && <div style={{ color: 'var(--bad)', marginBottom: 12, fontSize: 14 }}>{err}</div>}
        <button className="btn" disabled={busy}>{busy ? 'Creating…' : 'Create account'}</button>
      </form>
      <div className="auth-switch">Already have one? <Link to="/login">Sign in</Link></div>
    </div>
  );
}
