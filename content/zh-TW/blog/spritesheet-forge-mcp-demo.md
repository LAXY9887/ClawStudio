---
title: "用 Claude MCP 把 GIF 轉成遊戲用 Spritesheet：完整流程展示"
description: "實機展示：Claude 透過 Spritesheet Forge MCP 把 GIF 轉成 Spritesheet PNG 和 TexturePacker 相容的 Atlas JSON——含工具串接、參數說明，以及 Unity/Godot 匯入注意事項。"
date: "2026-05-05"
readingTime: 8
tag: "tutorial"
---

每個遊戲美術都熟悉這個循環：從動畫工具匯出 GIF、開啟 TexturePacker、設定欄數、處理透明邊框、匯出、驗證 JSON 座標、匯入 Unity 或 Godot。只要動畫改了一格，整個流程就要重來。

Spritesheet Forge 是一個託管的 MCP（模型上下文協定）伺服器，讓這套流程可以在和 Claude 的對話中完成。你描述你要什麼，Claude 呼叫工具，你拿到輸出檔案和 Metadata。不需要安裝任何軟體，不需要記格式。

這篇文章完整走過一次真實的轉換流程——一個 9 幀 GIF 動畫到 Spritesheet PNG 和 TexturePacker 相容 Atlas JSON——展示 Claude 實際呼叫的工具、選擇的參數，以及如何在同一個對話中串接多個操作。

---

## 可用工具

連線後，Spritesheet Forge 提供六個工具給 Claude 使用：

| 工具 | 輸入 | 輸出 | 主要參數 |
|---|---|---|---|
| `gif_to_spritesheet` | 動畫 GIF | Spritesheet PNG | `columns`、`background_removal` |
| `png_to_spritesheet` | PNG 幀的 ZIP 壓縮檔 | Spritesheet PNG | `columns`、`padding` |
| `split_spritesheet` | Spritesheet PNG + 幀數 | 個別幀 + Atlas JSON | `columns`、`rows` |
| `trim_png` | 含透明邊框的 PNG | 裁切後的 PNG + 裁切範圍 | — |
| `frames_to_animation` | PNG 幀的 ZIP 壓縮檔 | 動畫 GIF | `fps` |
| `spritesheet_to_animation` | Spritesheet PNG + 幀數 | 動畫 GIF | `columns`、`rows`、`fps` |

這些工具設計為可串接：一個工具的輸出 URL 可以直接當作下一個工具的輸入，不需要重新上傳。所有檔案傳輸都在伺服器端完成。

---

## 兩分鐘完成連線

**Claude Desktop** — 加入 `claude_desktop_config.json`（從 Settings → Developer 開啟）：

```json
{
  "mcpServers": {
    "spritesheet-forge": {
      "type": "http",
      "url": "https://mcp.clawstudiouo.com/mcp"
    }
  }
}
```

**Claude Code CLI：**

```bash
claude mcp add spritesheet-forge --transport http https://mcp.clawstudiouo.com/mcp
```

首次使用時，Claude 會自動開啟 GitHub OAuth 頁面——點擊「授權」後，Token 會儲存在本機，有效期 30 天。整個過程不需要手動編輯設定檔。

---

## 實機展示一：GIF 轉 Spritesheet

輸入素材——一個 9 幀的香蕉貓動畫，每幀 75 × 165 px：

<img src="/blog/spritesheet-forge-mcp-demo/input.gif" alt="輸入 GIF——9 幀香蕉貓動畫，75×165 px" style="width:150px;height:auto;display:block;margin:0 auto;border-radius:0.5rem;border:1px solid var(--ui-border);">

把檔案拖入 Claude，描述你的需求：

![Claude 對話：使用者傳入 GIF 並請求轉換成 Spritesheet](/blog/spritesheet-forge-mcp-demo/demo-1.png)

Claude 自動上傳檔案並呼叫 `gif_to_spritesheet`，啟用 `background_removal: true`。工具將所有幀排成單行，並把輸出儲存到 Cloudflare R2 後回傳 URL：

![Claude 呼叫 gif_to_spritesheet MCP 工具](/blog/spritesheet-forge-mcp-demo/demo-2.png)

結果回傳，並附上精確的像素尺寸和 Unity Sprite Editor 的設定步驟：

![Claude 回傳 Spritesheet 結果及幀尺寸表格](/blog/spritesheet-forge-mcp-demo/demo-3.png)

輸出——675 × 165 px，9 幀單行排列，透明背景：

![輸出 Spritesheet——675×165 px，9 幀，透明背景](/blog/spritesheet-forge-mcp-demo/spritesheet.png)

**Claude 選擇的參數：**
- `columns: 9` — 所有幀排成一條水平帶，符合 Unity 和 Godot 對簡單精靈動畫的預設期望
- `background_removal: true` — 去除白色背景，產生含每像素 Alpha 透明度的 PNG

這兩個參數都可以覆蓋：請 Claude 用 `columns: 3` 得到 3×3 格狀排列，或者如果你的引擎用色鍵而非 Alpha，可以省略去背。

---

## 實機展示二：Sprite Atlas JSON

只需一句追問，即可從上一步的 Spritesheet 輸出 URL 直接生成 TexturePacker 相容的 Atlas——無需重新上傳：

![Claude 呼叫 split_spritesheet 產生 Sprite Atlas JSON](/blog/spritesheet-forge-mcp-demo/demo-4.png)

![Claude 回傳正確的 Sprite Atlas 及幀座標表格](/blog/spritesheet-forge-mcp-demo/demo-5.png)

還可以請 Claude 驗證輸出是否符合 TexturePacker JSON Hash 規格：

![Claude 驗證 Sprite Atlas JSON 格式——全部通過](/blog/spritesheet-forge-mcp-demo/demo-6.png)

最終 Atlas——9 幀，每幀 75 × 165 px，座標從左上角以零為起點：

```json
{
  "frames": {
    "frame_0.png": { "frame": { "x": 0,   "y": 0, "w": 75, "h": 165 }, "rotated": false, "trimmed": false, "spriteSourceSize": { "x": 0, "y": 0, "w": 75, "h": 165 }, "sourceSize": { "w": 75, "h": 165 } },
    "frame_1.png": { "frame": { "x": 75,  "y": 0, "w": 75, "h": 165 }, "rotated": false, "trimmed": false, "spriteSourceSize": { "x": 0, "y": 0, "w": 75, "h": 165 }, "sourceSize": { "w": 75, "h": 165 } },
    "frame_2.png": { "frame": { "x": 150, "y": 0, "w": 75, "h": 165 }, "rotated": false, "trimmed": false, "spriteSourceSize": { "x": 0, "y": 0, "w": 75, "h": 165 }, "sourceSize": { "w": 75, "h": 165 } },
    "frame_3.png": { "frame": { "x": 225, "y": 0, "w": 75, "h": 165 }, "rotated": false, "trimmed": false, "spriteSourceSize": { "x": 0, "y": 0, "w": 75, "h": 165 }, "sourceSize": { "w": 75, "h": 165 } },
    "frame_4.png": { "frame": { "x": 300, "y": 0, "w": 75, "h": 165 }, "rotated": false, "trimmed": false, "spriteSourceSize": { "x": 0, "y": 0, "w": 75, "h": 165 }, "sourceSize": { "w": 75, "h": 165 } },
    "frame_5.png": { "frame": { "x": 375, "y": 0, "w": 75, "h": 165 }, "rotated": false, "trimmed": false, "spriteSourceSize": { "x": 0, "y": 0, "w": 75, "h": 165 }, "sourceSize": { "w": 75, "h": 165 } },
    "frame_6.png": { "frame": { "x": 450, "y": 0, "w": 75, "h": 165 }, "rotated": false, "trimmed": false, "spriteSourceSize": { "x": 0, "y": 0, "w": 75, "h": 165 }, "sourceSize": { "w": 75, "h": 165 } },
    "frame_7.png": { "frame": { "x": 525, "y": 0, "w": 75, "h": 165 }, "rotated": false, "trimmed": false, "spriteSourceSize": { "x": 0, "y": 0, "w": 75, "h": 165 }, "sourceSize": { "w": 75, "h": 165 } },
    "frame_8.png": { "frame": { "x": 600, "y": 0, "w": 75, "h": 165 }, "rotated": false, "trimmed": false, "spriteSourceSize": { "x": 0, "y": 0, "w": 75, "h": 165 }, "sourceSize": { "w": 75, "h": 165 } }
  },
  "meta": {
    "app": "PNG2Spritesheet",
    "version": "1.0",
    "image": "file.png",
    "format": "RGBA8888",
    "size": { "w": 675, "h": 165 },
    "scale": "1"
  }
}
```

這個格式可以直接在 Unity（`SpriteAtlasImporter`）、Godot（`AtlasTexture`）、Phaser 3（`Loader.atlas`）以及任何支援 TexturePacker JSON Hash 格式的引擎中載入。

---

## 工具串接

上面兩個展示只是更長工具鏈的一部分。每個工具的輸出都是一個儲存在 Cloudflare R2 的 URL，有效期 1 小時。將 URL 直接傳給下一個工具，可以省去重新上傳的步驟：

```
gif_to_spritesheet(input.gif)
        │  Spritesheet PNG URL
        ▼
split_spritesheet(spritesheet URL, columns=9)
        │  Atlas JSON + 個別幀 URL
        ▼
frames_to_animation(幀 URL, fps=12)   ← 預覽動畫
        │
        ▼
trim_png(任意幀 URL)                   ← 選填的裁切處理
```

你可以用一句話讓 Claude 執行整個鏈：*「把這個 GIF 轉成 Spritesheet，生成 Atlas JSON，再給我一個 12 fps 的預覽動畫。」* Claude 會依序呼叫每個工具，自動傳遞 URL，不需要任何手動介入。

要注意一點：**輸出 URL 在 60 分鐘後失效**。如果需要保留檔案，請在對話結束前下載。

---

## MCP 工具規格參考（供 AI Agent 使用）

以下是 Spritesheet Forge 全部七個工具的完整 inputSchema。AI Agent 可透過這些定義了解每個工具接受哪些參數，以及如何透過 MCP 呼叫它們。

### gif_to_spritesheet

```json
{
  "name": "gif_to_spritesheet",
  "description": "將動態 GIF 轉換為 spritesheet PNG。",
  "inputSchema": {
    "type": "object",
    "properties": {
      "file": { "type": "string", "description": "GIF 檔案 — base64 data URI 或 HTTPS URL" },
      "columns": { "type": "integer", "description": "橫向格數（省略時自動計算）" },
      "padding": { "type": "integer", "default": 0, "description": "格子之間的像素間距" },
      "remove_bg": { "type": "boolean", "default": false, "description": "是否移除每個 frame 的背景" },
      "bg_color": { "type": "string", "default": "auto", "description": "\"auto\" 或 \"#RRGGBB\"" },
      "tolerance": { "type": "integer", "default": 30, "description": "背景移除的容許閾值 0–255" }
    },
    "required": ["file"]
  }
}
```

### gif_to_frames

```json
{
  "name": "gif_to_frames",
  "description": "將動態 GIF 的每個 frame 解壓縮為獨立 PNG，打包成 ZIP 回傳。",
  "inputSchema": {
    "type": "object",
    "properties": {
      "file": { "type": "string", "description": "GIF 檔案 — base64 data URI 或 HTTPS URL" },
      "remove_bg": { "type": "boolean", "default": false },
      "bg_color": { "type": "string", "default": "auto" },
      "tolerance": { "type": "integer", "default": 30 }
    },
    "required": ["file"]
  }
}
```

### png_to_spritesheet

```json
{
  "name": "png_to_spritesheet",
  "description": "將多張 PNG 圖片打包成一張 spritesheet，並可輸出 atlas metadata。",
  "inputSchema": {
    "type": "object",
    "properties": {
      "files": { "type": "array", "items": { "type": "string" }, "description": "PNG 檔案陣列 — base64 data URI 或 HTTPS URL" },
      "layout": { "type": "string", "default": "grid", "enum": ["grid", "horizontal", "vertical", "packed"] },
      "columns": { "type": "integer", "description": "格數（省略時自動）" },
      "cell_mode": { "type": "string", "default": "auto_max", "enum": ["auto_max", "auto_uniform", "fixed"] },
      "cell_width": { "type": "integer", "description": "cell_mode=fixed 時必填" },
      "cell_height": { "type": "integer", "description": "cell_mode=fixed 時必填" },
      "padding": { "type": "integer", "default": 0 },
      "bg_color": { "type": "string", "default": "transparent" },
      "power_of_2": { "type": "boolean", "default": false, "description": "將畫布尺寸補到 2 的冪次" },
      "trim_input": { "type": "boolean", "default": false, "description": "打包前自動裁切透明邊緣" },
      "extrude": { "type": "integer", "default": 0, "description": "每個 frame 的最外圍像素向外延伸 N px" },
      "metadata_format": { "type": "string", "default": "none", "enum": ["none", "json_array", "json_hash", "css"] }
    },
    "required": ["files"]
  }
}
```

### split_spritesheet

```json
{
  "name": "split_spritesheet",
  "description": "將 spritesheet PNG 切割成獨立的 frame 圖片，並可匯出 atlas JSON。",
  "inputSchema": {
    "type": "object",
    "properties": {
      "file": { "type": "string", "description": "Spritesheet PNG — base64 data URI 或 HTTPS URL" },
      "columns": { "type": "integer" },
      "rows": { "type": "integer" },
      "cell_width": { "type": "integer" },
      "cell_height": { "type": "integer" },
      "padding": { "type": "integer", "default": 0 },
      "frame_count": { "type": "integer", "description": "最後一行不完整時的實際 frame 數" },
      "skip_empty": { "type": "boolean", "default": true },
      "output": { "type": "string", "default": "frames", "enum": ["frames", "metadata", "both"] },
      "metadata_format": { "type": "string", "enum": ["json_array", "json_hash", "css"] }
    },
    "required": ["file"]
  }
}
```

### spritesheet_to_animation

```json
{
  "name": "spritesheet_to_animation",
  "description": "將 spritesheet PNG 轉換成動態 GIF 或 WebP。",
  "inputSchema": {
    "type": "object",
    "properties": {
      "file": { "type": "string", "description": "Spritesheet PNG — base64 data URI 或 HTTPS URL" },
      "columns": { "type": "integer" },
      "rows": { "type": "integer" },
      "frame_count": { "type": "integer" },
      "duration": { "type": "integer", "default": 100, "description": "每個 frame 的播放時間（毫秒）" },
      "loop": { "type": "integer", "default": 0, "description": "0 = 無限循環" },
      "output_format": { "type": "string", "default": "gif", "enum": ["gif", "webp"] }
    },
    "required": ["file"]
  }
}
```

### frames_to_animation

```json
{
  "name": "frames_to_animation",
  "description": "將多張 PNG frame 合成動態 GIF 或 WebP。",
  "inputSchema": {
    "type": "object",
    "properties": {
      "files": { "type": "array", "items": { "type": "string" }, "description": "依序排列的 PNG frame 陣列" },
      "duration": { "type": "integer", "default": 100, "description": "每個 frame 的播放時間（毫秒，10–10000）" },
      "loop": { "type": "integer", "default": 0 },
      "output_format": { "type": "string", "default": "gif", "enum": ["gif", "webp"] }
    },
    "required": ["files"]
  }
}
```

### trim_png

```json
{
  "name": "trim_png",
  "description": "裁切一張或多張 PNG 的透明邊緣。",
  "inputSchema": {
    "type": "object",
    "properties": {
      "files": { "type": "array", "items": { "type": "string" }, "description": "PNG 檔案 — 單張回傳 PNG，多張回傳 ZIP" },
      "threshold": { "type": "integer", "default": 0, "description": "Alpha 閾值 0–255" },
      "padding": { "type": "integer", "default": 0, "description": "裁切後保留的透明邊距（px）" }
    },
    "required": ["files"]
  }
}
```

---

## 接下來

- **[用 Cloudflare Workers 和 GCP Cloud Run 建置遠端 MCP 伺服器](/blog/building-remote-mcp-server)** — 如果你想自己建 MCP 伺服器而不是使用託管版，這篇涵蓋完整架構：OAuth 2.1 + PKCE、內部服務驗證、R2 檔案暫存，以及工具設計。
- *([Spritesheet 匯入 Unity 和 Godot 完整指南](/blog/spritesheet-game-engine-import) — 即將推出)* — Unity Sprite Atlas 工作流和 Godot AtlasTexture 節點的詳細操作，包含如何直接對接本文的 Atlas JSON 輸出。

Spritesheet Forge 開源免費（免費方案每月 100 次操作）：

- **MCP 設定指南** — [clawstudiouo.com/mcp](https://clawstudiouo.com/mcp)
- **Smithery 一鍵安裝** — [smithery.ai](https://smithery.ai/servers/lxya98874322688423/spritesheet-forge)
- **GitHub 儲存庫** — [LAXY9887/Game-Dev.-Spritesheet-Forge](https://github.com/LAXY9887/Game-Dev.-Spritesheet-Forge)
- **完整 API 文件** — [GitHub Pages](https://laxy9887.github.io/Game-Dev.-Spritesheet-Forge)

---

## 常見問題

**Spritesheet Forge 是什麼？**

Spritesheet Forge 是一個託管的 MCP 伺服器，讓 Claude 能直接存取 Spritesheet 處理工具。連線後，Claude 可以透過自然語言轉換 GIF、打包 PNG 幀、生成 Atlas JSON、分割現有 Spritesheet 等，不需要在本機安裝任何軟體。

**如何把 Spritesheet Forge 連接到 Claude？**

Claude Desktop 請在 `claude_desktop_config.json` 加入伺服器設定；Claude Code CLI 執行 `claude mcp add spritesheet-forge --transport http https://mcp.clawstudiouo.com/mcp`。首次使用時 Claude 會自動開啟 GitHub OAuth 頁面，點擊授權後 Token 儲存 30 天。完整說明在 [clawstudiouo.com/mcp](https://clawstudiouo.com/mcp)。

**Spritesheet Forge 支援哪些檔案格式？**

`gif_to_spritesheet` 接受任何動畫 GIF；`png_to_spritesheet` 和 `frames_to_animation` 接受 PNG 幀的 ZIP 壓縮檔。所有圖片輸出為 PNG；Atlas 輸出為 TexturePacker JSON Hash 格式，相容 Unity、Godot、Phaser 3、Cocos2d 等主流引擎。

**Spritesheet Forge 是免費的嗎？**

免費方案每月提供 100 次操作，足夠中等動畫量的遊戲開發使用。不需要信用卡。伺服器本身在 GitHub 上開源。

**Claude 能處理大型 Sprite 檔案嗎？**

小於 ~185 KB 的檔案以 base64 方式內嵌傳送；較大的檔案，Claude 會先 POST 到伺服器的 `/upload` 端點，取得 URL 後再傳給工具。你不需要手動判斷——Claude 會自動偵測檔案大小並選擇正確方式。

**輸出檔案可以保留多久？**

工具輸出 URL 儲存在 Cloudflare R2，有效期為 1 小時。如果對話結束前沒有下載，檔案會自動失效。建議在工作流程結束時，請 Claude 清楚列出所有下載連結。

**可以在一個請求中串接多個工具嗎？**

可以。Claude 會自動依序呼叫工具，將每個輸出 URL 傳給下一個工具的輸入。例如：*「把這個 GIF 轉成 Spritesheet、分割成個別幀，再給我 12 fps 的預覽 GIF」* 會執行三個工具，全程不需要任何手動介入。

**Atlas JSON 相容哪些遊戲引擎？**

輸出格式為 TexturePacker JSON Hash，是遊戲開發中支援最廣泛的 Atlas 格式。相容 Unity（`SpriteAtlasImporter`）、Godot（`AtlasTexture`）、Phaser 3（`Loader.atlas`）、Cocos2d，以及任何接受 TexturePacker 輸出的引擎。
