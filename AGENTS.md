# AGENTS.md

See `.cursorrules` for product/architecture rules (BlinkOne = rebranded Chatwoot CE + sidecars for LABBIK Telecom). The notes below are operational only.

## Cursor Cloud specific instructions

### What this repo is
- **Chatwoot CE** runs from a Docker image built locally from `docker/chatwoot-blinkone/Dockerfile` (Rails 7 + Vue). It is the core product UI; building it is heavy and is **not** required to develop/run the BlinkOne sidecars.
- **BlinkOne sidecars** (`services/<name>`) are independent Express/Node ESM apps (`node src/server.js`), each on its own port (8790–8803). The **active API gateway** is `gateway/` (Express, port 8787). `services/gateway` is a separate NestJS/Fastify "target" gateway and the only TS package (besides `services/_shared/packages/*`) in the pnpm workspace.
- Orchestration is **Docker Compose** (`docker-compose.yml` is the main stack; `docker-compose.blinkone.yml`, `.telephony.yml`, `.staging.yml` are overlays). There is no hot-reload dev compose; services run as built images.

### Dependencies / build / lint / test
- Host workspace deps are installed by the startup update script (`pnpm install`). The pnpm workspace only covers `services/_shared/packages/*` and `services/gateway`.
- Lint/test/build commands are the standard root scripts in `package.json` (`pnpm -r run lint|test|build|typecheck`). They only run for workspace packages, not the standalone sidecars.
- Pre-existing failures (repo code, not environment): `@blinkone/chatwoot-client` has eslint `restrict-template-expressions` errors, and `@blinkone/audit` build/typecheck fails because `pg` is used without `@types/pg` declared. `pnpm -r run test` passes.
- Standalone sidecars (`services/<name>`) are not in the workspace. Their unit tests run with `node --test test/*.test.js` from the service dir; pure-lib tests run without `npm install`, but DB/HTTP-touching ones need the service's own `npm install`.

### Running the services (Docker)
- Docker is installed but **not** managed by systemd here. Start the daemon once per VM with `sudo dockerd &` (or in a tmux session) and use `sudo docker ...`. The daemon is configured for this VM with `fuse-overlayfs` and `containerd-snapshotter: false` (required for Docker 29 + fuse-overlayfs) in `/etc/docker/daemon.json`.
- Create `.env` first: `cp .env.example .env` (it is gitignored). Services read `*_TOKEN`, `JWT_SECRET`, `APP_DB_PASSWORD`, etc. from it. The gateway **fails fast** if `JWT_SECRET` is empty.
- Run the BlinkOne sidecar fleet + gateway without Chatwoot, e.g.:
  `sudo docker compose up -d --build postgres_app redis gateway tickets calls tenant` (add `sla escalation routing billing platform integration` as needed). Bringing up `chatwoot`/`sidekiq` triggers the heavy Rails image build; only do that when you actually need the Chatwoot UI.

### Non-obvious gotchas
- **Sidecars do not run via bare `node src/server.js` from a host checkout.** Their source imports `../_shared/lib/...`, which only exists after each service's Dockerfile copies `services/_shared/lib` into the service dir. Run sidecars through Docker. (The `gateway/` Express app is the exception — it imports the real `../../services/_shared` path and can run on host.)
- Sidecars use a **JSON file-store fallback** when `BLINKONE_DATABASE_URL` is unset; when it is set (as in compose, pointing at `postgres_app`) they use Postgres and run their SQL migrations on startup. `postgres` (Chatwoot DB) and `postgres_app` (`blinkone_app`, the sidecar DB) are separate.
- Gateway auth: for service-to-service calls send `Authorization: Bearer <SERVICE_TOKEN>` (e.g. `TICKET_TOKEN`); for agent flows send a JWT signed with `JWT_SECRET` carrying `tenant_id`/`roles`. `/api/auth/token` exchanges a Chatwoot token and therefore needs a running Chatwoot.
- The `calls` migration logger prints a harmless `log.log is not a function` line per migration; migrations still apply and the service starts (`db:true`).
