# Cloth Store — Online Clothing Shop + Admin Panel

A complete clothing storefront with a separate login-protected admin panel, built to run
entirely on **Cloudflare's free tier** with **Razorpay (UPI)** payments.

```
Storefront  →  https://your-project.pages.dev          (Home, Shop, Product, Cart, Checkout)
Admin panel →  https://your-project.pages.dev/admin/   (separate design, password login)
```

## Stack

| Layer      | Tech                                       | Free tier                          |
|------------|--------------------------------------------|------------------------------------|
| Frontend   | Static HTML/CSS/JS (no framework)          | Cloudflare Pages — unlimited       |
| Backend    | Cloudflare Pages Functions                 | ~100k requests/day                 |
| Database   | Cloudflare D1 (SQLite)                     | 5 GB storage, 5M rows read/day     |
| Images     | Cloudflare R2 + `/media/*` route           | 10 GB storage                      |
| Payments   | Razorpay Checkout (UPI, cards, netbanking) | Pay per successful transaction     |

## What's inside

```
public/               Storefront (static site)
  index.html          Home — hero, featured products, categories
  shop.html           Catalog with category filters + search
  product.html        Product detail (?slug=...)
  cart.html           Cart page
  checkout.html       Delivery form + Razorpay payment
  order-success.html  Confirmation page
  admin/              Admin panel (separate look & feel)
  assets/p/           29 generated placeholder product SVGs
  js/                 store.js (shared), home.js, shop.js, product.js, cart.js, checkout.js
functions/            Pages Functions (API)
  api/products.js     GET  /api/products  (?category= ?q= ?slug= ?featured=1)
  api/config.js       GET  /api/config    (brand, announcement, hero…)
  api/create-order.js POST /api/create-order  (server-side price check → Razorpay order)
  api/verify-payment.js POST /api/verify-payment (HMAC signature check → save order → stock−)
  api/login|logout|me.js Admin auth (signed HMAC cookie)
  api/admin/[[path]].js  Admin CRUD: products, orders, settings, upload (auth-gated)
  media/[[key]].js    GET /media/* (serves uploaded images from R2)
schema.sql            D1 schema + 29 sample products + default settings
wrangler.toml         Cloudflare config (D1 + R2 bindings)
scripts/gen-assets.js Regenerates the placeholder SVGs
```

---

## 1. One-time setup (~15 minutes)

You need **Node.js 18+** and a free **Cloudflare** account. Create a Razorpay account when
you reach the payments step.

```bash
npm install
npx wrangler login          # opens browser, authorize Cloudflare
```

### 1.1 Create the database and image bucket

```bash
npx wrangler d1 create cloth-store-db
npx wrangler r2 bucket create cloth-store-images
```

Copy the `database_id` printed by the first command into `wrangler.toml`
(replace `REPLACE_WITH_D1_DATABASE_ID`).

### 1.2 Load the schema + sample products

```bash
npm run db:setup
```

This creates the tables and seeds 29 sample products. Re-running it resets the catalog to
the samples (orders and settings are kept).

### 1.3 Set your secrets

Run each command and paste the value when prompted:

```bash
npx wrangler pages secret put ADMIN_PASSWORD --project-name cloth-store   # your admin login password
npx wrangler pages secret put AUTH_SECRET    --project-name cloth-store   # any long random string
npx wrangler pages secret put RAZORPAY_KEY_ID     --project-name cloth-store
npx wrangler pages secret put RAZORPAY_KEY_SECRET --project-name cloth-store
```

Generate a random string for `AUTH_SECRET` with: `openssl rand -hex 32`

### 1.4 Razorpay keys

1. Sign up at <https://razorpay.com> (test mode is free).
2. Dashboard → **Settings → API Keys → Generate Test Key**.
3. Use the **test** Key Id / Secret in step 1.3. Test UPI payments work in test mode.
4. Before going live, generate **live** keys (requires KYC) and update the two secrets.

### 1.5 Deploy

```bash
npm run deploy
```

First deploy creates the Pages project `cloth-store` at `https://cloth-store.pages.dev`.

### 1.6 Local development

```bash
npm run dev      # http://localhost:8788  (D1 + R2 run locally, no secrets needed)
```

---

## 2. Adding and updating products (no code)

Open `https://your-site.pages.dev/admin/`, log in with your admin password.

- **Products → Add product**: name, price (₹), category, sizes, colors, stock, description,
  featured toggle, image upload (stored in R2, max 5 MB).
- Edits appear on the storefront **immediately** — the site reads from the database, no
  redeploy needed.
- **Orders**: every paid order shows the customer, items, amount and payment id. Update
  status as you fulfil: `paid → shipped → delivered`.
- **Settings**: brand name, announcement bar text, hero headline/subtitle, support phone,
  footer text.

To load the sample catalog again at any time: `npm run db:setup`.

---

## 3. How checkout works

```
Cart → POST /api/create-order
        • server looks up every slug in D1 and recomputes the total (client prices ignored)
        • rejects out-of-stock items
        • creates a Razorpay order, stores a pending order row (status: created)
     → Razorpay Checkout opens (UPI / card / netbanking)
     → POST /api/verify-payment
        • verifies HMAC-SHA256 signature with RAZORPAY_KEY_SECRET
        • marks order paid, saves payment id
        • decrements product stock (idempotent — safe to call twice)
     → order-success.html?order_id=ORD-…
```

---

## 4. Notes & limits

- **Amounts are stored in paise** (₹799.00 = `79900`) to avoid float errors.
- **Admin session**: signed HMAC cookie (`HttpOnly`, `SameSite=Lax`), valid 7 days.
  `/api/admin/*` is auth-gated on every request; the storefront has no write access.
- **Stock is not reserved** during checkout — final availability is enforced server-side
  in `create-order`, so you can never oversell below 0 via the decrement guard.
- **Webhooks** (optional hardening): client-side verification is standard for small stores;
  if you want server-guaranteed payment events, add a Razorpay webhook that calls
  `/api/verify-payment`-style logic. Ping me when you need it.
- **Secure cookie**: automatically set when the site is served over HTTPS (pages.dev is
  always HTTPS; local dev works over HTTP too).
- **Custom domain**: Cloudflare Pages → your project → *Custom domains* → add a domain
  from your Cloudflare DNS zone (free SSL included).

## 5. Useful commands

```bash
npm run dev                                  # local dev with local D1/R2
npm run deploy                               # deploy site + functions
npm run db:setup                             # apply schema + reset sample catalog
npm test                                     # local end-to-end test suite (44 checks)
npx wrangler pages secret put NAME           # set/update a secret
npx wrangler d1 execute cloth-store-db --remote --command "SELECT count(*) FROM orders"
npx wrangler tail --project-name cloth-store # stream live function logs
```

## 6. Troubleshooting

| Symptom | Fix |
|---|---|
| `Payments are not configured yet` at checkout | Set `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` secrets, redeploy |
| Admin login always fails | `ADMIN_PASSWORD` secret missing — set it and redeploy |
| `R2 is not configured` on image upload | Create the bucket (step 1.1) and check `wrangler.toml` |
| Products page empty | Run `npm run db:setup` and confirm `database_id` in `wrangler.toml` |
| Razorpay checkout doesn't open | You're likely using a test key id with a live-mode secret (or vice versa) |
