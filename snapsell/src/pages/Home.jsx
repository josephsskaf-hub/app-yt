import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import ListingCard from '../components/ListingCard.jsx';

const CATEGORIES = ['All', 'Cars', 'Real Estate', 'Electronics', 'Furniture', 'Services', 'Other'];

export default function Home() {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('All');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [location, setLocation] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      let query = supabase
        .from('listings')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(60);

      if (cat !== 'All') query = query.eq('category', cat);
      if (q.trim()) query = query.ilike('title', `%${q.trim()}%`);
      if (minPrice) query = query.gte('price', Number(minPrice));
      if (maxPrice) query = query.lte('price', Number(maxPrice));
      if (location.trim()) query = query.ilike('location', `%${location.trim()}%`);

      const { data, error } = await query;
      if (cancelled) return;
      if (error) console.error(error);
      setItems(data || []);
      setLoading(false);
    };
    const t = setTimeout(run, 200);
    return () => { cancelled = true; clearTimeout(t); };
  }, [q, cat, minPrice, maxPrice, location]);

  const empty = !loading && items.length === 0;

  return (
    <div>
      <div className="search">
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search items, brands, models…"
          inputMode="search"
        />
        <button className="btn secondary" style={{ width: 'auto', padding: '12px 14px' }} onClick={() => setShowFilters(s => !s)}>⚙︎</button>
      </div>

      <div className="cats">
        {CATEGORIES.map(c => (
          <div key={c} className={`cat-chip ${cat === c ? 'active' : ''}`} onClick={() => setCat(c)}>{c}</div>
        ))}
      </div>

      {showFilters && (
        <div className="form" style={{ paddingTop: 0 }}>
          <div className="row2">
            <div className="field"><label>Min price</label><input value={minPrice} onChange={e => setMinPrice(e.target.value)} inputMode="numeric" placeholder="0" /></div>
            <div className="field"><label>Max price</label><input value={maxPrice} onChange={e => setMaxPrice(e.target.value)} inputMode="numeric" placeholder="999999" /></div>
          </div>
          <div className="field"><label>Location</label><input value={location} onChange={e => setLocation(e.target.value)} placeholder="City, state" /></div>
        </div>
      )}

      {loading && <div className="loading">Loading listings…</div>}
      {empty && (
        <div className="empty">
          <div className="big">🔍</div>
          <div>No listings match your filters.</div>
        </div>
      )}

      <div className="grid">
        {items.map(it => <ListingCard key={it.id} listing={it} />)}
      </div>
    </div>
  );
}
