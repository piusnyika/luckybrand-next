# Lucky Brand – Next.js store

A standalone rebuild of the Lucky Brand store, going live at **luckybrand.co.zw** (previously **luckybrandonline.co.zw**). Visits to the old domain are redirected (301) to the new one, keeping each page path.
Storefront, checkout (Paynow), customer accounts and a full admin dashboard in one Next.js app on MySQL.

- **Storefront:** home (slider + product sections), shop, categories, brands, tags, search, product pages, cart, checkout, wishlist, compare, my account, contact, FAQ and policy pages. All URLs match the old site (`/product/…/`, `/product-category/…/`) so Google rankings carry over.
- **Admin:** `/admin/`: dashboard, orders (status, notes, invoices, CSV export), products, categories, brands & tags, media library, coupons, customers, homepage builder, pages, menus, contact messages, newsletter subscribers, settings (store info, notice bar, footer, payments, shipping, contact page, GA4, Tawk.to) and redirects.
- **Customers keep their passwords:** older password formats are accepted and upgraded at each person's next login.

## 1. Run it on your PC (Laragon)

Requirements: Node.js 20+ and Laragon's MySQL running.

```bash
cd C:\laragon\www\luckybrand-next
npm install
copy .env.example .env.local        # then check the values (defaults match Laragon: root / no password)
npm run create-admin -- you@example.com "AStrongPassword"
npm run dev
```

Open http://localhost:3000 for the store and http://localhost:3000/admin/ for the admin.
Before `npm run dev`, create a `luckybrand_next` database and import your database backup into it.

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

- **VPS / dedicated server:** use Docker (see [Run with Docker](#run-with-docker)), or run with PM2 (`pm2 start npm --name luckybrand -- start`) behind Nginx or Cloudflare.
- **cPanel "Setup Node.js App":** application root = this folder, startup file = `node_modules/next/dist/bin/next` with argument `start`, then run `npm install` and `npm run build` from the cPanel terminal.
- Copy `storage/uploads/` with the app. That's where all product images and new uploads live. Back it up together with the database.
- In Paynow, the result URL is set automatically per order (`/api/paynow/result/`). No dashboard change is needed.
- Point the domain at the new app only after testing a real Paynow payment on the live keys.

## Chat bubble and AI assistant

The bubble offers WhatsApp (customers pick a salesperson) and an AI assistant that looks up live products, prices, stock and specifications. Set the people, Claude model, greeting and daily message limit in Admin → Settings → Integrations.

The assistant only appears once `ANTHROPIC_API_KEY` is in `.env.local` (or `.env.docker`) and the site has been restarted. Customer messages are sent to Anthropic to generate replies.

## Run with Docker

The container runs the store only. MySQL stays outside it, and images stay in `storage/uploads/` on the server.

1. Copy `.env.example` to `.env.docker` and fill it in. Use the live `SITE_URL`, and a `DATABASE_URL` with `host.docker.internal` as the host when MySQL is on the same server.
2. Give the store access to MySQL. Create a MySQL user that can connect from Docker's network (`root@localhost` can't), and make MySQL listen on that network, not just `127.0.0.1`. Don't open port 3306 to the internet.
3. Let the container write images (Linux servers): `sudo chown -R 1001:1001 storage/uploads`
4. Start it: `docker compose up -d --build`. It listens on `127.0.0.1:3000` (set `APP_PORT` to change).
5. Point the web server at it. For Apache, with `proxy`, `proxy_http` and `headers` enabled:

```apache
ProxyPreserveHost On
RequestHeader set X-Forwarded-Proto "https"
ProxyPass / http://127.0.0.1:3000/
ProxyPassReverse / http://127.0.0.1:3000/
```

To update, replace the code and run `docker compose up -d --build` again. Logs: `docker compose logs -f store`. Back up `storage/uploads/` and the database; neither is inside the container. Scripts like `npm run create-admin` aren't in the image, so run them from a copy of the project with `DATABASE_URL` set.

## Useful commands

| Command | What it does |
|---|---|
| `npm run dev` | development server with hot reload |
| `npm run build && npm start` | production build and server |
| `npm run create-admin -- email "password"` | create or promote an admin |
| `npm run db:push` | apply schema changes to the database |

## Project layout

```
src/app/(store)/        storefront pages
src/app/admin/          admin dashboard (+ /admin/login, /admin/invoice)
src/app/api/            cart pricing, search, Paynow callback, contact, newsletter, admin uploads/exports
src/components/store/   storefront UI (header, product cards, cart, checkout…)
src/components/admin/   admin UI (editors, media library, menu/homepage builders)
src/db/schema.ts        database tables (Drizzle ORM, works on MySQL 8 and MariaDB)
src/lib/                catalogue queries, orders, Paynow, email, auth, settings
scripts/                create-admin
storage/uploads/        product images and media (not in git)
```

## Notes

- Payment flow: Paynow web checkout (EcoCash, OneMoney, InnBucks, Visa/Mastercard). On return the order is confirmed by polling Paynow and through Paynow's server callback.
- Stock is reduced when an order is placed and restored automatically if it is cancelled, fails or is refunded.
- Invoices: Admin → order → *Print invoice* (print or save as PDF from the browser).
