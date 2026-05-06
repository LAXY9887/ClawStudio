---
title: "Claude MCPでGIFをゲーム対応スプライトシートに変換：完全なウォークスルー"
description: "ステップバイステップのデモ：ClaudeがSpritesheet Forge MCPを使ってGIFをスプライトシートPNGおよびTexturePacker互換アトラスJSON変換する方法 — ツールチェーン、パラメーター選択、Unity/Godot統合に関する注釈付き。"
date: "2026-05-05"
readingTime: 8
tag: "tutorial"
---

ゲーム開発者なら誰もがこのループを知っています：アニメーションツールからGIFをエクスポート、TexturePackerを開く、フレームの列を構成する、透明なボーダーを処理する、アトラスを生成する、JSON座標を検証する、UnityまたはGodotにインポートする。1フレーム変更して、すべてのステップを繰り返します。

Spritesheet Forgeはホストされたモデル コンテキスト プロトコル（MCP）サーバーで、このワークフロー全体をClaudeとの会話に移動させます。必要なものを説明すれば、Claudeがツールを呼び出し、出力ファイルとメタデータが戻ります。インストールするソフトウェアはありません。フォーマット暗記も不要です。

この記事は実際の変換 — 9フレームのGIFアニメーションをスプライトシートPNGおよびTexturePacker互換アトラスJSONに変換 — を通じて、正確なツール呼び出し、Claudeが選択したパラメーター、単一のセッション内で操作をチェーン化する方法を示します。

---

## 利用可能なツール

Spritesheet Forgeは接続後、Claudeに6つのツールを公開します：

| ツール | 入力 | 出力 | 主要なパラメーター |
|---|---|---|---|
| `gif_to_spritesheet` | アニメーションGIF | スプライトシートPNG | `columns`, `background_removal` |
| `png_to_spritesheet` | PNGフレームのZIP | スプライトシートPNG | `columns`, `padding` |
| `split_spritesheet` | スプライトシートPNG + フレーム数 | 個別フレーム + アトラスJSON | `columns`, `rows` |
| `trim_png` | 透明ボーダー付きPNG | トリミングされたPNG + クロップ境界 | — |
| `frames_to_animation` | PNGフレームのZIP | アニメーションGIF | `fps` |
| `spritesheet_to_animation` | スプライトシートPNG + フレーム数 | アニメーションGIF | `columns`, `rows`, `fps` |

ツールはチェーン化するよう設計されています：1つのツールの出力URLは、再アップロードなしに次のツールへ直接渡すことができます。すべてのファイル転送はサーバー側で行われます。

---

## 2分でClaudeを接続する

**Claude Desktop** — `claude_desktop_config.json`に追加（Settings → Developer経由でアクセス）：

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

初回使用時、Claudeは自動的にGitHub OAuthページを開きます — 「Authorize」をクリックすればトークンが30日間ローカルに保存されます。認証のためにコンフィグファイルに触れることはありません。

---

## デモ1：GIFからスプライトシートへ

入力は75 × 165 pxの9フレームバナナキャットアニメーションです：

<img src="/blog/spritesheet-forge-mcp-demo/input.gif" alt="入力GIF — 75×165 pxの9フレームバナナキャットアニメーション" style="width:150px;height:auto;display:block;margin:0 auto;border-radius:0.5rem;border:1px solid var(--ui-border);">

ファイルをClaudeにドロップして、必要なものを説明します：

![Claudeとの会話：ユーザーがGIFを送ってスプライトシート変換をリクエスト](/blog/spritesheet-forge-mcp-demo/demo-1.png)

Claudeは自動的にファイルをアップロードし、`background_removal: true`で`gif_to_spritesheet`を呼び出します。ツールはすべてのフレームを1行に配置し、Cloudflare R2に保存されたURLで出力を返します：

![Claudeがgif_to_spritesheet MCPツールを呼び出し](/blog/spritesheet-forge-mcp-demo/demo-2.png)

結果は正確なピクセル寸法とUnity Sprite Editor設定ステップとともに返されます：

![Claudeがスプライトシート結果をフレーム寸法テーブルで返す](/blog/spritesheet-forge-mcp-demo/demo-3.png)

出力 — 675 × 165 px、9フレーム1行、透明背景：

![出力スプライトシート — 675×165 px、9フレーム、透明背景](/blog/spritesheet-forge-mcp-demo/spritesheet.png)

**Claudeが選択したパラメーター：**
- `columns: 9` — すべてのフレームを1つの水平ストリップに配置。UnityおよびGodotの単純なスプライトアニメーションのデフォルト期待値と一致します
- `background_removal: true` — 白い背景を削除し、ピクセル単位のアルファ透明性を持つPNGを生成します

どちらでもオーバーライドできます：`columns: 3`を指定すれば3×3グリッドを取得でき、エンジンがアルファの代わりにカラーキーを使う場合は背景削除を省略できます。

---

## デモ2：スプライトアトラスJSON

単一のフォローアップはスプライトシート出力URLからTexturePacker互換アトラスを生成します — 前のステップからのURLが直接渡され、再アップロードは不要です：

![Claudeがsplit_spritesheetを呼び出してSprite Atlas JSONを生成](/blog/spritesheet-forge-mcp-demo/demo-4.png)

![Claudeが修正されたSprite Atlasをフレーム座標テーブルとともに返す](/blog/spritesheet-forge-mcp-demo/demo-5.png)

Claudeはインポート前にTexturePackerJSON Hashスペックに対して出力を検証できます：

![Claudeが形式の検証 — すべてのチェックが完了](/blog/spritesheet-forge-mcp-demo/demo-6.png)

最終アトラス — 各フレーム75 × 165 px、座標は左上隅からゼロインデックス：

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

このフォーマットはUnity（`SpriteAtlasImporter`）、Godot（`AtlasTexture`）、Phaser 3（`Loader.atlas`）、およびTexturePacker JSON Hash出力を受け入れる他のエンジンで直接読み込まれます。

---

## ツールチェーン

上記の2つのデモは大きなツールチェーンの一部です。すべてのツール出力はCloudflare R2に保存されたURL（1時間TTL）です。1つのツールの出力URLを次のツールへ直接渡すと、再アップロードが回避されます：

```
gif_to_spritesheet(input.gif)
        │  スプライトシート PNG URL
        ▼
split_spritesheet(spritesheet URL, columns=9)
        │  アトラス JSON + 個別フレームURL
        ▼
frames_to_animation(frame URLs, fps=12)   ← プレビューアニメーション
        │
        ▼
trim_png(any frame URL)                   ← オプションのクリーンアップ
```

Claudeにこのチェーン全体を1つのメッセージで実行するよう依頼できます：*「このGIFをスプライトシートに変換し、アトラスJSONを生成し、12 fpsでプレビューアニメーションをください」* Claudeは各ツールを順序に呼び出し、自動的にURLを間に渡します。

1つの制約に注意してください：**出力URLは60分後に期限切れになります**。セッション終了前に必要なファイルをダウンロードしてください。

---

## 次のステップ

- **[Cloudflare WorkersとGCP Cloud Runを使ったリモートMCPサーバーの構築](/blog/building-remote-mcp-server)** — ホストされたサーバーを使用するのではなく独自のMCPサーバーを構築したい場合、この記事は完全なアーキテクチャをカバーします：OAuth 2.1 + PKCE、内部サービス認証、R2ファイルステージング、ツール設計。
- *([UnityおよびGodotへのスプライトシートのインポート：ステップバイステップガイド](/blog/spritesheet-game-engine-import) — 近日公開)* — UnityのSprite Atlasワークフローおよび GodotのAtlasTextureノードの詳細なウォークスルー、アトラスJSON出力を直接配線する方法を含みます。

Spritesheet Forgeはオープンソースで無料で使用できます（無料層で月100操作）：

- **MCP設定ガイド** — [clawstudiouo.com/mcp](https://clawstudiouo.com/mcp)
- **Smitheryで1クリックインストール** — [smithery.ai](https://smithery.ai/servers/lxya98874322688423/spritesheet-forge)
- **GitHubリポジトリ** — [LAXY9887/Game-Dev.-Spritesheet-Forge](https://github.com/LAXY9887/Game-Dev.-Spritesheet-Forge)
- **完全なAPI documentation** — [GitHub Pages](https://laxy9887.github.io/Game-Dev.-Spritesheet-Forge)

---

## よくある質問

**Spritesheet Forgeとは何ですか？**

Spritesheet ForgeはホストされたMCPサーバーで、Claudeにスプライトシート処理ツールへの直接アクセスを提供します。接続後、Claudeはgif変換、PNGフレームパッキング、アトラスJSON生成、既存スプライトシートの分割などを自然言語で実行できます — ローカルソフトウェアインストール不要です。

**Spritesheet ForgeをClaudeに接続するにはどうしますか？**

Claude Desktopの場合、`claude_desktop_config.json`にサーバー構成を追加します。Claude Code CLIの場合、`claude mcp add spritesheet-forge --transport http https://mcp.clawstudiouo.com/mcp`を実行します。初回使用時、Claudeは自動的にGitHub OAuthページを開きます — 「Authorize」をクリックすればトークンが30日間保存されます。完全な設定は[clawstudiouo.com/mcp](https://clawstudiouo.com/mcp)にあります。

**Spritesheet Forgeはどのファイル形式をサポートしていますか？**

`gif_to_spritesheet`は任意のアニメーションGIFを受け入れます。`png_to_spritesheet`および`frames_to_animation`はPNGフレームのZIPを受け入れます。すべての画像出力はPNG、アトラス出力はTexturePacker JSON Hashで、Unity、Godot、Phaser 3、Cocos2d、および同様のエンジンと互換性があります。

**Spritesheet Forgeは無料ですか？**

無料層には月100操作が含まれます — 中程度のアニメーションボリュームを備えたアクティブなゲーム開発に十分です。クレジットカードは不要です。サーバー自体はGitHubのオープンソースです。

**Claudeは大きなスプライトファイルを処理できますか？**

~185 KB未満のファイルはbase64でインラインで送信されます。より大きいファイルの場合、Claudeはサーバーの`/upload`エンドポイントにアップロードし、返されたURLをツールに渡します。これを手動で管理することはありません — Claudeがファイルサイズを検出し、正しい方法を自動的に選択します。

**出力ファイルはどのくらい利用できますか？**

ツール出力URLはCloudflare R2に1時間TTLで保存されます。セッションをダウンロードなしで閉じた場合、ファイルは期限切れになります。ワークフローの最後にダウンロードリンクを明確に表示するようClaudeに依頼してください。

**1つのリクエストで複数のツールをチェーン化できますか？**

はい。Claudeは自動的にツールを順序に呼び出し、各出力URLを次のツール入力として渡します。たとえば、*「このGIFを変換してフレームに分割し、12 fpsでプレビューGIFをください」*は3つのツールを手動ステップなしで実行します。

**アトラスJSONはどのゲームエンジンと互換性がありますか？**

出力フォーマットはTexturePacker JSON Hash — ゲーム開発で最も広くサポートされているアトラスフォーマットです。Unity（`SpriteAtlasImporter`）、Godot（`AtlasTexture`）、Phaser 3（`Loader.atlas`）、Cocos2d、およびTexturePacker出力を受け入れる他のエンジンと互換性があります。
