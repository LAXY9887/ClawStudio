# Easy HEIC & Image Converter — API Reference

Convert images between HEIC, AVIF, WebP, PNG, JPG, and SVG in one HTTP request. Generate full favicon packs (7 files) from a single source image. Built for frontend engineers, SaaS platforms, and automation pipelines.

> **Known issues with the RapidAPI in-browser Console:** (1) multipart parts are capped at 1024 KB — use a sub-1 MB file when testing; (2) binary file uploads are sometimes serialized as a base64-encoded JSON string instead of a real multipart file part, causing errors like `Expected UploadFile, received: <class 'str'>`. These are Console-only quirks unrelated to the API itself. For reliable testing use `curl` (snippets below) or any real HTTP client — the API accepts standard multipart uploads up to 50 MB.

---

## Quick Start

```bash
curl -X POST 'https://easy-heic-image-converter.p.rapidapi.com/heic' \
  -H 'x-rapidapi-host: easy-heic-image-converter.p.rapidapi.com' \
  -H 'x-rapidapi-key: YOUR_RAPIDAPI_KEY' \
  -F 'file=@photo.heic' \
  -F 'source_format=heic' \
  -F 'target_format=jpg' \
  -o photo.jpg
```

That's it — your HEIC photo is now a JPG.

---

## Authentication

All requests must include these two headers (provided by your RapidAPI subscription):

| Header | Description |
|---|---|
| `x-rapidapi-host` | `easy-heic-image-converter.p.rapidapi.com` |
| `x-rapidapi-key` | Your RapidAPI subscription key |

Missing or invalid keys return `401 Unauthorized`.

---

## Endpoints at a glance

| Method | Path | Purpose |
|---|---|---|
| `GET` | [`/health`](#get-health) | Liveness probe (no auth required). |
| `POST` | [`/heic`](#post-heic) | Convert between HEIC ↔ PNG / JPG / WebP. |
| `POST` | [`/avif`](#post-avif) | Convert between AVIF ↔ PNG / JPG / WebP. |
| `POST` | [`/webp`](#post-webp) | Convert any image → WebP, or WebP → PNG / JPG. |
| `POST` | [`/png-to-jpg`](#post-png-to-jpg) | Convert PNG → JPG (flattens alpha onto white). |
| `POST` | [`/jpg-to-png`](#post-jpg-to-png) | Convert JPG → PNG. |
| `POST` | [`/svg-to-png`](#post-svg-to-png) | Rasterize SVG → PNG with optional scale. |
| `POST` | [`/favicon`](#post-favicon) | Generate a full favicon pack (7 files) as a ZIP. |

---

## Global Limits

| Limit | Value | Behavior on violation |
|---|---|---|
| Max request body | 50 MB | `HTTP 413 payload_too_large` |
| Max image resolution | ~89.5 MP | `HTTP 400 invalid_file` (decompression bomb protection) |
| Request timeout | 300 s | Cloud Run aborts the connection |

All processing happens in memory — no files are retained on the server.

---

## `GET /health`

Returns `{"status": "ok"}`. Exempt from auth and size limits. Useful for uptime probes.

---

## `POST /heic`

Convert between HEIC and PNG/JPG/WebP in either direction. At least one side of the conversion must be HEIC; use `/webp` or `/png-to-jpg` for conversions that don't involve HEIC.

**Content-Type:** `multipart/form-data`

### Parameters

| Param | Type | Required | Default | Description |
|---|---|---|---|---|
| `file` | file | **yes** | — | Source image. |
| `source_format` | string | **yes** | — | `heic`, `jpg`, `png`, or `webp`. Must match the file's actual format. |
| `target_format` | string | **yes** | — | `heic`, `jpg`, `png`, or `webp`. Must differ from `source_format`. |
| `quality` | int (0–100) | no | `90` | JPEG / HEIC encoding quality. Ignored for lossless output formats (PNG / WebP lossless). |

### Response

| Status | Content-Type | Body |
|---|---|---|
| `200` | `image/heic`, `image/jpeg`, `image/png`, or `image/webp` | Converted image |
| `400` | `application/json` | `invalid_format` — file couldn't be decoded as the declared source format |
| `422` | `application/json` | `unsupported_conversion` — same source/target, or neither side is HEIC |
| `422` | `application/json` | `invalid_parameter` — `quality` out of range |

### Examples

```bash
# HEIC -> JPG
curl -X POST 'https://easy-heic-image-converter.p.rapidapi.com/heic' \
  -H 'x-rapidapi-host: easy-heic-image-converter.p.rapidapi.com' \
  -H 'x-rapidapi-key: YOUR_RAPIDAPI_KEY' \
  -F 'file=@IMG_3041.HEIC' \
  -F 'source_format=heic' -F 'target_format=jpg' \
  -F 'quality=85' \
  -o photo.jpg

# JPG -> HEIC (reverse)
curl -X POST 'https://easy-heic-image-converter.p.rapidapi.com/heic' \
  -H 'x-rapidapi-host: easy-heic-image-converter.p.rapidapi.com' \
  -H 'x-rapidapi-key: YOUR_RAPIDAPI_KEY' \
  -F 'file=@photo.jpg' \
  -F 'source_format=jpg' -F 'target_format=heic' \
  -o photo.heic
```

---

## `POST /avif`

Convert between AVIF and PNG/JPG/WebP in either direction. At least one side must be AVIF.

**Content-Type:** `multipart/form-data`

### Parameters

| Param | Type | Required | Default | Description |
|---|---|---|---|---|
| `file` | file | **yes** | — | Source image. |
| `source_format` | string | **yes** | — | `avif`, `jpg`, `png`, or `webp`. |
| `target_format` | string | **yes** | — | `avif`, `jpg`, `png`, or `webp`. Must differ from `source_format`. |
| `quality` | int (0–100) | no | `90` | Encoder quality. Higher = bigger file, better fidelity. |
| `speed` | int (**3–10**) | no | `6` | AVIF encoder speed. Lower = slower but better compression. Values **0–2 are disabled** to avoid request timeouts on large photos. |

### Response

| Status | Content-Type | Body |
|---|---|---|
| `200` | `image/avif`, `image/jpeg`, `image/png`, or `image/webp` | Converted image |
| `400` | `application/json` | `invalid_format` |
| `422` | `application/json` | `unsupported_conversion` — same source/target, or neither side is AVIF |
| `422` | `application/json` | `invalid_parameter` — `quality` or `speed` out of range |

### Examples

```bash
# PNG -> AVIF (best compression)
curl -X POST 'https://easy-heic-image-converter.p.rapidapi.com/avif' \
  -H 'x-rapidapi-host: easy-heic-image-converter.p.rapidapi.com' \
  -H 'x-rapidapi-key: YOUR_RAPIDAPI_KEY' \
  -F 'file=@photo.png' \
  -F 'source_format=png' -F 'target_format=avif' \
  -F 'quality=75' -F 'speed=3' \
  -o photo.avif

# AVIF -> WebP (fast fallback for older browsers)
curl -X POST 'https://easy-heic-image-converter.p.rapidapi.com/avif' \
  -H 'x-rapidapi-host: easy-heic-image-converter.p.rapidapi.com' \
  -H 'x-rapidapi-key: YOUR_RAPIDAPI_KEY' \
  -F 'file=@photo.avif' \
  -F 'source_format=avif' -F 'target_format=webp' \
  -o photo.webp
```

---

## `POST /webp`

Convert any image to WebP, or convert WebP to PNG / JPG. The direction is auto-detected: if the uploaded file is WebP, it's decoded to `target_format`; otherwise it's encoded to WebP.

**Content-Type:** `multipart/form-data`

### Parameters

| Param | Type | Required | Default | Description |
|---|---|---|---|---|
| `file` | file | **yes** | — | Source image (PNG, JPG, or WebP). |
| `target_format` | string | only when input is WebP | — | `png` or `jpg`. Ignored when encoding **to** WebP. |
| `quality` | int (0–100) | no | `80` | WebP encoding quality. Ignored when decoding from WebP. |
| `lossless` | bool | no | `false` | Use lossless WebP encoding. Output can be ~5× larger than lossy. |

### Response

| Status | Content-Type | Body |
|---|---|---|
| `200` | `image/webp`, `image/png`, or `image/jpeg` | Converted image |
| `400` | `application/json` | `invalid_file` or `invalid_format` |
| `422` | `application/json` | `missing_parameter` — WebP input without `target_format` |
| `422` | `application/json` | `invalid_parameter` — `quality` out of range |

### Examples

```bash
# PNG -> WebP
curl -X POST 'https://easy-heic-image-converter.p.rapidapi.com/webp' \
  -H 'x-rapidapi-host: easy-heic-image-converter.p.rapidapi.com' \
  -H 'x-rapidapi-key: YOUR_RAPIDAPI_KEY' \
  -F 'file=@photo.png' \
  -F 'quality=85' \
  -o photo.webp

# PNG -> Lossless WebP
curl -X POST 'https://easy-heic-image-converter.p.rapidapi.com/webp' \
  -H 'x-rapidapi-host: easy-heic-image-converter.p.rapidapi.com' \
  -H 'x-rapidapi-key: YOUR_RAPIDAPI_KEY' \
  -F 'file=@icon.png' \
  -F 'lossless=true' \
  -o icon.webp

# WebP -> JPG
curl -X POST 'https://easy-heic-image-converter.p.rapidapi.com/webp' \
  -H 'x-rapidapi-host: easy-heic-image-converter.p.rapidapi.com' \
  -H 'x-rapidapi-key: YOUR_RAPIDAPI_KEY' \
  -F 'file=@photo.webp' \
  -F 'target_format=jpg' \
  -o photo.jpg
```

---

## `POST /png-to-jpg`

Convert PNG to JPG. Transparent pixels are flattened onto a white background (JPEG has no alpha channel).

**Content-Type:** `multipart/form-data`

### Parameters

| Param | Type | Required | Default | Description |
|---|---|---|---|---|
| `file` | file | **yes** | — | PNG image. |
| `quality` | int (0–100) | no | `90` | JPEG encoding quality. |

### Response

| Status | Content-Type | Body |
|---|---|---|
| `200` | `image/jpeg` | JPG image |
| `400` | `application/json` | `invalid_format` — input is not a valid PNG |
| `422` | `application/json` | `invalid_parameter` — `quality` out of range |

### Example

```bash
curl -X POST 'https://easy-heic-image-converter.p.rapidapi.com/png-to-jpg' \
  -H 'x-rapidapi-host: easy-heic-image-converter.p.rapidapi.com' \
  -H 'x-rapidapi-key: YOUR_RAPIDAPI_KEY' \
  -F 'file=@screenshot.png' \
  -F 'quality=85' \
  -o screenshot.jpg
```

---

## `POST /jpg-to-png`

Convert JPG to PNG (lossless).

**Content-Type:** `multipart/form-data`

### Parameters

| Param | Type | Required | Default | Description |
|---|---|---|---|---|
| `file` | file | **yes** | — | JPG image. |

### Response

| Status | Content-Type | Body |
|---|---|---|
| `200` | `image/png` | PNG image |
| `400` | `application/json` | `invalid_format` — input is not a valid JPG |

### Example

```bash
curl -X POST 'https://easy-heic-image-converter.p.rapidapi.com/jpg-to-png' \
  -H 'x-rapidapi-host: easy-heic-image-converter.p.rapidapi.com' \
  -H 'x-rapidapi-key: YOUR_RAPIDAPI_KEY' \
  -F 'file=@photo.jpg' \
  -o photo.png
```

---

## `POST /svg-to-png`

Rasterize SVG to PNG. You can control the output size by either supplying absolute pixel dimensions (`width` / `height`) or a `scale` multiplier.

**Content-Type:** `multipart/form-data`

### Parameters

| Param | Type | Required | Default | Description |
|---|---|---|---|---|
| `file` | file | **yes** | — | SVG source. |
| `width` | int (1–8192) | no | — | Absolute output width in pixels. |
| `height` | int (1–8192) | no | — | Absolute output height in pixels. |
| `scale` | float (0.1–10.0) | no | `1.0` | Multiplier applied to the SVG's native viewBox. **Ignored if `width` or `height` is given.** |

### Sizing rules

| What you send | Output size | Aspect ratio |
|---|---|---|
| Only `width` | `width × (width / viewBox_w × viewBox_h)` | Preserved |
| Only `height` | `(height / viewBox_h × viewBox_w) × height` | Preserved |
| Both `width` + `height` | Exactly `width × height` | **Stretched** if ratio differs from viewBox |
| Neither | `viewBox × scale` | Preserved |

Use absolute dimensions when you know the target size (e.g. "I need a 512×512 favicon master"). Use `scale` when your SVG already has correct proportions and you just want a retina multiplier.

### Response

| Status | Content-Type | Body |
|---|---|---|
| `200` | `image/png` | Rasterized PNG (RGBA) |
| `400` | `application/json` | `invalid_file` — SVG couldn't be parsed |
| `422` | `application/json` | `invalid_parameter` — `width`, `height`, or `scale` out of range |

### Examples

```bash
# Option 1: absolute width (aspect preserved)
curl -X POST 'https://easy-heic-image-converter.p.rapidapi.com/svg-to-png' \
  -H 'x-rapidapi-host: easy-heic-image-converter.p.rapidapi.com' \
  -H 'x-rapidapi-key: YOUR_RAPIDAPI_KEY' \
  -F 'file=@logo.svg' \
  -F 'width=512' \
  -o logo-512.png

# Option 2: exact dimensions (stretches if aspect mismatches)
curl -X POST 'https://easy-heic-image-converter.p.rapidapi.com/svg-to-png' \
  -H 'x-rapidapi-host: easy-heic-image-converter.p.rapidapi.com' \
  -H 'x-rapidapi-key: YOUR_RAPIDAPI_KEY' \
  -F 'file=@logo.svg' \
  -F 'width=1200' -F 'height=630' \
  -o og-image.png

# Option 3: scale multiplier (for retina, when SVG already has correct proportions)
curl -X POST 'https://easy-heic-image-converter.p.rapidapi.com/svg-to-png' \
  -H 'x-rapidapi-host: easy-heic-image-converter.p.rapidapi.com' \
  -H 'x-rapidapi-key: YOUR_RAPIDAPI_KEY' \
  -F 'file=@logo.svg' \
  -F 'scale=2.0' \
  -o logo@2x.png
```

---

## `POST /favicon`

Generate a complete favicon pack from a single source image. Returns a ZIP containing all the files a modern website needs.

**Content-Type:** `multipart/form-data`

### Parameters

| Param | Type | Required | Description |
|---|---|---|---|
| `file` | file | **yes** | Source image (PNG, JPG, WebP, or any format Pillow can decode). For best results use a square image at least 512×512. |

### Response

`HTTP 200` with `Content-Type: application/zip` containing:

| File | Size | Purpose |
|---|---|---|
| `favicon.ico` | 16×16, 32×32, 48×48 (multi-resolution) | Classic `<link rel="icon">` for all browsers |
| `favicon-16x16.png` | 16×16 | Small browser tab icon |
| `favicon-32x32.png` | 32×32 | Standard browser tab icon |
| `apple-touch-icon.png` | 180×180 | iOS home screen icon |
| `android-chrome-192x192.png` | 192×192 | Android / PWA icon |
| `android-chrome-512x512.png` | 512×512 | PWA splash / high-DPI icon |
| `site.webmanifest` | — | PWA manifest stub (edit `name` / `short_name` after extraction) |

### HTML snippet

After extracting the ZIP to your site's document root, include:

```html
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<link rel="shortcut icon" href="/favicon.ico">
```

### Errors

| Status | Meaning |
|---|---|
| `400` | `invalid_file` — image couldn't be decoded |
| `400` | `invalid_file` — SVG input is not supported (use `/svg-to-png` first, then pipe the PNG here) |

### Example

```bash
curl -X POST 'https://easy-heic-image-converter.p.rapidapi.com/favicon' \
  -H 'x-rapidapi-host: easy-heic-image-converter.p.rapidapi.com' \
  -H 'x-rapidapi-key: YOUR_RAPIDAPI_KEY' \
  -F 'file=@logo.png' \
  -o favicon-pack.zip

unzip favicon-pack.zip -d public/
```

---

## Error Format

All error responses (status `4xx` / `5xx`) use a consistent JSON shape:

```json
{
  "error": "<error_code>",
  "message": "<human-readable message>"
}
```

### Error codes

| Code | HTTP | Meaning |
|---|---|---|
| `unauthorized` | 401 | Missing / invalid RapidAPI key |
| `payload_too_large` | 413 | Upload exceeds 50 MB |
| `invalid_file` | 400 | Image couldn't be decoded |
| `invalid_format` | 400 | Declared format doesn't match actual bytes |
| `invalid_parameter` | 422 | Parameter out of range |
| `missing_parameter` | 422 | Required parameter missing |
| `unsupported_conversion` | 422 | Source/target combination not supported |
| `conversion_failed` | 500 | Unexpected server error during encoding |

---

## Input Format Reference

| Endpoint | Accepted input formats |
|---|---|
| `/heic` | HEIC, JPG, PNG, WebP (must match `source_format`) |
| `/avif` | AVIF, JPG, PNG, WebP (must match `source_format`) |
| `/webp` | PNG, JPG, WebP (auto-detected) |
| `/png-to-jpg` | PNG |
| `/jpg-to-png` | JPG |
| `/svg-to-png` | SVG |
| `/favicon` | PNG, JPG, WebP (SVG not supported — rasterize first) |

---

## FAQ

**Q: Can I convert PNG directly to JPG using `/heic` or `/avif`?**
No. `/heic` and `/avif` both require at least one side of the conversion to be HEIC or AVIF respectively. Use `/png-to-jpg` or `/webp` for conversions between PNG / JPG / WebP.

**Q: Why is there no `direction` parameter on `/webp`?**
`/webp` auto-detects the direction from the uploaded file's bytes. If you send a WebP file, you must specify `target_format=png` or `target_format=jpg`. If you send anything else, it gets encoded to WebP.

**Q: Is `/favicon` lossless?**
The PNG outputs (16×16, 32×32, etc.) are lossless. The `favicon.ico` uses PNG-compressed frames internally so it's also lossless.

**Q: Can I submit an SVG to `/favicon`?**
Not directly — Pillow can't read SVG. Rasterize the SVG via `/svg-to-png` first with `width=512` (or higher) to get a proper favicon master, then feed the PNG into `/favicon`.

**Q: My AVIF conversions time out. What do I do?**
Raise `speed` (e.g. `speed=8`) — this trades compression ratio for encoding speed. For very large photos, also consider resizing before conversion.

**Q: Is my data stored?**
No. All processing is in-memory. Upload and output buffers are discarded immediately after the response.

**Q: What's the maximum image I can convert?**
Requests are capped at 50 MB upload body, and images are capped at ~89.5 MP (to prevent decompression bombs). In practice a 3024×4032 iPhone photo (~1.5 MB HEIC) is well within limits.
