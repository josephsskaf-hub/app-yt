# SnapSell

No-commission marketplace. Sellers pay **$5/month** for unlimited listings.
Snap a photo → AI fills the title, description, category and suggested price.
Mobile-first PWA — installable on iPhone & Android home screens, with native camera capture.

## Stack

- **Frontend**: Vite + React + React Router (vanilla JS, no TypeScript)
- **Backend**: Supabase (Postgres + Auth + Storage + Edge Functions)
- **Payments**: Stripe Subscriptions
- **AI**: OpenAI Vision (`gpt-4o-mini`) inside an Edge Function
- **PWA**: vite-plugin-pwa (auto service worker + manifest)

## What ships in this scaffold

- Email/password auth with auto-created `profiles`
- Browse + search + category/price/location filters
- Listing detail with photo gallery, save-to-favorites, contact bar (WhatsApp / Email / Phone)
- Sell flow with native camera capture (`<input capture="environment">`) and AI-drafted listing
- Seller dashboard: status pills, leads count, pause/activate/delete listings
- Admin dashboard: approve / flag / remove listings, list users, list subscriptions
- $5/mo Stripe subscription with Checkout + Customer Portal
- DB trigger that auto-deactivates a seller's listings when their subscription lapses
- Row-level security policies on every table

---

## Setup (~20 min)

### 0. Prerequisites

- Node 18+ and npm
- A Supabase project: <https://supabase.com> (free)
- A Stripe account: <https://stripe.com>
- An OpenAI API key: <https://platform.openai.com/api-keys>
- Supabase CLI: `npm i -g supabase`

### 1. Install + configure

```bash
cd snapsell
npm install
cp .env.example .env.local
```

Open `.env.local` and fill in `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`,
`VITE_STRIPE_PUBLISHABLE_KEY`, `VITE_STRIPE_PRICE_ID`.

### 2. Provision the database

Open your Supabase project → **SQL editor** → New query → paste the contents of
`supabase/schema.sql` → **Run**. This creates all tables, triggers, RLS
policies and the public `listing-photos` storage bucket.

To make yourself an admin, run:

```sql
update profiles set role = 'admin' where email = 'you@example.com';
```

### 3. Set up Stripe

1. Stripe Dashboard → **Products** → New product → Recurring → **$5 USD / month** → Save the **Price ID** (`price_...`).
2. Put it in `.env.local` as `VITE_STRIPE_PRICE_ID`.
3. Get your **Secret key** (`sk_test_...` or `sk_live_...`).
4. Webhooks → Add endpoint → URL: `https://YOUR-PROJECT.functions.supabase.co/stripe-webhook`
   → Events: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed` → save the **Signing secret** (`whsec_...`).

### 4. Deploy Edge Functions

```bash
supabase login
supabase link --project-ref YOUR-PROJECT-REF

# secrets used by the functions
supabase secrets set OPENAI_API_KEY=sk-...
supabase secrets set STRIPE_SECRET_KEY=sk_test_...
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
supabase secrets set STRIPE_PRICE_ID=price_...
supabase secrets set APP_URL=https://YOUR-DOMAIN

# deploy
supabase functions deploy analyze-photo --no-verify-jwt
supabase functions deploy stripe-checkout --no-verify-jwt
supabase functions deploy stripe-webhook --no-verify-jwt
```

> The webhook **must** be `--no-verify-jwt` because Stripe doesn't send a Supabase JWT.

### 5. Run locally

```bash
npm run dev
# open http://localhost:5173
```

### 6. Deploy the frontend

Easiest: **Vercel** or **Netlify**.

```bash
npm run build
# upload `dist/` or push the repo and connect Vercel/Netlify
```

In the host's environment variables, set the same `VITE_*` keys.

---

## "Install on iPhone / Android" (PWA)

1. Open the deployed URL on the phone (must be HTTPS).
2. **iOS Safari**: tap the Share button → *Add to Home Screen*.
3. **Android Chrome**: a banner appears, or menu → *Install app*.
4. The app opens fullscreen, with native camera access in the Sell flow.

To later wrap as a native app for the App Store / Play Store, use [Capacitor](https://capacitorjs.com):

```bash
npm i @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android
npx cap init SnapSell com.snapsell.app
npm run build && npx cap add ios && npx cap add android
npx cap open ios   # opens Xcode
npx cap open android   # opens Android Studio
```

You'll need an **Apple Developer** account ($99/yr) and **Google Play** account ($25 one-time).

---

## Move this to its own GitHub repo

Right now SnapSell lives inside `josephsskaf-hub/app-yt` because the build
environment was restricted to that repo. To move it to a dedicated repo:

```bash
# 1. Create empty repo on github.com named "snapsell" (no README/license)
# 2. Locally:
cd snapsell
git init
git add .
git commit -m "Initial SnapSell scaffold"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/snapsell.git
git push -u origin main
```

---

## Project layout

```
snapsell/
├── index.html
├── package.json
├── vite.config.js              # PWA config
├── .env.example
├── public/
│   ├── favicon.svg
│   ├── icon-192.png            # placeholder — replace with real brand icon
│   └── icon-512.png
├── src/
│   ├── main.jsx
│   ├── App.jsx                 # routes
│   ├── styles.css              # dark theme, mobile-first
│   ├── lib/supabase.js
│   ├── hooks/useAuth.jsx
│   ├── components/
│   │   ├── Layout.jsx          # bottom nav
│   │   └── ListingCard.jsx
│   └── pages/
│       ├── Home.jsx            # browse + search + filters
│       ├── ListingDetail.jsx   # gallery + contact bar
│       ├── Sell.jsx            # camera + AI listing draft
│       ├── Login.jsx
│       ├── Signup.jsx
│       ├── Subscribe.jsx       # Stripe checkout / portal
│       ├── SellerDashboard.jsx
│       ├── AdminDashboard.jsx
│       └── Favorites.jsx
└── supabase/
    ├── schema.sql              # tables, triggers, RLS, storage bucket
    └── functions/
        ├── analyze-photo/      # OpenAI Vision → listing draft
        ├── stripe-checkout/    # Checkout + Billing Portal sessions
        └── stripe-webhook/     # Sync subscription status
```

## Roadmap (next sessions)

- Realtime updates on dashboard (Supabase Realtime)
- Push notifications (web push) on new lead
- Image moderation (OpenAI / Cloudflare AI) before publish
- Saved searches + alerts
- Geo search using PostGIS
- Sponsored listings / boost feature
- App Store + Play Store wrapping via Capacitor
- Replace placeholder PNG icons with real brand assets
