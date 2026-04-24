# EXIFRm API Reference

**Base URL (RapidAPI):** `https://exifrm.p.rapidapi.com`

**Base URL (Cloud Run):** `https://exifrm-934861542626.us-central1.run.app`

All requests must include the standard RapidAPI authentication header:

```
X-RapidAPI-Key: YOUR_API_KEY
X-RapidAPI-Host: exifrm.p.rapidapi.com
```

## Endpoints

| Method | Path | Plan | Description |
| ------ | ---- | ---- | ----------- |
| `POST` | `/scan` | Free | Scan a single image for privacy risks |
| `POST` | `/clean` | Free | Strip all EXIF from a single image |
| `POST` | `/batch/scan` | Pro | Scan up to 50 images in one request |
| `POST` | `/batch/clean` | Pro | Clean up to 10 images, returns a ZIP |
| `GET` | `/health` | — | Service health check (no auth required) |

---

## POST /scan

Scan a single image and return a structured JSON privacy report. Returns GPS coordinates (decimal), device make/model, software version, and timestamp if present.

### Request

**Content-Type:** `multipart/form-data`

| Parameter | Type | Required | Description |
| --------- | ---- | -------- | ----------- |
| `file` | file | Yes | Image file to scan. Accepted: JPEG, PNG, WebP, AVIF, TIFF, HEIC/HEIF |

### Response

| Status | Content-Type | Body |
| ------ | ------------ | ---- |
| `200 OK` | `application/json` | Privacy report (see below) |
| `400` | `application/json` | See [Error Responses](#error-responses) |
| `403` | `application/json` | Missing or invalid API key |
| `413` | `application/json` | File exceeds 50 MB |
| `500` | `application/json` | Internal processing error |

**200 response body:**

```json
{
  "hasPrivacyRisk": true,
  "summary": {
    "gps": {
      "lat": 25.033,
      "lng": 121.565,
      "altitude": 42.3,
      "direction": 183.5
    },
    "device": "Apple iPhone 17 Pro",
    "software": "26.2.1",
    "timestamp": "2026-02-18T17:02:42Z"
  },
  "raw": {
    "EXIF:Make": "Apple",
    "EXIF:Model": "iPhone 17 Pro",
    "Composite:GPSLatitude": 25.033,
    "Composite:GPSLongitude": 121.565
  }
}
```

- **`hasPrivacyRisk`** — `true` if any privacy-relevant field is present; `false` if the image has no detectable metadata
- **`summary`** — structured extraction; fields are omitted when not present in the image (`gps` is omitted entirely if no GPS tags exist)
- **`summary.gps.direction`** — compass heading of the camera at capture time; omitted if not present
- **`raw`** — full ExifTool tag dump for debugging or custom extraction; always present, may be empty `{}`

### Examples

**Scan a JPEG:**

```bash
curl -X POST https://exifrm.p.rapidapi.com/scan \
  -H "X-RapidAPI-Key: YOUR_API_KEY" \
  -H "X-RapidAPI-Host: exifrm.p.rapidapi.com" \
  -F "file=@photo.jpg"
```

**Scan a HEIC photo from an iPhone:**

```bash
curl -X POST https://exifrm.p.rapidapi.com/scan \
  -H "X-RapidAPI-Key: YOUR_API_KEY" \
  -H "X-RapidAPI-Host: exifrm.p.rapidapi.com" \
  -F "file=@IMG_3041.HEIC"
```

**Check if an image is clean (no privacy risk):**

```bash
curl -X POST https://exifrm.p.rapidapi.com/scan \
  -H "X-RapidAPI-Key: YOUR_API_KEY" \
  -H "X-RapidAPI-Host: exifrm.p.rapidapi.com" \
  -F "file=@exported.png" \
  | jq '.hasPrivacyRisk'
```

---

## POST /clean

Strip all EXIF metadata from a single image and return the cleaned file. The response `Content-Type` matches the input format — JPEG in, JPEG out.

- **HEIC/HEIF:** ExifTool strips metadata in-place. No re-encoding, zero quality loss.
- **All other formats:** Re-encoded by Pillow with `exif=b""`. Embedded ICC colour profile is extracted and re-embedded so colours stay accurate.

The `Content-Disposition` header on the response carries the original filename.

### Request

**Content-Type:** `multipart/form-data`

| Parameter | Type | Required | Description |
| --------- | ---- | -------- | ----------- |
| `file` | file | Yes | Image file to clean. Accepted: JPEG, PNG, WebP, AVIF, TIFF, HEIC/HEIF |

### Response

| Status | Content-Type | Body |
| ------ | ------------ | ---- |
| `200 OK` | Matches input format (e.g. `image/jpeg`) | Cleaned image binary |
| `400` | `application/json` | See [Error Responses](#error-responses) |
| `403` | `application/json` | Missing or invalid API key |
| `413` | `application/json` | File exceeds 50 MB |
| `500` | `application/json` | Internal processing error |

### Examples

**Clean a JPEG and save the result:**

```bash
curl -X POST https://exifrm.p.rapidapi.com/clean \
  -H "X-RapidAPI-Key: YOUR_API_KEY" \
  -H "X-RapidAPI-Host: exifrm.p.rapidapi.com" \
  -F "file=@photo.jpg" \
  -o photo_clean.jpg
```

**Clean a HEIC photo:**

```bash
curl -X POST https://exifrm.p.rapidapi.com/clean \
  -H "X-RapidAPI-Key: YOUR_API_KEY" \
  -H "X-RapidAPI-Host: exifrm.p.rapidapi.com" \
  -F "file=@IMG_3041.HEIC" \
  -o IMG_3041_clean.HEIC
```

**Scan then clean (audit workflow):**

```bash
# 1. Confirm what's there
curl -X POST https://exifrm.p.rapidapi.com/scan \
  -H "X-RapidAPI-Key: YOUR_API_KEY" \
  -H "X-RapidAPI-Host: exifrm.p.rapidapi.com" \
  -F "file=@photo.jpg" | jq '.summary'

# 2. Strip it
curl -X POST https://exifrm.p.rapidapi.com/clean \
  -H "X-RapidAPI-Key: YOUR_API_KEY" \
  -H "X-RapidAPI-Host: exifrm.p.rapidapi.com" \
  -F "file=@photo.jpg" \
  -o photo_clean.jpg
```

---

## POST /batch/scan *(Pro)*

Scan up to 50 images in a single request. Returns an array of privacy reports in the same order as the uploaded files.

**Quota:** Each image counts as one API call. A batch of 50 images consumes 50 calls.

### Request

**Content-Type:** `multipart/form-data`

| Parameter | Type | Required | Description |
| --------- | ---- | -------- | ----------- |
| `files` | file[] | Yes | Up to 50 image files. Accepted: JPEG, PNG, WebP, AVIF, TIFF, HEIC/HEIF |

### Response

| Status | Content-Type | Body |
| ------ | ------------ | ---- |
| `200 OK` | `application/json` | Array of privacy reports (see below) |
| `400` | `application/json` | One or more files unsupported or unreadable |
| `403` | `application/json` | Missing or invalid API key |
| `413` | `application/json` | One or more files exceed 10 MB |
| `422` | `application/json` | More than 50 files submitted |
| `500` | `application/json` | Internal processing error |

**200 response body:**

```json
[
  {
    "filename": "IMG_3008.HEIC",
    "hasPrivacyRisk": true,
    "summary": {
      "gps": { "lat": 22.618, "lng": 120.283 },
      "device": "Apple iPhone 17 Pro",
      "software": "26.2.1",
      "timestamp": "2026-02-18T12:14:05Z"
    },
    "raw": {}
  },
  {
    "filename": "screenshot.png",
    "hasPrivacyRisk": false,
    "summary": {},
    "raw": {}
  }
]
```

### Examples

**Batch scan three photos:**

```bash
curl -X POST https://exifrm.p.rapidapi.com/batch/scan \
  -H "X-RapidAPI-Key: YOUR_API_KEY" \
  -H "X-RapidAPI-Host: exifrm.p.rapidapi.com" \
  -F "files=@IMG_3008.HEIC" \
  -F "files=@IMG_3009.HEIC" \
  -F "files=@photo.jpg"
```

**Filter only files with GPS data:**

```bash
curl -X POST https://exifrm.p.rapidapi.com/batch/scan \
  -H "X-RapidAPI-Key: YOUR_API_KEY" \
  -H "X-RapidAPI-Host: exifrm.p.rapidapi.com" \
  -F "files=@photo1.jpg" \
  -F "files=@photo2.jpg" \
  -F "files=@photo3.jpg" \
  | jq '[.[] | select(.summary.gps != null) | .filename]'
```

---

## POST /batch/clean *(Pro)*

Clean up to 10 images and receive a single `cleaned.zip` archive containing all cleaned files. Original filenames are preserved inside the archive.

**Quota:** Each image counts as one API call. A batch of 5 images consumes 5 calls.

### Request

**Content-Type:** `multipart/form-data`

| Parameter | Type | Required | Description |
| --------- | ---- | -------- | ----------- |
| `files` | file[] | Yes | Up to 10 image files. Accepted: JPEG, PNG, WebP, AVIF, TIFF, HEIC/HEIF |

### Response

| Status | Content-Type | Body |
| ------ | ------------ | ---- |
| `200 OK` | `application/zip` | ZIP archive named `cleaned.zip` containing all cleaned files |
| `400` | `application/json` | One or more files unsupported or unreadable |
| `403` | `application/json` | Missing or invalid API key |
| `413` | `application/json` | One or more files exceed 20 MB |
| `422` | `application/json` | More than 10 files submitted |
| `500` | `application/json` | Internal processing error |

The ZIP uses DEFLATE compression. Filenames inside the archive match the original uploaded filenames exactly.

### Examples

**Batch clean and unzip:**

```bash
curl -X POST https://exifrm.p.rapidapi.com/batch/clean \
  -H "X-RapidAPI-Key: YOUR_API_KEY" \
  -H "X-RapidAPI-Host: exifrm.p.rapidapi.com" \
  -F "files=@IMG_3008.HEIC" \
  -F "files=@IMG_3009.HEIC" \
  -F "files=@photo.jpg" \
  -o cleaned.zip

unzip cleaned.zip -d cleaned_photos/
```

**Batch clean with mixed formats:**

```bash
curl -X POST https://exifrm.p.rapidapi.com/batch/clean \
  -H "X-RapidAPI-Key: YOUR_API_KEY" \
  -H "X-RapidAPI-Host: exifrm.p.rapidapi.com" \
  -F "files=@portrait.heic" \
  -F "files=@landscape.jpg" \
  -F "files=@screenshot.png" \
  -F "files=@product.webp" \
  -o cleaned.zip
```

---

## GET /health

Returns the service status. Does not require authentication.

### Response

```json
{ "status": "ok" }
```

---

## Authentication — Two Keys Explained

There are two different keys involved when using EXIFRm through RapidAPI. They serve completely different purposes and should not be confused:

| Key | Where to find it | Used by | Purpose |
| --- | ---------------- | ------- | ------- |
| `X-RapidAPI-Key` | RapidAPI Developer Dashboard > Apps | **Callers** — included in every request | Identifies the caller to the RapidAPI gateway for auth and billing |
| `X-RapidAPI-Proxy-Secret` | Hub Listing > Gateway > Firewall Settings | **Backend only** — never sent by callers | Injected by RapidAPI proxy when forwarding to the backend, used to verify the request came from RapidAPI |

- `X-RapidAPI-Key` is consumed by the RapidAPI gateway and **never forwarded to the backend**.
- `X-RapidAPI-Proxy-Secret` is added by the proxy and **never visible to callers**.

For direct access (internal use), use `X-Internal-Key` instead of `X-RapidAPI-Key`.

### RapidAPI Firewall Settings

| Setting | Recommended | Reason |
| ------- | ----------- | ------ |
| Threat Protection | **OFF** | Scans binary image data in multipart uploads and produces false-positive blocks on HEIC and larger files. This API has no SQL or JavaScript attack surface — Threat Protection provides no security benefit and breaks image uploads. |
| Request Schema Validation | **OFF** | FastAPI + Pydantic validates all parameters server-side and returns proper `422` responses. Enabling schema validation at the gateway layer causes conflicts with multipart form validation. |

---

## Error Responses

All error responses follow this schema:

```json
{ "error": "error_code", "message": "Human-readable description" }
```

| HTTP | `error` | Cause |
| ---- | ------- | ----- |
| `400 Bad Request` | `invalid_file` | Unsupported format, unreadable file, or magic bytes don't match a supported type |
| `403 Forbidden` | `unauthorized` | Missing or invalid `X-RapidAPI-Proxy-Secret` / `X-Internal-Key` |
| `413 Content Too Large` | `payload_too_large` | File exceeds the size limit for the endpoint (50 MB single; 10 MB for batch/scan; 20 MB for batch/clean) |
| `422 Unprocessable Entity` | `invalid_parameter` | Batch exceeds file count limit (50 for batch/scan; 10 for batch/clean) |
| `500 Internal Server Error` | `processing_failed` | Unexpected error during EXIF processing |

**Format detection** uses magic bytes (Pillow), not the `Content-Type` header. Spoofed MIME types are rejected correctly — a JPEG renamed to `.png` is processed as JPEG; a non-image file is rejected with `400 invalid_file` regardless of the declared content type.

---

## Limits

| Limit | `/scan` & `/clean` | `/batch/scan` | `/batch/clean` |
| ----- | ------------------ | ------------- | -------------- |
| Max file size | 50 MB | 10 MB per file | 20 MB per file |
| Max files per request | 1 | 50 | 10 |
| Request timeout | 180 s | 180 s | 180 s |
| Supported formats | JPEG, PNG, WebP, AVIF, TIFF, HEIC/HEIF | JPEG, PNG, WebP, AVIF, TIFF, HEIC/HEIF | JPEG, PNG, WebP, AVIF, TIFF, HEIC/HEIF |

---

## Code Examples

### Python (requests)

```python
import requests

headers = {
    "X-RapidAPI-Key": "YOUR_API_KEY",
    "X-RapidAPI-Host": "exifrm.p.rapidapi.com",
}

# Scan a photo
with open("photo.jpg", "rb") as f:
    response = requests.post(
        "https://exifrm.p.rapidapi.com/scan",
        headers=headers,
        files={"file": f},
    )
response.raise_for_status()
report = response.json()
print(report["hasPrivacyRisk"], report["summary"])

# Clean a photo
with open("photo.jpg", "rb") as f:
    response = requests.post(
        "https://exifrm.p.rapidapi.com/clean",
        headers=headers,
        files={"file": f},
    )
response.raise_for_status()
with open("photo_clean.jpg", "wb") as out:
    out.write(response.content)

# Batch scan
files = [
    ("files", open("IMG_3008.HEIC", "rb")),
    ("files", open("IMG_3009.HEIC", "rb")),
    ("files", open("photo.jpg", "rb")),
]
response = requests.post(
    "https://exifrm.p.rapidapi.com/batch/scan",
    headers=headers,
    files=files,
)
response.raise_for_status()
for result in response.json():
    print(result["filename"], result["hasPrivacyRisk"])
```

### JavaScript (fetch)

```javascript
const headers = {
  "X-RapidAPI-Key": "YOUR_API_KEY",
  "X-RapidAPI-Host": "exifrm.p.rapidapi.com",
};

// Scan a photo
const scanForm = new FormData();
scanForm.append("file", fs.createReadStream("photo.jpg"), "photo.jpg");

const scanResponse = await fetch("https://exifrm.p.rapidapi.com/scan", {
  method: "POST",
  headers,
  body: scanForm,
});
const report = await scanResponse.json();
console.log(report.hasPrivacyRisk, report.summary);

// Clean a photo
const cleanForm = new FormData();
cleanForm.append("file", fs.createReadStream("photo.jpg"), "photo.jpg");

const cleanResponse = await fetch("https://exifrm.p.rapidapi.com/clean", {
  method: "POST",
  headers,
  body: cleanForm,
});
const buffer = await cleanResponse.arrayBuffer();
fs.writeFileSync("photo_clean.jpg", Buffer.from(buffer));

// Batch clean and save ZIP
const batchForm = new FormData();
batchForm.append("files", fs.createReadStream("IMG_3008.HEIC"), "IMG_3008.HEIC");
batchForm.append("files", fs.createReadStream("photo.jpg"), "photo.jpg");

const batchResponse = await fetch("https://exifrm.p.rapidapi.com/batch/clean", {
  method: "POST",
  headers,
  body: batchForm,
});
const zip = await batchResponse.arrayBuffer();
fs.writeFileSync("cleaned.zip", Buffer.from(zip));
```

### PHP (cURL)

```php
$headers = [
    "X-RapidAPI-Key: YOUR_API_KEY",
    "X-RapidAPI-Host: exifrm.p.rapidapi.com",
];

// Scan a photo
$curl = curl_init();
curl_setopt_array($curl, [
    CURLOPT_URL => "https://exifrm.p.rapidapi.com/scan",
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => ["file" => new CURLFile("photo.jpg")],
    CURLOPT_HTTPHEADER => $headers,
]);
$body = curl_exec($curl);
curl_close($curl);
$report = json_decode($body, true);
echo $report["hasPrivacyRisk"] ? "Has privacy risk\n" : "Clean\n";

// Clean a photo
$curl = curl_init();
curl_setopt_array($curl, [
    CURLOPT_URL => "https://exifrm.p.rapidapi.com/clean",
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => ["file" => new CURLFile("photo.jpg")],
    CURLOPT_HTTPHEADER => $headers,
]);
$cleaned = curl_exec($curl);
curl_close($curl);
file_put_contents("photo_clean.jpg", $cleaned);

// Batch clean
$curl = curl_init();
curl_setopt_array($curl, [
    CURLOPT_URL => "https://exifrm.p.rapidapi.com/batch/clean",
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => [
        "files[0]" => new CURLFile("IMG_3008.HEIC"),
        "files[1]" => new CURLFile("photo.jpg"),
    ],
    CURLOPT_HTTPHEADER => $headers,
]);
$zip = curl_exec($curl);
curl_close($curl);
file_put_contents("cleaned.zip", $zip);
```
