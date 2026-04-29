import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../hooks/useAuth.jsx';

export default function Subscribe() {
  const { session } = useAuth();
  const [sub, setSub] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!session) return;
    supabase.from('subscriptions').select('*').eq('user_id', session.user.id).maybeSingle()
      .then(({ data }) => setSub(data));
  }, [session]);

  const startCheckout = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('stripe-checkout', {
        body: { return_url: window.location.origin + '/dashboard' }
      });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (err) {
      alert('Could not start checkout: ' + err.message);
    } finally {
      setBusy(false);
    }
  };

  const openPortal = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('stripe-checkout', {
        body: { portal: true, return_url: window.location.origin + '/dashboard' }
      });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } finally {
      setBusy(false);
    }
  };

  const active = sub?.status === 'active' || sub?.status === 'trialing';

  return (
    <div className="section" style={{ maxWidth: 480, margin: '0 auto' }}>
      <div className="card" style={{ padding: 22, textAlign: 'center' }}>
        <div style={{ fontSize: 14, color: 'var(--muted)' }}>Seller plan</div>
        <div style={{ fontSize: 44, fontWeight: 900, margin: '6px 0' }}>$5<span style={{ fontSize: 16, color: 'var(--muted)', fontWeight: 600 }}>/month</span></div>
        <div style={{ color: 'var(--muted)', marginBottom: 16 }}>Unlimited listings · No commission · Cancel anytime</div>
        <ul style={{ textAlign: 'left', padding: 0, listStyle: 'none', margin: '0 0 18px' }}>
          {[
            'Unlimited active listings',
            'AI photo → instant listing',
            'Direct buyer contact (no fees)',
            'Lead tracking dashboard',
            'Cancel anytime'
          ].map(b => <li key={b} style={{ padding: '6px 0', fontSize: 14 }}>✅ {b}</li>)}
        </ul>
        {active
          ? <button className="btn" disabled={busy} onClick={openPortal}>Manage subscription</button>
          : <button className="btn" disabled={busy} onClick={startCheckout}>{busy ? 'Loading…' : 'Activate $5/mo plan'}</button>}
        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 10 }}>Secured by Stripe. We never store card details.</div>
      </div>
    </div>
  );
}
