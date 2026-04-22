# UniIMGC — ClawStudio Frontend Integration Guide

Internal-only guide for calling UniIMGC **directly** from the ClawStudio frontend (bypassing the RapidAPI gateway). Use this when shipping a new feature on the Nuxt portal; for public API consumers see [`uniimgc-api-reference.md`](./uniimgc-api-reference.md).

---

## Overview

| Aspect | Internal (ClawStudio) | Public (RapidAPI) |
|---|---|---|
| Base URL | `https://uniimgc-qfz3nutrvq-uc.a.run.app` (Cloud Run) | `https://easy-heic-image-converter.p.rapidapi.com` |
| Auth header | `X-Internal-Key: <INTERNAL_KEY>` | `x-rapidapi-key: <key>` + `x-rapidapi-host: ...` |
| Rate limits | None (self-hosted) | Tied to RapidAPI tier |
| Billing | Cloud Run egress + compute only | Per-request by RapidAPI |

**Rule:** all server-side calls from ClawStudio Nuxt should go through the internal URL. Never expose `INTERNAL_KEY` or the direct Cloud Run URL to the browser.

---

## Environment variables (ClawStudio Nuxt)

Add to the Nuxt portal's runtime config (`.env` / Cloud Run env vars):

| Variable | Value | Notes |
|---|---|---|
| `NUXT_UNIIMGC_SERVICE_URL` | `https://uniimgc-qfz3nutrvq-uc.a.run.app` | Server-side only |
| `NUXT_UNIIMGC_INTERNAL_KEY` | (match UniIMGC's `INTERNAL_KEY`) | Server-side only |

In `nuxt.config.ts`:

```ts
export default defineNuxtConfig({
  runtimeConfig: {
    // Server-only
    uniimgcServiceUrl: process.env.NUXT_UNIIMGC_SERVICE_URL,
    uniimgcInternalKey: process.env.NUXT_UNIIMGC_INTERNAL_KEY,
  },
});
```

**Never** put these under `public:` — the browser would see them.

---

## Architecture pattern

Don't call UniIMGC from the browser. Always route through a Nuxt server route:

```
  Browser                Nuxt server route              UniIMGC
  (no key)     ─▶        /api/convert              ─▶   /heic (with X-Internal-Key)
               ◀─        returns blob              ◀─   returns blob
```

This gives you:
- The `INTERNAL_KEY` stays on the server
- You can add ClawStudio-specific auth / logging / quota per user
- Easy to swap providers later (internal → RapidAPI fallback, for example)

---

## Example: HEIC → WebP upload handler

**Server route:** `server/api/images/convert-heic.post.ts`

```ts
import { readMultipartFormData } from "h3";

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const parts = await readMultipartFormData(event);
  if (!parts?.length) {
    throw createError({ statusCode: 400, statusMessage: "No file uploaded" });
  }

  const file = parts.find((p) => p.name === "file");
  if (!file) {
    throw createError({ statusCode: 400, statusMessage: "Missing 'file' field" });
  }

  // Forward multipart to UniIMGC, swapping auth header
  const form = new FormData();
  form.append("file", new Blob([file.data]), file.filename ?? "upload");
  form.append("source_format", "heic");
  form.append("target_format", "webp");
  form.append("quality", "85");

  const res = await $fetch.raw<Blob>(`${config.uniimgcServiceUrl}/heic`, {
    method: "POST",
    headers: { "X-Internal-Key": config.uniimgcInternalKey },
    body: form,
    responseType: "blob",
  });

  // Stream the converted WebP straight back to the browser
  setResponseHeader(event, "Content-Type", "image/webp");
  return res._data;
});
```

**Browser usage:**

```ts
async function uploadHeic(file: File) {
  const form = new FormData();
  form.append("file", file);

  const webp = await $fetch<Blob>("/api/images/convert-heic", {
    method: "POST",
    body: form,
  });

  return URL.createObjectURL(webp); // drop into <img src="...">
}
```

---

## Endpoint checklist

The API surface is identical to the public docs — just swap base URL and auth header. See [`uniimgc-api-reference.md`](./uniimgc-api-reference.md) for full parameter details.

| Endpoint | Common ClawStudio use cases |
|---|---|
| `POST /heic` | Normalize iPhone uploads (HEIC → WebP or JPG) |
| `POST /avif` | Generate AVIF variants for high-traffic pages |
| `POST /webp` | Default "make this web-ready" pipeline for user photos |
| `POST /png-to-jpg` | Shrink screenshots before storing |
| `POST /jpg-to-png` | Convert user-uploaded JPG when we need alpha-friendly format |
| `POST /svg-to-png` | Rasterize logos at build time or on upload |
| `POST /favicon` | One-click favicon generator for site-builder products |
| `GET /health` | Uptime check (doesn't require auth) |

---

## Error handling

UniIMGC returns a consistent error body:

```json
{ "error": "invalid_parameter", "message": "quality must be between 0 and 100." }
```

In server routes, translate these into your Nuxt error responses so the browser sees consistent shape:

```ts
try {
  const res = await $fetch.raw(`${config.uniimgcServiceUrl}/heic`, { ... });
  // ...
} catch (e: any) {
  const body = e?.data ?? { error: "upstream_failed", message: "Conversion failed" };
  throw createError({
    statusCode: e?.statusCode ?? 502,
    statusMessage: body.error,
    data: body,
  });
}
```

### Common errors to surface to users

| UniIMGC error | ClawStudio UX |
|---|---|
| `payload_too_large` (413) | "File too large (max 50 MB)" |
| `invalid_file` (400) | "This file isn't a valid image" |
| `invalid_format` (400) | "The file format doesn't match what was expected" |
| `unsupported_conversion` (422) | Log & show generic "Conversion not supported" — this is a bug in our code if users see it |
| `conversion_failed` (500) | "Something went wrong — please try again" + log for debugging |

---

## Limits to respect client-side

Enforce these **before** uploading to avoid wasted bandwidth:

| Check | Where |
|---|---|
| File size ≤ 50 MB | Client-side (File.size) + server-side (just in case) |
| File is image-ish (correct MIME / extension) | Client-side (File.type), reject early |
| Resolution ≤ 89.5 MP | Usually irrelevant; only matters for pathological inputs |

Example pre-flight:

```ts
const MAX_BYTES = 50 * 1024 * 1024;

function validateUpload(file: File) {
  if (file.size > MAX_BYTES) throw new Error("檔案超過 50 MB 限制");
  if (!/^image\//.test(file.type) && !file.name.toLowerCase().endsWith(".heic")) {
    throw new Error("請上傳圖片檔");
  }
}
```

(HEIC files sometimes have empty `file.type` on older browsers — fall back to extension check.)

---

## Performance expectations

Based on container benchmarking (2 GB RAM, 1 vCPU, concurrency=1):

| Conversion | 3024×4032 iPhone photo | Notes |
|---|---|---|
| HEIC → PNG | ~800 ms | PNG encoding dominates |
| HEIC → JPG | ~500 ms | Faster than PNG |
| HEIC → WebP | ~700 ms | |
| PNG → AVIF (speed=6) | ~2–4 s | CPU-intensive |
| PNG → AVIF (speed=3) | ~8–15 s | Only use for CDN pre-processing, not on-demand |
| PNG → WebP | ~300 ms | |
| SVG → PNG (scale=4) | ~50–200 ms | Depends on SVG complexity |
| `/favicon` | ~500 ms | Seven encoding passes |

Cold starts add ~3–5 s on the first request after idle. Set Nuxt's fetch timeout accordingly.

---

## Debugging

### Check service health from a server route

```ts
const health = await $fetch<{ status: string }>(
  `${config.uniimgcServiceUrl}/health`
);
console.log("UniIMGC status:", health.status);  // "ok"
```

`/health` is exempt from auth and size limits — safe to hit as a readiness probe.

### Inspect Cloud Run logs

```bash
gcloud run services logs read uniimgc \
  --region=us-central1 \
  --project=rapid-project-491803 \
  --limit=50
```

Unhandled exceptions log with full traceback. `conversion_failed` (500) responses always have matching entries in logs with the root cause.

---

## Deployment coordination

If you change `NUXT_UNIIMGC_INTERNAL_KEY` on the Nuxt side, also update `INTERNAL_KEY` on UniIMGC's Cloud Run env vars **in the same deploy window** — otherwise requests will 401 until both sides match.

Rotation procedure:

1. Generate new key value
2. Deploy UniIMGC with the **new** key added (don't remove old one yet) — if supporting rotation becomes a need, we'd need to change auth middleware to accept a list. Currently it's single-valued, so this is a hard cut-over.
3. Deploy ClawStudio with the new key
4. Verify via `/health` + one real conversion
5. Remove old key from UniIMGC

For zero-downtime rotation, we'd extend `app/core/auth.py` to compare against a comma-separated list. Not implemented yet — file an issue if this becomes a blocker.

---

## Cross-references

- [`uniimgc-api-reference.md`](./uniimgc-api-reference.md) — full parameter reference
- [`tutorial-en.md`](./tutorial-en.md) — narrative tutorial (public, but useful as a cookbook)
- [`superpowers/specs/2026-04-21-universal-image-converter-design.md`](./superpowers/specs/2026-04-21-universal-image-converter-design.md) — design spec & architecture decisions
