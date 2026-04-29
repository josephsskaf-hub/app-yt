import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import Home from './pages/Home.jsx';
import Login from './pages/Login.jsx';
import Signup from './pages/Signup.jsx';
import Sell from './pages/Sell.jsx';
import ListingDetail from './pages/ListingDetail.jsx';
import SellerDashboard from './pages/SellerDashboard.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import Subscribe from './pages/Subscribe.jsx';
import Favorites from './pages/Favorites.jsx';
import { useAuth } from './hooks/useAuth.jsx';

function Protected({ children }) {
  const { session, loading } = useAuth();
  if (loading) return <div className="loading">Loading…</div>;
  if (!session) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="listing/:id" element={<ListingDetail />} />
        <Route path="login" element={<Login />} />
        <Route path="signup" element={<Signup />} />
        <Route path="sell" element={<Protected><Sell /></Protected>} />
        <Route path="dashboard" element={<Protected><SellerDashboard /></Protected>} />
        <Route path="admin" element={<Protected><AdminDashboard /></Protected>} />
        <Route path="subscribe" element={<Protected><Subscribe /></Protected>} />
        <Route path="favorites" element={<Protected><Favorites /></Protected>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
