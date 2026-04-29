import { NavLink, Outlet, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';

export default function Layout() {
  const { session, profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  return (
    <div className="app">
      <header className="topbar">
        <Link to="/" className="brand">
          <div className="logo">S</div>
          SnapSell
        </Link>
        {session ? (
          <Link to="/dashboard" className="status-pill">
            {profile?.full_name?.split(' ')[0] || 'Account'}
          </Link>
        ) : (
          <Link to="/login" className="btn ghost" style={{ width: 'auto', padding: '8px 14px', fontSize: 13 }}>Sign in</Link>
        )}
      </header>

      <Outlet />

      <nav className="bottom-nav">
        <NavLink to="/" end><span className="ico">🏠</span>Browse</NavLink>
        <NavLink to="/favorites"><span className="ico">❤️</span>Saved</NavLink>
        <NavLink to="/sell" className="sell-btn"><span className="ico">📷</span>Sell</NavLink>
        <NavLink to="/dashboard"><span className="ico">📊</span>Mine</NavLink>
        <NavLink to={isAdmin ? '/admin' : '/subscribe'}>
          <span className="ico">{isAdmin ? '🛡️' : '⚡'}</span>{isAdmin ? 'Admin' : 'Plan'}
        </NavLink>
      </nav>
    </div>
  );
}
