---
title: "From GIF to Game-Ready Spritesheet: A Claude + MCP Live Demo"
description: "Watch Claude convert a GIF animation into a spritesheet and TexturePacker-compatible atlas JSON using the Spritesheet Forge MCP server — no manual tools required."
date: "2026-05-05"
readingTime: 6
tag: "tutorial"
---

## The Problem with Traditional Spritesheet Tools

Converting a GIF animation into a game-ready spritesheet has always been a multi-step process: open TexturePacker, configure column counts, decide whether to remove the background, export, check frame coordinates, adjust. Each time you iterate on an animation, you repeat the whole cycle.

What if you could just describe what you need and get the result?

## Spritesheet Forge: A Spritesheet Server for Claude

**Spritesheet Forge** is a hosted MCP (Model Context Protocol) server that gives Claude direct access to spritesheet processing tools. Once connected, you can ask Claude to convert GIFs, pack PNGs into spritesheets, split existing spritesheets, generate Sprite Atlas JSON, and more — all through natural language.

There is no software to install. The server runs on Cloudflare Workers and processes your files in the cloud. Claude handles the file upload, parameter selection, and output — you just describe the result you want.

## Connect Claude in 2 Minutes

You can connect via Claude Desktop or the Claude Code CLI:

**Claude Desktop** — add to `claude_desktop_config.json`:

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

On first use, Claude opens a GitHub OAuth page to authenticate your session. The token is stored locally and valid for 30 days.

## Demo: GIF to Spritesheet

Here is the input — a 9-frame banana cat animation at 75 × 165 px:

<img src="/blog/spritesheet-forge-mcp-demo/input.gif" alt="Input GIF" style="width:150px;height:auto;display:block;margin:0 auto;border-radius:0.5rem;border:1px solid var(--ui-border);">

Drop the file into Claude and describe what you need:

![Claude conversation: user sends GIF and asks for spritesheet conversion](/blog/spritesheet-forge-mcp-demo/demo-1.png)

Claude uploads the file automatically and calls `gif_to_spritesheet` with background removal enabled:

![Claude calling gif_to_spritesheet MCP tool](/blog/spritesheet-forge-mcp-demo/demo-2.png)

The result comes back with the exact pixel dimensions and Unity setup steps included:

![Claude returning spritesheet result with frame dimensions table](/blog/spritesheet-forge-mcp-demo/demo-3.png)

Output spritesheet — 675 × 165 px, 9 frames in a single row, transparent background:

![Output spritesheet](/blog/spritesheet-forge-mcp-demo/spritesheet.png)

## Demo: Sprite Atlas JSON

A single follow-up is all it takes to get a TexturePacker-compatible atlas:

![Claude calling split_spritesheet to generate Sprite Atlas JSON](/blog/spritesheet-forge-mcp-demo/demo-4.png)

![Claude returning corrected Sprite Atlas with frame coordinates table](/blog/spritesheet-forge-mcp-demo/demo-5.png)

You can ask Claude to validate the output against the TexturePacker JSON Hash spec:

![Claude validating the Sprite Atlas JSON format — all checks passed](/blog/spritesheet-forge-mcp-demo/demo-6.png)

The final atlas — all 9 frames at 75 × 165 px, ready to load in Unity, Godot (`AtlasTexture`), or any TexturePacker-compatible engine:

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

## Try It Yourself

Spritesheet Forge is open source and free to use (100 operations/month on the free tier):

- **MCP setup guide** — [clawstudiouo.com/mcp](https://clawstudiouo.com/mcp)
- **One-click install on Smithery** — [smithery.ai](https://smithery.ai/servers/lxya98874322688423/spritesheet-forge)
- **GitHub repository** — [LAXY9887/Game-Dev.-Spritesheet-Forge](https://github.com/LAXY9887/Game-Dev.-Spritesheet-Forge)
- **Full API documentation** — [GitHub Pages](https://laxy9887.github.io/Game-Dev.-Spritesheet-Forge)
