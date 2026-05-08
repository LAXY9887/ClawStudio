---
title: "用 Cloudflare Workers + GCP Cloud Run 建置 Remote MCP Server：完整實戰指南"
description: "完整指南：在 Cloudflare Workers 和 GCP Cloud Run 上建置 Remote MCP Server——涵蓋 OAuth 2.1 + PKCE、內部服務認證、R2 檔案暫存，以及保護後端程式碼的架構設計。"
date: "2026-05-06"
readingTime: 15
tag: "guide"
---

## 起點：已有的 API 服務

在任何 MCP 之前，Spritesheet Forge 就已經有一個運作中的後端：一組跑在 Google Cloud Platform 上的圖像處理 API，負責實際的工作——GIF 轉 spritesheet、裁切透明邊緣、打包幀、產生 atlas JSON。

MCP（Model Context Protocol，模型上下文協定）是一個開放標準，讓 Claude 等 AI 助理可以透過自然語言直接呼叫工具和 API。MCP 加進來之後，做的事情是在這個現有 API 的上面架一層 **AI 原生的呼叫介面**。不是取代它，而是讓 Claude 可以透過自然語言來觸發這些操作。後端沒有改變，改變的是它怎麼被呼叫。

這個脈絡對理解後面的架構決策很重要：這不是從零開始建系統，而是在已有的東西上面疊一層新介面。

### 為什麼選 GCP

如果你還沒選定雲端供應商，GCP 的 serverless 架構對開發者工具來說值得認真考慮——尤其是流量不穩定、無法預測的情境。

關鍵特性是 **scale to zero**。GCP 的托管容器運行平台 Cloud Run，在沒有請求時會完全停止，有請求時在幾秒內啟動。你只為實際使用的運算時間付費，計費精度到 100ms。對於以零散工具呼叫為主、不是持續高流量的 MCP server，實際跑下來的費用可以接近 $0。

其他值得知道的優點：

- **不需要管理基礎設施** — Cloud Run 自動處理 HTTPS、自動擴縮容、健康檢查、部署回滾
- **任何語言、任何框架** — 只要能打包成容器都能部署，不綁定特定 runtime
- **免費額度夠用** — 每月 200 萬次請求、36 萬 GB-seconds 的運算完全免費
- **部署流程可以完全自動化** — Artifact Registry + Cloud Build，一行 `gcloud` 指令完成 build → push → deploy

關於如何從零開始架設這套 GCP 架構——Cloud Run 部署、Artifact Registry、Cloud Build CI/CD、IAM 設定——請參考這篇專門的教學文章：*([在 GCP 部署容器化 API](/blog/deploy-api-on-gcp-cloud-run))*

---

## 加上 MCP 這一層

後端已經在跑了，接下來的問題是：怎麼讓 AI client 能呼叫它？

答案是在 Cloudflare Workers 上建一個輕量的 gateway，負責說 MCP 協議，並把請求轉譯給現有的 API。

```
MCP Client (Claude Desktop / Claude Code)
        │  Streamable HTTP (MCP protocol)
        ▼
Cloudflare Worker  ←── MCP gateway、Auth、Quota、File staging
        │  HTTP + X-MCP-Key
        ▼
GCP Cloud Run  ←── 現有 API（圖像處理等）
        │
        ▼
Cloudflare R2  ←── 暫存輸出檔案（TTL 1 小時）
Cloudflare KV  ←── Session、Quota、OAuth state
```

### Cloudflare Worker

Worker 負責邊緣層的所有工作：MCP 協議解析、OAuth token 驗證、per-user quota 管控，以及 file staging。Worker 全球分散部署、沒有冷啟動，請求打到最近的 PoP，額外開銷在毫秒以下。代價是嚴格的 CPU 時間限制（免費方案每次請求 50ms），這正是計算密集型工作必須留在 Cloud Run 的原因。

### Cloudflare R2

R2 是工具間傳遞資料的橋樑。每個工具的輸出都寫入 R2 並設定 1 小時 TTL，回傳 URL。下一個工具收到這個 URL 當輸入時，Worker 直接從 R2 讀取，不需要繞過公網。這讓多步驟的 Agent 工作流程既快又省。R2 相容 S3 API，現有的 S3 SDK 不需修改即可使用。

### Cloudflare KV

KV 儲存三種資料：OAuth session token（30 天 TTL）、per-user 每月 quota 計數器，以及 OAuth 授權流程中的 PKCE state。KV 是最終一致性，讀取從邊緣快取提供——非常適合這種寫一次多次讀的短暫存活資料。

關於 Cloudflare Workers 的完整設置流程——建立 Worker、設定自訂域名、DNS 管理、R2 和 KV 的接線——請參考配套教學：*([Cloudflare 完整設置教學：Worker、DNS 與自訂域名](/blog/cloudflare-worker-setup-guide) — 即將發佈)*

### Private Repo 的額外好處

Gateway 和後端分開，還解決了一個比較不明顯的問題：**只需要公開 MCP 包裝那層的 repo**。

Cloudflare Worker 的程式碼本質上是你的 API 介面——定義了哪些工具存在、參數怎麼設計、認證如何運作。公開它讓使用者可以看到整合方式，社群也能貢獻相容的 client。而 Cloud Run 後端，也就是實際處理邏輯所在，可以永遠放在 private repo。核心演算法和實作細節不會對外暴露。

對商業產品來說，這非常重要：你可以展示 MCP server 技術、讓開源社群參與整合層的開發，同時把私有後端完全封鎖。不需要因為上架 MCP 目錄或公開 server，就必須把自己的程式碼交出去。

---

## MCP Server 需要哪些組成要件

Spritesheet Forge 第一次上線時，MCP server 技術上是跑起來了——但 Claude 幾乎沒辦法用它。工具存在，但 server 缺了好幾個 MCP client 在呼叫任何工具之前就需要的東西。Agent 連上去、陷入混亂、然後放棄。

以下是一個 Remote MCP Server 要能正常運作，實際需要的完整清單：

### MCP 協議 Handler（`POST /mcp`）

主要 endpoint 接收所有 MCP 流量。它需要處理每個 MCP client 在做任何有用的事情之前都會依序送出的一組訊息：

| 方法 | 誰發送 | 意義 |
|------|--------|------|
| `initialize` | Client，第一條訊息 | 「我要連線了，這是我的能力清單」 |
| `notifications/initialized` | Client，收到 server 回應後 | 「準備好了，可以繼續」 |
| `tools/list` | Client，用來發現可用工具 | 「你能做哪些事？」 |
| `tools/call` | Client，實際呼叫工具 | 「幫我做這件事」 |

`initialize` 和 `notifications/initialized` 這兩條訊息**必須在不需要認證的情況下回傳有效回應**——它們是建立 session 的握手過程。如果其中任何一個失敗或回傳認證錯誤，client 會認為連線已損壞並停止嘗試。

### 工具定義

`tools/list` 回傳的每個工具，需要四個部分才算完整：

```typescript
{
  name: 'gif_to_spritesheet',
  description: '...', // 給 LLM 看的使用說明——詳見工具設計章節
  inputSchema: {       // 參數的 JSON Schema
    type: 'object',
    properties: { ... },
    required: [...]
  },
  outputSchema: { ... },  // 回傳值的 JSON Schema
  annotations: {          // 給平台和 LLM 的行為提示
    title: 'GIF to Spritesheet',
    readOnlyHint: false,
    idempotentHint: false,
    openWorldHint: true
  }
}
```

缺少 `outputSchema` 或 `annotations` 不會讓工具呼叫直接失敗，但會讓你在每個目錄平台的品質分數掉到谷底。更重要的是，LLM 靠 `outputSchema` 來解析和理解工具回傳的結果——沒有它，模型就是在猜回傳的資料結構。

### 探索與基礎設施 Endpoints

除了 `/mcp`，一個完整的 server 還需要：

- **`GET /health`** — 回傳 `{"status":"ok"}` HTTP 200，不需要認證。目錄平台靠這個確認你的 server 還活著。
- **`OPTIONS /mcp`** — 處理 CORS preflight。所有 browser-based MCP client 都需要這個。
- **`GET /.well-known/oauth-authorization-server`** — 如果使用 OAuth，MCP client 靠這個自動發現你的認證 endpoints。沒有這個，client 要麼需要手動設定，要麼直接連線失敗。

### 缺了這些會怎樣

Claude 連接 MCP server 的流程是固定的：`initialize` → `notifications/initialized` → `tools/list`，依序執行。如果 `tools/list` 失敗（因為需要認證、或回應格式錯誤），client 就沒有任何工具定義可以使用。從 Claude 的視角來看，server 存在，但沒有任何能力——什麼都沒辦法呼叫。

這就是「Agent 幾乎無法使用這個 MCP」的實際樣貌：連線成功了，但每次嘗試使用工具都失敗，因為工具探索這個步驟從來沒有正確完成。

### 協議訊息實際長這樣

MCP 協議的每一條訊息都是透過 HTTP POST 傳送的 JSON-RPC 2.0 物件。以下是實際的交換過程。

**第一步 — Client 送出 `initialize`**

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2024-11-05",
    "capabilities": { "roots": { "listChanged": true } },
    "clientInfo": { "name": "claude-code", "version": "1.0.0" }
  }
}
```

**Server 回應自己的能力清單**

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocolVersion": "2024-11-05",
    "capabilities": { "tools": {} },
    "serverInfo": { "name": "spritesheet-forge", "version": "1.0.0" }
  }
}
```

**第二步 — Client 送出 `notifications/initialized`**（不需要回應）

```json
{
  "jsonrpc": "2.0",
  "method": "notifications/initialized"
}
```

**第三步 — Client 送出 `tools/list`**（不需要認證）

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/list"
}
```

**Server 回傳所有已註冊的工具**

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "tools": [
      {
        "name": "gif_to_spritesheet",
        "description": "...",
        "inputSchema": { "type": "object", "properties": { "file": { "type": "string" }, "columns": { "type": "number" } }, "required": ["file"] },
        "outputSchema": { "type": "object", "properties": { "url": { "type": "string" }, "frame_width": { "type": "number" }, "frame_height": { "type": "number" }, "frame_count": { "type": "number" } } },
        "annotations": { "title": "GIF to Spritesheet", "readOnlyHint": false, "idempotentHint": true, "openWorldHint": true }
      },
      { "name": "server_info", "description": "...", "inputSchema": { "type": "object" } }
    ]
  }
}
```

這個握手流程完成後，client 就知道有哪些工具、以及如何呼叫它們。只有在這之後，認證才開始變得重要——`tools/call` 等實際工具呼叫才需要有效的 Bearer token。

**`server_info` — 無參數工具呼叫範例**

以下是一次真實的 `tools/call` 請求與回應，使用 Spritesheet Forge 的 `server_info` 工具：

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "server_info",
    "arguments": {}
  }
}
```

**實際回應：**

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "result": {
    "content": [
      {
        "type": "text",
        "text": {
          "upload_url": "https://mcp.clawstudiouo.com/upload",
          "output_ttl_seconds": 3600,
          "max_file_bytes": 20971520,
          "base64_threshold_bytes": 4194304,
          "file_input_rules": {
            "small_file": "< 4 MB：base64 編碼後加上 data URI prefix，必須去除所有換行符。",
            "large_file": "≥ 4 MB 或透過 shell 編碼：POST 到 /upload，使用回傳的 URL。",
            "previous_output": "任何工具的 output URL 都可以直接作為下一個工具的輸入。",
            "ttl_warning": "Output URL 在建立後 60 分鐘過期。"
          }
        }
      }
    ]
  }
}
```

`server_info` 是「回傳設定或元資料的工具」應遵循的模式：無參數、輸出確定性、讓 Agent 在開始複雜工作流程前可以先查詢一次。

---

## 認證

### 為什麼要認證？

沒有認證的 MCP server 就是一個完全開放的公開 API——任何人發現這個 endpoint 就能無限制地呼叫你的工具，消耗 Cloud Run 的運算資源、寫入 R2 儲存空間，並把真實使用者的 quota 額度耗盡。認證同時解決三個問題：

- **資源保護**：每次工具呼叫都直接對應到運算成本。不知道是誰在呼叫，就無法設定限制。
- **Quota 管理**：per-user 每月 quota 需要有穩定的身份才能追蹤。沒有身份就沒有公平執行的基礎。
- **防止濫用**：沒有認證的公開 endpoint 非常容易被腳本化——一個惡意使用者就能讓你的帳單暴增，或讓其他人的服務品質下降。

### 認證方式比較

| 方式 | 使用者體驗 | 實作複雜度 | MCP client 支援 |
|------|-----------|-----------|----------------|
| 不認證 | 零摩擦 | 極簡單 | 全部支援 |
| Static API Key | 差——使用者需手動複製貼上 | 簡單 | 全部支援 |
| OAuth 2.1 + PKCE | 流暢——瀏覽器一鍵完成 | 中等 | Claude Desktop、Claude Code |

**不認證**只適合本機或內網的 server，由網路本身承擔安全邊界。對公開的 remote server 來說，這代表網際網路上任何人都能呼叫你的工具。

**API Key** 是直覺上的第一選擇：產生一個 key、給使用者、完成。問題在於分發體驗。使用者要去找 dashboard 或文件頁面，複製一串亂碼，開啟 config 檔，貼上去，重啟 client。這是多步驟流程，任何一步都可能出錯，key 遺失也沒有自助恢復的方式。而且每個新的 MCP client 都要重複同樣的手動設定。

**OAuth 2.1 + PKCE** 實作比較麻煩，但帶來的使用者體驗差距非常大。MCP client 原生處理整個 OAuth 流程——在需要 token 時自動開啟瀏覽器。使用者看到 GitHub 登入頁面，點一下「授權」，client 自動把 token 存起來。從使用者的角度看，就是一次點擊，完全不需要碰任何 config 檔。

### Spritesheet Forge 的實作方式

以 GitHub 作為 Identity Provider，Cloudflare KV 儲存 token，標準 OAuth 2.1 + PKCE 流程：

**1. 自動發現端點 `/.well-known/oauth-authorization-server`**

MCP client 在發起任何 OAuth 流程之前都會讀取這個端點，取得 authorization endpoint、token endpoint 以及支援的 grant type。沒有這個端點，client 要麼需要手動設定，要麼完全無法連線。

**2. 動態 client registration（RFC 7591）**

任何 MCP client 都可以透過 POST 到 registration endpoint 自動完成登記，不需要預先審核或加入任何名單——server 自動處理。

**3. PKCE 流程**

防止 authorization code 被截取。client 先產生一個隨機的 `code_verifier`，在發送 authorization request 時附上它的 hash（`code_challenge`），之後交換 token 時再證明自己持有原始的 verifier。這封閉了 code 在傳輸過程中被竊取的攻擊路徑。

**4. KV session 儲存**

Session token 存在 Cloudflare KV 的 `session:{userId}` key 下，TTL 30 天。每次 `tools/call` 請求都會先用這個 token 去 KV 驗證，通過才把請求轉發給 Cloud Run。

**5. 腳本備援**

對需要在腳本、CI 流程或 benchmark 環境使用、但無法完成瀏覽器 OAuth 的使用者，提供可下載的 `get-token.py` 腳本。在終端機執行整個 OAuth 流程，印出 token 並存到 `~/.spritesheet-forge-token`。

### X-MCP-Key：內部服務認證

架構分成兩層：Cloudflare Worker（公開的 Gateway）和 Cloud Run（私有的後端）。Cloud Run 跑在一個技術上可從網際網路存取的 URL——任何人如果發現這個 URL，就能直接 POST 請求，完全繞過 Worker。這代表繞過 OAuth 驗證、quota 管控，以及所有 rate limiting。

`X-MCP-Key` header 填補了這個缺口。這是一個只有 Worker 和 Cloud Run 知道的共用密鑰。Worker 驗證每個進來的 OAuth token，然後把請求連同這個 header 一起轉發給 Cloud Run。Cloud Run 拒絕任何不帶正確 key 的請求。

```
使用者 → Worker:      Authorization: Bearer <oauth-token>    (公開認證)
Worker → Cloud Run:   X-MCP-Key: <internal-secret>          (內部認證)
```

這是**縱深防禦**的概念：就算 Cloud Run URL 透過 log、錯誤訊息或逆向工程洩漏出去，攻擊者沒有內部 key 就無法呼叫它。所有流量都被強制通過 gateway，所有安全管控都得以保全。

沒有這個機制，「私有後端」就只是說說而已——對夠有心的人來說，後端實際上仍然是公開的。

---

## 檔案輸入設計

這個章節針對的是工具本身需要處理檔案的 MCP server——圖像轉換、文件解析、音訊處理等類型的 API。如果你的工具只處理文字或結構化資料，不會遇到這個問題。但對檔案型的 API 來說，這是實作上最容易踩到的限制之一。

問題的核心是：**讓 Agent 透過 API 處理檔案，比想像中困難**。直覺的做法是把檔案 base64 編碼後直接夾在請求裡傳過去，理論上可行，但實際上會撞上一道硬限制：Claude Code 的 shell tool 對 stdout 輸出有 ~256 KB 的 context 上限。base64 編碼會讓檔案大小膨脹約 33%，所以 inline base64 實際能用的安全上限大約是 185 KB。大多數的圖片、音訊檔案、文件都比這大。

這讓 base64 在現實世界的檔案處理場景中幾乎無法使用。我們的解法是在 MCP 層加上一個獨立的 `/upload` endpoint——它不在 MCP 協議裡，是一個普通的 HTTP endpoint。使用者（或 Agent）直接把檔案 POST 過去，取得一個 URL，再把這個 URL 傳給工具，而不是把檔案 inline 嵌入請求。Worker 收到 URL 後直接從 R2 server-side 讀取，完全繞過 context 大小的限制。

**為什麼用 Cloudflare R2 儲存檔案？**

R2 是 Cloudflare 的 S3 相容物件儲存服務，在這個架構裡選它有一個很具體的原因：**零 egress 費用**。AWS S3 和大多數物件儲存服務都對資料輸出收費——每次工具輸出被讀取（在工具鏈中每次呼叫下一個工具時都會發生），你就要付費。R2 的 egress 完全免費。對一個頻繁在工具間傳遞檔案的 MCP server 來說，這個差異非常顯著。

R2 的免費方案額度也足夠讓流量不高的 MCP server 完全跑在免費層內：

| 資源 | 免費額度 |
|------|---------|
| 儲存空間 | 10 GB / 月 |
| Class A 操作（寫入、刪除） | 100 萬次 / 月 |
| Class B 操作（讀取） | 1,000 萬次 / 月 |
| Egress（資料輸出） | 永久免費 |

工具輸出設定 1 小時 TTL 後自動刪除——所以就算使用量頻繁，實際佔用的儲存空間也很少。一個在 1 小時內處理完畢的檔案，幾乎不會對當月的儲存總量造成影響。

接受檔案的 MCP 工具需要處理三種輸入情境：

| 情境 | 方法 |
|------|------|
| 小檔案（< ~185 KB） | base64 data URI：`data:image/png;base64,...` |
| 大檔案或來自 shell 的檔案 | POST 到 `/upload` endpoint，傳回 URL 使用 |
| 前一個工具的輸出 | 直接傳 output URL——Worker 從 R2 讀取 |

有一個不直覺的限制：Claude Code 的 shell tool 對 stdout 有 ~256 KB 的 context 限制。base64 編碼會讓檔案大小增加 ~33%，所以 inline base64 實際安全上限是 ~185 KB，不是 4 MB。工具 description 應該明確說明這個限制，並在適當時候引導使用者改用 upload endpoint。

**base64 換行問題。** `openssl base64`、`base64` 等 shell 工具產生的 base64 字串每 76 字元會插入一個換行符。直接把這個字串貼進 data URI，server 解析時會出現 `INVALID_BASE64` 錯誤。在工具 description 裡一定要加上這個警告：

> "在加上 data URI prefix 之前，必須去掉 base64 字串中所有的空白和換行。範例：`base64 file.png | tr -d '\n'`"

---

## 讓工具能被 LLM 正確使用

### 第零步：讓 Claude 連上你的 MCP Server

在使用任何工具之前，Claude 必須先連線到 MCP server。這看起來很理所當然，但值得明確說清楚：Claude 不會自動發現或連線到任何 MCP server。你必須明確設定連線，在設定之前，Claude 完全不知道這個 server 的存在。

**Claude Desktop** — 加入 `claude_desktop_config.json`（從 Settings → Developer 找到這個檔案）：

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

**Claude Code CLI** — 在終端機執行：

```bash
claude mcp add spritesheet-forge --transport http https://mcp.clawstudiouo.com/mcp
```

如果沒有設定連線，Claude 不會說「我找不到那個工具」——它只會表現得好像這個工具根本不存在。接下來它會上網搜尋替代方案、幻想出聽起來類似但實際上不存在的工具，或者給出一個完全答非所問的回應。這種失敗是靜默的，非常容易讓人搞混。

### 使用者怎麼找到你的 MCP Server

讓 Claude 連上 server 是第一步。讓使用者知道這個 server 存在是另一個問題。有幾個管道，各自觸及不同的受眾：

**原始碼與文件**
- [GitHub 儲存庫](https://github.com/LAXY9887/Game-Dev.-Spritesheet-Forge) — 主要的資訊來源。開發者第一個看這裡。清楚的 README 加上 endpoint URL 和設定範例是最低限度。
- [專屬教學頁面](https://sprite-forge-mcp.tutorial.clawstudiouo.com) — 一頁式教學，帶著使用者從安裝、認證到實際範例 prompt 走一遍。適合不想讀 README 的非開發者。

**官方目錄**
- [Anthropic MCP Registry](https://registry.modelcontextprotocol.io/?q=io.github.LAXY9887%2Fspritesheet-forge) — Anthropic 官方的 MCP server 索引。MCP client 應用程式直接查詢這裡，在 app 內顯示精選 server 清單。

**市集與目錄平台**
- [Smithery.ai](https://smithery.ai/servers/lxya98874322688423/spritesheet-forge) — 直接整合在 Claude Code 的 MCP 瀏覽器裡。使用者不需要離開 CLI 就能找到並安裝 server。
- [MCP Marketplace](https://mcp-marketplace.io/server/game-dev-spritesheet-forge) — 有付費方案收益分潤機制的專屬市集。
- GitHub Marketplace — 觸及 GitHub 開發者生態系。

這些管道會相互強化。在 Smithery 上發現 server 的使用者，通常接著會去看 GitHub repo。教學頁面把「發現」轉換成實際安裝。全部覆蓋的維護成本不高，但觸及的受眾幾乎不重疊。

### 寫出 LLM 真正看得懂的工具 description

工具 description 不是給人類看的文件——它是 LLM 用來決定「何時」和「如何」呼叫你的工具的指令。寫得不好，模型就會呼叫錯工具、傳錯參數，或產生難以排查的錯誤。

好的工具 description 應包含：

- **輸入格式**：URL？data URI？接受哪些 MIME type？
- **輸出**：工具回傳什麼？URL？JSON struct？TTL 是多少？
- **限制**：檔案大小上限、參數互動規則、已知的坑
- **範例**：輸入規則複雜時，直接在 description 裡給範例指令

**設計可鏈式呼叫的工具。** 讓每個工具的 output URL 可以直接當作下一個工具的輸入，Agent 就能自然地組合多步驟工作流程：

```
gif_to_spritesheet → split_spritesheet → frames_to_animation
```

**加一個 `server_info` 工具。** 提供一個無參數的工具，回傳 runtime 設定：upload endpoint URL、output file TTL、檔案大小限制，以及 base64 和 upload 的選擇規則。這樣就不用在每個工具 description 裡重複這些資訊，Agent 也有可靠的方式在開始複雜工作流程前查詢設定。

---

## 常見錯誤對照

| 錯誤現象 | 根本原因 | 解法 |
|---------|---------|------|
| 平台顯示「0 tools found」 | `tools/list` 需要認證 | 將 `initialize`、`notifications/initialized`、`tools/list` 加入 handshake whitelist |
| Smithery Quality Score 為 0 | 缺少 `outputSchema` / `annotations` | 所有工具補上這兩個欄位 |
| `INVALID_BASE64` 解析失敗 | shell 工具插入換行符 | description 明確警告；使用 `tr -d '\n'` |
| Agent 說找不到工具、開始上網搜尋 | MCP server 未在 client 設定連線 | 加入 `claude_desktop_config.json`，或執行 `claude mcp add` |
| OAuth 授權頁面沒有開啟 | `/.well-known/oauth-authorization-server` 無法公開存取 | 確認這個 endpoint 不需要認證即可讀取 |
| Upload endpoint 回傳 `401` | Bearer token 未提供或已過期 | 重新認證；必要時執行 `get-token.py` |
| 工具 output URL 回傳 404 或無法存取 | R2 物件 TTL 過期（60 分鐘） | 重新執行原本的工具取得新的 URL |
| Cloud Run 所有請求回傳 `403` | `X-MCP-Key` header 遺失或錯誤 | 確認 Worker 環境變數中的 secret 是否正確 |
| Browser-based MCP client 無法連線 | `/mcp` endpoint 缺少 CORS headers | 加上 `OPTIONS` preflight handler + 所有回應加 `Access-Control-Allow-Origin: *` |

---

## MCP 工具定義格式參考（供 AI Agent 使用）

以下是定義一個 MCP 工具的完整 JSON 結構。AI Agent 和 MCP client 透過這個結構了解有哪些工具可用、每個工具接受哪些參數，以及每個參數的含義。

```json
{
  "name": "your_tool_name",
  "description": "一句話描述這個工具做什麼、回傳什麼。AI Agent 會根據這段描述判斷何時呼叫這個工具。",
  "inputSchema": {
    "type": "object",
    "properties": {
      "file": {
        "type": "string",
        "description": "輸入檔案 — 小檔用 base64 data URI，大檔或已上傳的檔案用 HTTPS URL"
      },
      "option_flag": {
        "type": "boolean",
        "default": false,
        "description": "啟用此選項時會做什麼。選填參數一定要寫 default。"
      },
      "choice_param": {
        "type": "string",
        "default": "default_value",
        "enum": ["option_a", "option_b", "option_c"],
        "description": "使用哪種輸出模式。description 裡列出各選項的差異。"
      },
      "numeric_param": {
        "type": "integer",
        "default": 0,
        "description": "這個數字控制什麼。包含有效範圍，例如 0–255。"
      }
    },
    "required": ["file"]
  }
}
```

**讓 LLM 正確使用工具定義的關鍵原則：**

- 工具的 `description`：一句話，動詞開頭，說明產出什麼——不要描述內部運作
- 每個屬性的 `description`：數字參數要寫有效範圍，enum 參數要列出各選項的取捨，說明 default 的行為
- `required`：只列出工具無法推斷或提供預設值的參數。所有選填參數都要有 `default`
- 避免模糊描述如「輸入檔案」——要說清楚接受哪些格式、如何提供

---

## 常見問題

**Remote MCP Server 是什麼？**

Remote MCP Server 是實作了 Model Context Protocol 的雲端託管服務，讓 Claude 等 AI 助理可以透過網際網路和自然語言直接呼叫工具。與本機 MCP Server（跑在使用者自己電腦上、只能從本機存取）不同，Remote Server 運行在雲端，任何已認證的 MCP client 都能存取，不需要在本機安裝任何東西。

**怎麼在 Claude Desktop 或 Claude Code 加入 MCP Server？**

Claude Desktop 在 Settings → Developer 找到 `claude_desktop_config.json`，把 server 設定加進去。Claude Code 在終端機執行 `claude mcp add <名稱> --transport http <URL>`。在明確設定連線之前，Claude 完全不知道這個 server 存在，也無法使用它的任何工具。

**在 Cloudflare 和 GCP 上跑 Remote MCP Server 要花多少錢？**

流量不高的情況下可以完全免費。Cloudflare Workers 免費方案每天 10 萬次請求。Cloudflare R2 每月 10 GB 儲存、100 萬次寫入、1,000 萬次讀取，egress 永久免費。GCP Cloud Run 每月 200 萬次請求和 36 萬 GB-seconds 的運算在免費額度內。以零散工具呼叫為主的開發者工具，可以完全跑在這些免費額度裡。

**MCP 認證為什麼要用 OAuth 而不是 API Key？**

OAuth 2.1 提供更好的使用者體驗。使用 API Key，使用者必須手動複製貼上 token 到 config 檔——多步驟，遺失 key 後也沒有自助恢復的方式。使用 OAuth，Claude Desktop 和 Claude Code 原生處理整個流程：自動開啟瀏覽器，使用者點一下「授權」，token 自動存好。使用者完全不需要碰任何 config 檔。

**為什麼 Claude 找不到我的 MCP 工具？**

最常見的原因是 MCP server 沒有在 client 設定連線——Claude 不會自動發現 server。如果 server 已設定但工具還是不出現，檢查 `tools/list` 是否能在不需要認證的情況下存取。如果它需要 Bearer token，Claude 在初始握手時就無法取得工具清單，表現得就好像這個 server 完全沒有工具一樣。

**怎麼把大檔案傳給 MCP 工具？**

對大於 ~185 KB 的檔案，使用 server 的 `/upload` endpoint，而不是 base64 編碼。直接把檔案 POST 過去（multipart/form-data），收到回傳的 URL 後把它當作工具的 file 參數傳入。Server 直接 server-side 讀取檔案，完全繞過 Claude Code shell tool 的 ~256 KB 輸出限制——這個限制讓 inline base64 對大多數真實世界的檔案根本不可行。

**X-MCP-Key header 是什麼？**

X-MCP-Key 是 Cloudflare Worker（公開的 gateway）和 GCP Cloud Run 後端之間用來做內部認證的共用密鑰，確保所有流量只能透過 Worker 到達 Cloud Run，而不能從網際網路直接存取。沒有這個機制，任何人只要發現 Cloud Run 的 URL，就能完全繞過 OAuth 驗證和 quota 管控。

**要跑一個 MCP Server，我的後端程式碼必須公開嗎？**

不需要。只有 MCP 包裝層（Cloudflare Worker）需要是公開的 repository——它定義你的 API 介面，讓社群可以參考整合方式。Cloud Run 後端，也就是實際業務邏輯所在，可以永遠放在 private repo。你可以發佈開放的 MCP 整合，同時把私有的演算法和實作細節完全鎖在 private repository 裡。
