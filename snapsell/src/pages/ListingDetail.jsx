import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../hooks/useAuth.jsx';

const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n ?? 0);

export default function ListingDetail() {
  const { id } = useParams();
  const { session } = useAuth();
  const [it, setIt] = useState(null);
  const [photoIdx, setPhotoIdx] = useState(0);
  const [fav, setFav] = useState(false);
  const [seller, setSeller] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from('listings').select('*').eq('id', id).maybeSingle();
      if (cancelled) return;
      setIt(data);
      if (data?.seller_id) {
        const { data: s } = await supabase.from('profiles').select('full_name, phone, whatsapp, email').eq('id', data.seller_id).maybeSingle();
        if (!cancelled) setSeller(s);
        // Log a lead view
        if (session?.user?.id && session.user.id !== data.seller_id) {
          await supabase.from('leads').insert({ listing_id: id, buyer_id: session.user.id, kind: 'view' });
        }
      }
    })();
    return () => { cancelled = true; };
  }, [id, session]);

  useEffect(() => {
    if (!session || !id) return;
    supabase.from('favorites').select('listing_id').eq('user_id', session.user.id).eq('listing_id', id).maybeSingle()
      .then(({ data }) => setFav(!!data));
  }, [session, id]);

  const toggleFav = async () => {
    if (!session) return;
    if (fav) {
      await supabase.from('favorites').delete().eq('user_id', session.user.id).eq('listing_id', id);
      setFav(false);
    } else {
      await supabase.from('favorites').insert({ user_id: session.user.id, listing_id: id });
      setFav(true);
    }
  };

  const logLead = async (kind) => {
    if (!session?.user?.id || !it) return;
    if (session.user.id === it.seller_id) return;
    await supabase.from('leads').insert({ listing_id: id, buyer_id: session.user.id, kind });
  };

  if (!it) return <div className="loading">Loading…</div>;
  const photos = it.photos || [];
  const wa = seller?.whatsapp ? `https://wa.me/${seller.whatsapp.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Hi! I'm interested in: ${it.title} on SnapSell.`)}` : null;

  return (
    <div className="detail">
      <div className="gallery">
        {photos[photoIdx] ? <img src={photos[photoIdx]} alt={it.title} /> : <div className="empty">No photo</div>}
        {photos.length > 1 && (
          <>
            <div className="nav-dots">
              {photos.map((_, i) => <span key={i} className={i === photoIdx ? 'active' : ''} />)}
            </div>
            <div style={{ position: 'absolute', inset: 0, display: 'flex' }} aria-hidden>
              <div onClick={() => setPhotoIdx(Math.max(0, photoIdx - 1))} style={{ flex: 1 }} />
              <div onClick={() => setPhotoIdx(Math.min(photos.length - 1, photoIdx + 1))} style={{ flex: 1 }} />
            </div>
          </>
        )}
      </div>

      <div className="detail-body">
        <div className="row-between">
          <div className="price-big">{fmt(it.price)}</div>
          <button className="btn ghost" style={{ width: 'auto', padding: '8px 14px' }} onClick={toggleFav}>{fav ? '❤️ Saved' : '🤍 Save'}</button>
        </div>
        <h1>{it.title}</h1>
        <div className="muted" style={{ fontSize: 13 }}>
          📍 {it.location || '—'} · {it.category} · Listed {new Date(it.created_at).toLocaleDateString()}
        </div>
        <div className="spacer" />
        <p style={{ whiteSpace: 'pre-wrap' }}>{it.description}</p>

        <div className="section" style={{ padding: 0, marginTop: 16 }}>
          <h2>Seller</h2>
          <div className="kv"><span className="k">Name</span><span>{seller?.full_name || 'Verified seller'}</span></div>
        </div>
      </div>

      <div className="contact-bar">
        {wa
          ? <a className="wa" href={wa} target="_blank" rel="noreferrer" onClick={() => logLead('whatsapp')}>WhatsApp</a>
          : <a className="wa" style={{ opacity: 0.4, pointerEvents: 'none' }}>WhatsApp</a>}
        {seller?.email
          ? <a className="email" href={`mailto:${seller.email}?subject=${encodeURIComponent(it.title)}`} onClick={() => logLead('email')}>Email</a>
          : <a className="email" style={{ opacity: 0.4, pointerEvents: 'none' }}>Email</a>}
        {seller?.phone
          ? <a className="phone" href={`tel:${seller.phone}`} onClick={() => logLead('phone')}>Call</a>
          : <a className="phone" style={{ opacity: 0.4, pointerEvents: 'none' }}>Call</a>}
      </div>

      {!session && (
        <div className="modal-back" onClick={() => null}>
          <div className="modal">
            <h2>Sign in to contact seller</h2>
            <p className="muted">Buyers chat directly with sellers — free, no commission.</p>
            <Link to="/login" className="btn" style={{ marginTop: 12 }}>Sign in</Link>
            <Link to="/signup" className="btn ghost" style={{ marginTop: 8 }}>Create free account</Link>
          </div>
        </div>
      )}
    </div>
  );
}
