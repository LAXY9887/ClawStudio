---
title: "用 Claude MCP 把 GIF 转成游戏用 Spritesheet：完整流程展示"
description: "实机展示：Claude 通过 Spritesheet Forge MCP 把 GIF 转成 Spritesheet PNG 和 TexturePacker 兼容的 Atlas JSON——含工具串接、参数说明，以及 Unity/Godot 导入注意事项。"
date: "2026-05-05"
readingTime: 8
tag: "tutorial"
---

每个游戏美术都熟悉这个循环：从动画工具导出 GIF、打开 TexturePacker、设定列数、处理透明边框、导出、验证 JSON 坐标、导入 Unity 或 Godot。只要动画改了一格，整个流程就要重来。

Spritesheet Forge 是一个托管的 MCP（模型上下文协议）服务器，让这套流程可以在和 Claude 的对话中完成。你描述你要什么，Claude 调用工具，你拿到输出文件和 Metadata。不需要安装任何软件，不需要记格式。

这篇文章完整走过一次真实的转换流程——一个 9 帧 GIF 动画到 Spritesheet PNG 和 TexturePacker 兼容 Atlas JSON——展示 Claude 实际调用的工具、选择的参数，以及如何在同一个对话中串接多个操作。

---

## 可用工具

连线后，Spritesheet Forge 提供六个工具给 Claude 使用：

| 工具 | 输入 | 输出 | 主要参数 |
|---|---|---|---|
| `gif_to_spritesheet` | 动画 GIF | Spritesheet PNG | `columns`、`background_removal` |
| `png_to_spritesheet` | PNG 帧的 ZIP 压缩档 | Spritesheet PNG | `columns`、`padding` |
| `split_spritesheet` | Spritesheet PNG + 帧数 | 个别帧 + Atlas JSON | `columns`、`rows` |
| `trim_png` | 含透明边框的 PNG | 裁切后的 PNG + 裁切范围 | — |
| `frames_to_animation` | PNG 帧的 ZIP 压缩档 | 动画 GIF | `fps` |
| `spritesheet_to_animation` | Spritesheet PNG + 帧数 | 动画 GIF | `columns`、`rows`、`fps` |

这些工具设计为可串接：一个工具的输出 URL 可以直接当作下一个工具的输入，不需要重新上传。所有文件传输都在服务器端完成。

---

## 两分钟完成连线

**Claude Desktop** — 加入 `claude_desktop_config.json`（从 Settings → Developer 打开）：

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

首次使用时，Claude 会自动打开 GitHub OAuth 页面——点击「授权」后，Token 会储存在本机，有效期 30 天。整个过程不需要手动编辑设定档。

---

## 实机展示一：GIF 转 Spritesheet

输入素材——一个 9 帧的香蕉猫动画，每帧 75 × 165 px：

<img src="/blog/spritesheet-forge-mcp-demo/input.gif" alt="输入 GIF——9 帧香蕉猫动画，75×165 px" style="width:150px;height:auto;display:block;margin:0 auto;border-radius:0.5rem;border:1px solid var(--ui-border);">

把文件拖入 Claude，描述你的需求：

![Claude 对话：使用者传入 GIF 并请求转换成 Spritesheet](/blog/spritesheet-forge-mcp-demo/demo-1.png)

Claude 自动上传文件并调用 `gif_to_spritesheet`，启用 `background_removal: true`。工具将所有帧排成单行，并把输出储存到 Cloudflare R2 后回传 URL：

![Claude 调用 gif_to_spritesheet MCP 工具](/blog/spritesheet-forge-mcp-demo/demo-2.png)

结果回传，并附上精确的像素尺寸和 Unity Sprite Editor 的设定步骤：

![Claude 回传 Spritesheet 结果及帧尺寸表格](/blog/spritesheet-forge-mcp-demo/demo-3.png)

输出——675 × 165 px，9 帧单行排列，透明背景：

![输出 Spritesheet——675×165 px，9 帧，透明背景](/blog/spritesheet-forge-mcp-demo/spritesheet.png)

**Claude 选择的参数：**
- `columns: 9` — 所有帧排成一条水平带，符合 Unity 和 Godot 对简单精灵动画的预设期望
- `background_removal: true` — 去除白色背景，产生含每像素 Alpha 透明度的 PNG

这两个参数都可以覆盖：请 Claude 用 `columns: 3` 得到 3×3 格状排列，或者如果你的引擎用色键而非 Alpha，可以省略去背。

---

## 实机展示二：Sprite Atlas JSON

只需一句追问，即可从上一步的 Spritesheet 输出 URL 直接生成 TexturePacker 兼容的 Atlas——无需重新上传：

![Claude 调用 split_spritesheet 产生 Sprite Atlas JSON](/blog/spritesheet-forge-mcp-demo/demo-4.png)

![Claude 回传正确的 Sprite Atlas 及帧坐标表格](/blog/spritesheet-forge-mcp-demo/demo-5.png)

还可以请 Claude 验证输出是否符合 TexturePacker JSON Hash 规格：

![Claude 验证 Sprite Atlas JSON 格式——全部通过](/blog/spritesheet-forge-mcp-demo/demo-6.png)

最终 Atlas——9 帧，每帧 75 × 165 px，坐标从左上角以零为起点：

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

这个格式可以直接在 Unity（`SpriteAtlasImporter`）、Godot（`AtlasTexture`）、Phaser 3（`Loader.atlas`）以及任何支持 TexturePacker JSON Hash 格式的引擎中载入。

---

## 工具串接

上面两个展示只是更长工具链的一部分。每个工具的输出都是一个储存在 Cloudflare R2 的 URL，有效期 1 小时。将 URL 直接传给下一个工具，可以省去重新上传的步骤：

```
gif_to_spritesheet(input.gif)
        │  Spritesheet PNG URL
        ▼
split_spritesheet(spritesheet URL, columns=9)
        │  Atlas JSON + 个别帧 URL
        ▼
frames_to_animation(帧 URL, fps=12)   ← 预览动画
        │
        ▼
trim_png(任意帧 URL)                   ← 选填的裁切处理
```

你可以用一句话让 Claude 执行整个链：*「把这个 GIF 转成 Spritesheet，生成 Atlas JSON，再给我一个 12 fps 的预览动画。」* Claude 会依序调用每个工具，自动传递 URL，不需要任何手动介入。

要注意一点：**输出 URL 在 60 分钟后失效**。如果需要保留文件，请在对话结束前下载。

---

## 接下来

- **[用 Cloudflare Workers 和 GCP Cloud Run 建置远端 MCP 服务器](/blog/building-remote-mcp-server)** — 如果你想自己建 MCP 服务器而不是使用托管版，这篇涵盖完整架构：OAuth 2.1 + PKCE、内部服务验证、R2 文件暂存，以及工具设计。
- *([Spritesheet 导入 Unity 和 Godot 完整指南](/blog/spritesheet-game-engine-import) — 即将推出)* — Unity Sprite Atlas 工作流和 Godot AtlasTexture 节点的详细操作，包含如何直接对接本文的 Atlas JSON 输出。

Spritesheet Forge 开源免费（免费方案每月 100 次操作）：

- **MCP 设定指南** — [clawstudiouo.com/mcp](https://clawstudiouo.com/mcp)
- **Smithery 一键安装** — [smithery.ai](https://smithery.ai/servers/lxya98874322688423/spritesheet-forge)
- **GitHub 储存库** — [LAXY9887/Game-Dev.-Spritesheet-Forge](https://github.com/LAXY9887/Game-Dev.-Spritesheet-Forge)
- **完整 API 文件** — [GitHub Pages](https://laxy9887.github.io/Game-Dev.-Spritesheet-Forge)

---

## 常见问题

**Spritesheet Forge 是什么？**

Spritesheet Forge 是一个托管的 MCP 服务器，让 Claude 能直接存取 Spritesheet 处理工具。连线后，Claude 可以通过自然语言转换 GIF、打包 PNG 帧、生成 Atlas JSON、分割现有 Spritesheet 等，不需要在本机安装任何软件。

**如何把 Spritesheet Forge 连接到 Claude？**

Claude Desktop 请在 `claude_desktop_config.json` 加入服务器设定；Claude Code CLI 执行 `claude mcp add spritesheet-forge --transport http https://mcp.clawstudiouo.com/mcp`。首次使用时 Claude 会自动打开 GitHub OAuth 页面，点击授权后 Token 储存 30 天。完整说明在 [clawstudiouo.com/mcp](https://clawstudiouo.com/mcp)。

**Spritesheet Forge 支持哪些文件格式？**

`gif_to_spritesheet` 接受任何动画 GIF；`png_to_spritesheet` 和 `frames_to_animation` 接受 PNG 帧的 ZIP 压缩档。所有图片输出为 PNG；Atlas 输出为 TexturePacker JSON Hash 格式，兼容 Unity、Godot、Phaser 3、Cocos2d 等主流引擎。

**Spritesheet Forge 是免费的吗？**

免费方案每月提供 100 次操作，足够中等动画量的游戏开发使用。不需要信用卡。服务器本身在 GitHub 上开源。

**Claude 能处理大型 Sprite 文件吗？**

小于 ~185 KB 的文件以 base64 方式内嵌传送；较大的文件，Claude 会先 POST 到服务器的 `/upload` 端点，取得 URL 后再传给工具。你不需要手动判断——Claude 会自动侦测文件大小并选择正确方式。

**输出文件可以保留多久？**

工具输出 URL 储存在 Cloudflare R2，有效期为 1 小时。如果对话结束前没有下载，文件会自动失效。建议在工作流程结束时，请 Claude 清楚列出所有下载连结。

**可以在一个请求中串接多个工具吗？**

可以。Claude 会自动依序调用工具，将每个输出 URL 传给下一个工具的输入。例如：*「把这个 GIF 转成 Spritesheet、分割成个别帧，再给我 12 fps 的预览 GIF」* 会执行三个工具，全程不需要任何手动介入。

**Atlas JSON 兼容哪些游戏引擎？**

输出格式为 TexturePacker JSON Hash，是游戏开发中支持最广泛的 Atlas 格式。兼容 Unity（`SpriteAtlasImporter`）、Godot（`AtlasTexture`）、Phaser 3（`Loader.atlas`）、Cocos2d，以及任何接受 TexturePacker 输出的引擎。
