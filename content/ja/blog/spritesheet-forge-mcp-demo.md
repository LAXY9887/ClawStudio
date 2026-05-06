---
title: "GIF からゲーム対応スプライトシートへ: Claude + MCP ライブデモ"
description: "Claude が Spritesheet Forge MCP サーバーを使用して GIF アニメーションをスプライトシートと TexturePacker 互換アトラス JSON に変換する様子を見てみましょう。手動ツールは不要です。"
date: "2026-05-05"
readingTime: 6
tag: "tutorial"
---

## 従来のスプライトシートツールの問題点

GIF アニメーションをゲーム対応スプライトシートに変換するには、これまで多段階のプロセスが必要でした: TexturePacker を開く、列数を設定する、背景を削除するかどうか決める、エクスポート、フレーム座標を確認、調整する。アニメーションを繰り返すたびに、このサイクル全体を繰り返す必要がありました。

必要な結果を単に説明するだけで得られるとしたら、どうでしょうか?

## Spritesheet Forge: Claude 向けスプライトシートサーバー

**Spritesheet Forge** は、Claude にスプライトシート処理ツールへの直接アクセスを提供するホストされた MCP (Model Context Protocol) サーバーです。接続すると、Claude に GIF の変換、PNG のスプライトシートへのパッキング、既存スプライトシートの分割、Sprite Atlas JSON の生成など、すべて自然言語で行うよう依頼できます。

インストールするソフトウェアはありません。サーバーは Cloudflare Workers 上で実行され、ファイルをクラウドで処理します。Claude がファイルのアップロード、パラメータの選択、出力を処理します。必要な結果を説明するだけです。

## 2分で Claude を接続

Claude Desktop または Claude Code CLI 経由で接続できます:

**Claude Desktop** — `claude_desktop_config.json` に追加:

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

初回使用時、Claude は GitHub OAuth ページを開いてセッションを認証します。トークンはローカルに保存され、30 日間有効です。

## デモ: GIF からスプライトシートへ

ここが入力です。75 × 165 px の 9 フレームのバナナキャットアニメーション:

<img src="/blog/spritesheet-forge-mcp-demo/input.gif" alt="入力 GIF" style="width:150px;height:auto;display:block;margin:0 auto;border-radius:0.5rem;border:1px solid var(--ui-border);">

ファイルを Claude にドロップして、必要な内容を説明します:

![Claude の会話: ユーザーが GIF を送信してスプライトシート変換を依頼](/blog/spritesheet-forge-mcp-demo/demo-1.png)

Claude がファイルを自動的にアップロードし、背景削除を有効にして `gif_to_spritesheet` を呼び出します:

![gif_to_spritesheet MCP ツールを呼び出す Claude](/blog/spritesheet-forge-mcp-demo/demo-2.png)

結果は正確なピクセル寸法と Unity セットアップ手順を含めて返されます:

![フレーム寸法テーブル付きスプライトシート結果を返す Claude](/blog/spritesheet-forge-mcp-demo/demo-3.png)

出力スプライトシート — 675 × 165 px、単一行に 9 フレーム、透明背景:

![出力スプライトシート](/blog/spritesheet-forge-mcp-demo/spritesheet.png)

## デモ: Sprite Atlas JSON

TexturePacker 互換アトラスを取得するのに必要なのは、1つの後続質問だけです:

![split_spritesheet を呼び出して Sprite Atlas JSON を生成する Claude](/blog/spritesheet-forge-mcp-demo/demo-4.png)

![修正された Sprite Atlas とフレーム座標テーブルを返す Claude](/blog/spritesheet-forge-mcp-demo/demo-5.png)

Claude に出力を TexturePacker JSON Hash 仕様に対して検証するよう依頼できます:

![Sprite Atlas JSON 形式を検証する Claude — すべてのチェックに合格](/blog/spritesheet-forge-mcp-demo/demo-6.png)

最終アトラス — 75 × 165 px の 9 フレームすべて、Unity、Godot (`AtlasTexture`)、または TexturePacker 互換エンジンで読み込む準備ができています:

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

## 自分で試してみましょう

Spritesheet Forge はオープンソースで無料で使用できます (無料ティアで毎月 100 オペレーション):

- **MCP セットアップガイド** — [clawstudiouo.com/mcp](https://clawstudiouo.com/mcp)
- **Smithery でのワンクリックインストール** — [smithery.ai](https://smithery.ai/servers/lxya98874322688423/spritesheet-forge)
- **GitHub リポジトリ** — [LAXY9887/Game-Dev.-Spritesheet-Forge](https://github.com/LAXY9887/Game-Dev.-Spritesheet-Forge)
- **完全な API ドキュメント** — [GitHub Pages](https://laxy9887.github.io/Game-Dev.-Spritesheet-Forge)
