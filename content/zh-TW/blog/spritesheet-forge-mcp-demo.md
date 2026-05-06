---
title: "GIF 到 Spritesheet 的 AI 工作流：Claude + MCP 實機展示"
description: "看 Claude 透過 Spritesheet Forge MCP 伺服器，用對話把 GIF 動畫轉成 Spritesheet 和 TexturePacker JSON Atlas，全程無需手動操作。"
date: "2026-05-05"
readingTime: 6
tag: "tutorial"
---

## 傳統 Spritesheet 工具的痛點

把 GIF 動畫轉成可用於遊戲的 Spritesheet 一直是繁瑣的多步驟流程：開啟 TexturePacker、設定欄數、決定是否去背、匯出、確認幀座標、再調整。每次動畫有所更動，就要重複整個流程。

如果你只需要描述你要什麼，就能直接拿到結果呢？

## Spritesheet Forge：專為 Claude 設計的 Spritesheet 伺服器

**Spritesheet Forge** 是一個託管的 MCP（模型上下文協定）伺服器，讓 Claude 可以直接存取 Spritesheet 處理工具。連線後，你可以用自然語言請 Claude 轉換 GIF、打包 PNG 成 Spritesheet、分割現有 Spritesheet、產生 Sprite Atlas JSON 等等。

不需要安裝任何軟體。伺服器運行在 Cloudflare Workers 上，在雲端處理你的檔案。Claude 負責上傳、參數選擇和輸出——你只需要描述你想要的結果。

## 兩分鐘完成連線

透過 Claude Desktop 或 Claude Code CLI 皆可連線：

**Claude Desktop** — 加入 `claude_desktop_config.json`：

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

首次使用時，Claude 會開啟 GitHub OAuth 頁面進行認證。Token 儲存於本機，有效期 30 天。

## 實機展示：GIF 轉 Spritesheet

以下是輸入素材——一個 9 幀的香蕉貓動畫，75 × 165 px：

<img src="/blog/spritesheet-forge-mcp-demo/input.gif" alt="輸入 GIF" style="width:150px;height:auto;display:block;margin:0 auto;border-radius:0.5rem;border:1px solid var(--ui-border);">

把檔案拖入 Claude，描述你的需求：

![Claude 對話：使用者傳入 GIF 並請求轉換成 Spritesheet](/blog/spritesheet-forge-mcp-demo/demo-1.png)

Claude 自動上傳檔案並呼叫 `gif_to_spritesheet`，並啟用去背功能：

![Claude 呼叫 gif_to_spritesheet MCP 工具](/blog/spritesheet-forge-mcp-demo/demo-2.png)

結果回傳，並附上 Unity Sprite Editor 所需的精確像素尺寸：

![Claude 回傳 Spritesheet 結果及幀尺寸表格](/blog/spritesheet-forge-mcp-demo/demo-3.png)

輸出 Spritesheet——675 × 165 px，9 幀單行排列，透明背景：

![輸出 Spritesheet](/blog/spritesheet-forge-mcp-demo/spritesheet.png)

## 實機展示：Sprite Atlas JSON

只需一句追問，就能取得 TexturePacker 相容的 Atlas：

![Claude 呼叫 split_spritesheet 產生 Sprite Atlas JSON](/blog/spritesheet-forge-mcp-demo/demo-4.png)

![Claude 回傳正確的 Sprite Atlas 及幀座標表格](/blog/spritesheet-forge-mcp-demo/demo-5.png)

還可以請 Claude 驗證輸出是否符合 TexturePacker JSON Hash 規格：

![Claude 驗證 Sprite Atlas JSON 格式——全部通過](/blog/spritesheet-forge-mcp-demo/demo-6.png)

最終的 Atlas——9 幀，每幀 75 × 165 px，可直接在 Unity、Godot（`AtlasTexture`）或任何支援 TexturePacker JSON Hash 的引擎中使用：

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

## 立即試用

Spritesheet Forge 開源免費（免費方案每月 100 次操作）：

- **MCP 設定指南** — [clawstudiouo.com/mcp](https://clawstudiouo.com/mcp)
- **Smithery 一鍵安裝** — [smithery.ai](https://smithery.ai/servers/lxya98874322688423/spritesheet-forge)
- **GitHub 儲存庫** — [LAXY9887/Game-Dev.-Spritesheet-Forge](https://github.com/LAXY9887/Game-Dev.-Spritesheet-Forge)
- **完整 API 文件** — [GitHub Pages](https://laxy9887.github.io/Game-Dev.-Spritesheet-Forge)
