---
title: "从 GIF 到游戏就绪 Spritesheet：Claude + MCP 实机演示"
description: "观看 Claude 通过 Spritesheet Forge MCP 服务器将 GIF 动画转换为 Spritesheet 和 TexturePacker 兼容的 Atlas JSON——无需手动工具。"
date: "2026-05-05"
readingTime: 6
tag: "tutorial"
---

## 传统 Spritesheet 工具的问题

将 GIF 动画转换为游戏就绪的 Spritesheet 一直是一个多步骤的流程：打开 TexturePacker、配置列数、决定是否去掉背景、导出、检查帧坐标、调整。每次迭代动画时，都要重复整个循环。

如果你只需要描述你需要什么，就能直接获得结果呢？

## Spritesheet Forge：为 Claude 设计的 Spritesheet 服务器

**Spritesheet Forge** 是一个托管的 MCP（模型上下文协议）服务器，使 Claude 可以直接访问 Spritesheet 处理工具。连接后，你可以要求 Claude 转换 GIF、将 PNG 打包成 Spritesheet、分割现有 Spritesheet、生成 Sprite Atlas JSON，以及更多——所有这些都通过自然语言完成。

无需安装任何软件。服务器运行在 Cloudflare Workers 上，在云端处理你的文件。Claude 处理文件上传、参数选择和输出——你只需描述你想要的结果。

## 2 分钟内连接 Claude

你可以通过 Claude Desktop 或 Claude Code CLI 连接：

**Claude Desktop** — 添加到 `claude_desktop_config.json`：

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

首次使用时，Claude 会打开 GitHub OAuth 页面来验证你的会话。令牌存储在本地，有效期为 30 天。

## 演示：GIF 转 Spritesheet

这是输入——一个 9 帧香蕉猫动画，75 × 165 px：

<img src="/blog/spritesheet-forge-mcp-demo/input.gif" alt="输入 GIF" style="width:150px;height:auto;display:block;margin:0 auto;border-radius:0.5rem;border:1px solid var(--ui-border);">

将文件拖入 Claude 并描述你需要的内容：

![Claude 对话：用户发送 GIF 并请求 Spritesheet 转换](/blog/spritesheet-forge-mcp-demo/demo-1.png)

Claude 自动上传文件并调用 `gif_to_spritesheet`，启用背景移除：

![Claude 调用 gif_to_spritesheet MCP 工具](/blog/spritesheet-forge-mcp-demo/demo-2.png)

结果返回时包含确切的像素尺寸和 Unity 设置步骤：

![Claude 返回带有帧尺寸表的 Spritesheet 结果](/blog/spritesheet-forge-mcp-demo/demo-3.png)

输出 Spritesheet——675 × 165 px，9 帧在单行中，透明背景：

![输出 Spritesheet](/blog/spritesheet-forge-mcp-demo/spritesheet.png)

## 演示：Sprite Atlas JSON

只需一个后续问题就能获得 TexturePacker 兼容的 Atlas：

![Claude 调用 split_spritesheet 生成 Sprite Atlas JSON](/blog/spritesheet-forge-mcp-demo/demo-4.png)

![Claude 返回带有帧坐标表的更正 Sprite Atlas](/blog/spritesheet-forge-mcp-demo/demo-5.png)

你可以要求 Claude 根据 TexturePacker JSON Hash 规范验证输出：

![Claude 验证 Sprite Atlas JSON 格式——所有检查通过](/blog/spritesheet-forge-mcp-demo/demo-6.png)

最终 Atlas——全部 9 帧，75 × 165 px，可在 Unity、Godot（`AtlasTexture`）或任何 TexturePacker 兼容引擎中加载：

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

## 立即尝试

Spritesheet Forge 是开源的，免费使用（免费层每月 100 次操作）：

- **MCP 设置指南** — [clawstudiouo.com/mcp](https://clawstudiouo.com/mcp)
- **在 Smithery 上一键安装** — [smithery.ai](https://smithery.ai/servers/lxya98874322688423/spritesheet-forge)
- **GitHub 存储库** — [LAXY9887/Game-Dev.-Spritesheet-Forge](https://github.com/LAXY9887/Game-Dev.-Spritesheet-Forge)
- **完整 API 文档** — [GitHub Pages](https://laxy9887.github.io/Game-Dev.-Spritesheet-Forge)
