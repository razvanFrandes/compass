# Infrastructure

```
Client (browser, Claude Desktop)
   │  https://juyo.razvanfrandes.com
   ▼
Cloudflare Worker  compass-juyo  (apps/worker)
   │  env.HYPERDRIVE  (Hyperdrive config "compass-db": pooling + query cache)
   ▼
Workers VPC service "compass-db"  (tcp, postgresql, 127.0.0.1:5433)
   │  Cloudflare Tunnel "compass-db"  (cloudflared runs on the VM, outbound only)
   ▼
VM (HostHatch, CloudPanel site user razvanfrandes-compass-db, no root)
   Postgres 17.12 + pgvector (conda-forge, in ~/opt/pg), data in ~/pgdata
   listens on 127.0.0.1:5433 only, TLS on (self-signed), scram-sha-256
```

- **No inbound port is opened on the VM.** Postgres listens on localhost. cloudflared dials out to Cloudflare, and Hyperdrive reaches the database through the tunnel.
- **Roles:**
  - `compass_admin` (owner; its password is in `~/.pgpass` on the VM);
  - `compass_ro`, which the Worker uses:
    - `SELECT` on schema `hotel` only;
    - every transaction is read-only;
    - `statement_timeout = 5s`.
- **Memory:** `shared_buffers = 512MB`, `max_connections = 40`. The VM also hosts other sites.
- **Restarts:** the site user's crontab has `@reboot` entries for Postgres and cloudflared, plus a 5-minute watchdog for each.
- **Data:** loaded from `compass-datagen/out/full` with `db/load.sh` (Halcyon: 20 hotels, 1.2M reservations, business date 2026-11-20). To reload, rsync `db/` and `out/full/` to `~/compass-datagen` on the VM and run `db/load.sh` with `DATABASE_URL` pointing at `compass_admin`. Then re-run the grants for `compass_ro`.

## Local development

- **Database:** the local `compass_hotels` database and the same read-only role.
- **Secret files** (all git-ignored):
  - `apps/worker/.env` — `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE`, read by `wrangler dev`;
  - `apps/worker/.env.local` — `DATABASE_URL` for the Vitest integration tests;
  - `apps/worker/.env.production` — the production `compass_ro` password.
- **Testing against production data:** open `ssh -L 15433:127.0.0.1:5433 compass-db` and point `DATABASE_URL` at `127.0.0.1:15433`.

## Cloudflare resources

| Resource | Name | Id |
|---|---|---|
| Worker | compass-juyo | route `juyo.razvanfrandes.com` (custom domain) |
| Hyperdrive | compass-db | `0d5570d3cead4ad69805cd67233d92b3` |
| Workers VPC service | compass-db | `01a1f9c3-d18c-7002-9c9c-b6bc8b102c98` |
| Tunnel | compass-db | `730ca4b7-4cfb-4418-b89f-72dff11eb3fb` |
| Rate limit | MCP_RATE_LIMIT | namespace 2001, 60 requests/min per client |
