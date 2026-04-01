# Easy GIF2Sprite API Reference

**Base URL:** `https://easy-gif-to-sprites.p.rapidapi.com`

All requests must include the standard RapidAPI authentication headers:

```
X-RapidAPI-Key: YOUR_API_KEY
X-RapidAPI-Host: easy-gif-to-sprites.p.rapidapi.com
```

## Endpoints

| Method   | Path                | Description                                        |
| -------- | ------------------- | -------------------------------------------------- |
| `POST` | `/to-spritesheet` | Convert a GIF into a single sprite sheet PNG       |
| `POST` | `/to-frames`      | Extract all GIF frames as individual PNGs in a ZIP |
| `GET`  | `/health`         | Service health check                               |

---

## POST /to-spritesheet

Converts a GIF animation into a single PNG sprite sheet with all frames arranged in a grid.

### Request

**Content-Type:** `multipart/form-data`

| Parameter     | Type    | Required                | Default    | Description                                                                                                                                                       |
| ------------- | ------- | ----------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `file`      | file    | One of `file`/`url` | —         | GIF file to upload                                                                                                                                                |
| `url`       | string  | One of `file`/`url` | —         | Publicly accessible URL of a GIF file                                                                                                                             |
| `columns`   | integer | No                      | auto       | Number of columns in the grid. If omitted, calculated as `ceil(sqrt(frame_count))` to produce the closest-to-square layout. Minimum: `1`.                     |
| `padding`   | integer | No                      | `0`      | Pixel gap between frames. Minimum:`0`.                                                                                                                          |
| `remove_bg` | boolean | No                      | `false`  | Remove background from each frame before compositing.                                                                                                             |
| `bg_color`  | string  | No                      | `"auto"` | Background color to remove.`"auto"` samples the four corner pixels of each frame. Or specify a hex color, e.g. `"#FFFFFF"`. Ignored when `remove_bg=false`. |
| `tolerance` | integer | No                      | `30`     | Color distance threshold for background removal (0–255). Higher values remove more of the background. Ignored when `remove_bg=false`.                          |

`file` and `url` are mutually exclusive. Providing both or neither returns a `400` error.

### Response

| Status     | Content-Type         | Body                                |
| ---------- | -------------------- | ----------------------------------- |
| `200 OK` | `image/png`        | Raw PNG binary                      |
| `400`    | `application/json` | See[Error Responses](#error-responses) |
| `413`    | `application/json` | Input exceeds 20 MB                 |
| `422`    | `application/json` | Invalid parameter value             |
| `500`    | `application/json` | Internal processing error           |

### Examples

**Basic — file upload:**

```bash
curl -X POST https://easy-gif-to-sprites.p.rapidapi.com/to-spritesheet \
  -H "X-RapidAPI-Key: YOUR_API_KEY" \
  -H "X-RapidAPI-Host: easy-gif-to-sprites.p.rapidapi.com" \
  -F "file=@animation.gif" \
  --output spritesheet.png
```

**Custom grid layout:**

```bash
curl -X POST https://easy-gif-to-sprites.p.rapidapi.com/to-spritesheet \
  -H "X-RapidAPI-Key: YOUR_API_KEY" \
  -H "X-RapidAPI-Host: easy-gif-to-sprites.p.rapidapi.com" \
  -F "file=@animation.gif" \
  -F "columns=4" \
  -F "padding=8" \
  --output spritesheet.png
```

**From URL:**

```bash
curl -X POST https://easy-gif-to-sprites.p.rapidapi.com/to-spritesheet \
  -H "X-RapidAPI-Key: YOUR_API_KEY" \
  -H "X-RapidAPI-Host: easy-gif-to-sprites.p.rapidapi.com" \
  -F "url=https://example.com/animation.gif" \
  --output spritesheet.png
```

**Background removal — auto-detect:**

```bash
curl -X POST https://easy-gif-to-sprites.p.rapidapi.com/to-spritesheet \
  -H "X-RapidAPI-Key: YOUR_API_KEY" \
  -H "X-RapidAPI-Host: easy-gif-to-sprites.p.rapidapi.com" \
  -F "file=@animation.gif" \
  -F "remove_bg=true" \
  --output spritesheet.png
```

**Background removal — specified color:**

```bash
curl -X POST https://easy-gif-to-sprites.p.rapidapi.com/to-spritesheet \
  -H "X-RapidAPI-Key: YOUR_API_KEY" \
  -H "X-RapidAPI-Host: easy-gif-to-sprites.p.rapidapi.com" \
  -F "file=@animation.gif" \
  -F "remove_bg=true" \
  -F "bg_color=#FFFFFF" \
  -F "tolerance=40" \
  --output spritesheet.png
```

---

## POST /to-frames

Extracts all frames from a GIF and returns them as individual PNGs inside a ZIP archive.

⚠️ NOTICE: A ZIP file output can not be shown or downloaded by runing tests on RapidAPI.

### Request

**Content-Type:** `multipart/form-data`

| Parameter     | Type    | Required                | Default    | Description                                                                                                |
| ------------- | ------- | ----------------------- | ---------- | ---------------------------------------------------------------------------------------------------------- |
| `file`      | file    | One of `file`/`url` | —         | GIF file to upload                                                                                         |
| `url`       | string  | One of `file`/`url` | —         | Publicly accessible URL of a GIF file                                                                      |
| `remove_bg` | boolean | No                      | `false`  | Remove background from each frame.                                                                         |
| `bg_color`  | string  | No                      | `"auto"` | Background color to remove.`"auto"` or a hex color e.g. `"#FFFFFF"`. Ignored when `remove_bg=false`. |
| `tolerance` | integer | No                      | `30`     | Color distance threshold for background removal (0–255). Ignored when `remove_bg=false`.                |

### Response

| Status     | Content-Type         | Body                                |
| ---------- | -------------------- | ----------------------------------- |
| `200 OK` | `application/zip`  | ZIP archive                         |
| `400`    | `application/json` | See[Error Responses](#error-responses) |
| `413`    | `application/json` | Input exceeds 20 MB                 |
| `422`    | `application/json` | Invalid parameter value             |
| `500`    | `application/json` | Internal processing error           |

The ZIP contains one PNG per frame, named with zero-padded indices:

| Frame count     | File names                             |
| --------------- | -------------------------------------- |
| 1–9 frames     | `frame_0.png` – `frame_8.png`     |
| 10–99 frames   | `frame_00.png` – `frame_98.png`   |
| 100–999 frames | `frame_000.png` – `frame_998.png` |

### Examples

**Basic — file upload:**

```bash
curl -X POST https://easy-gif-to-sprites.p.rapidapi.com/to-frames \
  -H "X-RapidAPI-Key: YOUR_API_KEY" \
  -H "X-RapidAPI-Host: easy-gif-to-sprites.p.rapidapi.com" \
  -F "file=@animation.gif" \
  --output frames.zip
```

**With background removal:**

```bash
curl -X POST https://easy-gif-to-sprites.p.rapidapi.com/to-frames \
  -H "X-RapidAPI-Key: YOUR_API_KEY" \
  -H "X-RapidAPI-Host: easy-gif-to-sprites.p.rapidapi.com" \
  -F "file=@animation.gif" \
  -F "remove_bg=true" \
  -F "bg_color=#000000" \
  -F "tolerance=25" \
  --output frames.zip
```

---

## GET /health

Returns the service status. Does not require authentication.

### Response

```json
{ "status": "ok" }
```

---

## Background Removal

Background removal uses a flood-fill algorithm seeded from all four corners of each frame simultaneously. Pixels within the specified color distance (`tolerance`) of the target color are made transparent.

### bg_color: `"auto"` vs hex

| Mode                 | Behavior                                                                                                                                                                                                                                      |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `"auto"` (default) | Samples the RGBA values of the four corner pixels. If all corners are within `tolerance` of each other, their average is used as the target color. If corners diverge beyond `tolerance`, the frame is skipped silently (left unchanged). |
| `"#RRGGBB"`        | Uses the specified color as the target for all frames regardless of corner pixels.                                                                                                                                                            |

### Tolerance Guide

| Tolerance    | Effect                                                               |
| ------------ | -------------------------------------------------------------------- |
| `0`        | Exact color match only                                               |
| `15–30`   | Good for clean flat-color backgrounds (default:`30`)               |
| `50–80`   | Handles slight gradients or compressed backgrounds                   |
| `&gt; 100` | Aggressive — risks removing foreground pixels near background color |

### When to use hex vs auto

- Use `"auto"` when the GIF has a consistent solid background that fills the corners (most common case).
- Use a hex color when the subject reaches into the corners of the frame, or when you know the exact background color.

---

## Authentication — Two Keys Explained

There are two different keys involved. They serve completely different purposes and should not be confused:

| Key                         | Where to find it                               | Used by                                         | Purpose                                                                                                  |
| --------------------------- | ---------------------------------------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `X-RapidAPI-Key`          | RapidAPI Developer Dashboard&gt; Apps          | **Callers** — included in every request  | Identifies the caller to the RapidAPI gateway for auth and billing                                       |
| `X-RapidAPI-Proxy-Secret` | Hub Listing&gt; Gateway &gt; Firewall Settings | **Backend only** — never sent by callers | Injected by RapidAPI proxy when forwarding to the backend, used to verify the request came from RapidAPI |

- `X-RapidAPI-Key` is consumed by the RapidAPI gateway and **never forwarded to the backend**. 
- `X-RapidAPI-Proxy-Secret` is added by the proxy and **never visible to callers**.

### Testing Note

The **RapidAPI test console** (Hub Listing &gt; Test tab) converts uploaded image files to PNG before sending — this will cause a `400 Invalid GIF` error when testing file uploads. Use the `url` parameter instead when testing via the console, or test file uploads directly with curl.

### RapidAPI Firewall Settings

| Setting | Recommended | Reason |
|---|---|---|
| Threat Protection | **OFF** | Claims to only scan "non-binary data in multipart/form-data", but actually scans binary GIF data and produces false-positive `400` blocks on larger files. This API has no SQL or JavaScript attack surface — Threat Protection provides no security benefit and breaks core functionality. |
| Request Schema Validation | **OFF** | FastAPI + Pydantic already validates all parameters server-side with proper error responses (`422`). |

---

## Error Responses

All error responses follow this schema:

```json
{ "detail": "Human-readable error message" }
```

| Status                        | Cause                                                                                                                                                                                                |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `400 Bad Request`           | Not a GIF file; both `file` and `url` provided; neither `file` nor `url` provided; URL is unreachable or returns a non-GIF; `bg_color` is not `"auto"` or a valid `#RRGGBB` hex string |
| `413 Content Too Large`     | Input file or URL download exceeds 20 MB                                                                                                                                                             |
| `422 Unprocessable Entity`  | `columns &lt; 1`; `padding &lt; 0`; `tolerance` outside 0–255                                                                                                                                 |
| `500 Internal Server Error` | Unexpected processing failure                                                                                                                                                                        |

---

## Limits

| Limit                | Value                                |
| -------------------- | ------------------------------------ |
| Max input size       | 20 MB                                |
| Accepted formats     | GIF only (`GIF87a` and `GIF89a`) |
| URL download timeout | 10 seconds                           |
| Max request timeout  | 60 seconds                           |

---

## Code Examples

### Python (requests)

```python
import requests

url = "https://easy-gif-to-sprites.p.rapidapi.com/to-spritesheet"
headers = {
    "X-RapidAPI-Key": "YOUR_API_KEY",
    "X-RapidAPI-Host": "easy-gif-to-sprites.p.rapidapi.com",
}

with open("animation.gif", "rb") as f:
    response = requests.post(url, headers=headers, files={"file": f})

response.raise_for_status()
with open("spritesheet.png", "wb") as out:
    out.write(response.content)
```

### JavaScript (fetch)

```javascript
const form = new FormData();
form.append("file", fs.createReadStream("animation.gif"));
form.append("columns", "4");
form.append("padding", "8");

const response = await fetch("https://easy-gif-to-sprites.p.rapidapi.com/to-spritesheet", {
  method: "POST",
  headers: {
    "X-RapidAPI-Key": "YOUR_API_KEY",
    "X-RapidAPI-Host": "easy-gif-to-sprites.p.rapidapi.com",
  },
  body: form,
});

const buffer = await response.arrayBuffer();
fs.writeFileSync("spritesheet.png", Buffer.from(buffer));
```

### PHP (cURL)

```php
$curl = curl_init();
curl_setopt_array($curl, [
    CURLOPT_URL => "https://easy-gif-to-sprites.p.rapidapi.com/to-frames",
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => [
        "file" => new CURLFile("animation.gif"),
        "remove_bg" => "true",
    ],
    CURLOPT_HTTPHEADER => [
        "X-RapidAPI-Key: YOUR_API_KEY",
        "X-RapidAPI-Host: easy-gif-to-sprites.p.rapidapi.com",
    ],
]);
$response = curl_exec($curl);
file_put_contents("frames.zip", $response);
curl_close($curl);
```
