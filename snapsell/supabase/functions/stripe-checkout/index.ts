// Supabase Edge Function: stripe-checkout
// Creates a Stripe Checkout Session for the $5/mo seller plan,
// or a billing-portal session if { portal: true }.
//
// Deploy:
//   supabase functions deploy stripe-checkout --no-verify-jwt
// Secrets:
//   supabase secrets set STRIPE_SECRET_KEY=sk_test_...
//   supabase secrets set STRIPE_PRICE_ID=price_...
//   supabase secrets set APP_URL=https://your-domain.com

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const STRIPE_SECRET = Deno.env.get('STRIPE_SECRET_KEY')!;
const PRICE_ID = Deno.env.get('STRIPE_PRICE_ID')!;
const APP_URL = Deno.env.get('APP_URL') || 'http://localhost:5173';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const stripe = async (path: string, params: Record<string, string>) => {
  const body = new URLSearchParams(params).toString();
  const r = await fetch(`https://api.stripe.com/v1${path}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${STRIPE_SECRET}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body
  });
  if (!r.ok) throw new Error(`Stripe ${path} ${r.status}: ${await r.text()}`);
  return r.json();
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const auth = req.headers.get('Authorization');
    if (!auth) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: cors });

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supa = createClient(supabaseUrl, supabaseServiceRole);
    const supaUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });

    const { data: { user }, error: userErr } = await supaUser.auth.getUser();
    if (userErr || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: cors });

    const { return_url, portal } = await req.json().catch(() => ({}));
    const successUrl = return_url || `${APP_URL}/dashboard`;

    // Find or create Stripe customer
    const { data: subRow } = await supa.from('subscriptions').select('*').eq('user_id', user.id).maybeSingle();
    let customerId = subRow?.stripe_customer_id as string | undefined;
    if (!customerId) {
      const cust = await stripe('/customers', { email: user.email || '', 'metadata[user_id]': user.id });
      customerId = cust.id;
      await supa.from('subscriptions').upsert({ user_id: user.id, stripe_customer_id: customerId, status: subRow?.status || 'none' }, { onConflict: 'user_id' });
    }

    if (portal) {
      const session = await stripe('/billing_portal/sessions', {
        customer: customerId!,
        return_url: successUrl
      });
      return new Response(JSON.stringify({ url: session.url }), { headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    const session = await stripe('/checkout/sessions', {
      mode: 'subscription',
      customer: customerId!,
      'line_items[0][price]': PRICE_ID,
      'line_items[0][quantity]': '1',
      success_url: `${successUrl}?sub=success`,
      cancel_url: `${APP_URL}/subscribe?sub=cancel`,
      'subscription_data[metadata][user_id]': user.id,
      allow_promotion_codes: 'true'
    });

    return new Response(JSON.stringify({ url: session.url }), { headers: { ...cors, 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
});
