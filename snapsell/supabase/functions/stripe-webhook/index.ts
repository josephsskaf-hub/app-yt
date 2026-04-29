// Supabase Edge Function: stripe-webhook
// Receives Stripe events and syncs subscription status into the DB.
//
// Deploy:
//   supabase functions deploy stripe-webhook --no-verify-jwt
// Secrets:
//   supabase secrets set STRIPE_SECRET_KEY=sk_...
//   supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
//
// Configure the webhook endpoint in Stripe dashboard:
//   https://YOUR-PROJECT.functions.supabase.co/stripe-webhook
// Subscribe to: checkout.session.completed, customer.subscription.created,
// customer.subscription.updated, customer.subscription.deleted, invoice.payment_failed.

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const STRIPE_SECRET = Deno.env.get('STRIPE_SECRET_KEY')!;
const WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;

// Minimal Stripe signature verification (HMAC-SHA256, scheme v1)
async function verifyStripe(payload: string, sigHeader: string | null): Promise<boolean> {
  if (!sigHeader) return false;
  const parts = Object.fromEntries(sigHeader.split(',').map(s => s.split('=')));
  const t = parts['t']; const v1 = parts['v1'];
  if (!t || !v1) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(WEBHOOK_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(`${t}.${payload}`));
  const hex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
  return hex === v1;
}

async function fetchSubscription(id: string) {
  const r = await fetch(`https://api.stripe.com/v1/subscriptions/${id}`, {
    headers: { 'Authorization': `Bearer ${STRIPE_SECRET}` }
  });
  return r.json();
}

serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const raw = await req.text();
  const ok = await verifyStripe(raw, req.headers.get('Stripe-Signature'));
  if (!ok) return new Response('Invalid signature', { status: 400 });

  const event = JSON.parse(raw);
  const supa = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const handleSub = async (sub: any) => {
    const userId = sub.metadata?.user_id;
    if (!userId) {
      // Fallback: lookup by customer
      const { data } = await supa.from('subscriptions').select('user_id').eq('stripe_customer_id', sub.customer).maybeSingle();
      if (!data) return;
      sub.metadata = { user_id: data.user_id };
    }
    const periodEnd = sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null;
    await supa.from('subscriptions').upsert({
      user_id: sub.metadata.user_id,
      stripe_customer_id: sub.customer,
      stripe_subscription_id: sub.id,
      status: sub.status,
      current_period_end: periodEnd,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' });
  };

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        if (session.subscription) {
          const sub = await fetchSubscription(session.subscription);
          if (!sub.metadata?.user_id && session.metadata?.user_id) sub.metadata = { user_id: session.metadata.user_id };
          await handleSub(sub);
        }
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
      case 'invoice.payment_failed': {
        const sub = event.data.object.object === 'subscription' ? event.data.object : await fetchSubscription(event.data.object.subscription);
        await handleSub(sub);
        break;
      }
    }
    return new Response('ok');
  } catch (err) {
    console.error(err);
    return new Response('error: ' + String(err), { status: 500 });
  }
});
