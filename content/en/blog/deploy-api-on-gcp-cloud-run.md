---
title: "Deploy a Containerized API on GCP Cloud Run"
description: "Step-by-step guide to deploying a Python API on GCP using Artifact Registry and Cloud Run — from Docker setup to a repeatable one-command release pipeline, with every configuration parameter explained."
date: "2026-05-08"
readingTime: 19
tag: "tutorial"
---

You have built something that works on your machine — a script that converts images, a function that runs a calculation, a small program that does something useful. At some point you want to take it beyond your laptop: put it on your website so visitors can use it, send a link to a friend or colleague, or package it into something you can charge for. The moment you want others to be able to call your code from anywhere — a browser, a mobile app, another server — you need to expose it as an API.

An API (Application Programming Interface) turns your code into a service with a stable URL. Instead of sharing a script and asking people to set up their own environment to run it, you run it once and they use it. That is what this guide builds.

By the end of this tutorial you will have a containerized API running on GCP, reachable via a public HTTPS URL, and deployable with a single command. The API logic is up to you — this guide covers everything else: Docker setup, Artifact Registry, Cloud Run configuration, environment variables, public access, and post-deploy verification.

The examples use Python (FastAPI + uvicorn), but the GCP-side steps apply to any language or framework that can run in a container.

---

## How It All Fits Together

Before touching any tooling, here is the full picture of what you are building:

```
Local Machine                         GCP
──────────────────────────────────────────────────────────
                                      ┌───────────────────┐
1. Write Dockerfile                   │  Artifact         │
2. docker build ──────── docker push ▶│  Registry         │
3. docker run   (local test)          │  (image storage)  │
                                      └─────────┬─────────┘
                                                │ pull image
                                                ▼
                                      ┌───────────────────┐
                                      │   Cloud Run       │
                                      │   (managed        │
                                      │    runtime)       │
                                      └─────────┬─────────┘
                                                │
                                                ▼
                                      https://your-service-xxxx.run.app
                                      (public HTTPS API endpoint)
```

**Artifact Registry** stores your Docker images — a private image registry inside your GCP project. **Cloud Run** is the managed container runtime that pulls your image, runs it, handles HTTPS termination and scaling automatically, and exposes it at a stable URL.

Everything else — Cloud Build, Cloud Storage, GKE — is optional. The minimum viable setup is these two services.

---

## Setting Up Your GCP Project

Before anything else, you need a GCP project. A project is the container for all your GCP resources — billing, APIs, IAM permissions, and services are all scoped to a project.

### Install and authenticate the gcloud CLI

Install the [Google Cloud CLI](https://cloud.google.com/sdk/docs/install), then authenticate:

```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
```

Authenticate Docker to use Artifact Registry (one-time per machine):

```bash
gcloud auth configure-docker us-central1-docker.pkg.dev
```

This writes a credential helper to `~/.docker/config.json`. You only need to run this once — it persists across terminal sessions.

### Create a project

Go to the [Google Cloud Console](https://console.cloud.google.com), click the project selector at the top, then **New Project**. Give it a name and note the Project ID — you will use this in every CLI command below.

Or via the CLI:

```bash
gcloud projects create YOUR_PROJECT_ID --name="My API Project"
gcloud config set project YOUR_PROJECT_ID
```

### Enable billing

Cloud Run and Artifact Registry require a billing account to be attached to the project before you can use them — even if your usage stays within the free tier. GCP uses the billing account to identify who is responsible for costs, not to charge you immediately.

In the Console: **Billing** → **Link a billing account** → select or create a billing account.

### Enable the required APIs

GCP services are disabled by default. Enable the two services this tutorial uses:

```bash
gcloud services enable artifactregistry.googleapis.com run.googleapis.com
```

This takes about 30 seconds and only needs to be done once per project.

### IAM permissions

If you are the project owner — the account that created the project — you already have full permissions and can skip this section.

If you are deploying from a CI/CD pipeline or want to follow the principle of least privilege, create a dedicated service account with only the roles it needs:

| Role | What it allows |
|------|---------------|
| `roles/artifactregistry.writer` | Push images to Artifact Registry |
| `roles/run.developer` | Deploy and manage Cloud Run services |

```bash
gcloud iam service-accounts create api-deployer \
  --display-name="API Deployer"

gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:api-deployer@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/artifactregistry.writer"

gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:api-deployer@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/run.developer"
```

For personal use from your own machine, your user account with owner permissions is sufficient — no service account needed.

---

## Prerequisites: Docker Setup

### What is Docker and why do we use it?

Docker is a containerization platform. A **container** packages your application code together with its runtime, dependencies, and configuration into a single, portable unit that runs the same way everywhere.

Without containerization, deploying your code to a remote server means ensuring the server has the exact right Python version, the exact packages listed in your `requirements.txt`, the same environment variables, and the same directory layout as your laptop. This is fragile — subtle differences between local and production environments cause bugs that are hard to reproduce and even harder to diagnose.

A container eliminates this class of problem. You define the environment once in a **Dockerfile**, build it into an **image**, and that image runs identically on your laptop, on GCP, or on any machine that has Docker.

**Two terms you will see throughout this guide:**

- **Image** — a read-only blueprint that describes the filesystem and the startup command. Immutable once built. Think of it as a snapshot.
- **Container** — a running instance of an image. When Cloud Run receives a request, it starts a container from your image to process it. When the request is done, the container may be kept warm for the next request or shut down.

You build the image locally, push it to Artifact Registry (your image storage on GCP), and Cloud Run pulls and runs it from there.

### Install Docker Desktop

Download and install Docker Desktop from [docker.com](https://www.docker.com/products/docker-desktop/). After installation, start Docker Desktop and wait for the whale icon in the menu bar to stop animating — that means the daemon is running.

Verify the installation:

```bash
docker --version
# Docker version 27.x.x, build ...

docker info
# Should print system info without errors
# If you see "Cannot connect to the Docker daemon" — Docker Desktop is not running
```

---

## The Two Services You Need

GCP has a sprawling catalog. For this tutorial, you need exactly two services.

**Artifact Registry** stores your Docker images. Think of it as a private Docker Hub that lives inside your GCP project. Cloud Run pulls images from here at deploy time.

**Cloud Run** is the managed container runtime. It handles HTTPS termination, auto-scaling, health checks, and deployment rollbacks. You provide an image and a set of parameters; it runs your container and exposes it at a stable URL.

---

## Free Tier and Usage Limits

Both services have permanent free tiers — not just trial credits.

| Service | Free tier | Beyond free tier |
|---------|-----------|-----------------|
| Artifact Registry | 0.5 GB storage/month | $0.10/GB/month |
| Cloud Run | 2M requests/month | $0.40 per million requests |
| Cloud Run | 360,000 GB-seconds memory/month | $0.00000250/GB-second |
| Cloud Run | 180,000 vCPU-seconds/month | $0.00001000/vCPU-second |
| Cloud Run | 1 GB network egress (North America)/month | $0.12/GB |

For a low-to-medium traffic API (tens of thousands of requests per month), you will likely stay within the free tier for Cloud Run. Artifact Registry costs depend on how many image versions you keep — see the cleanup policy section below.

---

## One-Time Setup: Artifact Registry

Before any deployment, you need a repository inside Artifact Registry to store your images. Run this once per project:

```bash
gcloud artifacts repositories create my-service \
  --repository-format=docker \
  --location=us-central1 \
  --project=YOUR_PROJECT_ID \
  --description="Container images for my-service"
```

After this, your image name follows this pattern:

```
us-central1-docker.pkg.dev/YOUR_PROJECT_ID/my-service/my-service:latest
```

### Cleanup policy

Artifact Registry charges for storage. Without a cleanup policy, old image layers accumulate silently. Apply a policy that keeps the three most recent versions and deletes anything older than 30 days:

```bash
gcloud artifacts repositories set-cleanup-policies my-service \
  --location=us-central1 \
  --project=YOUR_PROJECT_ID \
  --policy=cleanup-policy.json \
  --no-dry-run
```

`cleanup-policy.json`:

```json
[
  {
    "name": "keep-latest-3",
    "action": {"type": "Keep"},
    "mostRecentVersions": {"keepCount": 3}
  },
  {
    "name": "delete-old",
    "action": {"type": "Delete"},
    "condition": {"olderThan": "30d"}
  }
]
```

The `--no-dry-run` flag is required — without it the policy is evaluated but not applied.

---

## Defining Your API Endpoints

Cloud Run runs your container — it has no knowledge of what your application does. Your application defines the routes, and Cloud Run exposes them through the service URL.

Once deployed, every endpoint you define is reachable at:

```
https://{your-service-url}/{endpoint-path}
```

For example, if your Cloud Run service URL is `https://my-service-abc123-uc.a.run.app` and you define a `/convert` route, it is accessible at `https://my-service-abc123-uc.a.run.app/convert`.

### Why the health check endpoint matters

A health check endpoint is a dedicated route — typically `/health` — that returns a `200 OK` response immediately, with no side effects. Cloud Run uses it to confirm the container started correctly. Monitoring tools use it to detect outages. Your post-deploy verification script uses it as the first thing it calls after every deployment.

Without a `/health` route, the only way to confirm the service is alive after a deployment is to call one of your real endpoints and hope it behaves — a fragile substitute.

### A minimal Flask example

Here is a minimal Flask application with a health check and one functional endpoint:

```python
# app/main.py
from flask import Flask, jsonify, request

app = Flask(__name__)

@app.route("/health")
def health():
    return jsonify({"status": "ok"})

@app.route("/process", methods=["POST"])
def process():
    data = request.get_json()
    result = {"output": f"processed: {data.get('input', '')}"}
    return jsonify(result)
```

`requirements.txt`:

```
flask
gunicorn
```

After deployment, both routes are reachable through the service URL:

| Route | Full URL |
|-------|----------|
| `/health` | `https://your-service-url/health` |
| `/process` | `https://your-service-url/process` |

### Flask vs FastAPI in the Dockerfile

The framework you choose affects the `CMD` line in your Dockerfile. Flask uses **gunicorn** (a production WSGI server); FastAPI uses **uvicorn**:

```dockerfile
# Flask + gunicorn
CMD ["gunicorn", "--bind", "0.0.0.0:8080", "--workers", "1", "app.main:app"]

# FastAPI + uvicorn
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
```

Everything else in the Dockerfile — the base image, port, working directory — is the same regardless of framework.

---

## The Dockerfile

Cloud Run runs any container that listens on port `8080` and exits cleanly on `SIGTERM`. A minimal production-ready Dockerfile for a Python API:

```dockerfile
FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ ./app/

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
```

Three things worth noting:

- **`python:3.12-slim`** omits compilers, test tools, and documentation from the base image. Smaller image means faster pulls at deploy time and lower Artifact Registry storage costs.
- **`--no-cache-dir`** prevents pip from writing its download cache to the image layer. The cache is never reused inside a running container, so it is pure waste.
- **Port `8080` is mandatory.** Cloud Run routes all traffic to this port. The host must be `0.0.0.0` — not `localhost` or `127.0.0.1` — or Cloud Run's health checks will fail silently.

---

## Local Testing Before Pushing

Always verify the container works locally before pushing to GCP. A broken image pushed to Artifact Registry wastes time and storage.

Build the image:

```bash
docker build --platform linux/amd64 -t my-service:local .
```

The `--platform linux/amd64` flag is critical if you are on an Apple Silicon Mac. Without it, Docker builds an `arm64` image. Cloud Run's underlying hardware is `amd64` — it will silently reject the wrong architecture. The flag forces a cross-platform build.

Run the container locally:

```bash
docker run --rm -p 8080:8080 \
  -e API_KEY=your-dev-key \
  my-service:local
```

The `-p 8080:8080` flag maps port 8080 inside the container to port 8080 on your machine. The `-e` flag passes environment variables.

Test it:

```bash
curl http://localhost:8080/health
# Expected: {"status": "ok"}
```

If the health check passes, the container starts correctly and the server is listening. Stop it with `Ctrl+C` before proceeding.

---

## The Release Pipeline

The build → push → deploy sequence runs on every release. Split into three composable scripts so each step can be tested independently:

**`scripts/build.sh`**

```bash
#!/usr/bin/env bash
set -euo pipefail

IMAGE="us-central1-docker.pkg.dev/YOUR_PROJECT_ID/my-service/my-service:latest"

docker build --platform linux/amd64 -t "$IMAGE" .
```

**`scripts/push.sh`**

```bash
#!/usr/bin/env bash
set -euo pipefail

IMAGE="us-central1-docker.pkg.dev/YOUR_PROJECT_ID/my-service/my-service:latest"

gcloud auth configure-docker us-central1-docker.pkg.dev --quiet
docker push "$IMAGE"
```

**`scripts/deploy.sh`**

```bash
#!/usr/bin/env bash
set -euo pipefail

gcloud run deploy my-service \
  --image "us-central1-docker.pkg.dev/YOUR_PROJECT_ID/my-service/my-service:latest" \
  --platform managed \
  --region us-central1 \
  --memory 512Mi \
  --cpu 1 \
  --concurrency 1 \
  --max-instances 100 \
  --timeout 60 \
  --allow-unauthenticated \
  --project=YOUR_PROJECT_ID
```

**`scripts/release.sh`** — chains all three:

```bash
#!/usr/bin/env bash
set -euo pipefail
bash scripts/build.sh && bash scripts/push.sh && bash scripts/deploy.sh
```

After this, `bash scripts/release.sh` is the only command needed to ship a new version.

---

## Cloud Run Configuration: Every Parameter Explained

| Parameter | Value | Reasoning |
|-----------|-------|-----------|
| `--memory` | `512Mi` | Most image-processing and computation APIs fit in 512 MiB. Cloud Run metrics will show if you need more. |
| `--cpu` | `1` | One vCPU per instance. CPU is only allocated while a request is being processed — no idle billing. |
| `--concurrency` | `1` | Each instance handles one request at a time. Correct for CPU-bound work where parallel requests would compete for CPU and degrade both. For I/O-bound services, raise to 10–80. |
| `--max-instances` | `100` | Caps concurrent instances. Prevents runaway scaling from a traffic spike or attack. Set based on acceptable worst-case cost, not expected traffic. |
| `--timeout` | `60` | Request timeout in seconds. Cloud Run terminates the request and returns 504 if processing exceeds this. Size it to your slowest expected operation with room to spare. |
| `--allow-unauthenticated` | — | Makes the URL publicly accessible. See the next section for the IAM caveat. |

**What `--concurrency 1` means in practice.** With concurrency set to 1, each active request gets its own instance. If two requests arrive simultaneously, Cloud Run spins up a second instance rather than queuing the second request. For CPU-bound work — image processing, file conversion, model inference — this is the correct model. It scales horizontally by instance count rather than request queue depth.

**Memory sizing matters upfront.** Cloud Run will OOM-kill your container if it exceeds the configured memory limit. Estimate your peak memory usage before deploying: if your API loads a 200 MB model into memory, `512Mi` is not enough — start at `1Gi`. Resize after observing Cloud Run's memory metrics.

---

## Scale to Zero: The Cold Start Trade-off

Cloud Run's default behavior — and its main cost advantage — is **scale to zero**: when there are no active requests, all instances shut down and you pay nothing.

The trade-off is **cold start latency**: when a request arrives after a period of inactivity, Cloud Run must start a new container before it can respond. For a Python API with typical dependencies, this takes 2–5 seconds.

| Setting | Behavior | Cost |
|---------|----------|------|
| `--min-instances 0` (default) | Scale to zero; cold starts after idle periods | Zero when idle |
| `--min-instances 1` | One instance always running; no cold starts | ~$10–15/month for 512Mi/1 vCPU |

Use `--min-instances 0` when traffic is unpredictable or bursty, cold starts are acceptable to users, or you want near-zero costs during early development.

Use `--min-instances 1` when the service is user-facing and a 2–5 second first-request delay is visibly unacceptable, or when you have a latency SLA.

---

## Environment Variables and Secrets

Cloud Run passes environment variables to the container at startup via `--set-env-vars`:

```bash
gcloud run deploy my-service \
  --set-env-vars "API_KEY=abc123,DB_URL=postgres://..."
```

For a service that uses a local `.env` file during development, the deploy script can read that file and build the `--set-env-vars` string automatically:

```bash
ENV_VARS=""
while IFS= read -r line || [[ -n "$line" ]]; do
  [[ -z "$line" || "$line" == \#* ]] && continue
  key="${line%%=*}"
  val="${line#*=}"
  val="${val#\"}" val="${val%\"}"
  val="${val#\'}" val="${val%\'}"
  ENV_VARS="${ENV_VARS:+$ENV_VARS,}${key}=${val}"
done < .env

gcloud run deploy my-service --set-env-vars "$ENV_VARS" ...
```

This keeps secrets out of the repository while making deployments repeatable.

**Note:** If a value contains a comma, `--set-env-vars` will silently split it into two variables. Wrap the value in quotes, or migrate that secret to [Google Secret Manager](https://cloud.google.com/secret-manager) with `--set-secrets`. *(A full Secret Manager guide is coming soon.)*

---

## Public Access and Authentication

### The IAM org policy caveat

`--allow-unauthenticated` in the deploy script is not always sufficient. Many GCP organizations have an org policy (`constraints/iam.allowedPolicyMemberTypes`) that blocks `allUsers` from being granted IAM roles — including the Cloud Run Invoker role.

If your deployment succeeds but you get a `403 Forbidden` when calling the URL, this is why.

**Fix via Cloud Console:**

1. Go to **Cloud Run** → select your service
2. Click the **Security** tab
3. Under "Authentication", select **Allow unauthenticated invocations**
4. Click **Save**

This sets the IAM policy directly on the service resource rather than going through the deploy command, and typically bypasses org-level restrictions on the CLI path.

### Handling authentication in your API

Most APIs — even internal ones — need key-based access control. The common pattern for a public Cloud Run service with a third-party gateway (such as RapidAPI):

```
Caller ──▶ Gateway ──▶ Cloud Run
           injects       validates
           X-RapidAPI-Proxy-Secret
```

| Header | Who sends it | What it proves |
|--------|-------------|----------------|
| `X-RapidAPI-Key` | API caller | Valid subscription |
| `X-RapidAPI-Proxy-Secret` | Gateway (injected) | Request came through the gateway |
| `X-Internal-Key` | You (ops/testing) | Direct access, bypassing gateway |

Your service validates `X-RapidAPI-Proxy-Secret` to confirm the request passed through the gateway. The `X-Internal-Key` is a separate secret for direct access during testing and health checks.

**Do not use `X-RapidAPI-Proxy-Secret` as a caller credential.** It is injected by the gateway, not used by callers. Treating it as a caller key is a common mistake that either fails authentication or leaks a backend secret into client-side code.

---

## Post-Deploy Verification

Every deployment should be verified before it is considered done.

**Step 1: health check** — confirms the container started and the server is listening:

```bash
curl https://your-service-url/health
# Expected: {"status": "ok"}
```

**Step 2: functional smoke test** — confirms the service processes a request end to end:

```bash
SECRET=$(grep INTERNAL_KEY .env | cut -d'=' -f2- | tr -d '"')

curl -X POST https://your-service-url/your-endpoint \
  -H "X-Internal-Key: $SECRET" \
  -F "file=@tests/sample.gif" \
  --output /tmp/smoke_output.png

file /tmp/smoke_output.png
```

Reading the secret directly from `.env` (rather than from the shell environment) ensures the test works in a fresh terminal session.

---

## Quick Reference: Common Errors

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| `exec format error` on Cloud Run | Image built for wrong CPU architecture | Add `--platform linux/amd64` to `docker build` |
| Health check fails immediately after deploy | Container listening on wrong host or port | Use `--host 0.0.0.0 --port 8080` in CMD |
| `docker push` returns `unauthorized` | Docker not authenticated to Artifact Registry | Run `gcloud auth configure-docker us-central1-docker.pkg.dev` |
| 403 after deploying with `--allow-unauthenticated` | Org IAM policy blocking `allUsers` | Set public access via Cloud Console (Security tab) |
| Deployment succeeds but old behavior persists | Cloud Run cached old image digest | Force re-deploy: `gcloud run deploy ... --image ...:latest` |
| Cold start latency is unacceptable | Scale-to-zero with a large container | Set `--min-instances 1` or reduce image size |
| `--set-env-vars` silently drops a value | Value contains a comma | Wrap in quotes or migrate to Secret Manager |
| Container killed during request | Memory limit exceeded (OOM) | Increase `--memory` (try `1Gi` or `2Gi`) |

---

## API Reference (For AI Agents)

Machine-readable specification for the example API endpoints defined in this guide. The actual endpoint paths and request/response shapes are determined by your application — replace the placeholders below with your real routes.

```json
{
  "baseUrl": "https://YOUR_SERVICE_URL.run.app",
  "authentication": {
    "type": "header",
    "header": "X-Internal-Key",
    "description": "Shared secret for direct access. Set as Cloud Run environment variable INTERNAL_KEY."
  },
  "endpoints": [
    {
      "name": "health_check",
      "method": "GET",
      "path": "/health",
      "description": "Liveness check. Returns 200 OK when the service is running. No authentication required.",
      "response": {
        "200": { "status": "ok" }
      }
    },
    {
      "name": "process",
      "method": "POST",
      "path": "/process",
      "description": "Main processing endpoint. Replace with your actual route and payload shape.",
      "requestBody": {
        "content-type": "application/json",
        "schema": {
          "type": "object",
          "properties": {
            "input": { "type": "string", "description": "Input data for processing" }
          },
          "required": ["input"]
        }
      },
      "response": {
        "200": {
          "output": "string — processing result"
        },
        "504": "Request exceeded --timeout limit. Increase timeout or break operation into smaller steps."
      }
    }
  ],
  "cloudRunConfig": {
    "memory": "512Mi",
    "cpu": 1,
    "concurrency": 1,
    "maxInstances": 100,
    "timeout": 60,
    "region": "us-central1"
  }
}
```

---

## What's Next

This guide covers the fundamentals. The next natural steps:

- *([Automating Deployments with CI/CD on GCP](/blog/gcp-cicd-cloud-run) — coming soon)* — trigger `release.sh` automatically on every git push to main
- *([Managing Secrets with Google Secret Manager](/blog/gcp-secret-manager) — coming soon)* — audit logging, rotation, and fine-grained IAM access for production secrets
- *([Long-Running Jobs with Cloud Run Jobs](/blog/gcp-cloud-run-jobs) — coming soon)* — for operations that take longer than 60 seconds, Cloud Run Jobs are the right tool

---

## FAQ

**Why does my browser show a CORS error when I fetch the API?**

There are two distinct causes that look identical in the browser. First, your API may not have CORS headers configured — the server must respond with `Access-Control-Allow-Origin` headers for cross-origin requests. Second, and more commonly, the API is not running at all: when a `fetch()` call fails to reach the server entirely (network error, cold start timeout, wrong URL), the browser reports it as a CORS error rather than a connection error. Check the Network tab in DevTools first — if the request never gets a response, the problem is connectivity, not CORS headers.

**How do I tell if it is a CORS problem or the API is down?**

Call the endpoint directly with `curl` from your terminal. If `curl` returns a valid response, the service is up and the issue is CORS headers. If `curl` also fails (connection refused, timeout, 404), the service is not reachable — fix the deployment first, then address CORS.

**How much memory should I allocate?**

Estimate your peak in-memory footprint: sum up the base Python/framework overhead (~50–100 MB), any models or data you load at startup, and the maximum size of a single request payload. Add 30% headroom and round up to the next Cloud Run tier (256Mi, 512Mi, 1Gi, 2Gi, 4Gi, 8Gi). Start conservative and watch Cloud Run's memory utilization metrics in the first few days — it is easy to increase, and an OOM kill is immediately visible in the logs.

**I added `--allow-unauthenticated` but still get 403. Why?**

Your GCP organization likely has an IAM org policy that restricts granting roles to `allUsers` via the CLI. The `--allow-unauthenticated` flag tries to grant the Cloud Run Invoker role to `allUsers` at deploy time, which the org policy blocks. Fix it by going to Cloud Run in the Console → your service → Security tab → set Authentication to "Allow unauthenticated invocations" and save. This route typically bypasses the CLI-level policy restriction.

**My API operation takes more than 5 minutes. Can I still use Cloud Run?**

Cloud Run's maximum request timeout is 60 minutes (configured via `--timeout`), but for operations over 5–10 minutes, a direct API approach becomes fragile — clients time out, connections drop, and retries cause duplicate work. For long-running computation, use **Cloud Run Jobs** instead: submit the work, return a job ID immediately, and let the client poll for completion. A Cloud Run Jobs guide is coming soon.

**What happens when my free tier runs out?**

Cloud Run and Artifact Registry automatically switch to pay-as-you-go billing — there is no service interruption or notification. Cloud Run billing is per-request and per-resource-second, so a service with zero traffic costs nothing even after the free tier is exhausted. Set up budget alerts in the GCP Billing console to get notified before costs become significant.

**Can I use a different port besides 8080?**

You can configure Cloud Run to use a different port with the `--port` flag on `gcloud run deploy`. However, `8080` is the default and widely expected — change it only if you have a specific reason. Whatever port you configure in Cloud Run must match the port your container actually listens on.

**How do I roll back a bad deployment?**

Cloud Run keeps a revision history. In the Console, go to your service → Revisions tab → select any previous revision → click "Manage Traffic" and send 100% of traffic to it. Rollbacks take effect within seconds and do not require a rebuild.
