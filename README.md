# Shopline Blind Box App

A Shopline app that lets merchants sell mystery/blind box products where customers discover which item they received only after purchase.

---

## Architecture

```
┌─────────────────────┐     Theme App Extension      ┌──────────────────────┐
│  Shopline Storefront│ ──── blindbox.js/css ──────►  │  Shopline CDN        │
│  (Merchant Theme)   │                               │  (after sl push)     │
└──────────┬──────────┘                               └──────────────────────┘
           │ fetch /api/public/*
           │ fetch /api/reveal/*
           ▼
┌──────────────────────────────────────────────────────────────────┐
│                     Node.js + Express API                        │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────┐  │
│  │ /api/public  │  │ /api/reveal  │  │ /api/admin            │  │
│  │ /api/webhook │  │              │  │ /api/shopline (OAuth) │  │
│  └──────────────┘  └──────────────┘  └───────────────────────┘  │
│            │                                     │               │
│            ▼                                     ▼               │
│  ┌─────────────────────┐            ┌────────────────────────┐   │
│  │  BullMQ Worker      │            │  Winston + Sentry      │   │
│  │  (assign-item job)  │            │  (logging + errors)    │   │
│  └──────────┬──────────┘            └────────────────────────┘   │
│             │                                                     │
└─────────────┼───────────────────────────────────────────────────-┘
              │                              │
              ▼                              ▼
┌─────────────────────┐          ┌────────────────────┐
│    PostgreSQL        │          │       Redis         │
│    (Supabase)        │          │  (BullMQ queues)   │
│  - BlindBox          │          └────────────────────┘
│  - BlindBoxItem      │
│  - BlindBoxOrder     │
│  - ShoplineStore     │
└─────────────────────┘
```

---

## Prerequisites

- **Node.js** 18+
- **PostgreSQL** (Supabase recommended)
- **Redis** (Upstash or local)
- **Shopline CLI**: `npm install -g @shopline/cli` — provides the `sl` command

---

## Setup

```bash
# 1. Clone the repo
git clone <repo-url>
cd shopline-blind-box

# 2. Copy environment variables
cp .env.example .env

# 3. Fill in .env (see Environment Variables section below)

# 4. Install root dependencies
npm install

# 5. Install storefront build dependencies
cd storefront-src && npm install && cd ..

# 6. Install admin dependencies
cd admin && npm install && cd ..

# 7. Run database migrations
npm run migrate

# 8. Build the storefront widget
npm run build:widget

# 9. Start the development server
npm run dev
```

---

## Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (e.g. `postgresql://...`) |
| `REDIS_URL` | Redis connection URL (e.g. `redis://localhost:6379`) |
| `ADMIN_API_KEY` | Secret key for admin API authentication |
| `SHOPLINE_WEBHOOK_SECRET` | Secret for HMAC webhook signature verification |
| `SHOPLINE_API_KEY` | Shopline app API key (from Partner Portal) |
| `SHOPLINE_API_SECRET` | Shopline app API secret (from Partner Portal) |
| `SHOPLINE_SCOPES` | OAuth scopes: `read_orders,write_orders,read_products` |
| `APP_URL` | Your deployed app URL (e.g. `https://blindbox.myapp.com`) |
| `SENTRY_DSN` | Sentry DSN for error reporting (optional) |
| `PORT` | HTTP server port (default: `3000`) |
| `NODE_ENV` | `development` or `production` |

---

## API Reference

### Public Storefront API (no auth, rate limited: 20 req/min/IP)

#### `GET /api/public/blind-boxes/:shoplineProductId`
Returns a summary of the blind box. **Never exposes probabilities or individual stock.**

```json
// Request
GET /api/public/blind-boxes/prod-12345

// Response 200
{
  "id": "uuid",
  "name": "Mystery Sneaker Box",
  "description": "One of three exclusive colorways",
  "price": "299.00",
  "itemCount": 3,
  "totalStock": 47
}

// Response 404 (not a blind box product)
{ "error": "Not a blind box product" }
```

#### `GET /api/public/blind-boxes/:shoplineProductId/teaser`
Returns item names and images for the storefront preview gallery.

```json
// Response 200
[
  { "name": "Air Max Blue", "imageUrl": "https://cdn.example.com/blue.jpg" },
  { "name": "Air Max Red", "imageUrl": "https://cdn.example.com/red.jpg" },
  { "name": "Air Max Black", "imageUrl": null }
]
```

---

### Reveal API (no auth, rate limited: 30 req/min/IP)

#### `GET /api/reveal/:shoplineOrderId`
Poll this endpoint to find out which item was assigned.

```json
// 202 — still processing
{ "status": "pending", "message": "Assignment in progress" }

// 200 — item assigned (first call transitions to FULFILLED)
{ "status": "assigned", "item": { "name": "Air Max Blue", "sku": "AMB-001", "imageUrl": "..." } }

// 200 — already revealed
{ "status": "fulfilled", "item": { "name": "Air Max Blue", "sku": "AMB-001", "imageUrl": "..." } }

// 500 — assignment failed
{ "status": "failed", "message": "There was an issue with your order." }
```

---

### Admin API (requires `X-Admin-Api-Key` header, rate limited: 100 req/min)

#### Blind Boxes

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/admin/blind-boxes` | Create a blind box |
| `GET` | `/api/admin/blind-boxes` | List all active blind boxes |
| `GET` | `/api/admin/blind-boxes/:id` | Get blind box details |
| `PUT` | `/api/admin/blind-boxes/:id` | Update blind box |
| `DELETE` | `/api/admin/blind-boxes/:id` | Soft delete (isActive=false) |
| `POST` | `/api/admin/blind-boxes/:id/items` | Add item to pool |
| `PUT` | `/api/admin/blind-boxes/:id/items/:itemId` | Update item |
| `DELETE` | `/api/admin/blind-boxes/:id/items/:itemId` | Deactivate item |
| `POST` | `/api/admin/blind-boxes/:id/items/restock` | Bulk restock |
| `GET` | `/api/admin/orders` | List orders (with filters) |
| `GET` | `/api/admin/orders/:shoplineOrderId` | Get order detail |

```json
// POST /api/admin/blind-boxes
// Body:
{
  "name": "Mystery Sneaker Box",
  "description": "One of three exclusive colorways",
  "price": 299.00,
  "shoplineProductId": "prod-12345"
}

// POST /api/admin/blind-boxes/:id/items
{
  "name": "Air Max Blue",
  "sku": "AMB-001",
  "imageUrl": "https://cdn.example.com/blue.jpg",
  "stock": 20,
  "probability": 0.5
}

// POST /api/admin/blind-boxes/:id/items/restock
[
  { "sku": "AMB-001", "additionalStock": 10 },
  { "sku": "AMB-002", "additionalStock": 5 }
]
```

---

### Shopline Webhooks (server-to-server, HMAC verified)

| Method | Path | Trigger |
|---|---|---|
| `POST` | `/api/webhooks/shopline/order-created` | New order placed |
| `POST` | `/api/webhooks/shopline/order-cancelled` | Order cancelled |

---

## Theme Integration Guide

### METHOD A — App Block *(recommended: precise placement control)*

1. From the `theme-app-extension/` directory, run:
   ```bash
   sl extension push
   ```
2. In **Shopline Partner Portal**: enable the draft → **Create version** → **Publish**
3. In merchant Shopline Admin: **Online Store → Design** → enter theme editor
4. Click **"Add component" → "Apps" tab** → select **"Blind Box Widget"**
5. In the block settings panel, enter your `APP_URL`
6. Customize button color and corner radius — no code required

### METHOD B — App Embed Block *(auto-activation, zero placement effort)*

1. Same publish steps as Method A (the same `sl extension push` covers both blocks)
2. In theme editor → **App embeds** section
3. Enable **"Blind Box Auto-Embed"** toggle
4. Enter your `APP_URL` in embed settings
5. The widget auto-activates on every product page linked to a blind box — no manual block placement needed per product template

### METHOD C — Manual Script Tag *(headless or fully custom themes)*

Add before `</body>` in your theme:
```html
<script src="https://yourapp.com/static/blindbox.js" defer></script>
<link rel="stylesheet" href="https://yourapp.com/static/blindbox.css">
```

Add this div wherever you want the widget on product pages:
```html
<div id="shopline-blind-box-widget"
     data-product-id="PRODUCT_ID"
     data-api-base="https://yourapp.com"
     style="--bb-primary:#7C3AED; --bb-radius:12px;">
</div>
```

---

## How the Weighted Random Algorithm Works

Each `BlindBoxItem` has a `probability` field (0–1). The probabilities of all **active, in-stock** items must sum to 1.0.

### Example

| Item | Declared Probability | Stock |
|---|---|---|
| Rare Holographic | 0.10 | 5 |
| Common Blue | 0.60 | 50 |
| Uncommon Red | 0.30 | 0 ← OOS |

**Step 1 — Filter out-of-stock items:**
```
Eligible: [Holographic (0.10), Blue (0.60)]
```

**Step 2 — Normalize:**
```
Total weight = 0.10 + 0.60 = 0.70
Holographic → 0.10 / 0.70 ≈ 14.3%
Blue        → 0.60 / 0.70 ≈ 85.7%
```

**Step 3 — Cumulative distribution:**
```
rand = Math.random() * 0.70   // e.g. 0.45
cumulative[Holographic] = 0.10  → 0.45 > 0.10, continue
cumulative[Blue]        = 0.70  → 0.45 ≤ 0.70, SELECT Blue
```

**Step 4 — Stock guard (inside Postgres transaction with SELECT FOR UPDATE):**
```sql
SELECT * FROM "BlindBoxItem" WHERE ... FOR UPDATE
-- Prevents concurrent orders from over-selecting
```

If `stock < quantity`, the item is excluded and a retry occurs (max 3 retries). After 3 failures, `OutOfStockError` is thrown.

---

## Running Tests

```bash
npm run test
```

Test suites:
- `tests/itemSelector.test.ts` — weighted random algorithm, probability distribution, OOS handling
- `tests/webhook.test.ts` — HMAC verification, BullMQ enqueueing, stock restoration
- `tests/widget.test.ts` — jsdom storefront widget rendering, polling, reveal animation

---

## Deployment

### Railway / Render / Fly.io

1. Set all environment variables from `.env.example`
2. Add PostgreSQL and Redis add-ons (or use Supabase + Upstash)
3. Set build command: `npm run build:all`
4. Set start command: `npm run start`
5. Run migrations: `npm run migrate:prod`

### Fly.io example

```bash
fly launch
fly secrets set DATABASE_URL="postgresql://..."
fly secrets set REDIS_URL="redis://..."
fly secrets set ADMIN_API_KEY="your-secret-key"
fly secrets set SHOPLINE_API_KEY="..."
fly secrets set SHOPLINE_API_SECRET="..."
fly secrets set SHOPLINE_WEBHOOK_SECRET="..."
fly secrets set APP_URL="https://your-app.fly.dev"
fly deploy
```

---

## Shopline CLI Reference

```bash
# Authenticate with your store
sl login --store <STORE>.myshopline.com

# Create a new theme app extension (run once per app)
sl extension create

# Push extension to Partner Portal as a draft
sl extension push

# Then in Partner Portal: enable draft → Create version → Publish
```

---

## Scripts Reference

| Script | Description |
|---|---|
| `npm run dev` | Start backend in watch mode |
| `npm run build` | Compile TypeScript backend |
| `npm run build:widget` | Build storefront JS/CSS via Rollup |
| `npm run build:admin` | Build React admin panel via Vite |
| `npm run build:all` | Run all three builds in sequence |
| `npm start` | Start compiled backend (production) |
| `npm run migrate` | Run Prisma migrations (development) |
| `npm run migrate:prod` | Run Prisma migrations (production) |
| `npm run test` | Run all Jest test suites |
| `npm run push:ext` | `sl extension push` from theme-app-extension/ |
