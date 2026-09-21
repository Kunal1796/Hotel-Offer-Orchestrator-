# Full hosted deployment on Railway

The existing GitHub Pages URL hosts only the labeled frontend preview. The complete application must run on a backend host. Serve the landing page from the Express service so `/site-config.js` selects live mode and all searches use `/api/hotels` on the same origin. No CORS setup or frontend API secret is needed.

## Account and cost prerequisite

Create a Railway account, link GitHub, and connect the Railway integration before deployment. Check the account's available trial credits and resource limits. Paid hosting requires the owner's explicit budget approval. Nothing in this document provisions paid resources automatically.

## Service layout

Create one project/environment with four services, using these exact names for the variable references below. Start Redis and Temporal first, then the API and worker. Keep all services in the same region. Use a new environment with IPv4 private networking support.

### 1. Redis

Create Railway's Redis service and name it `Redis`. Use its generated private `REDIS_URL`. Keep it private; no public TCP proxy is needed. Retain the template's authentication and persistent volume settings.

### 2. Temporal

Create an image service named `temporal` from `temporalio/temporal:latest`. Set its start command to:

```sh
temporal server start-dev --ip 0.0.0.0 --port 7233 --db-filename /home/temporal/temporal.db
```

Mount a persistent volume at `/home/temporal`. Do not generate a public domain or TCP proxy for this service. The current image tag matches the Compose deployment tested by CI; pin its tested digest before a long-lived deployment.

This is a functioning assignment/demo deployment using Temporal's development server and SQLite. It is not a production-grade Temporal cluster. A production service should use Temporal Cloud or a supported production cluster with appropriate authentication and persistence.

### 3. API and landing page

Create a GitHub-backed service named `api` from this repository. Build with the root `Dockerfile`; start with `node dist/server.js`. Set the health-check path to `/health`, allow up to 300 seconds for startup, and configure restart on failure. Set these variables:

```dotenv
PORT=3000
REDIS_URL=${{Redis.REDIS_URL}}
TEMPORAL_ADDRESS=${{temporal.RAILWAY_PRIVATE_DOMAIN}}:7233
TEMPORAL_NAMESPACE=default
TEMPORAL_TASK_QUEUE=hotel-offers
SUPPLIER_BASE_URL=http://127.0.0.1:3000
SNAPSHOT_TTL_SECONDS=300
SUPPLIER_A_DOWN=false
SUPPLIER_B_DOWN=false
```

Generate a public HTTPS domain for `api`, targeting port 3000. This URL serves both the actual website and API and is the eventual submission URL.

### 4. Worker

Create another service named `worker` from the same GitHub repository and Dockerfile. Override its start command to `node dist/worker.js`, configure restart on failure, and set:

```dotenv
REDIS_URL=${{Redis.REDIS_URL}}
TEMPORAL_ADDRESS=${{temporal.RAILWAY_PRIVATE_DOMAIN}}:7233
TEMPORAL_NAMESPACE=default
TEMPORAL_TASK_QUEUE=hotel-offers
SUPPLIER_BASE_URL=http://${{api.RAILWAY_PRIVATE_DOMAIN}}:3000
SNAPSHOT_TTL_SECONDS=300
```

Do not give the worker an HTTP health-check path or public domain. Keep the worker and Temporal running continuously; workflows depend on the worker polling the queue. If services start out of order, redeploy the API/worker after Redis and Temporal are ready.

## Verification before claiming completion

Run against the generated API domain:

```sh
npm run test:deployment -- https://YOUR-ACTUAL-API-DOMAIN
```

This rejects the GitHub Pages preview and checks that live mode is served, all dependency health checks pass, requests return the expected deduplicated offers, bounds are inclusive, and invalid inputs fail. Inspect the worker logs for the matching workflow/request ID and verify the Redis snapshot via the provider's private service shell. The existing Compose integration suite also checks Redis persistence and expiration directly.

Open the deployed website and exercise the price controls in the browser. Only after these checks succeed should the GitHub Pages landing page be linked or redirected to the real deployment. Until then, keep its preview label.

References: [Railway private networking](https://docs.railway.com/networking/private-networking/how-it-works), [trial limits](https://docs.railway.com/pricing/free-trial), and [Dockerfile deployment](https://docs.railway.com/builds/dockerfiles).
