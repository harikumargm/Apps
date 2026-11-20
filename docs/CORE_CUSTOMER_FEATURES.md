# Vastram — Core Customer & AI Features (implementation phases)

This document maps requirements **1–9** to code in the monorepo. Existing pieces are marked **✓**; new scaffolding is marked **+**.

## Phase 1 — Database (PostgreSQL / Prisma)

| Area | Location |
|------|----------|
| Canonical Prisma schema | `packages/database/prisma/schema.prisma` |
| Runtime SQLite/Postgres migrations | `services/api/app/db.py` (`migrate()`) |
| Dual catalog JSON (storefront seed) | `data/catalog.json`, `apps/web/data/catalog.json` |

**Tables:** `User`, `Category`, `Product`, `ProductVariant` (product + color + size SKU), `ProductFabric`, `ProductMedia`, `Cart`, `WishlistItem`, `Order`, `InventoryLog`, `TryOnJob`, `WebhookEvent`, `Campaign`, `OtpCode`.

**Apply Prisma (production):**
```bash
cd packages/database
export DATABASE_URL=postgresql://scv:scv@localhost:5432/scv
npx prisma migrate dev
```

## Phase 2 — API architecture

| Surface | Base path | Module |
|---------|-----------|--------|
| Storefront | `/v1/*` | `services/api/app/main.py` (catalog, cart, auth, checkout, try-on) **✓** |
| Storefront extensions | `/v1/wishlist`, `/v1/orders/{id}/stream` | `services/api/app/routes_storefront.py` **+** |
| Admin (RBAC) | `/v1/admin/*` | `services/api/app/routes_admin.py` **+** |
| Payment webhooks | `/v1/webhooks/stripe`, `/v1/webhooks/razorpay` | `services/api/app/routes_webhooks.py` **+** |
| WhatsApp webhooks | `/v1/webhooks/whatsapp` | `services/api/app/routes_webhooks.py` **+** |
| AI ingest | `/v1/admin/products/ingest-image` | `services/api/app/routes_admin.py` **+** |

**Auth (requirement 1) — already in gateway:**
- Phone OTP: `POST /v1/auth/otp/request`, `POST /v1/auth/otp/verify` **✓**
- Email: `POST /v1/auth/register`, `POST /v1/auth/login` **✓**
- Google OAuth: `POST /v1/auth/oauth/google` **✓** (set `GOOGLE_CLIENT_ID`)

**Cart & guest checkout:** Session header `X-Session-Id` + optional JWT; checkout without login **✓**

## Phase 3 — Frontend & mobile UI

| Feature | Web | Mobile |
|---------|-----|--------|
| Auth (phone / email / Google) | `apps/web/components/auth-panel.tsx` **+** | Extend `apps/mobile` account flow (future) |
| Size guide + cotton shrink | `apps/web/components/size-guide.tsx` **+** on PDP |
| Wishlist | `apps/web/components/wishlist-toggle.tsx` **+** + Zustand `wishlist` |
| Persistent cart | `apps/web/lib/store.ts` + API sync **✓** |
| Order tracking | `apps/web/components/order-tracker.tsx` **+** |
| Virtual try-on + AI models | `apps/web/components/try-on.tsx` **✓** + `apps/web/lib/tryon-models.ts` **+** |
| Admin dashboard | `apps/web/app/admin/page.tsx` **+** |

## Phase 4 — AI & WhatsApp services

| Service | Path |
|---------|------|
| Auto-categorization & SEO copy | `services/ai-pipeline/categorize.py` **+** |
| Fabric verification & GSM | `services/ai-pipeline/fabric_verify.py` **+** |
| Try-on job enqueue | API `TryOnJob` + existing `services/vision/scv_vision/tryon.py` **✓** |
| WhatsApp templates | `services/whatsapp/templates.py`, `client.py` **+** |

## Phase 5 — Payments & integrations

| Item | Location |
|------|----------|
| Razorpay / Stripe intents | `services/api/app/payments.py` **✓** |
| Webhook-driven status | `routes_webhooks.py` **+** |
| COD + OTP | Checkout flag `method: cod` + `POST /v1/orders/{id}/verify-cod` **+** |
| Abandoned cart (1h) | Admin worker hook + WhatsApp `abandoned_cart` template **+** |

## Environment variables

```env
DATABASE_URL=postgresql://scv:scv@postgres:5432/scv
SECRET_KEY=...
GOOGLE_CLIENT_ID=...
RAZORPAY_KEY_ID=...
RAZORPAY_KEY_SECRET=...
STRIPE_WEBHOOK_SECRET=...
WHATSAPP_TOKEN=...
WHATSAPP_PHONE_ID=...
SCV_ADMIN_TOKEN=...
VISION_URL=http://vision:8081
```

## Operational checklist

1. `docker compose up postgres redis api vision`
2. `cd apps/web && npm run dev -- --host 0.0.0.0 --port 3000`
3. Open `/account` (auth), PDP (size guide + try-on), `/admin` (token header)