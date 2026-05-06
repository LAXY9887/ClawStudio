# 建置 Remote MCP Server 心得與經驗整理

> 以 spritesheet-forge 為實例，紀錄從零到上架的完整歷程。
> 適用對象：未來建置任何 remote MCP server 的參考資料。

---

## 一、整體架構選擇

### 推薦架構：MCP Gateway + 後端服務分離

```
MCP Client (Claude Desktop / Claude Code)
        │  Streamable HTTP (MCP protocol)
        ▼
Cloudflare Worker  ←── MCP gateway、Auth、Quota、File staging
        │  HTTP + X-MCP-Key
        ▼
Cloud Run / 任何後端  ←── 實際業務邏輯（image processing 等）
        │
        ▼
Cloudflare R2  ←── 暫存輸出檔案（TTL 1 小時）
Cloudflare KV  ←── Session、Quota、OAuth state
```

**為什麼這樣分？**

- Cloudflare Worker 處理 MCP 協議、認證、限額，**無狀態、全球低延遲**
- 實際業務邏輯放 Cloud Run，可以用任何語言/框架，不受 Worker 限制（CPU time、記憶體）
- R2 作為工具輸出的暫存空間，讓 Agent 可以鏈式傳遞（tool output → 下一個 tool input）
- 兩層之間用 `X-MCP-Key` header 做內部認證，防止繞過 Gateway 直接打後端

---

## 二、認證策略

### 選擇：OAuth 2.1 + PKCE（綁定 GitHub 帳號）

**為什麼不用 API Key？**

API Key 對使用者體驗差——要叫使用者去複製貼上一串 key，再設定到 MCP client config 裡。OAuth 可以讓 Claude Desktop / Claude Code **自動完成整個授權流程**，使用者只需要在瀏覽器點一下「授權」，完全無感。

**OAuth 2.1 + PKCE 要點：**

- 使用 GitHub 作為 Identity Provider，不用自己建帳號系統
- PKCE（Proof Key for Code Exchange）防止 authorization code 被截取
- Session token 存在 KV，TTL 30 天，到期自動失效
- 提供 `/.well-known/oauth-authorization-server` 讓 MCP client 自動發現 endpoints
- 動態 client registration（RFC 7591）讓任何 MCP client 都能自動接入

**提供手動取 token 的 fallback：**

部分使用情境（curl、benchmark、自定義 script）需要手動取得 Bearer token。提供一個 Python 腳本下載點（`/get-token.py`），一行指令完成整個 OAuth 流程，印出 token 並存到本機。

---

## 三、MCP 協議實作注意事項

### 3.1 tools/list 必須允許未認證存取

**這是最重要的坑。**

各平台（Smithery、MCP.so、Glama 等）的爬蟲會呼叫 `tools/list` 來偵測你的工具。如果這個方法需要認證，爬蟲就會回報「0 tools found」，導致：
- 平台品質分數為 0
- 使用者在目錄看不到你有哪些工具

解法：在 MCP POST handler 裡，把 `initialize`、`notifications/initialized`、`tools/list` 列為「免認證 handshake 方法」。

```typescript
const isHandshake = body.method === 'initialize'
  || body.method === 'notifications/initialized'
  || body.method === 'tools/list';
```

### 3.2 CORS Headers 不可少

Browser-based MCP clients（包含 MCP.so 的線上測試工具）需要 CORS header，否則會被瀏覽器阻擋。

必須處理的兩件事：
1. **OPTIONS preflight** — 回傳 204 + CORS headers
2. **所有 `/mcp` POST 回應** — 加上 `Access-Control-Allow-Origin: *`

### 3.3 outputSchema 和 annotations 影響品質分數

Smithery 等平台會用這兩個欄位計算 Capability Quality 分數：

- **outputSchema**：描述工具回傳值的 JSON Schema，幫助 LLM 更好地解析輸出
- **annotations**：行為提示，讓平台和 LLM 知道這個工具的特性
  - `readOnlyHint`：不會修改資料
  - `destructiveHint`：有破壞性操作
  - `idempotentHint`：重複呼叫結果相同
  - `openWorldHint`：會存取外部網路/服務

這兩個欄位加上之後，Smithery Quality Score 從 0 分提升到有分數。

---

## 四、檔案輸入設計

### 大檔案三種傳遞方式

MCP tool 的 `file` 參數應同時支援三種輸入：

| 情境 | 方法 |
|------|------|
| 小檔案（< ~185 KB） | base64 data URI，`data:image/png;base64,...` |
| 大檔案（≥ 4 MB 或 shell 編碼） | POST 到 `/upload` endpoint，傳回 URL |
| 前一個工具的輸出 | 直接傳 output URL，server 從 R2 讀取 |

**關鍵 bug：base64 換行問題**

Shell 工具（`openssl base64`、`base64` CLI）產生的 base64 字串**每 76 字元插入一個換行**。如果不去掉換行就直接貼進 data URI，server 解析時會失敗（INVALID_BASE64 錯誤）。

在 tool description 裡一定要明確警告：
> "你必須在加上 data URI prefix 之前，去掉 base64 字串中所有的空白和換行。"

**Agent 的實際限制：**

Claude Code 的 shell tool 輸出有 ~256 KB 的 context limit，超過會寫到 temp file 但無法讀回。因此實際上使用 base64 安全的上限是 ~185 KB（不是 4 MB）。這個限制要在 tool description 裡說清楚，引導使用者改用 upload endpoint。

---

## 五、工具設計原則

### 5.1 Tool Description 是給 LLM 看的使用說明

Tool description 不只是給人類看——LLM 靠它決定何時、如何使用這個工具。寫法要：
- 說清楚輸入格式（URL？data URI？哪種 MIME type？）
- 說清楚輸出是什麼（URL、TTL、格式）
- 列出重要限制（檔案大小上限、特殊參數規則）
- 遇到複雜輸入規則，直接在 description 裡給範例或指令

### 5.2 讓工具可以鏈式使用

每個工具的輸出 URL 可以直接當作下一個工具的輸入，不需要重新上傳。這讓 Agent 可以自然地組合工具：

```
gif_to_spritesheet → split_spritesheet → frames_to_animation
```

設計時要讓 server 能區分「output URL」和「外部 URL」，從自己的 R2 直接讀取，避免 HTTP round-trip。

### 5.3 server_info 工具

提供一個無參數的 `server_info` 工具，回傳：
- upload endpoint URL
- output file TTL
- 檔案大小限制
- base64 vs upload 的判斷規則

讓 Agent 在開始複雜工作流程前可以查詢 runtime 設定，而不用把這些資訊硬寫在每個工具的 description 裡。

---

## 六、Quota 設計

### 用 KV 實作 per-user monthly quota

- Key：`quota:{userId}:{YYYY-MM}`
- Value：使用次數（integer）
- 月底自動過期（KV TTL 設到月底）

每次工具呼叫前 `checkQuota()`，超過上限回傳明確錯誤訊息（告知上限、重置日期）。工具執行成功後才 `incrementQuota()`，避免 failed call 也算次數。

每個工具回應都帶上 quota 狀態（已用/上限/重置日期），讓 Agent 知道剩餘額度。

---

## 七、上架前的準備清單

在提交到任何 MCP 目錄平台前，確認以下項目：

- [ ] `tools/list` 不需要認證即可呼叫
- [ ] CORS headers 正確設定（OPTIONS preflight + POST response）
- [ ] 所有工具都有 `outputSchema`
- [ ] 所有工具都有 `annotations`（至少填 `title` 和 `readOnlyHint`）
- [ ] `/health` endpoint 回傳 `{"status":"ok"}`（HTTP 200，不需認證）
- [ ] `/.well-known/oauth-authorization-server` 可公開存取
- [ ] README / 文件頁面包含 MCP endpoint URL 和連線說明

---

## 八、目錄平台上架策略

### 各平台特性比較

| 平台 | 性質 | 上架方式 | 價值 |
|------|------|---------|------|
| **Anthropic Registry** | 官方 | `server.json` + `mcp-publisher` CLI | MCP client app 整合，非 web 搜尋 |
| **Smithery.ai** | 免費目錄 | CLI `smithery mcp publish` | **最重要**，直接整合進 Claude Code |
| **Glama.ai** | 免費目錄 | `glama.json` commit 到 repo | 自動掃描，有評分系統 |
| **MCP.so** | 免費目錄 | 網頁表單 | 一般曝光，平台有 bug |
| **mcp-marketplace.io** | 付費市場 | LAUNCHGUIDE.md + 網頁表單 | 有 85% 收益分潤，台灣用 Polar.sh |
| **mcpmarket.com** | 免費目錄 | 填 GitHub URL | 10,000+ servers，有中文版 |
| **GitHub Marketplace** | 付費市場 | GitHub App 設定 | 需 100 installations 解鎖付費功能 |

### 關鍵學習

**Smithery 最值得優先處理**：Smithery 直接整合在 Claude Code 的 MCP 瀏覽功能裡，使用者不需要 web 搜尋就能發現工具。

**Anthropic Registry 的定位**：這不是 web 搜尋索引，是 MCP client application 的整合目錄。Agent 用 Google 搜尋找不到，但 MCP client app 直接查詢 API 會看到。

**Glama Release 只適合 stdio server**：Glama 的 Release 功能需要 Docker containerize，對於已經是 remote/hosted server 的架構沒有意義，可以跳過。

---

## 九、LAUNCHGUIDE.md 格式（mcp-marketplace.io 專用）

mcp-marketplace.io 會自動讀取 repo 根目錄的 `LAUNCHGUIDE.md` 預填上架表單。格式：

```markdown
# 伺服器名稱

## Tagline
一行描述，最多 100 字元

## Description
完整描述：做什麼、怎麼運作、目標用戶

## Setup Requirements
- `ENV_VAR` (required): 說明這個變數是什麼

## Category
Developer Tools  （從固定清單選一個）

## Use Cases
Game Development, Image Processing  （逗號分隔）

## Features
- 功能一
- 功能二

## Getting Started
- "範例 prompt"
- Tool: tool_name — 說明

## Tags
tag1, tag2, tag3  （最多 30 個）

## Documentation URL
https://...

## Health Check URL
https://.../health
```

---

## 十、台灣開發者的收費平台選擇

**Stripe 不支援台灣**（2026 年現況，台灣不在 46 個支援國家內）。

替代方案：

| 平台 | 費用 | 特點 |
|------|------|------|
| **Polar.sh** | 4% + $0.40 | **最推薦**，明確支援台灣，專為開發者工具設計，MoR（代繳全球稅） |
| **Lemon Squeezy** | 5% + $0.50 | SaaS 友好，但 2024 年被 Stripe 收購後開發趨緩 |
| **Paddle** | ~5%+ | 企業級合規，適合較高收入規模 |
| **Stripe Atlas** | Stripe 費率 + LLC 維護成本 | 透過設立美國 LLC 繞過限制，每年約 $1,500+ 維護成本 |

---

## 十一、整體時程參考

| 階段 | 工作項目 | 重點 |
|------|---------|------|
| 架構設計 | Gateway 選型、Auth 策略、儲存方案 | 選 Cloudflare Worker + OAuth 2.1 |
| 核心開發 | MCP 協議實作、工具邏輯、Quota | tools/list 免認證、CORS、outputSchema |
| 上架準備 | health check、LAUNCHGUIDE.md、glama.json、server.json | 清單逐項確認 |
| 平台上架 | 依序提交各平台 | Smithery 優先 |
| 宣傳 | README SEO、自有網站 | GitHub 頁面 Google 排名建立快 |

---

## 附錄：常見錯誤對照表

| 錯誤現象 | 根本原因 | 解法 |
|---------|---------|------|
| 平台顯示「0 tools found」 | `tools/list` 需要認證 | 加入 handshake whitelist |
| MCP.so 線上測試失敗 | 缺少 CORS headers | 加 OPTIONS handler + `Access-Control-Allow-Origin: *` |
| Smithery Quality Score 為 0 | 缺少 outputSchema / annotations | 所有工具補上這兩個欄位 |
| base64 解析失敗（INVALID_BASE64） | shell 工具插入換行符 | description 明確警告，提供 `tr -d '\n'` 指令 |
| Glama 顯示「No Glama release」 | Glama release 需要 Docker | Remote server 跳過這個步驟 |
| Smithery namespace 錯誤 | CLI 顯示的 namespace 和網頁不同 | 以 Smithery 網頁 UI 的 namespace 為準 |

---

*建立時間：2026-05-05*
*專案：spritesheet-forge MCP server（https://mcp.clawstudiouo.com）*
