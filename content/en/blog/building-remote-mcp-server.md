---
title: "Building a Remote MCP Server with Cloudflare Workers and GCP Cloud Run"
description: "Step-by-step guide to building a hosted MCP server on Cloudflare Workers and GCP Cloud Run — covering OAuth 2.1 + PKCE, internal service auth, R2 file staging, and keeping your backend code private."
date: "2026-05-06"
readingTime: 15
tag: "guide"
---

## Starting Point: An Existing API

Before any MCP was involved, Spritesheet Forge already had a working backend: a set of image processing APIs running on Google Cloud Platform. The APIs handled the actual work — converting GIFs to spritesheets, trimming transparent borders, packing frames, generating atlas JSON.

MCP (Model Context Protocol) is an open standard that lets AI assistants like Claude directly invoke tools and APIs through natural language. What MCP adds is an **AI-native interface** on top of that existing API. Instead of calling endpoints directly, Claude can now invoke these operations through natural language. The backend didn't change. What changed was how it's reached.

This distinction matters for understanding the architecture: this is not a ground-up rebuild. It's a new layer sitting in front of something that already works.

### Why GCP

If you're starting a new project and haven't chosen a cloud provider yet, GCP's serverless stack is worth serious consideration — especially for developer tools and utilities where traffic is unpredictable.

The key property is **scale to zero**. Cloud Run, GCP's managed container runtime, shuts down completely when there are no requests and starts back up in seconds when a request arrives. You pay only for the compute time actually used, billed to the nearest 100ms. For an MCP server that handles sporadic tool calls rather than continuous traffic, this translates to running costs that are nearly zero in practice.

Other benefits worth knowing:

- **No infrastructure to manage** — Cloud Run handles HTTPS termination, scaling, health checks, and deployment rollbacks automatically
- **Any language, any framework** — deploy any container, no platform-specific runtime required
- **Free tier is generous** — 2 million requests and 360,000 GB-seconds of compute per month at no cost
- **Artifact Registry + Cloud Build** — the deployment pipeline (build image → push → deploy) can be fully automated with a single `gcloud` command

A dedicated post covering this GCP setup from scratch — Cloud Run deployment, Artifact Registry, Cloud Build CI/CD, and IAM configuration — see the companion guide: *([Deploy a Containerized API on GCP Cloud Run](/blog/deploy-api-on-gcp-cloud-run))*

---

## Adding the MCP Layer

With the backend already running, the question was how to expose it to AI clients. The answer was a thin gateway on Cloudflare Workers that speaks the MCP protocol and translates requests to the existing API.

```
MCP Client (Claude Desktop / Claude Code)
        │  Streamable HTTP (MCP protocol)
        ▼
Cloudflare Worker  ←── MCP gateway, Auth, Quota, File staging
        │  HTTP + X-MCP-Key
        ▼
GCP Cloud Run  ←── existing API (image processing, etc.)
        │
        ▼
Cloudflare R2  ←── temporary output files (1-hour TTL)
Cloudflare KV  ←── Session, Quota, OAuth state
```

### Cloudflare Worker

The Worker handles everything at the edge: MCP protocol parsing, OAuth token verification, per-user quota enforcement, and file staging. Workers are globally distributed with no cold start — requests land at the nearest point of presence with sub-millisecond overhead. The constraint is a strict CPU time limit (50ms per request on the free tier), which makes them unsuitable for anything compute-intensive. That's exactly why the heavy work stays on Cloud Run.

### Cloudflare R2

R2 is the hand-off mechanism between tools. Every tool output is written to R2 with a 1-hour TTL and returned as a URL. The next tool in a chain receives that URL as input — the Worker fetches it directly from R2 without an extra HTTP round-trip. This makes multi-step agent workflows fast and cheap. R2 is S3-compatible, so any existing S3 SDK works without modification.

### Cloudflare KV

KV stores three types of data: OAuth session tokens (30-day TTL), per-user monthly quota counters, and OAuth PKCE state during the authorization flow. KV is eventually consistent with edge-cached reads — well-suited for these write-once-read-many values.

For a complete walkthrough of setting up Cloudflare Workers, configuring custom domains, managing DNS, and wiring up R2 and KV, see the companion guide: *([Complete Cloudflare Worker Setup for MCP Servers](/blog/cloudflare-worker-setup-guide) — coming soon)*

### The Private Repo Advantage

Splitting the gateway from the backend solves a less obvious problem: **only the MCP wrapper needs to be public**.

The Cloudflare Worker code defines your API surface — tool names, parameters, authentication. Publishing it lets the community inspect the integration and build compatible clients. The Cloud Run backend, where the actual processing logic lives, can stay in a private repository. Your core algorithms are never exposed.

For a commercial product, this is meaningful: you can ship an open MCP integration, let the community contribute to the interface layer, and keep the proprietary backend completely closed. You showcase MCP technology without giving away implementation details.

---

## What a Complete MCP Server Actually Needs

When Spritesheet Forge first launched, the MCP server was technically running — but Claude could barely use it. The tools existed, but the server was missing several components that MCP clients depend on before they even try to call a tool. The agent would connect, get confused, and give up.

Here's the full list of what a remote MCP server needs to work correctly:

### MCP Protocol Handler (`POST /mcp`)

The main endpoint receives all MCP traffic. It needs to handle a specific sequence of messages that every MCP client sends before doing anything useful:

| Method | Who sends it | What it means |
|--------|-------------|---------------|
| `initialize` | Client, first message | "I'm connecting, here are my capabilities" |
| `notifications/initialized` | Client, after server responds to `initialize` | "Ready to proceed" |
| `tools/list` | Client, to discover available tools | "What can you do?" |
| `tools/call` | Client, to actually invoke a tool | "Do this thing" |

The `initialize` and `notifications/initialized` messages must return a valid response even without authentication — they are the handshake that establishes the session. If either of these fails or returns an auth error, the client considers the connection broken and stops.

### Tool Definitions

Each tool registered in `tools/list` needs four things to be complete:

```typescript
{
  name: 'gif_to_spritesheet',
  description: '...', // instructions for the LLM — see Tool Design section
  inputSchema: {       // JSON Schema for parameters
    type: 'object',
    properties: { ... },
    required: [...]
  },
  outputSchema: { ... },  // JSON Schema for the return value
  annotations: {          // behavior hints for platforms and LLMs
    title: 'GIF to Spritesheet',
    readOnlyHint: false,
    idempotentHint: false,
    openWorldHint: true
  }
}
```

Missing `outputSchema` or `annotations` doesn't break tool calls, but it tanks your quality score on every directory platform. More importantly, LLMs use `outputSchema` to parse and reason about tool results — without it, the model is guessing the structure of what comes back.

### Discovery and Infrastructure Endpoints

Beyond `/mcp`, a complete server also needs:

- **`GET /health`** — returns `{"status":"ok"}` with HTTP 200, no auth required. Directory platforms poll this to verify your server is alive.
- **`OPTIONS /mcp`** — handles CORS preflight. Required for any browser-based MCP client.
- **`GET /.well-known/oauth-authorization-server`** — if using OAuth, this is how MCP clients discover your auth endpoints automatically. Without it, clients fall back to manual config or fail entirely.

### The Consequence of Missing Any of This

Claude connects to an MCP server by running through `initialize` → `notifications/initialized` → `tools/list` in sequence. If `tools/list` fails (because it requires auth, or because the response is malformed), the client has no tool definitions to work with. From Claude's perspective, the server exists but has no capabilities — it can't invoke anything.

This is what "Agent almost unable to use the MCP" looked like in practice: the connection succeeded, but every attempt to use a tool failed because the discovery step never completed correctly.

### Protocol Examples

Every message in the MCP protocol is a JSON-RPC 2.0 object over HTTP POST. Here's what the actual exchange looks like.

**Step 1 — Client sends `initialize`**

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

**Server responds with its own capabilities**

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

**Step 2 — Client sends `notifications/initialized`** (no response expected)

```json
{
  "jsonrpc": "2.0",
  "method": "notifications/initialized"
}
```

**Step 3 — Client sends `tools/list`** (no auth required)

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/list"
}
```

**Server returns all registered tools**

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

Once this handshake completes, the client knows exactly what tools are available and how to call them. Only after this point does authentication become relevant — tool calls like `tools/call` require a valid Bearer token.

**`server_info` — a zero-argument tool call**

This is what a real `tools/call` request and response looks like, using the `server_info` tool from Spritesheet Forge:

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

**Actual response:**

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
            "small_file": "Files < 4 MB: base64-encode, prepend data URI prefix, strip all newlines.",
            "large_file": "Files ≥ 4 MB or encoded via shell: POST to /upload, use returned URL.",
            "previous_output": "Output URLs from any tool can be passed directly as input to other tools.",
            "ttl_warning": "Output URLs expire 60 minutes after creation."
          }
        }
      }
    ]
  }
}
```

`server_info` is the pattern to follow for any tool that returns configuration or metadata: zero arguments, deterministic output, useful for agents to query before starting a workflow.

---

## Authentication

### Why Authenticate?

Without authentication, your MCP server is an open public API — anyone who discovers the endpoint can run your tools indefinitely, consuming Cloud Run compute, burning R2 storage writes, and exhausting quota that belongs to real users. Authentication solves three problems at once:

- **Resource protection**: every tool call translates directly to compute cost. Without knowing who is calling, you can't enforce limits.
- **Quota management**: per-user monthly quotas require a stable identity to track against. No identity means no fair enforcement.
- **Abuse prevention**: a public endpoint with no auth is trivially scriptable — one bad actor can spike your bills or degrade service for everyone else.

### Authentication Options

| Method | User experience | Implementation | MCP client support |
|--------|----------------|----------------|-------------------|
| No auth | Frictionless | Trivial | Universal |
| Static API key | Poor — user must copy-paste into config | Simple | Universal |
| OAuth 2.1 + PKCE | Seamless — one browser click | Moderate | Claude Desktop, Claude Code |

**No auth** is only appropriate for local or internal-only servers where the network is the security boundary. For a public remote server, this means anyone on the internet can call your tools.

**API keys** are the obvious first choice: generate a key, give it to the user, done. The problem is the distribution experience. The user has to find a dashboard or docs page, copy a random string, open their config file, paste it in, and restart the client. That's a multi-step process with multiple failure points, and there's no recovery if they lose it. Every new MCP client they use requires the same manual setup.

**OAuth 2.1 + PKCE** is more work to implement but delivers a dramatically better experience. The MCP client handles the entire flow natively — it opens the browser automatically when a token is needed. The user sees a GitHub login page, clicks "Authorize", and the client stores the resulting token internally. From the user's perspective, it's one click with no config file involved.

### How Spritesheet Forge Implements It

The implementation uses GitHub as the identity provider, Cloudflare KV for token storage, and the standard OAuth 2.1 + PKCE flow:

**1. Auto-discovery via `/.well-known/oauth-authorization-server`**

MCP clients read this endpoint before initiating any OAuth flow. It returns the authorization endpoint, token endpoint, and supported grant types. Without it, clients require manual configuration or fail to connect entirely.

**2. Dynamic client registration (RFC 7591)**

Any MCP client can register itself programmatically by POSTing to the registration endpoint. This means new clients can connect without being pre-approved or listed anywhere — the server handles registration automatically.

**3. PKCE flow**

Prevents authorization code interception. The client generates a random `code_verifier`, sends its hash (`code_challenge`) with the authorization request, then proves it holds the original verifier when exchanging the code for a token. This closes the attack vector where an authorization code could be stolen in transit.

**4. KV session storage**

The session token is stored in Cloudflare KV under `session:{userId}` with a 30-day TTL. Each `tools/call` request validates the Bearer token against KV before the request reaches Cloud Run.

**5. Script fallback**

For users working in scripts, CI pipelines, or benchmark environments where browser OAuth isn't practical, a `get-token.py` script is available for download. It runs the full OAuth flow in a terminal, prints the resulting token, and saves it to `~/.spritesheet-forge-token`.

### The X-MCP-Key: Internal Service Authentication

The architecture has two layers: the Cloudflare Worker (public-facing gateway) and Cloud Run (the private backend). Cloud Run runs at a URL that is technically reachable from the internet — anyone who discovers it could POST requests directly, bypassing the Worker entirely. That means bypassing OAuth verification, quota enforcement, and rate limiting.

The `X-MCP-Key` header closes this gap. It's a shared secret known only to the Worker and Cloud Run. The Worker validates every incoming OAuth token, then forwards the request to Cloud Run with this header attached. Cloud Run rejects any request that doesn't include the correct key.

```
User → Worker:     Authorization: Bearer <oauth-token>   (public auth)
Worker → Cloud Run: X-MCP-Key: <internal-secret>         (internal auth)
```

This is **defense in depth**: even if the Cloud Run URL leaks through logs, error messages, or reverse engineering, an attacker cannot call it without the internal key. All traffic is forced through the gateway, and all security enforcement is preserved.

Without this, "private backend" would be a false claim — the backend would still be effectively public to anyone who looked hard enough.

---

## File Input Design

This section is specific to MCP servers whose tools process files — image converters, document parsers, audio processors, and similar. If your tools only handle text or structured data, you won't face this problem. But for file-heavy APIs, it's one of the most practically limiting issues you'll run into.

The core problem is that passing files to an Agent is harder than it looks. The instinctive approach — base64-encode the file and send it inline — works in theory but hits a hard constraint in practice: **Claude Code's shell tool has a ~256 KB context limit on stdout output**. Base64 encoding expands file size by ~33%, which means the real safe ceiling for inline base64 is around 185 KB. Most images, audio files, and documents are larger than that.

This makes base64 impractical for the majority of real-world file processing use cases. The solution we added was a dedicated `/upload` endpoint at the MCP layer — outside the MCP protocol itself. The user (or Agent) POSTs the file there directly, gets back a URL, and passes that URL to the tool instead of embedding the file inline. The Worker then fetches the file server-side from R2, bypassing the context size constraint entirely.

**Why Cloudflare R2 for file storage?**

R2 is Cloudflare's S3-compatible object storage, and it's the right choice here for one specific reason: **zero egress fees**. AWS S3 and most other object storage services charge for data transfer out — every time a tool output is read (which happens on every chained tool call), you pay. R2 charges nothing for egress. For an MCP server that moves files between tools frequently, this matters.

R2's free tier is also generous enough that a low-to-moderate-traffic MCP server can run entirely within it:

| Resource | Free tier |
|----------|-----------|
| Storage | 10 GB/month |
| Class A operations (writes, deletes) | 1 million/month |
| Class B operations (reads) | 10 million/month |
| Egress (data transfer out) | Free, always |

Tool outputs are stored with a 1-hour TTL and deleted automatically — so storage usage stays low even under active use. A file processed and discarded within an hour never counts toward the monthly storage total in any meaningful way.

MCP tools that accept files need to handle three distinct input scenarios:

| Scenario | Method |
|----------|--------|
| Small files (< ~185 KB) | base64 data URI: `data:image/png;base64,...` |
| Large files or files from shell | POST to `/upload` endpoint, pass back the URL |
| Output from a previous tool | Pass the output URL directly — Worker fetches from R2 |

The non-obvious constraint: Claude Code's shell tool has a ~256 KB context limit on stdout. Base64 encoding expands file size by ~33%, so the practical ceiling for inline base64 is around 185 KB, not 4 MB. Your tool descriptions should state this limit explicitly and point users to the upload endpoint when it matters.

**The base64 newline bug.** Shell tools like `openssl base64` and the `base64` CLI insert a newline every 76 characters. Passing that string directly as a data URI causes `INVALID_BASE64` errors on the server. Put this warning in your tool description:

> "Strip all whitespace and newlines from the base64 string before prepending the data URI prefix. Example: `base64 file.png | tr -d '\n'`"

---

## Tool Design That Works With LLMs

### Step 0: Connect Claude to Your MCP Server

Before any tool can be used, Claude needs to be connected to the MCP server. This sounds obvious, but it's worth spelling out: Claude does not automatically discover or connect to MCP servers. You configure the connection explicitly, and until you do, Claude has no knowledge that the server exists.

**Claude Desktop** — add to `claude_desktop_config.json` (find it via Settings → Developer):

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

**Claude Code CLI** — add via terminal:

```bash
claude mcp add spritesheet-forge --transport http https://mcp.clawstudiouo.com/mcp
```

If the server is not configured, Claude won't say "I can't find that tool." It will just act as if the tool doesn't exist — searching the web for alternatives, hallucinating similar-sounding tools it doesn't actually have, or producing a generic response that completely misses what you asked for. The failure mode is silent and confusing.

### How Users Find Your MCP Server

Getting Claude connected is step one. Getting users to know the server exists in the first place is a separate problem. There are several channels, each reaching a different audience:

**Source and documentation**
- [GitHub repository](https://github.com/LAXY9887/Game-Dev.-Spritesheet-Forge) — the primary source of truth. Developers look here first. A clear README with the endpoint URL and config snippet is the minimum.
- [Dedicated tutorial page](https://sprite-forge-mcp.tutorial.clawstudiouo.com) — a standalone page that walks through installation, authentication, and example prompts. Useful for non-developers who don't want to read a README.

**Official registries**
- [Anthropic MCP Registry](https://registry.modelcontextprotocol.io/?q=io.github.LAXY9887%2Fspritesheet-forge) — Anthropic's official index of MCP servers. This is where MCP client applications query to show curated server lists inside the app.

**Marketplaces and directories**
- [Smithery.ai](https://smithery.ai/servers/lxya98874322688423/spritesheet-forge) — integrated directly into Claude Code's MCP browser. Users can find and install servers without leaving the CLI.
- [MCP Marketplace](https://mcp-marketplace.io/server/game-dev-spritesheet-forge) — a dedicated marketplace with a revenue-sharing model for paid tiers.
- GitHub Marketplace — accessible to GitHub's developer ecosystem.

The channels reinforce each other. A user who finds the server on Smithery will often check the GitHub repo next. The tutorial page converts discovery into actual installation. Covering all of them costs little to maintain and reaches audiences that don't overlap.

### Writing Tool Descriptions That Actually Work

Tool descriptions are not documentation for humans — they are instructions LLMs use to decide *when* and *how* to call your tool. A poorly-written description results in the model calling the wrong tool, passing the wrong parameters, or producing errors that are hard to debug.

What a good tool description includes:

- **Input format**: URL? data URI? Which MIME types are accepted?
- **Output**: what does the tool return? A URL? A JSON struct? What's the TTL?
- **Constraints**: file size limits, parameter interactions, known gotchas
- **Examples**: for complex input rules, give an inline example or a shell command

**Design for chaining.** Make every tool's output URL directly usable as another tool's input. This lets agents compose multi-step workflows naturally:

```
gif_to_spritesheet → split_spritesheet → frames_to_animation
```

**Add a `server_info` tool.** Provide a zero-argument tool that returns runtime configuration: upload endpoint URL, output file TTL, file size limits, and the rule for choosing between base64 and upload. This prevents that information from going stale across individual tool descriptions and gives agents a reliable way to query it before starting complex workflows.

---

## Quick Error Reference

| Symptom | Root Cause | Fix |
|---------|-----------|-----|
| Platform shows "0 tools found" | `tools/list` requires auth | Add `initialize`, `notifications/initialized`, `tools/list` to handshake whitelist |
| Smithery Quality Score is 0 | Missing `outputSchema` / `annotations` | Add both fields to all tools |
| `INVALID_BASE64` decode error | Shell tools insert newlines in base64 | Warn in tool description; use `tr -d '\n'` |
| Agent says "I don't have that tool" and starts web searching | MCP server not configured in the client | Add server config to `claude_desktop_config.json`, or run `claude mcp add` |
| OAuth authorization page never opens | `/.well-known/oauth-authorization-server` not publicly accessible | Ensure the endpoint is reachable without auth |
| Upload endpoint returns `401` | Bearer token missing or expired | User re-authenticates; run `get-token.py` if needed |
| Tool output URL returns 404 or fails | R2 object TTL expired (60 minutes) | Re-run the originating tool to get a fresh URL |
| Cloud Run returns `403` on all requests | `X-MCP-Key` header missing or wrong | Verify the secret in the Worker's environment variables |
| Browser-based MCP client cannot connect | Missing CORS headers on `/mcp` | Add `OPTIONS` preflight handler + `Access-Control-Allow-Origin: *` to all responses |

---

## MCP Tool Definition Reference (For AI Agents)

The complete JSON structure that defines an MCP tool. AI agents and MCP clients read these definitions to understand what tools are available, what parameters they accept, and what each parameter means.

```json
{
  "name": "your_tool_name",
  "description": "One sentence describing what this tool does and what it returns. AI agents use this to decide when to call the tool.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "file": {
        "type": "string",
        "description": "Input file — base64 data URI (small files) or HTTPS URL (large files or pre-uploaded)"
      },
      "option_flag": {
        "type": "boolean",
        "default": false,
        "description": "What enabling this flag does. Always include a default."
      },
      "choice_param": {
        "type": "string",
        "default": "default_value",
        "enum": ["option_a", "option_b", "option_c"],
        "description": "Which output mode to use. List the trade-offs in the description."
      },
      "numeric_param": {
        "type": "integer",
        "default": 0,
        "description": "What this number controls. Include the valid range (e.g. 0–255)."
      }
    },
    "required": ["file"]
  }
}
```

**Rules for tool definitions that work well with LLMs:**

- `description` on the tool itself: one sentence, action-oriented, says what it produces — not how it works internally
- `description` on each property: include the valid range for numeric params, list all enum options with trade-offs, say what the default does
- `required`: only list params the tool cannot infer or default. Every optional param needs a `default`
- Avoid vague descriptions like "the input file" — say what formats are accepted and how to supply them

---

## Frequently Asked Questions

**What is a remote MCP server?**

A remote MCP server is a cloud-hosted service that implements the Model Context Protocol, allowing AI assistants like Claude to invoke tools over the internet through natural language. Unlike local MCP servers — which run on the user's machine and are only accessible from that machine — a remote server is accessible to any authenticated MCP client anywhere, without local installation.

**How do I add an MCP server to Claude Desktop or Claude Code?**

For Claude Desktop, add the server configuration to `claude_desktop_config.json` (find it under Settings → Developer). For Claude Code, run `claude mcp add <name> --transport http <url>` in the terminal. Until the connection is explicitly configured, Claude has no awareness that the server exists and cannot use any of its tools.

**Is it free to run a remote MCP server on Cloudflare and GCP?**

Yes, for low-to-moderate traffic. Cloudflare Workers includes 100,000 requests per day on the free tier. Cloudflare R2 offers 10 GB storage, 1 million writes, and 10 million reads per month at no cost — with no egress fees. GCP Cloud Run provides 2 million requests and 360,000 GB-seconds of compute per month for free. A developer tool handling sporadic tool calls can run entirely within these limits.

**Why use OAuth instead of API keys for MCP authentication?**

OAuth 2.1 provides a better user experience. With API keys, users must manually copy and paste a token into a config file — a multi-step process with no self-service recovery if the key is lost. With OAuth, Claude Desktop and Claude Code handle the flow natively: they open a browser, the user clicks "Authorize", and the token is stored automatically. The user never touches a config file.

**Why can't Claude find my MCP tool?**

The most common cause is that the MCP server has not been configured in the client. Claude does not discover servers automatically. If the server is configured but tools still don't appear, check that `tools/list` is accessible without authentication — if it requires a Bearer token, Claude cannot retrieve the tool list during the initial handshake and will behave as if the server has no tools.

**How do I pass large files to an MCP tool?**

For files larger than ~185 KB, use the server's `/upload` endpoint instead of base64 encoding. POST the file directly (multipart/form-data), receive a URL in the response, and pass that URL as the tool's file parameter. The server fetches the file server-side, bypassing Claude Code's ~256 KB shell output limit that makes inline base64 impractical for most real-world files.

**What is the X-MCP-Key header?**

The X-MCP-Key is a shared secret used to authenticate requests between the Cloudflare Worker (the public-facing gateway) and the GCP Cloud Run backend. It ensures all traffic reaches Cloud Run only through the Worker — not directly from the internet. Without it, anyone who discovers the Cloud Run URL could bypass OAuth verification and quota enforcement entirely.

**Do I need to make my backend code public to run an MCP server?**

No. Only the MCP wrapper (the Cloudflare Worker) needs to be a public repository — it defines your API surface and lets the community inspect the integration. The Cloud Run backend, where the actual business logic lives, can remain private. This lets you publish an open MCP integration while keeping proprietary algorithms and implementation details in a private repository.
