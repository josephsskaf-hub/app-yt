import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../hooks/useAuth.jsx';
import ListingCard from '../components/ListingCard.jsx';

export default function Favorites() {
  const { session } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session) return;
    (async () => {
      const { data } = await supabase
        .from('favorites')
        .select('listing_id, listings(*)')
        .eq('user_id', session.user.id);
      setItems((data || []).map(r => r.listings).filter(Boolean));
      setLoading(false);
    })();
  }, [session]);

  if (loading) return <div className="loading">Loading…</div>;
  if (!items.length) return <div className="empty"><div className="big">❤️</div><div>No favorites yet. Tap the heart on any listing to save it.</div></div>;

  return (
    <div className="grid" style={{ paddingTop: 16 }}>
      {items.map(it => <ListingCard key={it.id} listing={it} />)}
    </div>
  );
}
