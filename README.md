# Hotel Offer Orchestrator

An Express/TypeScript API that uses Temporal to call two hotel suppliers in parallel, choose the cheapest offer per hotel name, and persist the winners in Redis. Price range filtering runs inside Redis; the API returns a plain JSON array.

## Landing page preview

Public landing-page demo: https://kunal1796.github.io/Hotel-Offer-Orchestrator-/

Run `npm ci` and `npm run preview`, then open http://localhost:3000. This frontend-only mode uses visibly labeled sample offers and does not need Docker. Stop it before starting the full stack on the same port.

When the full Express API runs, the same landing page at `/` automatically uses real API calls through Temporal and Redis. GitHub Pages publishes the labeled sample-data landing page separately; it does not host the backend.

## Run with Docker Compose

Requirements: Docker Engine with Compose v2 (or Docker Desktop), Git, and available ports 3000, 6379, 7233, and 8233.

```sh
git clone https://github.com/Kunal1796/Hotel-Offer-Orchestrator-.git
cd Hotel-Offer-Orchestrator-
docker compose up --build --wait --wait-timeout 180
curl "http://localhost:3000/api/hotels?city=delhi"
curl "http://localhost:3000/api/hotels?city=delhi&minPrice=5340&maxPrice=5900"
curl "http://localhost:3000/health"
```

In Windows PowerShell use `curl.exe` for these examples. The API runs at http://localhost:3000 and the Temporal UI at http://localhost:8233. Compose starts Redis, Temporal, the API, and a separate Temporal worker. The worker can take a few extra seconds to begin polling after the API becomes healthy; Temporal queues requests during startup.

```sh
docker compose logs -f api worker
docker compose down
```

Named volumes retain Redis data and Temporal history across restarts. `docker compose down -v` deletes those volumes and all stored data.

## API

- `GET /api/hotels?city=delhi`: all winning offers, sorted by ascending price.
- `GET /api/hotels?city=delhi&minPrice=5340&maxPrice=5900`: inclusive price range. Either bound may be omitted; zero is valid.
- `GET /supplierA/hotels` and `GET /supplierB/hotels`: static supplier arrays. An optional `city` filters the mocks.
- `GET /health`: reports Redis, Temporal server, and both supplier HTTP endpoints. Returns 200 when all are up, otherwise 503. It does not assert worker readiness; the integration search exercises that path.

`city` is required for search, trimmed, and case-insensitive. Prices must be non-negative decimal numbers with no more than two decimal places. Missing/blank city, repeated parameters, unknown parameters, invalid bounds, and `minPrice > maxPrice` return 400. Unknown cities and ranges without matches return `[]`. Supplier/Redis/Temporal failures return 503 with a request ID and no internal error details. All fixture prices use the same currency (INR); commission is metadata and is not added to the comparison price.

The filtered example returns:

```json
[
  { "name": "Holtin", "price": 5340, "supplier": "Supplier B", "commissionPct": 20 },
  { "name": "Radison", "price": 5900, "supplier": "Supplier A", "commissionPct": 13 }
]
```

Unfiltered Delhi also includes City Inn (3200, Supplier A) and Grand Palace (8100, Supplier B). Mumbai returns Sea View (7100, Supplier B).

## How it works

1. Express validates the query and starts a unique Temporal workflow with a 45-second execution timeout.
2. The workflow schedules both supplier activities in parallel. Activities make real HTTP calls to the mock endpoints and validate their responses.
3. Deterministic workflow code deduplicates trimmed, case-insensitive names and selects the lowest price. It also removes duplicates within one supplier. Ties prefer Supplier A, then the first occurrence within that supplier.
4. A Redis activity atomically replaces the **full unfiltered** winning snapshot and queries it using `ZRANGE ... BYSCORE` within a Lua script. Price is the sorted-set score, and the JSON offer is the member. No application-side price filtering occurs.
5. The workflow returns the Redis-filtered result to Express.

Snapshots use `hotels:<encoded-city>:hotel-search-<request-id>` and expire after 300 seconds by default. The response `X-Request-Id` identifies the snapshot and workflow. Per-workflow keys avoid cross-request races, and atomic replacement makes activity retries idempotent. An empty result from both suppliers is represented by an absent sorted set (Redis does not retain empty sets); a filtered-empty response still retains the full nonempty snapshot. Every request fetches fresh offers; Redis is snapshot storage, not a cache that bypasses Temporal.

Supplier HTTP requests time out after 4 seconds. Activities have an 8-second execution timeout, a 30-second total scheduling/retry budget, and up to 3 attempts with exponential backoff. Malformed data and non-retryable HTTP 4xx responses fail immediately (429 retries). When either supplier exhausts retries, the search fails instead of claiming a partial list is the cheapest. Workflow/activity logs appear in worker output, with workflow/activity context; API errors include the request ID.

## Local Node.js development

Use Node.js 22. Start only the infrastructure in Docker, then run the API and worker in separate terminals:

```sh
npm ci
docker compose up -d --wait redis temporal
cp .env.example .env
npm run dev
# In a second terminal:
npm run dev:worker
```

On PowerShell replace `cp` with `Copy-Item` if preferred. `.env.example` documents configuration. Compose sets service hostnames itself; local Node processes use localhost. For compiled execution run `npm run build`, then `npm start` and `npm run worker` in separate terminals.

## Tests and Postman

```sh
npm ci
npm run check
docker compose up --build --wait --wait-timeout 180
npm run test:integration
```

Unit/API tests cover winner selection, ties, name normalization, validation, parallel activity scheduling, supplier failures, and health responses. Integration tests require the running Compose stack and verify real Temporal execution, inclusive bounds, concurrent requests, Redis persistence/TTL, and retry-safe writes. GitHub Actions runs these checks and additionally recreates the API with Supplier B down to verify the full failure path.

Import `postman/Hotel-Offer-Orchestrator.postman_collection.json` into Postman. Set the collection `baseUrl` variable if needed. Its default requests assert overlap winners, empty cities, inclusive bounds, one-sided bounds, invalid input, health, and both supplier schemas.

To simulate a supplier outage, set `SUPPLIER_B_DOWN=true` in a root `.env` file and run:

```sh
docker compose up -d --no-deps api
```

Run the collection's optional outage folder after setting its `runOutageTests` variable to `true`. Search and health return 503, and health identifies Supplier B as down. Restore `SUPPLIER_B_DOWN=false`, recreate the API, and reset the Postman variable to `false`. For local Node, restart the API after changing `.env`.

## Deployment scope

The included Compose deployment is intended for local evaluation or a private demo server. It uses Temporal's development server with persisted SQLite, following the [official Temporal example](https://github.com/temporalio/samples-server/blob/main/compose/docker-compose-dev.yml), and binds exposed ports to localhost. On a Docker-enabled remote host, clone this repository and run the same Compose command; use an SSH tunnel (`ssh -L 3000:localhost:3000 -L 8233:localhost:8233 user@host`) to access it privately.

For a public production service, use Temporal Cloud or a supported production Temporal cluster, authenticated Redis, TLS/reverse proxy and authentication for the API, secrets management, and pinned image digests. The Temporal CLI image follows the official example's `latest` tag; pin a tested version/digest for reproducible deployments. No cloud account or hosting target is provisioned by this repository.

Redis range semantics: [official ZRANGE reference](https://redis.io/docs/latest/commands/zrange/).
