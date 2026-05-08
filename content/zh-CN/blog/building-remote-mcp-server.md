---
title: "用 Cloudflare Workers + GCP Cloud Run 构建 Remote MCP Server：完整实战指南"
description: "完整指南：在 Cloudflare Workers 和 GCP Cloud Run 上构建 Remote MCP Server——涵盖 OAuth 2.1 + PKCE、内部服务认证、R2 文件暂存，以及保护后端代码的架构设计。"
date: "2026-05-06"
readingTime: 15
tag: "guide"
---

## 起点：已有的 API 服务

在任何 MCP 之前，Spritesheet Forge 就已经有一个运作中的后端：一组跑在 Google Cloud Platform 上的图像处理 API，负责实际的工作——GIF 转 spritesheet、裁切透明边缘、打包帧、生成 atlas JSON。

MCP（Model Context Protocol，模型上下文协议）是一个开放标准，让 Claude 等 AI 助理可以通过自然语言直接调用工具和 API。MCP 加进来之后，做的事情是在这个现有 API 的上面架一层 **AI 原生的调用界面**。不是取代它，而是让 Claude 可以通过自然语言来触发这些操作。后端没有改变，改变的是它怎么被调用。

这个脉络对理解后面的架构决策很重要：这不是从零开始建系统，而是在已有的东西上面叠一层新界面。

### 为什么选 GCP

如果你还没选定云端供应商，GCP 的 serverless 架构对开发者工具来说值得认真考虑——尤其是流量不稳定、无法预测的情境。

关键特性是 **scale to zero**。GCP 的托管容器运行平台 Cloud Run，在没有请求时会完全停止，有请求时在几秒内启动。你只为实际使用的运算时间付费，计费精度到 100ms。对于以零散工具调用为主、不是持续高流量的 MCP server，实际跑下来的费用可以接近 $0。

其他值得知道的优点：

- **不需要管理基础设施** — Cloud Run 自动处理 HTTPS、自动扩缩容、健康检查、部署回滚
- **任何语言、任何框架** — 只要能打包成容器都能部署，不绑定特定 runtime
- **免费额度够用** — 每月 200 万次请求、36 万 GB-seconds 的运算完全免费
- **部署流程可以完全自动化** — Artifact Registry + Cloud Build，一行 `gcloud` 指令完成 build → push → deploy

关于如何从零开始架设这套 GCP 架构——Cloud Run 部署、Artifact Registry、Cloud Build CI/CD、IAM 设定——之后会有一篇专门的教学文章。*([在 GCP 建立 API 服务](/blog/deploy-api-on-gcp-cloud-run))*

---

## 加上 MCP 这一层

后端已经在跑了，接下来的问题是：怎么让 AI client 能调用它？

答案是在 Cloudflare Workers 上建一个轻量的 gateway，负责说 MCP 协议，并把请求转译给现有的 API。

```
MCP Client (Claude Desktop / Claude Code)
        │  Streamable HTTP (MCP protocol)
        ▼
Cloudflare Worker  ←── MCP gateway、Auth、Quota、File staging
        │  HTTP + X-MCP-Key
        ▼
GCP Cloud Run  ←── 现有 API（图像处理等）
        │
        ▼
Cloudflare R2  ←── 暂存输出文件（TTL 1 小时）
Cloudflare KV  ←── Session、Quota、OAuth state
```

### Cloudflare Worker

Worker 负责边缘层的所有工作：MCP 协议解析、OAuth token 验证、per-user quota 管控，以及 file staging。Worker 全球分散部署、没有冷启动，请求打到最近的 PoP，额外开销在毫秒以下。代价是严格的 CPU 时间限制（免费方案每次请求 50ms），这正是计算密集型工作必须留在 Cloud Run 的原因。

### Cloudflare R2

R2 是工具间传递数据的桥梁。每个工具的输出都写入 R2 并设定 1 小时 TTL，回传 URL。下一个工具收到这个 URL 当输入时，Worker 直接从 R2 读取，不需要绕过公网。这让多步骤的 Agent 工作流程既快又省。R2 相容 S3 API，现有的 S3 SDK 不需修改即可使用。

### Cloudflare KV

KV 储存三种数据：OAuth session token（30 天 TTL）、per-user 每月 quota 计数器，以及 OAuth 授权流程中的 PKCE state。KV 是最终一致性，读取从边缘快取提供——非常适合这种写一次多次读的短暂存活数据。

关于 Cloudflare Workers 的完整设置流程——建立 Worker、设定自订域名、DNS 管理、R2 和 KV 的接线——请参考配套教学：*([Cloudflare 完整设置教学：Worker、DNS 与自订域名](/blog/cloudflare-worker-setup-guide) — 即将发布)*

### Private Repo 的额外好处

Gateway 和后端分开，还解决了一个比较不明显的问题：**只需要公开 MCP 包装那层的 repo**。

Cloudflare Worker 的代码本质上是你的 API 界面——定义了哪些工具存在、参数怎么设计、认证如何运作。公开它让使用者可以看到整合方式，社群也能贡献相容的 client。而 Cloud Run 后端，也就是实际处理逻辑所在，可以永远放在 private repo。核心算法和实现细节不会对外暴露。

对商业产品来说，这非常重要：你可以展示 MCP server 技术、让开源社群参与整合层的开发，同时把私有后端完全封锁。不需要因为上架 MCP 目录或公开 server，就必须把自己的代码交出去。

---

## MCP Server 需要哪些组成要件

Spritesheet Forge 第一次上线时，MCP server 技术上是跑起来了——但 Claude 几乎没办法用它。工具存在，但 server 缺了好几个 MCP client 在调用任何工具之前就需要的东西。Agent 连上去、陷入混乱、然后放弃。

以下是一个 Remote MCP Server 要能正常运作，实际需要的完整清单：

### MCP 协议 Handler（`POST /mcp`）

主要 endpoint 接收所有 MCP 流量。它需要处理每个 MCP client 在做任何有用的事情之前都会依序送出的一组讯息：

| 方法 | 谁发送 | 意义 |
|------|--------|------|
| `initialize` | Client，第一条讯息 | 「我要连线了，这是我的能力清单」 |
| `notifications/initialized` | Client，收到 server 回应后 | 「准备好了，可以继续」 |
| `tools/list` | Client，用来发现可用工具 | 「你能做哪些事？」 |
| `tools/call` | Client，实际调用工具 | 「帮我做这件事」 |

`initialize` 和 `notifications/initialized` 这两条讯息**必须在不需要认证的情况下回传有效回应**——它们是建立 session 的握手过程。如果其中任何一个失败或回传认证错误，client 会认为连线已损坏并停止尝试。

### 工具定义

`tools/list` 回传的每个工具，需要四个部分才算完整：

```typescript
{
  name: 'gif_to_spritesheet',
  description: '...', // 给 LLM 看的使用说明——详见工具设计章节
  inputSchema: {       // 参数的 JSON Schema
    type: 'object',
    properties: { ... },
    required: [...]
  },
  outputSchema: { ... },  // 回传值的 JSON Schema
  annotations: {          // 给平台和 LLM 的行为提示
    title: 'GIF to Spritesheet',
    readOnlyHint: false,
    idempotentHint: false,
    openWorldHint: true
  }
}
```

缺少 `outputSchema` 或 `annotations` 不会让工具调用直接失败，但会让你在每个目录平台的品质分数掉到谷底。更重要的是，LLM 靠 `outputSchema` 来解析和理解工具回传的结果——没有它，模型就是在猜回传的数据结构。

### 探索与基础设施 Endpoints

除了 `/mcp`，一个完整的 server 还需要：

- **`GET /health`** — 回传 `{"status":"ok"}` HTTP 200，不需要认证。目录平台靠这个确认你的 server 还活着。
- **`OPTIONS /mcp`** — 处理 CORS preflight。所有 browser-based MCP client 都需要这个。
- **`GET /.well-known/oauth-authorization-server`** — 如果使用 OAuth，MCP client 靠这个自动发现你的认证 endpoints。没有这个，client 要麼需要手动设定，要麼直接连线失败。

### 缺了这些会怎样

Claude 连接 MCP server 的流程是固定的：`initialize` → `notifications/initialized` → `tools/list`，依序执行。如果 `tools/list` 失败（因为需要认证、或回应格式错误），client 就没有任何工具定义可以使用。从 Claude 的视角来看，server 存在，但没有任何能力——什么都没办法调用。

这就是「Agent 几乎无法使用这个 MCP」的实际样貌：连线成功了，但每次尝试使用工具都失败，因为工具探索这个步骤从来没有正确完成。

### 协议讯息实际长这样

MCP 协议的每一条讯息都是通过 HTTP POST 传送的 JSON-RPC 2.0 物件。以下是实际的交换过程。

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

**Server 回应自己的能力清单**

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

**第二步 — Client 送出 `notifications/initialized`**（不需要回应）

```json
{
  "jsonrpc": "2.0",
  "method": "notifications/initialized"
}
```

**第三步 — Client 送出 `tools/list`**（不需要认证）

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/list"
}
```

**Server 回传所有已注册的工具**

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

这个握手流程完成后，client 就知道有哪些工具、以及如何调用它们。只有在这之后，认证才开始变得重要——`tools/call` 等实际工具调用才需要有效的 Bearer token。

**`server_info` — 无参数工具调用范例**

以下是一次真实的 `tools/call` 请求与回应，使用 Spritesheet Forge 的 `server_info` 工具：

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

**实际回应：**

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
            "small_file": "< 4 MB：base64 编码后加上 data URI prefix，必须去除所有换行符。",
            "large_file": "≥ 4 MB 或通过 shell 编码：POST 到 /upload，使用回传的 URL。",
            "previous_output": "任何工具的 output URL 都可以直接作为下一个工具的输入。",
            "ttl_warning": "Output URL 在建立后 60 分钟过期。"
          }
        }
      }
    ]
  }
}
```

`server_info` 是「回传设定或元数据的工具」应遵循的模式：无参数、输出确定性、让 Agent 在开始复杂工作流程前可以先查询一次。

---

## 认证

### 为什么要认证？

没有认证的 MCP server 就是一个完全开放的公开 API——任何人发现这个 endpoint 就能无限制地调用你的工具，消耗 Cloud Run 的运算资源、写入 R2 储存空间，并把真实使用者的 quota 额度耗尽。认证同时解决三个问题：

- **资源保护**：每次工具调用都直接对应到运算成本。不知道是谁在调用，就无法设定限制。
- **Quota 管理**：per-user 每月 quota 需要有稳定的身份才能追踪。没有身份就没有公平执行的基础。
- **防止滥用**：没有认证的公开 endpoint 非常容易被脚本化——一个恶意使用者就能让你的帐单暴增，或让其他人的服务品质下降。

### 认证方式比较

| 方式 | 使用者体验 | 实作复杂度 | MCP client 支援 |
|------|-----------|-----------|----------------|
| 不认证 | 零摩擦 | 极简单 | 全部支援 |
| Static API Key | 差——使用者需手动复制贴上 | 简单 | 全部支援 |
| OAuth 2.1 + PKCE | 流畅——浏览器一键完成 | 中等 | Claude Desktop、Claude Code |

**不认证**只适合本机或内网的 server，由网路本身承担安全边界。对公开的 remote server 来说，这代表网际网路上任何人都能调用你的工具。

**API Key** 是直觉上的第一选择：产生一个 key、给使用者、完成。问题在于分发体验。使用者要去找 dashboard 或文件页面，复制一串乱码，开启 config 档，贴上去，重启 client。这是多步骤流程，任何一步都可能出错，key 遗失也没有自助恢复的方式。而且每个新的 MCP client 都要重复同样的手动设定。

**OAuth 2.1 + PKCE** 实作比较麻烦，但带来的使用者体验差距非常大。MCP client 原生处理整个 OAuth 流程——在需要 token 时自动开启浏览器。使用者看到 GitHub 登入页面，点一下「授权」，client 自动把 token 存起来。从使用者的角度看，就是一次点击，完全不需要碰任何 config 档。

### Spritesheet Forge 的实作方式

以 GitHub 作为 Identity Provider，Cloudflare KV 储存 token，标准 OAuth 2.1 + PKCE 流程：

**1. 自动发现端点 `/.well-known/oauth-authorization-server`**

MCP client 在发起任何 OAuth 流程之前都会读取这个端点，取得 authorization endpoint、token endpoint 以及支援的 grant type。没有这个端点，client 要麼需要手动设定，要麼完全无法连线。

**2. 动态 client registration（RFC 7591）**

任何 MCP client 都可以通过 POST 到 registration endpoint 自动完成登记，不需要预先审核或加入任何名单——server 自动处理。

**3. PKCE 流程**

防止 authorization code 被截取。client 先产生一个随机的 `code_verifier`，在发送 authorization request 时附上它的 hash（`code_challenge`），之后交换 token 时再证明自己持有原始的 verifier。这封闭了 code 在传输过程中被盗取的攻击路径。

**4. KV session 储存**

Session token 存在 Cloudflare KV 的 `session:{userId}` key 下，TTL 30 天。每次 `tools/call` 请求都会先用这个 token 去 KV 验证，通过才把请求转发给 Cloud Run。

**5. 脚本备援**

对需要在脚本、CI 流程或 benchmark 环境使用、但无法完成浏览器 OAuth 的使用者，提供可下载的 `get-token.py` 脚本。在终端机执行整个 OAuth 流程，印出 token 并存到 `~/.spritesheet-forge-token`。

### X-MCP-Key：内部服务认证

架构分成两层：Cloudflare Worker（公开的 Gateway）和 Cloud Run（私有的后端）。Cloud Run 跑在一个技术上可从网际网路存取的 URL——任何人如果发现这个 URL，就能直接 POST 请求，完全绕过 Worker。这代表绕过 OAuth 验证、quota 管控，以及所有 rate limiting。

`X-MCP-Key` header 填补了这个缺口。这是一个只有 Worker 和 Cloud Run 知道的共用密钥。Worker 验证每个进来的 OAuth token，然后把请求连同这个 header 一起转发给 Cloud Run。Cloud Run 拒绝任何不带正确 key 的请求。

```
使用者 → Worker:      Authorization: Bearer <oauth-token>    (公开认证)
Worker → Cloud Run:   X-MCP-Key: <internal-secret>          (内部认证)
```

这是**纵深防御**的概念：就算 Cloud Run URL 通过 log、错误讯息或逆向工程泄漏出去，攻击者没有内部 key 就无法调用它。所有流量都被强制通过 gateway，所有安全管控都得以保全。

没有这个机制，「私有后端」就只是说说而已——对够有心的人来说，后端实际上仍然是公开的。

---

## 文件输入设计

这个章节针对的是工具本身需要处理文件的 MCP server——图像转换、文件解析、音讯处理等类型的 API。如果你的工具只处理文本或结构化数据，不会遇到这个问题。但对文件型的 API 来说，这是实作上最容易踩到的限制之一。

问题的核心是：**让 Agent 通过 API 处理文件，比想像中困难**。直觉的做法是把文件 base64 编码后直接夹在请求裡传过去，理论上可行，但实际上会撞上一道硬限制：Claude Code 的 shell tool 对 stdout 输出有 ~256 KB 的 context 上限。base64 编码会让文件大小膨胀约 33%，所以 inline base64 实际能用的安全上限大约是 185 KB。大多数的图片、音讯档案、文件都比这大。

这让 base64 在现实世界的文件处理场景中几乎无法使用。我们的解法是在 MCP 层加上一个独立的 `/upload` endpoint——它不在 MCP 协议裡，是一个普通的 HTTP endpoint。使用者（或 Agent）直接把文件 POST 过去，取得一个 URL，再把这个 URL 传给工具，而不是把文件 inline 嵌入请求。Worker 收到 URL 后直接从 R2 server-side 读取，完全绕过 context 大小的限制。

**为什么用 Cloudflare R2 储存文件？**

R2 是 Cloudflare 的 S3 相容物件储存服务，在这个架构裡选它有一个很具体的原因：**零 egress 费用**。AWS S3 和大多数物件储存服务都对数据输出收费——每次工具输出被读取（在工具链中每次调用下一个工具时都会发生），你就要付费。R2 的 egress 完全免费。对一个频繁在工具间传递文件的 MCP server 来说，这个差异非常显著。

R2 的免费方案额度也足够让流量不高的 MCP server 完全跑在免费层内：

| 资源 | 免费额度 |
|------|---------|
| 储存空间 | 10 GB / 月 |
| Class A 操作（写入、删除） | 100 万次 / 月 |
| Class B 操作（读取） | 1,000 万次 / 月 |
| Egress（数据输出） | 永久免费 |

工具输出设定 1 小时 TTL 后自动删除——所以就算使用量频繁，实际佔用的储存空间也很少。一个在 1 小时内处理完毕的文件，几乎不会对当月的储存总量造成影响。

接受文件的 MCP 工具需要处理三种输入情境：

| 情境 | 方法 |
|------|------|
| 小文件（< ~185 KB） | base64 data URI：`data:image/png;base64,...` |
| 大文件或来自 shell 的文件 | POST 到 `/upload` endpoint，传回 URL 使用 |
| 前一个工具的输出 | 直接传 output URL——Worker 从 R2 读取 |

有一个不直觉的限制：Claude Code 的 shell tool 对 stdout 有 ~256 KB 的 context 限制。base64 编码会让文件大小增加 ~33%，所以 inline base64 实际安全上限是 ~185 KB，不是 4 MB。工具 description 应该明确说明这个限制，并在适当时候引导使用者改用 upload endpoint。

**base64 换行问题。** `openssl base64`、`base64` 等 shell 工具产生的 base64 字串每 76 字元会插入一个换行符。直接把这个字串贴进 data URI，server 解析时会出现 `INVALID_BASE64` 错误。在工具 description 裡一定要加上这个警告：

> "在加上 data URI prefix 之前，必须去掉 base64 字串中所有的空白和换行。范例：`base64 file.png | tr -d '\n'`"

---

## 让工具能被 LLM 正确使用

### 第零步：让 Claude 连上你的 MCP Server

在使用任何工具之前，Claude 必须先连线到 MCP server。这看起来很理所当然，但值得明确说清楚：Claude 不会自动发现或连线到任何 MCP server。你必须明确设定连线，在设定之前，Claude 完全不知道这个 server 的存在。

**Claude Desktop** — 加入 `claude_desktop_config.json`（从 Settings → Developer 找到这个档案）：

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

**Claude Code CLI** — 在终端机执行：

```bash
claude mcp add spritesheet-forge --transport http https://mcp.clawstudiouo.com/mcp
```

如果没有设定连线，Claude 不会说「我找不到那个工具」——它只会表现得好像这个工具根本不存在。接下来它会上网搜寻替代方案、幻想出听起来类似但实际上不存在的工具，或者给出一个完全答非所问的回应。这种失败是静默的，非常容易让人搞混。

### 使用者怎么找到你的 MCP Server

让 Claude 连上 server 是第一步。让使用者知道这个 server 存在是另一个问题。有几个管道，各自触及不同的受众：

**原始码与文件**
- [GitHub 储存库](https://github.com/LAXY9887/Game-Dev.-Spritesheet-Forge) — 主要的资讯来源。开发者第一个看这裡。清楚的 README 加上 endpoint URL 和设定范例是最低限度。
- [专属教学页面](https://sprite-forge-mcp.tutorial.clawstudiouo.com) — 一页式教学，带着使用者从安装、认证到实际范例 prompt 走一遍。适合不想读 README 的非开发者。

**官方目录**
- [Anthropic MCP Registry](https://registry.modelcontextprotocol.io/?q=io.github.LAXY9887%2Fspritesheet-forge) — Anthropic 官方的 MCP server 索引。MCP client 应用程式直接查询这裡，在 app 内显示精选 server 清单。

**市集与目录平台**
- [Smithery.ai](https://smithery.ai/servers/lxya98874322688423/spritesheet-forge) — 直接整合在 Claude Code 的 MCP 浏览器裡。使用者不需要离开 CLI 就能找到并安装 server。
- [MCP Marketplace](https://mcp-marketplace.io/server/game-dev-spritesheet-forge) — 有付费方案收益分潤机制的专属市集。
- GitHub Marketplace — 触及 GitHub 开发者生态系。

这些管道会相互强化。在 Smithery 上发现 server 的使用者，通常接着会去看 GitHub repo。教学页面把「发现」转换成实际安装。全部覆蓋的维护成本不高，但触及的受众几乎不重疊。

### 写出 LLM 真正看得懂的工具 description

工具 description 不是给人类看的文件——它是 LLM 用来决定「何时」和「如何」调用你的工具的指令。写得不好，模型就会调用错工具、传错参数，或产生难以排查的错误。

好的工具 description 应包含：

- **输入格式**：URL？data URI？接受哪些 MIME type？
- **输出**：工具回传什么？URL？JSON struct？TTL 是多少？
- **限制**：文件大小上限、参数互动规则、已知的坑
- **范例**：输入规则复杂时，直接在 description 裡给范例指令

**设计可链式调用的工具。** 让每个工具的 output URL 可以直接当作下一个工具的输入，Agent 就能自然地组合多步骤工作流程：

```
gif_to_spritesheet → split_spritesheet → frames_to_animation
```

**加一个 `server_info` 工具。** 提供一个无参数的工具，回传 runtime 设定：upload endpoint URL、output file TTL、文件大小限制，以及 base64 和 upload 的选择规则。这样就不用在每个工具 description 裡重复这些资讯，Agent 也有可靠的方式在开始复杂工作流程前查询设定。

---

## 常见错误对照

| 错误现象 | 根本原因 | 解法 |
|---------|---------|------|
| 平台显示「0 tools found」 | `tools/list` 需要认证 | 将 `initialize`、`notifications/initialized`、`tools/list` 加入 handshake whitelist |
| Smithery Quality Score 为 0 | 缺少 `outputSchema` / `annotations` | 所有工具补上这两个欄位 |
| `INVALID_BASE64` 解析失败 | shell 工具插入换行符 | description 明确警告；使用 `tr -d '\n'` |
| Agent 说找不到工具、开始上网搜寻 | MCP server 未在 client 设定连线 | 加入 `claude_desktop_config.json`，或执行 `claude mcp add` |
| OAuth 授权页面没有开启 | `/.well-known/oauth-authorization-server` 无法公开存取 | 确认这个 endpoint 不需要认证即可读取 |
| Upload endpoint 回传 `401` | Bearer token 未提供或已过期 | 重新认证；必要时执行 `get-token.py` |
| 工具 output URL 回传 404 或无法存取 | R2 物件 TTL 过期（60 分钟） | 重新执行原本的工具取得新的 URL |
| Cloud Run 所有请求回传 `403` | `X-MCP-Key` header 遗失或错误 | 确认 Worker 环境变数中的 secret 是否正确 |
| Browser-based MCP client 无法连线 | `/mcp` endpoint 缺少 CORS headers | 加上 `OPTIONS` preflight handler + 所有回应加 `Access-Control-Allow-Origin: *` |

---

## 常见问题

**Remote MCP Server 是什么？**

Remote MCP Server 是实作了 Model Context Protocol 的云端託管服务，让 Claude 等 AI 助理可以通过网际网路和自然语言直接调用工具。与本机 MCP Server（跑在使用者自己电脑上、只能从本机存取）不同，Remote Server 运行在云端，任何已认证的 MCP client 都能存取，不需要在本机安装任何东西。

**怎么在 Claude Desktop 或 Claude Code 加入 MCP Server？**

Claude Desktop 在 Settings → Developer 找到 `claude_desktop_config.json`，把 server 设定加进去。Claude Code 在终端机执行 `claude mcp add <名称> --transport http <URL>`。在明确设定连线之前，Claude 完全不知道这个 server 存在，也无法使用它的任何工具。

**在 Cloudflare 和 GCP 上跑 Remote MCP Server 要花多少钱？**

流量不高的情况下可以完全免费。Cloudflare Workers 免费方案每天 10 万次请求。Cloudflare R2 每月 10 GB 储存、100 万次写入、1,000 万次读取，egress 永久免费。GCP Cloud Run 每月 200 万次请求和 36 万 GB-seconds 的运算在免费额度内。以零散工具调用为主的开发者工具，可以完全跑在这些免费额度裡。

**MCP 认证为什么要用 OAuth 而不是 API Key？**

OAuth 2.1 提供更好的使用者体验。使用 API Key，使用者必须手动复制贴上 token 到 config 档——多步骤，遗失 key 后也没有自助恢复的方式。使用 OAuth，Claude Desktop 和 Claude Code 原生处理整个流程：自动开启浏览器，使用者点一下「授权」，token 自动存好。使用者完全不需要碰任何 config 档。

**为什么 Claude 找不到我的 MCP 工具？**

最常见的原因是 MCP server 没有在 client 设定连线——Claude 不会自动发现 server。如果 server 已设定但工具还是不出现，检查 `tools/list` 是否能在不需要认证的情况下存取。如果它需要 Bearer token，Claude 在初始握手时就无法取得工具清单，表现得就好像这个 server 完全没有工具一样。

**怎么把大文件传给 MCP 工具？**

对大于 ~185 KB 的文件，使用 server 的 `/upload` endpoint，而不是 base64 编码。直接把文件 POST 过去（multipart/form-data），收到回传的 URL 后把它当作工具的 file 参数传入。Server 直接 server-side 读取文件，完全绕过 Claude Code shell tool 的 ~256 KB 输出限制——这个限制让 inline base64 对大多数真实世界的文件根本不可行。

**X-MCP-Key header 是什么？**

X-MCP-Key 是 Cloudflare Worker（公开的 gateway）和 GCP Cloud Run 后端之间用来做内部认证的共用密钥，确保所有流量只能通过 Worker 到达 Cloud Run，而不能从网际网路直接存取。没有这个机制，任何人只要发现 Cloud Run 的 URL，就能完全绕过 OAuth 验证和 quota 管控。

**要跑一个 MCP Server，我的后端代码必须公开吗？**

不需要。只有 MCP 包装层（Cloudflare Worker）需要是公开的 repository——它定义你的 API 界面，让社群可以参考整合方式。Cloud Run 后端，也就是实际业务逻辑所在，可以永远放在 private repo。你可以发佈开放的 MCP 整合，同时把私有的算法和实现细节完全锁在 private repository 裡。
