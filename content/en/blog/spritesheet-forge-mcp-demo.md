---
title: "GIF to Game-Ready Spritesheet with Claude MCP: A Complete Walkthrough"
description: "Step-by-step demo: how Claude uses Spritesheet Forge MCP to convert a GIF into a spritesheet PNG and TexturePacker-compatible atlas JSON — with tool chaining, parameter choices, and Unity/Godot integration notes."
date: "2026-05-05"
readingTime: 8
tag: "tutorial"
---

Every game artist knows the loop: export a GIF from your animation tool, open TexturePacker, configure frame columns, handle transparent borders, generate the atlas, validate the JSON coordinates, import into Unity or Godot. Change one frame and you repeat every step.

Spritesheet Forge is a hosted MCP (Model Context Protocol) server that moves this entire workflow into a conversation with Claude. You describe what you need, Claude calls the tools, and you get back the output files and metadata. No software to install. No format memorization.

This article walks through a real conversion — a 9-frame GIF animation to a spritesheet PNG and TexturePacker-compatible atlas JSON — showing the exact tool calls, the parameters Claude chose, and how to chain operations in a single session.

---

## Available Tools

Spritesheet Forge exposes six tools to Claude once connected:

| Tool | Input | Output | Key parameters |
|---|---|---|---|
| `gif_to_spritesheet` | Animated GIF | Spritesheet PNG | `columns`, `background_removal` |
| `png_to_spritesheet` | ZIP of PNG frames | Spritesheet PNG | `columns`, `padding` |
| `split_spritesheet` | Spritesheet PNG + frame count | Individual frames + atlas JSON | `columns`, `rows` |
| `trim_png` | PNG with transparent border | Trimmed PNG + crop bounds | — |
| `frames_to_animation` | ZIP of PNG frames | Animated GIF | `fps` |
| `spritesheet_to_animation` | Spritesheet PNG + frame count | Animated GIF | `columns`, `rows`, `fps` |

Tools are designed to chain: the output URL from one tool can be passed directly as input to the next without any re-upload. All file transfers happen server-side.

---

## Connect Claude in 2 Minutes

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

**Claude Code CLI:**

```bash
claude mcp add spritesheet-forge --transport http https://mcp.clawstudiouo.com/mcp
```

On first use, Claude opens a GitHub OAuth page automatically — click "Authorize" and the token is stored locally for 30 days. You never touch a config file for authentication.

---

## Demo 1: GIF to Spritesheet

The input is a 9-frame banana cat animation at 75 × 165 px per frame:

<img src="/blog/spritesheet-forge-mcp-demo/input.gif" alt="Input GIF — 9-frame banana cat animation at 75×165 px" style="width:150px;height:auto;display:block;margin:0 auto;border-radius:0.5rem;border:1px solid var(--ui-border);">

Drop the file into Claude and describe what you need:

![Claude conversation: user sends GIF and asks for spritesheet conversion](/blog/spritesheet-forge-mcp-demo/demo-1.png)

Claude uploads the file automatically and calls `gif_to_spritesheet` with `background_removal: true`. The tool arranges all frames in a single row and returns the output as a URL stored in Cloudflare R2:

![Claude calling gif_to_spritesheet MCP tool](/blog/spritesheet-forge-mcp-demo/demo-2.png)

The result comes back with exact pixel dimensions and Unity Sprite Editor setup steps:

![Claude returning spritesheet result with frame dimensions table](/blog/spritesheet-forge-mcp-demo/demo-3.png)

Output — 675 × 165 px, 9 frames in a single row, transparent background:

![Output spritesheet — 675×165 px, 9 frames, transparent background](/blog/spritesheet-forge-mcp-demo/spritesheet.png)

**Parameters Claude chose:**
- `columns: 9` — all frames in one horizontal strip, which matches Unity's and Godot's default expectation for simple sprite animations
- `background_removal: true` — removes the white background, producing a PNG with per-pixel alpha transparency

You can override either: ask for `columns: 3` to get a 3×3 grid, or omit background removal if your engine uses a color key instead of alpha.

---

## Demo 2: Sprite Atlas JSON

A single follow-up generates a TexturePacker-compatible atlas from the spritesheet output URL — the URL from the previous step is passed directly, no re-upload needed:

![Claude calling split_spritesheet to generate Sprite Atlas JSON](/blog/spritesheet-forge-mcp-demo/demo-4.png)

![Claude returning corrected Sprite Atlas with frame coordinates table](/blog/spritesheet-forge-mcp-demo/demo-5.png)

Claude can validate the output against the TexturePacker JSON Hash spec before you import it:

![Claude validating the Sprite Atlas JSON format — all checks passed](/blog/spritesheet-forge-mcp-demo/demo-6.png)

Final atlas — 9 frames at 75 × 165 px each, coordinates zero-indexed from the top-left corner:

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

This format loads directly in Unity (`SpriteAtlasImporter`), Godot (`AtlasTexture`), Phaser 3 (`Loader.atlas`), and any other engine that accepts TexturePacker JSON Hash output.

---

## Tool Chaining

The two demos above are part of a larger tool chain. Every tool output is a URL stored in Cloudflare R2 with a 1-hour TTL. Passing a URL from one tool directly into the next avoids re-uploading:

```
gif_to_spritesheet(input.gif)
        │  spritesheet PNG URL
        ▼
split_spritesheet(spritesheet URL, columns=9)
        │  atlas JSON + individual frame URLs
        ▼
frames_to_animation(frame URLs, fps=12)   ← preview animation
        │
        ▼
trim_png(any frame URL)                   ← optional cleanup
```

You can ask Claude to run this entire chain in a single message: *"Convert this GIF to a spritesheet, generate the atlas JSON, and give me a preview animation at 12 fps."* Claude calls each tool in sequence, passing URLs between them automatically.

One constraint to keep in mind: **output URLs expire after 60 minutes**. Download any files you need before the session ends.

---

## MCP Tool Reference (For AI Agents)

Complete input schemas for all seven Spritesheet Forge tools. These definitions describe the exact parameters AI agents can pass when calling each tool via MCP.

### gif_to_spritesheet

```json
{
  "name": "gif_to_spritesheet",
  "description": "Converts an animated GIF into a sprite sheet PNG.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "file": { "type": "string", "description": "GIF file — base64 data URI or HTTPS URL" },
      "columns": { "type": "integer", "description": "Grid columns (auto-calculated if omitted)" },
      "padding": { "type": "integer", "default": 0, "description": "Pixel gap between frames" },
      "remove_bg": { "type": "boolean", "default": false, "description": "Remove background from each frame" },
      "bg_color": { "type": "string", "default": "auto", "description": "\"auto\" or \"#RRGGBB\"" },
      "tolerance": { "type": "integer", "default": 30, "description": "Background removal threshold 0–255" }
    },
    "required": ["file"]
  }
}
```

### gif_to_frames

```json
{
  "name": "gif_to_frames",
  "description": "Extracts all frames from an animated GIF and returns them as individual PNG files in a ZIP archive.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "file": { "type": "string", "description": "GIF file — base64 data URI or HTTPS URL" },
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
  "description": "Packs multiple PNG images into a single sprite sheet with optional atlas metadata.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "files": { "type": "array", "items": { "type": "string" }, "description": "PNG files — base64 data URIs or HTTPS URLs" },
      "layout": { "type": "string", "default": "grid", "enum": ["grid", "horizontal", "vertical", "packed"] },
      "columns": { "type": "integer", "description": "Grid columns (auto if omitted)" },
      "cell_mode": { "type": "string", "default": "auto_max", "enum": ["auto_max", "auto_uniform", "fixed"] },
      "cell_width": { "type": "integer", "description": "Required when cell_mode=fixed" },
      "cell_height": { "type": "integer", "description": "Required when cell_mode=fixed" },
      "padding": { "type": "integer", "default": 0 },
      "bg_color": { "type": "string", "default": "transparent" },
      "power_of_2": { "type": "boolean", "default": false, "description": "Pad canvas to next power of 2" },
      "trim_input": { "type": "boolean", "default": false, "description": "Auto-trim transparent edges before packing" },
      "extrude": { "type": "integer", "default": 0, "description": "Extrude outermost pixels by N px per frame" },
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
  "description": "Splits a sprite sheet PNG into individual frames and optionally exports an atlas JSON.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "file": { "type": "string", "description": "Spritesheet PNG — base64 data URI or HTTPS URL" },
      "columns": { "type": "integer" },
      "rows": { "type": "integer" },
      "cell_width": { "type": "integer" },
      "cell_height": { "type": "integer" },
      "padding": { "type": "integer", "default": 0 },
      "frame_count": { "type": "integer", "description": "Actual frame count if last row is incomplete" },
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
  "description": "Converts a sprite sheet PNG into an animated GIF or WebP.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "file": { "type": "string", "description": "Spritesheet PNG — base64 data URI or HTTPS URL" },
      "columns": { "type": "integer" },
      "rows": { "type": "integer" },
      "frame_count": { "type": "integer" },
      "duration": { "type": "integer", "default": 100, "description": "Frame duration in ms" },
      "loop": { "type": "integer", "default": 0, "description": "0 = infinite" },
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
  "description": "Combines multiple PNG frames into an animated GIF or WebP.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "files": { "type": "array", "items": { "type": "string" }, "description": "PNG frame files in order" },
      "duration": { "type": "integer", "default": 100, "description": "Frame duration in ms (10–10000)" },
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
  "description": "Crops transparent edges from one or more PNG files.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "files": { "type": "array", "items": { "type": "string" }, "description": "PNG files — single returns PNG, multiple returns ZIP" },
      "threshold": { "type": "integer", "default": 0, "description": "Alpha threshold 0–255" },
      "padding": { "type": "integer", "default": 0, "description": "Transparent margin to preserve after trim" }
    },
    "required": ["files"]
  }
}
```

---

## What's Next

- **[Building a Remote MCP Server with Cloudflare Workers and GCP Cloud Run](/blog/building-remote-mcp-server)** — if you want to build your own MCP server rather than use a hosted one, this covers the full architecture: OAuth 2.1 + PKCE, internal service auth, R2 file staging, and tool design.
- *([Importing Spritesheets into Unity and Godot: A Step-by-Step Guide](/blog/spritesheet-game-engine-import) — coming soon)* — detailed walkthroughs for Unity's Sprite Atlas workflow and Godot's AtlasTexture node, including how to wire up the atlas JSON output directly.

Spritesheet Forge is open source and free to use (100 operations/month on the free tier):

- **MCP setup guide** — [clawstudiouo.com/mcp](https://clawstudiouo.com/mcp)
- **One-click install on Smithery** — [smithery.ai](https://smithery.ai/servers/lxya98874322688423/spritesheet-forge)
- **GitHub repository** — [LAXY9887/Game-Dev.-Spritesheet-Forge](https://github.com/LAXY9887/Game-Dev.-Spritesheet-Forge)
- **Full API documentation** — [GitHub Pages](https://laxy9887.github.io/Game-Dev.-Spritesheet-Forge)

---

## Frequently Asked Questions

**What is Spritesheet Forge?**

Spritesheet Forge is a hosted MCP server that gives Claude direct access to spritesheet processing tools. Once connected, Claude can convert GIFs to spritesheets, pack PNG frames, generate atlas JSON, split existing spritesheets, and more — through natural language, without any local software installation.

**How do I connect Spritesheet Forge to Claude?**

For Claude Desktop, add the server config to `claude_desktop_config.json`. For Claude Code CLI, run `claude mcp add spritesheet-forge --transport http https://mcp.clawstudiouo.com/mcp`. On first use, Claude opens a GitHub OAuth page automatically — click "Authorize" and the token is stored for 30 days. Full setup is at [clawstudiouo.com/mcp](https://clawstudiouo.com/mcp).

**What file formats does Spritesheet Forge support?**

`gif_to_spritesheet` accepts any animated GIF. `png_to_spritesheet` and `frames_to_animation` accept a ZIP of PNG frames. All image outputs are PNG; atlas output is TexturePacker JSON Hash, compatible with Unity, Godot, Phaser 3, Cocos2d, and similar engines.

**Is Spritesheet Forge free?**

The free tier includes 100 operations per month — enough for active game development with moderate animation volume. No credit card is required. The server itself is open source on GitHub.

**Can Claude handle large sprite files?**

Files smaller than ~185 KB are sent inline as base64. For larger files, Claude uploads to the server's `/upload` endpoint and passes the returned URL to the tool instead. You don't manage this manually — Claude detects file size and chooses the right method automatically.

**How long are output files available?**

Tool output URLs are stored in Cloudflare R2 with a 1-hour TTL. If you close the session without downloading, the files expire. Ask Claude to display the download links clearly at the end of a workflow.

**Can I chain multiple tools in one request?**

Yes. Claude calls tools in sequence automatically, passing each output URL as the next tool's input. For example: *"Convert this GIF, split it into frames, and give me a preview GIF at 12 fps"* runs three tools without any manual steps between them.

**What game engines is the atlas JSON compatible with?**

The output format is TexturePacker JSON Hash — the most widely supported atlas format in game development. It is compatible with Unity (`SpriteAtlasImporter`), Godot (`AtlasTexture`), Phaser 3 (`Loader.atlas`), Cocos2d, and any other engine that accepts TexturePacker output.
