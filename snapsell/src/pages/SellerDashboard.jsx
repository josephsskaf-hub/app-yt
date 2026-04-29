import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../hooks/useAuth.jsx';

const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n ?? 0);

export default function SellerDashboard() {
  const { session, profile, signOut } = useAuth();
  const nav = useNavigate();
  const [listings, setListings] = useState([]);
  const [leadsByListing, setLeadsByListing] = useState({});
  const [sub, setSub] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!session) return;
    setLoading(true);
    const [{ data: ls }, { data: lds }, { data: s }] = await Promise.all([
      supabase.from('listings').select('*').eq('seller_id', session.user.id).order('created_at', { ascending: false }),
      supabase.from('leads').select('listing_id, kind').in('kind', ['whatsapp', 'email', 'phone']),
      supabase.from('subscriptions').select('*').eq('user_id', session.user.id).maybeSingle()
    ]);
    setListings(ls || []);
    const map = {};
    (lds || []).forEach(l => { map[l.listing_id] = (map[l.listing_id] || 0) + 1; });
    setLeadsByListing(map);
    setSub(s);
    setLoading(false);
  };

  useEffect(() => { load(); }, [session]);

  const toggleStatus = async (l) => {
    const next = l.status === 'active' ? 'inactive' : 'active';
    await supabase.from('listings').update({ status: next }).eq('id', l.id);
    load();
  };
  const remove = async (l) => {
    if (!confirm('Delete this listing?')) return;
    await supabase.from('listings').delete().eq('id', l.id);
    load();
  };

  const subStatus = sub?.status || 'none';
  const subClass = subStatus === 'active' || subStatus === 'trialing' ? 'active' : (subStatus === 'past_due' || subStatus === 'unpaid' ? 'pending' : 'inactive');

  if (loading) return <div className="loading">Loading…</div>;

  return (
    <div className="section">
      <div className="row-between">
        <h2 style={{ margin: 0 }}>Your dashboard</h2>
        <button className="btn ghost" style={{ width: 'auto', padding: '8px 14px', fontSize: 13 }} onClick={async () => { await signOut(); nav('/'); }}>Sign out</button>
      </div>
      <div className="spacer" />

      <div className="card" style={{ padding: 14 }}>
        <div className="row-between">
          <div>
            <div className="muted" style={{ fontSize: 12 }}>Subscription</div>
            <div style={{ fontWeight: 800, fontSize: 18 }}>$5 / month</div>
          </div>
          <span className={`status-pill ${subClass}`}>{subStatus}</span>
        </div>
        <div className="spacer" />
        <Link to="/subscribe" className="btn secondary">Manage plan</Link>
      </div>

      <div className="spacer" />
      <div className="row-between">
        <h2 style={{ margin: 0 }}>Your listings</h2>
        <Link to="/sell" className="btn" style={{ width: 'auto', padding: '8px 14px', fontSize: 13 }}>+ New</Link>
      </div>
      <div className="spacer" />

      {listings.length === 0 && <div className="empty"><div className="big">📦</div><div>No listings yet. Tap Sell to create one.</div></div>}

      {listings.map(l => (
        <div key={l.id} className="card" style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: 12, padding: 10, marginBottom: 10 }}>
          <div className="thumb" style={{ width: 80, height: 80, borderRadius: 10, overflow: 'hidden', background: 'var(--card-2)' }}>
            {l.photos?.[0] && <img src={l.photos[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>{l.category} · {fmt(l.price)}</div>
            <div style={{ fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.title}</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>
              <span className={`status-pill ${l.status === 'active' ? 'active' : 'inactive'}`}>{l.status}</span>
              <span className="muted" style={{ marginLeft: 8 }}>· {leadsByListing[l.id] || 0} leads</span>
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
              <Link to={`/listing/${l.id}`} className="btn secondary" style={{ width: 'auto', padding: '6px 10px', fontSize: 12 }}>View</Link>
              <button className="btn secondary" style={{ width: 'auto', padding: '6px 10px', fontSize: 12 }} onClick={() => toggleStatus(l)}>
                {l.status === 'active' ? 'Pause' : 'Activate'}
              </button>
              <button className="btn danger" style={{ width: 'auto', padding: '6px 10px', fontSize: 12 }} onClick={() => remove(l)}>Delete</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
