import { Link } from 'react-router-dom';

const fmt = (n, currency = 'USD') => new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n ?? 0);

export default function ListingCard({ listing }) {
  const photo = listing.photos?.[0];
  return (
    <Link to={`/listing/${listing.id}`} className="card">
      <div className="thumb">
        {photo ? <img src={photo} alt={listing.title} loading="lazy" /> : <div style={{ height: '100%', display: 'grid', placeItems: 'center', color: '#666' }}>No photo</div>}
        <div className="badge">{listing.category}</div>
      </div>
      <div className="meta">
        <div className="price">{fmt(listing.price)}</div>
        <div className="title">{listing.title}</div>
        <div className="loc">📍 {listing.location || '—'}</div>
      </div>
    </Link>
  );
}
