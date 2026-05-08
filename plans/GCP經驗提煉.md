---
title: "Setting Up an API Service on GCP Cloud Run"
description: "A practical guide to deploying a containerized API on GCP from scratch — Artifact Registry, Cloud Run configuration, environment variable injection, and a repeatable one-command release pipeline."
date: "2026-05-08"
readingTime: 12
tag: "guide"
---

<!-- ─────────────────────────────────────────────────────────────
     WRITER'S NOTE
     This draft was produced from direct engineering experience.
     Every script, command, and parameter value shown here was used
     in a real production deployment. The role of the writing team
     is to smooth the prose and adjust the narrative voice —
     the technical content is accurate as-is.
     ───────────────────────────────────────────────────────────── -->

## What This Covers

This guide walks through deploying a containerized Python API service to Google Cloud Platform — from the first `gcloud` command to a repeatable one-command release pipeline. It covers the decisions that matter in practice: which Cloud Run parameters to set and why, how to handle secrets and environment variables, when to pay for always-on instances versus accepting cold starts, and what to verify after every deployment.

The setup is language-agnostic in principle. The examples use Python (FastAPI + uvicorn), but the GCP-side steps apply to any containerized service.

---

## The Two Services You Actually Need

GCP has a sprawling catalog. For deploying and running a containerized API, you need exactly two services:

**Artifact Registry** stores your Docker images. Think of it as a private Docker Hub that lives inside your GCP project. Cloud Run pulls images from here at deploy time.

**Cloud Run** is the managed container runtime. It handles HTTPS termination, scaling, health checks, and deployment rollbacks automatically. You give it an image and a set of parameters; it runs your container and exposes it at a stable URL.

Everything else — Cloud Build, Cloud Storage, IAM service accounts — is optional. The minimum viable setup is Artifact Registry plus Cloud Run.

---

## One-Time Setup: Artifact Registry

Before any deployment can happen, you need a repository inside Artifact Registry to hold your images. This is a one-time step.

```bash
gcloud artifacts repositories create my-service \
  --repository-format=docker \
  --location=us-central1 \
  --project=YOUR_PROJECT_ID \
  --description="Container images for my-service"
```

After this, your image name will follow the pattern:

```
us-central1-docker.pkg.dev/YOUR_PROJECT_ID/my-service/my-service:latest
```

**Cleanup policy.** Artifact Registry charges for storage. Without a cleanup policy, old image layers accumulate silently. Apply a policy that keeps the three most recent versions and deletes anything older than 30 days:

```bash
gcloud artifacts repositories set-cleanup-policies my-service \
  --location=us-central1 \
  --project=YOUR_PROJECT_ID \
  --policy=cleanup-policy.json \
  --no-dry-run
```

Where `cleanup-policy.json` contains:

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

This policy is idempotent — safe to re-run at any time. The `--no-dry-run` flag is required; without it, the policy is evaluated but not applied.

---

## The Dockerfile

Cloud Run runs any container that listens on port `8080` and exits cleanly on `SIGTERM`. Beyond that, there are no constraints.

For a Python API service, the minimal production-ready Dockerfile looks like this:

```dockerfile
FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ ./app/

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
```

Three things worth noting:

- **`python:3.12-slim`** instead of `python:3.12`. The slim variant omits compilers, test tools, and documentation. Smaller image = faster pulls at deploy time and lower Artifact Registry storage costs.
- **`--no-cache-dir`** on pip install prevents pip from writing its cache to the image layer. Since the cache is never reused inside the running container, it's pure waste.
- **Port `8080` is mandatory.** Cloud Run forwards all traffic to this port; the container must listen here. The host must be `0.0.0.0`, not `localhost` or `127.0.0.1`, or Cloud Run's health checks will fail.

---

## The Release Pipeline

The build → push → deploy sequence runs on every release. Scripting it in three composable pieces makes each step testable independently:

**`scripts/build.sh`** — builds the image for the correct platform:

```bash
#!/usr/bin/env bash
set -euo pipefail

IMAGE="us-central1-docker.pkg.dev/YOUR_PROJECT_ID/my-service/my-service:latest"

docker build --platform linux/amd64 -t "$IMAGE" .
```

The `--platform linux/amd64` flag is critical if you develop on an Apple Silicon Mac. Without it, Docker builds an `arm64` image that Cloud Run silently rejects. The flag forces a cross-platform build that matches Cloud Run's underlying hardware.

**`scripts/push.sh`** — authenticates Docker to Artifact Registry and pushes:

```bash
#!/usr/bin/env bash
set -euo pipefail

IMAGE="us-central1-docker.pkg.dev/YOUR_PROJECT_ID/my-service/my-service:latest"

gcloud auth configure-docker us-central1-docker.pkg.dev --quiet
docker push "$IMAGE"
```

`gcloud auth configure-docker` writes the Artifact Registry credential helper to `~/.docker/config.json`. You only need to run this once per machine, but including it in the script makes it safe to run from a fresh environment — it's idempotent.

**`scripts/deploy.sh`** — deploys the pushed image to Cloud Run:

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

With this structure, `bash scripts/release.sh` is the only command needed to ship a new version.

---

## Cloud Run Configuration: Every Parameter Explained

The `gcloud run deploy` parameters have real consequences. Here is what each one controls and why the values above were chosen.

| Parameter | Value | Reasoning |
|-----------|-------|-----------|
| `--memory` | `512Mi` | Most image processing APIs fit comfortably in 512 MiB. Start here; Cloud Run metrics will show if you need more. |
| `--cpu` | `1` | One vCPU per instance. CPU is only allocated while a request is being processed — no idle billing. |
| `--concurrency` | `1` | Each instance handles one request at a time. This is appropriate for CPU-bound work (image processing, file conversion) where parallel requests on a single instance would compete for CPU and degrade both. For I/O-bound services, this can be raised to 10–80. |
| `--max-instances` | `100` | Caps the number of concurrent instances. Prevents runaway scaling from an attack or traffic spike. Set based on acceptable worst-case cost, not expected traffic. |
| `--timeout` | `60` | Request timeout in seconds. Cloud Run terminates the request and returns a 504 if processing exceeds this. Size it to your slowest expected operation with room to spare. |
| `--allow-unauthenticated` | — | Makes the Cloud Run URL publicly accessible. Remove this if you're putting the service behind a separate gateway that handles auth — then only the gateway needs access. |

**What `--concurrency 1` means in practice.** With concurrency set to 1, each active request gets its own instance. If two requests arrive simultaneously, Cloud Run spins up a second instance rather than queuing the second request behind the first. This means your service scales horizontally by instance count, not by request queue depth. For CPU-bound work, this is the correct model.

---

## Scale to Zero: The Cold Start Trade-off

Cloud Run's default behavior — and its main cost advantage — is **scale to zero**: when there are no active requests, Cloud Run shuts down all instances. You pay nothing while the service is idle.

The catch is **cold start latency**. When a request arrives after a period of inactivity, Cloud Run must start a new container from scratch before it can respond. For a Python API with typical dependencies, this takes 2–5 seconds.

The configuration parameter is `--min-instances`:

| Setting | Behavior | Cost |
|---------|----------|------|
| `--min-instances 0` (default) | Scale to zero. Cold starts on first request after idle. | Zero when idle |
| `--min-instances 1` | One instance always running. No cold starts, ever. | ~$10–15/month for 512Mi/1 vCPU |

**When to use each:**

Use `--min-instances 0` (the default) when:
- Traffic is unpredictable or bursty, with genuine idle periods
- The occasional 2–5 second cold start is acceptable to users
- You want predictable, near-zero costs during development or low-traffic phases

Use `--min-instances 1` when:
- The service is user-facing and cold start latency is visible and unacceptable
- You have a latency SLA that cold starts would violate
- The service is behind a health check that marks it unavailable if it doesn't respond in time

The cost of `--min-instances 1` is low in absolute terms — roughly the price of one coffee per month — but the principle matters at scale. If you run ten services with always-on instances, the idle billing adds up fast.

---

## Environment Variables and Secrets

Cloud Run passes environment variables to the container at startup. The `--set-env-vars` flag takes a comma-separated list:

```bash
gcloud run deploy my-service \
  --set-env-vars "API_KEY=abc123,DB_URL=postgres://..."
```

For a service that reads secrets from a local `.env` file during development, the deploy script can read that file and build the `--set-env-vars` string automatically:

```bash
# Read .env and build comma-separated KEY=VALUE string
ENV_VARS=""
while IFS= read -r line || [[ -n "$line" ]]; do
  [[ -z "$line" || "$line" == \#* ]] && continue
  key="${line%%=*}"
  val="${line#*=}"
  val="${val#\"}" val="${val%\"}"   # strip surrounding quotes
  val="${val#\'}" val="${val%\'}"
  ENV_VARS="${ENV_VARS:+$ENV_VARS,}${key}=${val}"
done < .env

gcloud run deploy my-service --set-env-vars "$ENV_VARS" ...
```

This approach keeps secrets out of the repository (`.env` is gitignored) while making deployments repeatable.

**For production.** The pattern above works well for small teams and early-stage services. For services with stricter compliance requirements, use [Google Secret Manager](https://cloud.google.com/secret-manager) instead — it provides audit logging, rotation, and fine-grained IAM access control. Cloud Run has native integration via `--set-secrets`.

---

## Two-Layer Authentication

If your Cloud Run service sits behind a third-party API gateway (such as RapidAPI), two distinct authentication headers are in play:

```
Caller → Gateway:    X-RapidAPI-Key: <caller's subscription key>
Gateway → Cloud Run: X-RapidAPI-Proxy-Secret: <shared backend secret>
```

The **caller key** (`X-RapidAPI-Key`) identifies the API subscriber. The caller sends this; your backend never sees it — the gateway validates it and strips it before forwarding.

The **proxy secret** (`X-RapidAPI-Proxy-Secret`) is a shared secret between the gateway and your Cloud Run service. The gateway injects it on every forwarded request. Your service validates it to confirm the request came through the gateway, not directly from the internet.

An **internal key** (`X-Internal-Key`) is a separate secret for direct access — bypassing the gateway entirely. This is useful for health checks, smoke tests, and administrative operations where you don't want the request going through the third-party gateway.

The three headers are not interchangeable:

| Header | Who sends it | What it proves |
|--------|-------------|----------------|
| `X-RapidAPI-Key` | API caller | Valid subscription |
| `X-RapidAPI-Proxy-Secret` | Gateway | Request passed through gateway |
| `X-Internal-Key` | You (ops/testing) | Direct, trusted access |

**Do not use `X-RapidAPI-Proxy-Secret` to call the gateway.** It's injected by the gateway, not used by callers. Using it as a caller credential is a common mistake and will either fail authentication or expose a backend secret in client-side code.

---

## Post-Deploy Verification

Every deployment should be verified before it's considered done. A two-step smoke test covers the essential cases.

**Step 1: health check** — confirms the container started and the server is listening:

```bash
curl https://your-service-url/health
# Expected: {"status": "ok"}
```

**Step 2: functional smoke test** — confirms the service actually processes a request end to end:

```bash
# Read secrets from .env rather than relying on shell environment
SECRET=$(grep INTERNAL_KEY .env | cut -d'=' -f2- | tr -d '"')

curl -X POST https://your-service-url/your-endpoint \
  -H "X-Internal-Key: $SECRET" \
  -F "file=@tests/sample.gif" \
  --output /tmp/smoke_output.png

# Verify the output is a valid file
file /tmp/smoke_output.png
```

Reading the secret from `.env` directly (rather than from `$SECRET` in the shell environment) ensures the test works in a fresh shell session — environment variables set in one terminal session are not visible to tools that spawn their own shells.

---

## Quick Reference

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| `exec format error` on Cloud Run | Image built for wrong architecture | Add `--platform linux/amd64` to `docker build` |
| Health check fails immediately after deploy | Container listening on wrong host or port | Ensure `--host 0.0.0.0 --port 8080` in CMD |
| `docker push` returns `unauthorized` | Docker not authenticated to Artifact Registry | Run `gcloud auth configure-docker us-central1-docker.pkg.dev` |
| Deployment succeeds but old behavior persists | Image tagged `:latest` but Cloud Run cached old digest | Force re-deploy: `gcloud run deploy ... --image ...:latest` |
| Cold start latency is unacceptable | `--min-instances 0` with a large container | Set `--min-instances 1` or reduce image size |
| `--set-env-vars` silently drops a value | Value contains commas | Wrap value in quotes, or migrate to Secret Manager |
