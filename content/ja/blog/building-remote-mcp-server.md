---
title: "Cloudflare Workers と GCP Cloud Run でリモート MCP サーバーを構築する"
description: "Cloudflare Workers および GCP Cloud Run でホストされた MCP サーバーを構築するためのステップバイステップガイド — OAuth 2.1 + PKCE、内部サービス認証、R2 ファイルステージング、およびバックエンド コードをプライベートに保つ方法をカバーしています。"
date: "2026-05-06"
readingTime: 15
tag: "guide"
---

## 出発点：既存の API

MCP が関与する前に、Spritesheet Forge は既に機能するバックエンドを持っていました。Google Cloud Platform で実行されている一連の画像処理 API です。これらの API は実際の処理を担当していました — GIF をスプライトシートに変換し、透明な境界線をトリミングし、フレームをパック し、アトラス JSON を生成します。

MCP (Model Context Protocol) はオープン スタンダードであり、Claude のような AI アシスタントが自然言語を通じてツールと API を直接呼び出すことができます。MCP が追加するのは、既存の API の上に置かれた **AI ネイティブ インターフェース** です。エンドポイントを直接呼び出す代わりに、Claude は自然言語を通じてこれらの操作を呼び出すことができるようになりました。バックエンドは変わりませんでした。変わったのはそれにアクセスする方法です。

この区別は、アーキテクチャを理解するために重要です。これは一から構築し直すのではなく、既に機能しているものの前に置かれた新しいレイヤーです。

### GCP を選ぶ理由

新しいプロジェクトを開始していて、まだクラウド プロバイダーを選択していない場合は、GCP のサーバーレス スタックを真剣に検討する価値があります — 特にトラフィックが予測不可能な開発者ツールとユーティリティの場合。

重要な特性は **ゼロへのスケール** です。GCP のマネージド コンテナ ランタイムである Cloud Run は、リクエストがないときは完全にシャットダウンし、リクエストが到着すると数秒で起動します。実際に使用されるコンピュート時間に対してのみ支払い、最も近い 100ms 単位で請求されます。スポーディックなツール呼び出しを処理する MCP サーバーの場合、これは実際にはほぼゼロの実行コストに変換されます。

他の利点として知る価値があるもの：

- **インフラストラクチャの管理は不要** — Cloud Run は HTTPS の終了、スケーリング、ヘルス チェック、およびデプロイメント ロールバックを自動的に処理します
- **任意の言語、任意のフレームワーク** — 任意のコンテナをデプロイでき、プラットフォーム固有のランタイムは不要です
- **無料階層は寛容** — 毎月 200 万件のリクエストと 360,000 GB 秒のコンピュート、コスト なし
- **Artifact Registry + Cloud Build** — デプロイメント パイプライン (イメージのビルド → プッシュ → デプロイ) は単一の `gcloud` コマンドで完全に自動化できます

GCP のセットアップをゼロから説明する専用投稿 — Cloud Run デプロイメント、Artifact Registry、Cloud Build CI/CD、および IAM 設定 — はまもなく公開されます。*([GCP での API サービスのセットアップ](/blog/deploy-api-on-gcp-cloud-run))*

---

## MCP レイヤーを追加する

バックエンドが既に実行されている状態で、AI クライアントにそれを公開する方法という問題がありました。答えは、MCP プロトコルを話し、リクエストを既存の API に変換する Cloudflare Workers 上の薄いゲートウェイでした。

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

Worker はエッジで everything を処理します：MCP プロトコル解析、OAuth トークン検証、ユーザー ごとのクォータ実施、ファイル ステージング。Worker はグローバルに分散され、コールド スタートがなく、リクエストは最も近いエッジ ロケーションに最小限のオーバーヘッド（サブミリ秒）で到着します。制約は厳格な CPU 時間制限です(無料階層では 50ms / リクエスト)。これは、計算集約的なものには適していません。これが大量の処理が Cloud Run に留まる理由です。

### Cloudflare R2

R2 はツール間の受け渡しメカニズムです。すべてのツール出力は 1 時間の TTL で R2 に書き込まれ、URL として返されます。チェーン内の次のツールが入力として URL を受け取ります — Worker は追加の HTTP ラウンド トリップなしに R2 から直接フェッチします。これにより、マルチ ステップのエージェント ワークフローが高速かつ安価になります。R2 は S3 互換なので、既存の S3 SDK は変更なしで動作します。

### Cloudflare KV

KV は 3 種類のデータを保存します：OAuth セッション トークン(30 日間の TTL)、ユーザー ごとの月次クォータ カウンター、および認可フロー中の OAuth PKCE 状態。KV は最終的に一貫性があり、エッジ キャッシュ読み取り対応です — これらの書き込み一度、読み取り多数の値に適しています。

Cloudflare Workers のセットアップ、カスタム ドメインの設定、DNS の管理、および R2 と KV の配線の完全なウォークスルーについては、サポート ガイドを参照してください：*([MCP サーバー用 Cloudflare Worker セットアップの完全ガイド](/blog/cloudflare-worker-setup-guide) — 近日公開予定)*

### プライベート リポジトリの利点

ゲートウェイをバックエンドから分離することで、明らかでない問題が解決されます：**MCP ラッパーのみがパブリックである必要があります**。

Cloudflare Worker コードは API サーフェスを定義します — ツール名、パラメーター、認証。これを公開することで、コミュニティが統合を検査し、互換性のあるクライアントを構築できます。実際の処理ロジックが存在する Cloud Run バックエンドはプライベート リポジトリに留まります。コア アルゴリズムは決して公開されません。

商用製品の場合、これは意味があります：オープン MCP 統合を出荷でき、コミュニティがインターフェース レイヤーに貢献でき、プロプライエタリなバックエンドは完全にクローズドに保つことができます。MCP テクノロジーを紹介しながら、実装の詳細を明かさない ことができます。

---

## 完全な MCP サーバーが実際に必要なもの

Spritesheet Forge が最初に起動した時、MCP サーバーは技術的に実行されていました — しかし Claude はほとんど使用できませんでした。ツールは存在しましたが、サーバーは MCP クライアントがツールを呼び出そうとする前に依存する複数のコンポーネントが不足していました。エージェントは接続され、困惑し、放棄されました。

リモート MCP サーバーが正しく動作するために必要なもののリストは次のとおりです：

### MCP プロトコル ハンドラー (`POST /mcp`)

メイン エンドポイントはすべての MCP トラフィックを受け取ります。すべての MCP クライアントが有用なことをする前に送信するメッセージの特定のシーケンスを処理する必要があります：

| Method | Who sends it | What it means |
|--------|-------------|---------------|
| `initialize` | Client, first message | "I'm connecting, here are my capabilities" |
| `notifications/initialized` | Client, after server responds to `initialize` | "Ready to proceed" |
| `tools/list` | Client, to discover available tools | "What can you do?" |
| `tools/call` | Client, to actually invoke a tool | "Do this thing" |

`initialize` と `notifications/initialized` メッセージは、認証なしでも有効な応答を返す必要があります — これらはセッションを確立するハンドシェイクです。これらのいずれかが失敗するか、認証エラーを返す場合、クライアントは接続が切断されたと判断し、停止します。

### ツール定義

`tools/list` に登録される各ツールは、4 つの完全なものが必要です：

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

`outputSchema` または `annotations` が不足していてもツール呼び出しを破損することはできませんが、すべてのディレクトリ プラットフォームの品質スコアが低下します。さらに重要なことに、LLM は `outputSchema` を使用して、戻ってくるものの構造を解析し、推論します — これなしでは、モデルは推測しています。

### Discovery とインフラストラクチャ エンドポイント

`/mcp` を超えて、完全なサーバーはまた必要とします：

- **`GET /health`** — HTTP 200 で `{"status":"ok"}` を返し、認証は不要です。ディレクトリ プラットフォームはこれをポーリングして、サーバーが動いていることを確認します。
- **`OPTIONS /mcp`** — CORS プリフライトを処理します。ブラウザベースの MCP クライアントに必要です。
- **`GET /.well-known/oauth-authorization-server`** — OAuth を使用している場合、これは MCP クライアントが認証エンドポイントを自動的に発見する方法です。これなしでは、クライアントは手動設定にフォールバックするか、完全に失敗します。

### これらのいずれかが欠落した場合の結果

Claude は `initialize` → `notifications/initialized` → `tools/list` を順番に実行して MCP サーバーに接続します。`tools/list` が失敗する場合(認証が必要なため、または応答が形式が正しくないため)、クライアントはツール定義がないため、作業する機能がありません。Claude の観点から、サーバーは存在しますが、機能がありません — 何も呼び出すことはできません。

これは実際には「MCP をほぼ使用できないエージェント」のように見えました：接続は成功しましたが、検出ステップが正しく完了しなかったため、ツールを使用するあらゆる試みは失敗しました。

### プロトコル例

MCP プロトコル内のすべてのメッセージは HTTP POST を介した JSON-RPC 2.0 オブジェクトです。実際のエクスチェンジがどのように見えるかを次に示します。

**ステップ 1 — クライアントが `initialize` を送信**

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

**サーバーが独自の機能で応答**

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

**ステップ 2 — クライアントが `notifications/initialized` を送信** (応答は不要)

```json
{
  "jsonrpc": "2.0",
  "method": "notifications/initialized"
}
```

**ステップ 3 — クライアントが `tools/list` を送信** (認証は不要)

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/list"
}
```

**サーバーが登録されたすべてのツールを返す**

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

このハンドシェイクが完了すると、クライアントは利用可能なツールと呼び出す方法を正確に知っています。この時点の後でのみ、認証が関連性があります — `tools/call` のようなツール呼び出しには有効な Bearer トークンが必要です。

**`server_info` — ゼロ引数のツール呼び出し**

これは、Spritesheet Forge の `server_info` ツールを使用した実際の `tools/call` リクエストと応答がどのように見えるかです：

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

**実際の応答：**

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

`server_info` は、構成またはメタデータを返すツールのパターンに従うべきです：ゼロ引数、決定的な出力、ワークフローを開始する前にエージェントが照会するのに役立ちます。

---

## 認証

### なぜ認証するのか？

認証がないと、MCP サーバーはオープン パブリック API です — エンドポイントを発見する人は誰でも、無期限にツールを実行でき、Cloud Run コンピュートを消費し、R2 ストレージ書き込みを消費し、実際のユーザーに属するクォータを使い果たします。認証は 3 つの問題を同時に解決します：

- **リソース保護**：すべてのツール呼び出しはコンピュート コストに直接変換されます。呼び出し者を知らなければ、制限を実施することはできません。
- **クォータ管理**：ユーザー ごとの月次クォータは、追跡する安定したアイデンティティが必要です。アイデンティティなしでは、公平な実施はできません。
- **悪用防止**：認証なしのパブリック エンドポイントは簡単にスクリプト可能です — 1 つの悪いアクターは請求額をスパイクするか、他全員のサービスを低下させることができます。

### 認証オプション

| Method | User experience | Implementation | MCP client support |
|--------|----------------|----------------|-------------------|
| No auth | Frictionless | Trivial | Universal |
| Static API key | Poor — user must copy-paste into config | Simple | Universal |
| OAuth 2.1 + PKCE | Seamless — one browser click | Moderate | Claude Desktop, Claude Code |

**認証なし** は、ネットワークがセキュリティ境界であるローカルまたは内部のみのサーバーにのみ適切です。パブリック リモート サーバーの場合、これはインターネット上の誰でもツールを呼び出すことができることを意味します。

**API キー** は明らかな最初の選択肢です：キーを生成し、ユーザーに提供し、完了です。問題は配布体験です。ユーザーはダッシュボードまたはドキュメント ページを見つけ、ランダム文字列をコピーし、設定ファイルを開き、貼り付け、クライアントを再起動する必要があります。これは複数の失敗ポイントがあるマルチ ステップ プロセスであり、失った場合は回復がありません。使用する新しい MCP クライアントごとに、同じ手動セットアップが必要です。

**OAuth 2.1 + PKCE** は実装するのに多くの作業が必要ですが、劇的に優れたエクスペリエンスを提供します。MCP クライアントはネイティブに全体のフローを処理します — トークンが必要な場合、自動的にブラウザを開きます。ユーザーは GitHub ログイン ページを表示し、「認可」をクリックし、クライアントが結果のトークンを内部に保存します。ユーザーの観点から、設定ファイルが関わらない 1 つのクリックです。

### Spritesheet Forge がこれを実装する方法

実装は GitHub をアイデンティティ プロバイダーとして使用し、Cloudflare KV をトークン ストレージとして使用し、標準的な OAuth 2.1 + PKCE フロー：

**1. `/.well-known/oauth-authorization-server` 経由の自動検出**

MCP クライアントは OAuth フローを開始する前にこのエンドポイントを読み取ります。認可エンドポイント、トークン エンドポイント、およびサポートされている付与タイプを返します。これなしでは、クライアントは手動設定を必要とするか、完全に接続に失敗します。

**2. 動的クライアント登録 (RFC 7591)**

すべての MCP クライアントは登録エンドポイントに POST することで自動的に自分自身を登録できます。これは、新しいクライアントが事前承認されたり、どこかにリストされたりせずに接続できることを意味します — サーバーは登録を自動的に処理します。

**3. PKCE フロー**

認可コードの傍受を防止します。クライアントはランダムな `code_verifier` を生成し、そのハッシュ (`code_challenge`) を認可リクエストで送信します。その後、トークンのコードを交換するときに元の検証を保持することを証明します。これにより、認可コードが転送中に盗まれる可能性があった攻撃ベクトルを閉じます。

**4. KV セッション ストレージ**

セッション トークンは Cloudflare KV の `session:{userId}` の下に 30 日間の TTL で保存されます。各 `tools/call` リクエストは、リクエストが Cloud Run に到達する前に KV に対して Bearer トークンを検証します。

**5. スクリプト フォールバック**

ブラウザー OAuth が実用的ではないスクリプト、CI パイプライン、またはベンチマーク環境で作業するユーザーの場合、ダウンロード可能な `get-token.py` スクリプトが利用可能です。これは端末で完全な OAuth フローを実行し、結果のトークンを出力し、`~/.spritesheet-forge-token` に保存します。

### X-MCP-Key：内部サービス認証

アーキテクチャは 2 つのレイヤーがあります：Cloudflare Worker (パブリック ゲートウェイ) と Cloud Run (プライベート バックエンド)。Cloud Run はインターネットから技術的にアクセス可能なURL で実行されます — それを発見する誰でも、Worker をすっかり次のリクエストをPOST可能します。つまり、OAuth 検証、クォータ実施、およびレート制限をバイパスします。

`X-MCP-Key` ヘッダーはこのギャップを閉じます。これは Worker と Cloud Run に知られている共有シークレットです。Worker はすべての受信 OAuth トークンを検証し、このヘッダーを付加してリクエストを Cloud Run に転送します。Cloud Run は正しいキーを含まないリクエストを拒否します。

```
User → Worker:     Authorization: Bearer <oauth-token>   (public auth)
Worker → Cloud Run: X-MCP-Key: <internal-secret>         (internal auth)
```

これは **多層防御** です：Cloud Run URL がログ、エラーメッセージ、またはリバース エンジニアリング経由でリークされても、攻撃者は内部キーなしでそれを呼び出すことはできません。すべてのトラフィックはゲートウェイを通じて強制され、すべてのセキュリティ実施は保持されます。

これなしでは、「プライベート バックエンド」は誤った主張になります — バックエンドは十分に探す人には実際にはまだパブリックになります。

---

## ファイル入力設計

このセクションはファイルを処理するツールがある MCP サーバーに固有です — 画像コンバーター、ドキュメント パーサー、オーディオ プロセッサー、およびそれに類するもの。ツールがテキストまたは構造化データのみを処理する場合、この問題に直面することはありません。しかし、ファイル集約的な API の場合、これは実際に最も制限的な問題の 1 つです。

基本的な問題は、エージェントにファイルを渡すことは見た目より難しいということです。本能的なアプローチ — ファイルを base64 エンコードしてインラインで送信する — 理論的には動作しますが、実際には厳しい制約にぶつかります：**Claude Code のシェル ツールの stdout 出力には約 256 KB のコンテキスト制限があります**。Base64 エンコーディングはファイル サイズを約 33% 拡大するため、インライン base64 の実際の安全な上限は約 185 KB です。ほとんどの画像、オーディオ ファイル、およびドキュメントはそれより大きいです。

これはほとんどの実際のファイル処理ユースケースでは base64 を実用的ではなくします。追加したソリューションは、MCP プロトコル自体の外側の MCP レイヤーに専用 `/upload` エンドポイントでした — ユーザー(またはエージェント)がファイルを直接そこに POST し、URL を取得し、ファイルをインラインに埋め込む代わりにその URL をツールに渡します。Worker はその後、サーバー側で R2 からファイルをフェッチし、コンテキスト サイズ制約を完全にバイパスします。

**ファイル ストレージに Cloudflare R2 を選ぶ理由？**

R2 は Cloudflare の S3 互換オブジェクト ストレージであり、1 つの特定の理由から正しい選択です：**エグレス料金がゼロ**。AWS S3 およびほとんどの他のオブジェクト ストレージ サービスはデータ転送出力に対して課金されます — ツール出力が読まれるたびに(チェーン ツール呼び出しのたびに発生します)、支払います。R2 はエグレスに何も課金しません。ツール間でファイルを頻繁に移動する MCP サーバーの場合、これは重要です。

R2 の無料階層も十分に寛容なので、低から中程度のトラフィック MCP サーバーは完全にそれ内で実行できます：

| Resource | Free tier |
|----------|-----------|
| Storage | 10 GB/month |
| Class A operations (writes, deletes) | 1 million/month |
| Class B operations (reads) | 10 million/month |
| Egress (data transfer out) | Free, always |

ツール出力は 1 時間の TTL で保存され、自動的に削除されます — したがって、アクティブな使用中でもストレージ使用量は低いままです。1 時間以内に処理および破棄されたファイルは、月次ストレージ合計に対して意味のある方法でカウントされません。

ファイルを受け入れる MCP ツールは 3 つの異なる入力シナリオを処理する必要があります：

| Scenario | Method |
|----------|--------|
| Small files (< ~185 KB) | base64 data URI: `data:image/png;base64,...` |
| Large files or files from shell | POST to `/upload` endpoint, pass back the URL |
| Output from a previous tool | Pass the output URL directly — Worker fetches from R2 |

明らかでない制約：Claude Code のシェル ツールの stdout には約 256 KB のコンテキスト制限があります。Base64 エンコーディングはファイル サイズを約 33% 拡大するため、インライン base64 の実際の上限は 4 MB ではなく約 185 KB です。ツール説明はこの制限を明確に述べ、重要な場合はアップロード エンドポイントへユーザーを向けるべきです。

**base64 改行バグ。** `openssl base64` と `base64` CLI のようなシェル ツールは 76 文字ごとに改行を挿入します。その文字列を直接データ URI として渡すと、サーバーで `INVALID_BASE64` エラーが発生します。ツール説明に次の警告を入れてください：

> "base64 文字列から all whitespace と改行を削除した後に、データ URI プレフィックスを前に追加してください。例： `base64 file.png | tr -d '\n'`"

---

## LLM と連携するツール設計

### ステップ 0：Claude を MCP サーバーに接続する

ツールを使用できるようになる前に、Claude を MCP サーバーに接続する必要があります。これは明白に思えますが、はっきりさせる価値があります：Claude は自動的に MCP サーバーを発見または接続します。明確に接続を設定し、それまでは Claude はサーバーが存在することを認識していません。

**Claude Desktop** — `claude_desktop_config.json` に追加します(設定 → 開発者から見つけてください)：

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

**Claude Code CLI** — ターミナルから追加します：

```bash
claude mcp add spritesheet-forge --transport http https://mcp.clawstudiouo.com/mcp
```

サーバーが設定されていない場合、Claude は「そのツールが見つかりません」と言いません。それはツールが存在しないかのように機能するだけです — ウェブ検索で代替を探し、実際に持っていない似たような名前のツールを幻覚化し、または完全にあなたが尋ねたことを見落とし、ジェネリック応答を生成します。失敗モードはサイレントで混乱します。

### ユーザーが MCP サーバーを見つける方法

Claude を接続することはステップ 1 です。ユーザーが最初の場所でサーバーが存在することを知ってもらうことは別の問題です。複数のチャネルがあり、各チャネルは異なるオーディエンスに到達します：

**ソースとドキュメンテーション**
- [GitHub リポジトリ](https://github.com/LAXY9887/Game-Dev.-Spritesheet-Forge) — 真実の主要なソース。開発者はここを最初に見ます。エンドポイント URL と設定スニペットを備えた明確な README が最小限です。
- [専用チュートリアル ページ](https://sprite-forge-mcp.tutorial.clawstudiouo.com) — インストール、認証、およびサンプル プロンプトをウォークスルーするスタンドアロン ページ。README を読みたくない非開発者に役立ちます。

**公式レジストリ**
- [Anthropic MCP レジストリ](https://registry.modelcontextprotocol.io/?q=io.github.LAXY9887%2Fspritesheet-forge) — Anthropic の MCP サーバーの公式インデックス。これは MCP クライアント アプリケーションがアプリ内にキュレーションされたサーバー リストを表示するためにクエリします。

**マーケットプレイスとディレクトリ**
- [Smithery.ai](https://smithery.ai/servers/lxya98874322688423/spritesheet-forge) — Claude Code の MCP ブラウザに直接統合されています。ユーザーは CLI を離れずにサーバーを見つけてインストールできます。
- [MCP マーケットプレイス](https://mcp-marketplace.io/server/game-dev-spritesheet-forge) — 有料階層の収益共有モデルを持つ専用マーケットプレイス。
- GitHub マーケットプレイス — GitHub の開発者エコシステムアクセス可能。

チャネルは相互に強化されます。Smithery でサーバーを見つけるユーザーは、その後 GitHub リポジトリを確認することが多いです。チュートリアル ページは発見を実際のインストールに変換します。すべてをカバーすることは最小限の保守を要し、重ならないオーディエンスに到達します。

### 実際に機能するツール説明を書く

ツール説明は人間向けのドキュメンテーションではありません — これはツールをいつ、どのように呼び出すかを決定するために LLM が使用する命令です。不十分に記述された説明により、モデルは間違ったツールを呼び出し、間違ったパラメーターを渡し、またはデバッグが難しいエラーを生成します。

良いツール説明に含まれるもの：

- **入力形式**：URL？データ URI？どの MIME タイプが受け入れられていますか？
- **出力**：ツールは何を返しますか？URL？JSON 構造体？TTL は何ですか？
- **制約**：ファイル サイズ制限、パラメーター相互作用、既知の落とし穴
- **例**：複雑な入力ルールの場合、インラインの例またはシェル コマンドを提供します

**チェーニング用に設計します。** すべてのツールの出力 URL を別のツールの入力として直接使用可能にします。これにより、エージェントはマルチ ステップのワークフローを自然に構成できます：

```
gif_to_spritesheet → split_spritesheet → frames_to_animation
```

**`server_info` ツールを追加します。** ランタイム設定を返すゼロ引数ツールを提供します：アップロード エンドポイント URL、出力ファイル TTL、ファイル サイズ制限、および base64 とアップロードの間で選択するルール。これにより、その情報は個々のツール説明全体で古くなることはなく、エージェントは複雑なワークフローを開始する前にそれを照会する確実な方法があります。

---

## クイック エラー リファレンス

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

## よくある質問

**リモート MCP サーバーとは何ですか？**

リモート MCP サーバーは、Model Context Protocol を実装するクラウド ホステッド サービスであり、Claude のような AI アシスタントがインターネットを介して自然言語でツールを呼び出すことができます。ローカル MCP サーバー（ユーザーのマシン上で実行され、そのマシンからのみアクセス可能）とは異なり、リモート サーバーはローカル インストールなしで、どこからでも認証済みの MCP クライアントにアクセス可能です。

**Claude Desktop または Claude Code に MCP サーバーを追加するにはどうすればよいですか？**

Claude Desktop の場合、`claude_desktop_config.json` にサーバー設定を追加します(設定 → 開発者の下で見つけてください)。Claude Code の場合、ターミナルで `claude mcp add <name> --transport http <url>` を実行します。接続が明確に設定されるまで、Claude はサーバーが存在することを認識せず、そのツールを使用できません。

**リモート MCP サーバーを Cloudflare および GCP で実行するのに無料ですか？**

はい、低から中程度のトラフィックに対しては。Cloudflare Workers には無料階層で 1 日 100,000 リクエストが含まれています。Cloudflare R2 は月に 10 GB ストレージ、100 万書き込み、1000 万読み取りをコスト なしで提供します — エグレス料金なし。GCP Cloud Run は月に 200 万リクエストと 360,000 GB 秒のコンピュートを無料で提供します。スポーディックなツール呼び出しを処理する開発者ツールはこれらの制限内で完全に実行できます。

**MCP 認証に API キーではなく OAuth を使用するのはなぜですか？**

OAuth 2.1 はより優れたユーザー エクスペリエンスを提供します。API キーでは、ユーザーはトークンをコピーして設定ファイルに貼り付ける必要があります — 複数ステップ プロセスであり、キーを失った場合に自己回復はありません。OAuth では、Claude Desktop および Claude Code はネイティブにフローを処理します：ブラウザを開き、ユーザーが「認可」をクリックし、トークンは自動的に保存されます。ユーザーは設定ファイルに触れることはありません。

**Claude が MCP ツールを見つけることができないのはなぜですか？**

最も一般的な原因は、MCP サーバーがクライアントで設定されていないことです。Claude はサーバーを自動的に発見します。サーバーが設定されているのにツールがまだ表示されない場合、`tools/list` が認証なしでアクセス可能であることを確認してください — Bearer トークンが必要な場合、Claude は初期ハンドシェイク中にツール リストを取得できず、サーバーがツールを持たないかのように動作します。

**大きなファイルを MCP ツールに渡すにはどうすればよいですか？**

約 185 KB より大きいファイルの場合、base64 エンコーディングの代わりにサーバーの `/upload` エンドポイントを使用してください。ファイルを直接(multipart/form-data)POST し、応答で URL を受け取り、その URL をツールのファイル パラメーターとして渡します。サーバーはサーバー側で R2 からファイルをフェッチし、Claude Code の約 256 KB シェル出力制限をバイパスし、ほとんどの実際のファイルでインライン base64 を実用的にしません。

**X-MCP-Key ヘッダーとは何ですか？**

X-MCP-Key は、Cloudflare Worker (パブリック ゲートウェイ) と GCP Cloud Run バックエンド間のリクエストを認証するために使用される共有シークレットです。すべてのトラフィックが Worker のみを通じて Cloud Run に到達し、直接インターネットからではないことを確認します — これなしでは、Cloud Run URL を発見した人は OAuth 検証およびクォータ実施をバイパスできます。

**MCP サーバーを実行するためにバックエンド コードをパブリックにする必要がありますか？**

いいえ。MCP ラッパー(Cloudflare Worker)のみがパブリック リポジトリである必要があります — API サーフェスを定義し、コミュニティが統合を検査できます。実際のビジネス ロジックが存在する Cloud Run バックエンドはプライベートのままです。これにより、開発者がプロプライエタリなアルゴリズムと実装の詳細をプライベート リポジトリに保ちながら、オープン MCP 統合を出版できます。
