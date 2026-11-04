# Deploying to the Vultr server

Postgres and the store run in Docker on the server (`deploy/docker-compose.yml`). The web server (Apache or nginx) runs
on the host, handles HTTPS, and forwards traffic to the store on `127.0.0.1:3000`. Product images live in
`storage/uploads/` on the host, outside the containers.

The catalogue, customers and orders are built up on the dev PC, in its own Postgres container. Going live copies that
database to the server once (step 3). After that the server's database is the real one: don't copy over it again.

## 1. Prepare the server

- Install Docker with the Compose plugin, Node.js 20+ (to run `npm run db:deploy` and `npm run create-admin` from the host) and your web server with certbot.
- Powershop already runs its own Postgres here. Luckybrand gets a separate container (project name `luckybrand`), so the two stores never share data. Both bind to localhost only, so give them different ports: if Powershop's database is on 5432, set `DB_HOST_PORT=5433` in luckybrand's `deploy/.env`.
- Never open the Postgres ports to the internet.

## 2. Code and settings

1. Copy the project to the server (e.g. `/var/www/luckybrand-next`), without `node_modules` or `.next`.
2. Create `deploy/.env` (read by docker compose only):
   ```
   POSTGRES_PASSWORD=<a long random password>
   DB_HOST_PORT=5433
   ```
3. Create `.env.docker` from `.env.example` with the live values: `SITE_URL=https://luckybrand.co.zw`, a new `AUTH_SECRET`, live Paynow/N-Genius keys, SMTP. `DATABASE_URL` in it is ignored; compose points the app at the `db` container.
4. For commands run from the host, create `.env.local` with just:
   ```
   DATABASE_URL="postgresql://luckybrand:<POSTGRES_PASSWORD>@localhost:<DB_HOST_PORT>/luckybrand"
   ```
5. `npm ci`

## 3. First time only: copy the database and images from the PC

On the dev PC:

```bash
docker compose -f deploy/docker-compose.yml exec -T db pg_dump -U luckybrand -Fc luckybrand > luckybrand.dump
```

Copy `luckybrand.dump` and the whole `storage/uploads/` folder to the server, then on the server:

```bash
docker compose -f deploy/docker-compose.yml up -d db
docker compose -f deploy/docker-compose.yml exec -T db pg_restore -U luckybrand -d luckybrand --no-owner --clean --if-exists < luckybrand.dump
npm run db:deploy        # should say "No pending migrations to apply"
sudo chown -R 1001:1001 storage/uploads   # the store runs as user 1001 and saves new uploads here
```

The dump includes Prisma's `_prisma_migrations` table, so later migrations apply on top of it normally.

## 4. Start the store

```bash
docker compose -f deploy/docker-compose.yml up -d --build
docker compose -f deploy/docker-compose.yml logs -f app
npm run create-admin -- you@example.com "AStrongPassword"   # only if you need a new admin login
```

## 5. Web server and HTTPS

Apache (modules `proxy`, `proxy_http`, `headers`):

```apache
ProxyPreserveHost On
RequestHeader set X-Forwarded-Proto "https"
ProxyPass / http://127.0.0.1:3000/
ProxyPassReverse / http://127.0.0.1:3000/
```

Point `luckybrand.co.zw` (and the old `luckybrandonline.co.zw`, which the store redirects) at the server, then get certificates with certbot.
Test a real Paynow and card payment on the live keys before switching the domain over.

## 6. Backups

The database is in the `luckybrand_pgdata` Docker volume; images are in `storage/uploads/`. Back up both every day, e.g. in cron:

```bash
0 2 * * * cd /var/www/luckybrand-next && docker compose -f deploy/docker-compose.yml exec -T db pg_dump -U luckybrand -Fc luckybrand > /var/backups/luckybrand-$(date +\%F).dump
```

Keep copies off the server too, and test a restore now and then (`pg_restore` as in step 3, into a test database).

## Updating the site (every release after the first)

Database changes are made on the PC with `npm run db:migrate -- --name what_changed`, which adds a folder under
`prisma/migrations/`. Ship that folder with the code. On the server:

```bash
# after copying the new code
npm ci
npm run db:deploy                                      # applies only the new migrations; never deletes data
docker compose -f deploy/docker-compose.yml up -d --build app
```

Take a backup first if the release changes the database. Never run `prisma db push` or `prisma migrate reset` on the server.
