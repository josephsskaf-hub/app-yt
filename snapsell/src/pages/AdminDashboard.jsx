import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../hooks/useAuth.jsx';

const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n ?? 0);

export default function AdminDashboard() {
  const { profile, loading } = useAuth();
  const [tab, setTab] = useState('listings');
  const [listings, setListings] = useState([]);
  const [users, setUsers] = useState([]);
  const [subs, setSubs] = useState([]);

  const load = async () => {
    if (tab === 'listings') {
      const { data } = await supabase.from('listings').select('*').order('created_at', { ascending: false }).limit(200);
      setListings(data || []);
    } else if (tab === 'users') {
      const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(200);
      setUsers(data || []);
    } else if (tab === 'subs') {
      const { data } = await supabase.from('subscriptions').select('*, profiles(full_name, email)').order('created_at', { ascending: false }).limit(200);
      setSubs(data || []);
    }
  };

  useEffect(() => { if (profile?.role === 'admin') load(); }, [tab, profile]);

  if (loading) return <div className="loading">Loading…</div>;
  if (!profile || profile.role !== 'admin') return <Navigate to="/" replace />;

  const removeListing = async (id) => {
    if (!confirm('Remove this listing?')) return;
    await supabase.from('listings').update({ status: 'removed' }).eq('id', id);
    load();
  };
  const flagListing = async (id) => {
    await supabase.from('listings').update({ status: 'flagged' }).eq('id', id);
    load();
  };
  const approveListing = async (id) => {
    await supabase.from('listings').update({ status: 'active' }).eq('id', id);
    load();
  };

  return (
    <div className="section">
      <h2>Admin</h2>
      <div className="cats" style={{ padding: 0, marginBottom: 12 }}>
        {[['listings', 'Listings'], ['users', 'Users'], ['subs', 'Subscriptions']].map(([k, label]) => (
          <div key={k} className={`cat-chip ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>{label}</div>
        ))}
      </div>

      {tab === 'listings' && listings.map(l => (
        <div key={l.id} className="card" style={{ padding: 12, marginBottom: 10 }}>
          <div style={{ fontWeight: 700 }}>{l.title}</div>
          <div className="muted" style={{ fontSize: 12 }}>{l.category} · {fmt(l.price)} · {l.status}</div>
          <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
            <button className="btn success" style={{ width: 'auto', padding: '6px 10px', fontSize: 12 }} onClick={() => approveListing(l.id)}>Approve</button>
            <button className="btn secondary" style={{ width: 'auto', padding: '6px 10px', fontSize: 12 }} onClick={() => flagListing(l.id)}>Flag</button>
            <button className="btn danger" style={{ width: 'auto', padding: '6px 10px', fontSize: 12 }} onClick={() => removeListing(l.id)}>Remove</button>
          </div>
        </div>
      ))}

      {tab === 'users' && users.map(u => (
        <div key={u.id} className="card" style={{ padding: 12, marginBottom: 10 }}>
          <div style={{ fontWeight: 700 }}>{u.full_name || '—'}</div>
          <div className="muted" style={{ fontSize: 12 }}>{u.email} · role: {u.role || 'user'}</div>
        </div>
      ))}

      {tab === 'subs' && subs.map(s => (
        <div key={s.id} className="card" style={{ padding: 12, marginBottom: 10 }}>
          <div style={{ fontWeight: 700 }}>{s.profiles?.full_name || s.user_id}</div>
          <div className="muted" style={{ fontSize: 12 }}>{s.profiles?.email} · status: {s.status}</div>
        </div>
      ))}
    </div>
  );
}
