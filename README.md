# Lucky Brand – Next.js store

A standalone rebuild of the Lucky Brand store, going live at **luckybrand.co.zw** (previously **luckybrandonline.co.zw**). Visits to the old domain are redirected (301) to the new one, keeping each page path.
Storefront, checkout (Paynow, N-Genius cards), customer accounts and a full admin dashboard in one Next.js app on Postgres (Prisma).

- **Storefront:** home (slider + product sections), shop, categories, brands, tags, search, product pages, cart, checkout, wishlist, compare, my account, contact, FAQ and policy pages. All URLs match the old site (`/product/…/`, `/product-category/…/`) so Google rankings carry over.
- **Admin:** `/admin/`: dashboard, orders (status, notes, invoices, CSV export), products, categories, brands & tags, media library, coupons, customers, homepage builder, pages, menus, contact messages, newsletter subscribers, settings (store info, notice bar, footer, payments, shipping, contact page, GA4, Tawk.to) and redirects.
- **Customers keep their passwords:** older password formats are accepted and upgraded at each person's next login.

## 1. Run it on your PC

Requirements: Node.js 20+ and Docker Desktop. The database is Postgres 16 in a Docker container, the same setup as the server.

```bash
npm install
copy .env.example .env.local        # then fill in the values
# deploy/.env holds the database password (POSTGRES_PASSWORD=...) and, on this PC, DB_HOST_PORT=5434
docker compose -f deploy/docker-compose.yml up -d db
npm run db:deploy                   # creates the tables
npm run create-admin -- you@example.com "AStrongPassword"
npm run dev
```

Open http://localhost:3000 for the store and http://localhost:3000/admin/ for the admin.
If the store shows a 500 error, check the database container is running: `docker ps` should list `luckybrand-db-1`.

## 2. Settings you should fill in

| What | Where |
|---|---|
| Email sending (order confirmations, password resets) | `SMTP_*` in `.env.local` (e.g. your cPanel mailbox or Gmail app password) |
| Paynow keys | `PAYNOW_*` in `.env.local`. Use your **live** keys in production |
| Live site address | `SITE_URL` in `.env.local` (used in emails, Paynow return URLs, sitemap) |
| `AUTH_SECRET` | any long random string (keeps logins secure) |
| Tawk.to chat, Google Analytics | Admin → Settings → Integrations (GA4 ID was imported) |
| Bank details / cash on collection | Admin → Settings → Payments |

## 3. Go live

```bash
npm run build
npm start            # serves on port 3000 (set PORT to change)
```

- **Vultr server:** Postgres and the store run in Docker. Follow [DEPLOY.md](DEPLOY.md).
- Copy `storage/uploads/` with the app. That's where all product images and new uploads live. Back it up together with the database.
- In Paynow, the result URL is set automatically per order (`/api/paynow/result/`). No dashboard change is needed.
- Point the domain at the new app only after testing a real Paynow payment on the live keys.

## Chat bubble and AI assistant

The bubble offers WhatsApp (customers pick a salesperson) and an AI assistant that looks up live products, prices, stock and specifications. Set the people, Claude model, greeting and daily message limit in Admin → Settings → Integrations.

The assistant only appears once `ANTHROPIC_API_KEY` is in `.env.local` (or `.env.docker`) and the site has been restarted. Customer messages are sent to Anthropic to generate replies.

## Run with Docker

`deploy/docker-compose.yml` runs two containers: `db` (Postgres 16, data in the `pgdata` volume) and `app` (the store, from `deploy/Dockerfile`). Images stay in `storage/uploads/` on the host. The full server setup, first data import, backups and updates are in [DEPLOY.md](DEPLOY.md).

## Changing the database

The tables are defined in `prisma/schema.prisma`. To change one:

1. Edit the schema, then run `npm run db:migrate -- --name what_changed`. This writes a new folder under `prisma/migrations/` and applies it to your PC's database.
2. Commit that folder with the code.
3. On the server, `npm run db:deploy` applies any new migrations (see DEPLOY.md). It never resets or deletes data.

Don't edit the database by hand or with `prisma db push`: the server only follows the migrations.

## Useful commands

| Command | What it does |
|---|---|
| `npm run dev` | development server with hot reload |
| `npm run build && npm start` | production build and server |
| `npm run create-admin -- email "password"` | create or promote an admin |
| `npm run db:migrate -- --name x` | create and apply a migration after changing `prisma/schema.prisma` |
| `npm run db:deploy` | apply committed migrations (server, or a fresh PC database) |
| `npm run db:studio` | browse and edit the data in your browser (Prisma Studio) |

## Project layout

```
src/app/(store)/        storefront pages
src/app/admin/          admin dashboard (+ /admin/login, /admin/invoice)
src/app/api/            cart pricing, search, Paynow callback, contact, newsletter, admin uploads/exports
src/components/store/   storefront UI (header, product cards, cart, checkout…)
src/components/admin/   admin UI (editors, media library, menu/homepage builders)
prisma/schema.prisma    database tables (Prisma, Postgres); prisma/migrations/ = every change, in order
src/lib/prisma.ts       the database client (money comes back as "12.50" strings, JSON columns typed)
src/lib/                catalogue queries, orders, Paynow, email, auth, settings
deploy/                 Dockerfile + docker-compose.yml (Postgres + store) for the server
scripts/                create-admin, prisma wrapper, one-off MySQL → Postgres copy
storage/uploads/        product images and media (not in git)
```

## Notes

- Payment flow: Paynow web checkout (EcoCash, OneMoney, InnBucks, Visa/Mastercard). On return the order is confirmed by polling Paynow and through Paynow's server callback.
- Stock is reduced when an order is placed and restored automatically if it is cancelled, fails or is refunded.
- Invoices: Admin → order → *Print invoice* (print or save as PDF from the browser).
