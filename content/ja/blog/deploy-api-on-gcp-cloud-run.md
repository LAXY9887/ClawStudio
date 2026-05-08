---
title: "コンテナ化したAPIをGCP Cloud Runにデプロイする"
description: "Artifact RegistryとCloud Runを使ってPython APIをGCPにデプロイするステップバイステップガイド — Dockerのセットアップからワンコマンドでリリースできるパイプラインまでを構築し、すべての設定パラメータを詳しく解説します。"
date: "2026-05-08"
readingTime: 19
tag: "tutorial"
---

ローカルマシンで動くものを作り上げた経験はあるでしょう — 画像を変換するスクリプト、計算を実行する関数、何か便利なことをする小さなプログラム。どこかの時点で、それをラップトップの外に持ち出したくなります。Webサイトで訪問者に使ってもらったり、友人や同僚にリンクを送ったり、課金できる形にパッケージ化したりするためです。ブラウザ、モバイルアプリ、別のサーバーなど、どこからでもコードを呼び出せるようにしたい場合、APIとして公開する必要があります。

API（Application Programming Interface）は、あなたのコードを安定したURLを持つサービスに変換します。スクリプトを共有して各自が実行環境を準備してもらう代わりに、あなたが一度動かしておけば、他の人はそれを使うだけです。これがこのガイドで作るものです。

このチュートリアルを終える頃には、GCP上でコンテナ化したAPIが動作し、公開されたHTTPS URLからアクセス可能で、コマンド一つでデプロイできるようになります。APIのロジックはあなた次第です — このガイドはその他すべてをカバーします：Dockerのセットアップ、Artifact Registry、Cloud Runの設定、環境変数、パブリックアクセス、デプロイ後の検証。

例ではPython（FastAPI + uvicorn）を使用していますが、GCP側の手順はコンテナで動作するあらゆる言語やフレームワークに適用できます。

---

## 全体像を把握する

ツールに触れる前に、これから作るものの全体像を把握しておきましょう。

```
ローカルマシン                        GCP
──────────────────────────────────────────────────────────
                                      ┌───────────────────┐
1. Dockerfileを書く                   │  Artifact         │
2. docker build ──────── docker push ▶│  Registry         │
3. docker run   (ローカルテスト)      │  (イメージ保存)   │
                                      └─────────┬─────────┘
                                                │ イメージをpull
                                                ▼
                                      ┌───────────────────┐
                                      │   Cloud Run       │
                                      │   (マネージド     │
                                      │    ランタイム)    │
                                      └─────────┬─────────┘
                                                │
                                                ▼
                                      https://your-service-xxxx.run.app
                                      (公開HTTPS APIエンドポイント)
```

**Artifact Registry**はDockerイメージを保存します — GCPプロジェクト内のプライベートなイメージレジストリです。**Cloud Run**はマネージドなコンテナランタイムで、イメージをpullして実行し、HTTPSの終端処理とスケーリングを自動的に行い、安定したURLで公開します。

その他のもの — Cloud Build、Cloud Storage、GKE — はオプションです。最小限の構成はこの2つのサービスだけです。

---

## GCPプロジェクトのセットアップ

まず最初に、GCPプロジェクトが必要です。プロジェクトはGCPリソースすべてのコンテナで、請求、API、IAMパーミッション、サービスはすべてプロジェクトにスコープされます。

### gcloud CLIのインストールと認証

[Google Cloud CLI](https://cloud.google.com/sdk/docs/install)をインストールし、認証します：

```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
```

DockerがArtifact Registryを使用できるよう認証します（マシンごとに一度だけ）：

```bash
gcloud auth configure-docker us-central1-docker.pkg.dev
```

これにより`~/.docker/config.json`に認証情報ヘルパーが書き込まれます。一度実行すればターミナルセッションをまたいで持続するため、再度実行する必要はありません。

### プロジェクトの作成

[Google Cloud Console](https://console.cloud.google.com)を開き、上部のプロジェクトセレクターをクリックして**新しいプロジェクト**を選択します。名前を付け、プロジェクトIDをメモしておきます — 以下のすべてのCLIコマンドで使用します。

CLIからも作成できます：

```bash
gcloud projects create YOUR_PROJECT_ID --name="My API Project"
gcloud config set project YOUR_PROJECT_ID
```

### 請求の有効化

Cloud RunとArtifact Registryは、使用する前にプロジェクトに請求アカウントを紐付ける必要があります — 無料枠内の使用量であっても同様です。GCPは請求アカウントを使って費用の責任者を識別しますが、即座に課金されるわけではありません。

コンソールで：**お支払い** → **請求アカウントをリンク** → 請求アカウントを選択または作成します。

### 必要なAPIの有効化

GCPのサービスはデフォルトで無効になっています。このチュートリアルで使用する2つのサービスを有効化します：

```bash
gcloud services enable artifactregistry.googleapis.com run.googleapis.com
```

これには約30秒かかり、プロジェクトごとに一度だけ実行が必要です。

### IAMパーミッション

プロジェクトのオーナー — プロジェクトを作成したアカウント — であれば、すでに全権限を持っているためこのセクションはスキップできます。

CI/CDパイプラインからデプロイする場合、または最小権限の原則に従いたい場合は、必要なロールのみを持つ専用サービスアカウントを作成します：

| ロール | 許可される操作 |
|------|---------------|
| `roles/artifactregistry.writer` | Artifact Registryへのイメージプッシュ |
| `roles/run.developer` | Cloud Runサービスのデプロイと管理 |

```bash
gcloud iam service-accounts create api-deployer \
  --display-name="API Deployer"

gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:api-deployer@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/artifactregistry.writer"

gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:api-deployer@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/run.developer"
```

個人の用途でご自身のマシンから使用する場合は、オーナー権限を持つユーザーアカウントで十分です — サービスアカウントは不要です。

---

## 前提条件：Dockerのセットアップ

### Dockerとは何か、なぜ使うのか

Dockerはコンテナ化プラットフォームです。**コンテナ**はアプリケーションコードをランタイム、依存関係、設定とともに1つのポータブルなユニットにパッケージ化し、どこでも同じように動作します。

コンテナ化なしでコードをリモートサーバーにデプロイするには、サーバーに正確なバージョンのPython、`requirements.txt`に記載された正確なパッケージ、同じ環境変数、ラップトップと同じディレクトリ構成があることを確認する必要があります。これは脆弱です — ローカルと本番環境の微妙な違いがバグを引き起こし、再現も診断も困難です。

コンテナはこの種の問題を解消します。**Dockerfile**に環境を一度定義し、**イメージ**としてビルドすれば、そのイメージはラップトップ上でも、GCP上でも、Dockerが動作するあらゆるマシンで同一の動作をします。

**このガイド全体で登場する2つの用語：**

- **イメージ** — ファイルシステムと起動コマンドを記述した読み取り専用の設計図。一度ビルドすると変更不可。スナップショットのようなものと考えてください。
- **コンテナ** — イメージの実行中インスタンス。Cloud Runはリクエストを受け取ると、イメージからコンテナを起動して処理します。リクエストが完了すると、コンテナは次のリクエストのためにウォーム状態で維持されるか、シャットダウンされます。

イメージをローカルでビルドし、Artifact Registry（GCP上のイメージストレージ）にプッシュすれば、Cloud RunはそこからイメージをpullしてRunします。

### Docker Desktopのインストール

[docker.com](https://www.docker.com/products/docker-desktop/)からDocker Desktopをダウンロードしてインストールします。インストール後、Docker Desktopを起動し、メニューバーのクジラアイコンのアニメーションが止まるまで待ちます — デーモンが起動している状態です。

インストールを確認します：

```bash
docker --version
# Docker version 27.x.x, build ...

docker info
# エラーなくシステム情報が表示されるはずです
# "Cannot connect to the Docker daemon" が表示された場合 — Docker Desktopが起動していません
```

---

## 必要な2つのサービス

GCPには膨大なカタログがあります。このチュートリアルでは正確に2つのサービスだけが必要です。

**Artifact Registry**はDockerイメージを保存します。GCPプロジェクト内に存在するプライベートなDocker Hubと考えてください。Cloud Runはデプロイ時にここからイメージをpullします。

**Cloud Run**はマネージドなコンテナランタイムです。HTTPSの終端処理、オートスケーリング、ヘルスチェック、デプロイのロールバックを処理します。イメージと一連のパラメータを提供するだけで、コンテナを実行して安定したURLで公開してくれます。

---

## 無料枠と使用制限

両サービスとも永続的な無料枠があります — 試用クレジットではありません。

| サービス | 無料枠 | 無料枠超過時 |
|---------|-----------|-----------------|
| Artifact Registry | 0.5 GBストレージ/月 | $0.10/GB/月 |
| Cloud Run | 200万リクエスト/月 | 100万リクエストあたり$0.40 |
| Cloud Run | 360,000 GB秒メモリ/月 | $0.00000250/GB秒 |
| Cloud Run | 180,000 vCPU秒/月 | $0.00001000/vCPU秒 |
| Cloud Run | 1 GBネットワーク送信（北米）/月 | $0.12/GB |

低〜中程度のトラフィックのAPI（月数万リクエスト）であれば、Cloud Runの無料枠内に収まるでしょう。Artifact Registryのコストは保持するイメージバージョンの数によります — 以下のクリーンアップポリシーのセクションを参照してください。

---

## 初回セットアップ：Artifact Registry

デプロイの前に、イメージを保存するためのArtifact Registry内のリポジトリが必要です。プロジェクトごとに一度だけ実行します：

```bash
gcloud artifacts repositories create my-service \
  --repository-format=docker \
  --location=us-central1 \
  --project=YOUR_PROJECT_ID \
  --description="Container images for my-service"
```

これ以降、イメージ名は以下のパターンになります：

```
us-central1-docker.pkg.dev/YOUR_PROJECT_ID/my-service/my-service:latest
```

### クリーンアップポリシー

Artifact Registryはストレージに課金されます。クリーンアップポリシーなしでは、古いイメージレイヤーが気づかないうちに蓄積されます。最新3バージョンを保持し、30日より古いものを削除するポリシーを適用します：

```bash
gcloud artifacts repositories set-cleanup-policies my-service \
  --location=us-central1 \
  --project=YOUR_PROJECT_ID \
  --policy=cleanup-policy.json \
  --no-dry-run
```

`cleanup-policy.json`：

```json
[
  {
    "name": "keep-latest-3",
    "action": {"type": "Keep"},
    "mostRecentVersions": {"keepCount": 3}
  },
  {
    "name": "delete-old",
    "action": {"type": "Delete"},
    "condition": {"olderThan": "30d"}
  }
]
```

`--no-dry-run`フラグが必要です — これなしではポリシーが評価されるだけで適用されません。

---

## APIエンドポイントの定義

Cloud Runはコンテナを実行します — アプリケーションが何をするかは一切知りません。アプリケーションがルートを定義し、Cloud RunはサービスURLを通じてそれらを公開します。

デプロイ後、定義したすべてのエンドポイントは以下でアクセス可能になります：

```
https://{your-service-url}/{endpoint-path}
```

例えば、Cloud RunサービスのURLが`https://my-service-abc123-uc.a.run.app`で、`/convert`ルートを定義した場合、`https://my-service-abc123-uc.a.run.app/convert`でアクセスできます。

### ヘルスチェックエンドポイントが重要な理由

ヘルスチェックエンドポイントは専用のルートです — 通常は`/health` — 副作用なしに即座に`200 OK`レスポンスを返します。Cloud Runはこれを使ってコンテナが正常に起動したことを確認します。監視ツールは障害を検出するために使用します。デプロイ後の検証スクリプトは、デプロイのたびに最初にこれを呼び出します。

`/health`ルートなしでは、デプロイ後にサービスが生きていることを確認する唯一の方法は実際のエンドポイントを呼び出してうまく動くことを祈るだけです — 脆弱な代替手段です。

### 最小限のFlaskの例

ヘルスチェックと1つの機能的なエンドポイントを持つ最小限のFlaskアプリケーションです：

```python
# app/main.py
from flask import Flask, jsonify, request

app = Flask(__name__)

@app.route("/health")
def health():
    return jsonify({"status": "ok"})

@app.route("/process", methods=["POST"])
def process():
    data = request.get_json()
    result = {"output": f"processed: {data.get('input', '')}"}
    return jsonify(result)
```

`requirements.txt`：

```
flask
gunicorn
```

デプロイ後、両方のルートがサービスURLからアクセス可能になります：

| ルート | 完全なURL |
|-------|----------|
| `/health` | `https://your-service-url/health` |
| `/process` | `https://your-service-url/process` |

### DockerfileにおけるFlask vs FastAPI

選択するフレームワークによってDockerfileの`CMD`行が変わります。Flaskは**gunicorn**（本番用WSGIサーバー）を使用し、FastAPIは**uvicorn**を使用します：

```dockerfile
# Flask + gunicorn
CMD ["gunicorn", "--bind", "0.0.0.0:8080", "--workers", "1", "app.main:app"]

# FastAPI + uvicorn
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
```

Dockerfile内のその他の部分 — ベースイメージ、ポート、作業ディレクトリ — はフレームワークに関係なく同じです。

---

## Dockerfile

Cloud Runはポート`8080`でリッスンし、`SIGTERM`でクリーンに終了するあらゆるコンテナを実行します。Python APIの最小限の本番対応Dockerfileです：

```dockerfile
FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ ./app/

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
```

注目すべき3点：

- **`python:3.12-slim`**はベースイメージからコンパイラ、テストツール、ドキュメントを除外します。イメージが小さくなるとデプロイ時のpullが速くなり、Artifact Registryのストレージコストも下がります。
- **`--no-cache-dir`**はpipのダウンロードキャッシュがイメージレイヤーに書き込まれるのを防ぎます。キャッシュは実行中のコンテナ内では再利用されないため、純粋な無駄です。
- **ポート`8080`は必須です。** Cloud Runはすべてのトラフィックをこのポートにルーティングします。ホストは`0.0.0.0`でなければなりません — `localhost`や`127.0.0.1`ではなく — さもなければCloud Runのヘルスチェックが暗黙的に失敗します。

---

## プッシュ前のローカルテスト

GCPにプッシュする前に、必ずコンテナがローカルで動作することを確認してください。壊れたイメージをArtifact Registryにプッシュすると時間とストレージが無駄になります。

イメージをビルドします：

```bash
docker build --platform linux/amd64 -t my-service:local .
```

Apple Silicon Macを使用している場合、`--platform linux/amd64`フラグは重要です。これなしでは、Dockerは`arm64`イメージをビルドします。Cloud Runの基盤となるハードウェアは`amd64`です — 誤ったアーキテクチャは暗黙的に拒否されます。このフラグはクロスプラットフォームビルドを強制します。

コンテナをローカルで実行します：

```bash
docker run --rm -p 8080:8080 \
  -e API_KEY=your-dev-key \
  my-service:local
```

`-p 8080:8080`フラグはコンテナ内のポート8080をマシンのポート8080にマッピングします。`-e`フラグは環境変数を渡します。

テストします：

```bash
curl http://localhost:8080/health
# 期待される結果: {"status": "ok"}
```

ヘルスチェックが通れば、コンテナは正常に起動しサーバーがリッスンしています。先に進む前に`Ctrl+C`で停止します。

---

## リリースパイプライン

ビルド → プッシュ → デプロイのシーケンスはリリースのたびに実行されます。各ステップを独立してテストできるよう、3つの組み合わせ可能なスクリプトに分割します：

**`scripts/build.sh`**

```bash
#!/usr/bin/env bash
set -euo pipefail

IMAGE="us-central1-docker.pkg.dev/YOUR_PROJECT_ID/my-service/my-service:latest"

docker build --platform linux/amd64 -t "$IMAGE" .
```

**`scripts/push.sh`**

```bash
#!/usr/bin/env bash
set -euo pipefail

IMAGE="us-central1-docker.pkg.dev/YOUR_PROJECT_ID/my-service/my-service:latest"

gcloud auth configure-docker us-central1-docker.pkg.dev --quiet
docker push "$IMAGE"
```

**`scripts/deploy.sh`**

```bash
#!/usr/bin/env bash
set -euo pipefail

gcloud run deploy my-service \
  --image "us-central1-docker.pkg.dev/YOUR_PROJECT_ID/my-service/my-service:latest" \
  --platform managed \
  --region us-central1 \
  --memory 512Mi \
  --cpu 1 \
  --concurrency 1 \
  --max-instances 100 \
  --timeout 60 \
  --allow-unauthenticated \
  --project=YOUR_PROJECT_ID
```

**`scripts/release.sh`** — 3つをまとめて実行：

```bash
#!/usr/bin/env bash
set -euo pipefail
bash scripts/build.sh && bash scripts/push.sh && bash scripts/deploy.sh
```

これ以降、`bash scripts/release.sh`が新しいバージョンをリリースするために必要な唯一のコマンドになります。

---

## Cloud Run設定：各パラメータの詳細解説

| パラメータ | 値 | 理由 |
|-----------|-------|-----------|
| `--memory` | `512Mi` | ほとんどの画像処理・計算APIは512 MiBに収まります。Cloud Runのメトリクスで不足を確認できます。 |
| `--cpu` | `1` | インスタンスあたり1 vCPU。CPUはリクエスト処理中のみ割り当てられます — アイドル時の課金はありません。 |
| `--concurrency` | `1` | 各インスタンスは1度に1つのリクエストを処理します。並行リクエストがCPUを競合して両方を低下させるCPUバウンドな処理に適しています。I/Oバウンドなサービスには10〜80に上げてください。 |
| `--max-instances` | `100` | 同時インスタンス数の上限。トラフィックスパイクや攻撃による際限ないスケーリングを防ぎます。予想トラフィックではなく、許容できる最悪コストに基づいて設定します。 |
| `--timeout` | `60` | リクエストタイムアウト（秒）。処理がこの時間を超えるとCloud Runはリクエストを終了し504を返します。最も遅い予想処理に余裕を持たせて設定します。 |
| `--allow-unauthenticated` | — | URLを公開アクセス可能にします。IAMの注意点については次のセクションを参照してください。 |

**`--concurrency 1`が実際に意味すること。** 並行性を1に設定すると、各アクティブなリクエストは独自のインスタンスを取得します。2つのリクエストが同時に到達した場合、Cloud Runは2番目のリクエストをキューに入れるのではなく、2番目のインスタンスを起動します。画像処理、ファイル変換、モデル推論などのCPUバウンドな処理では、これが正しいモデルです。リクエストキューの深さではなく、インスタンス数で水平スケールします。

**メモリのサイジングは事前に重要です。** 設定されたメモリ制限を超えると、Cloud RunはコンテナをOOMキルします。デプロイ前にピークメモリ使用量を見積もってください：APIが200 MBのモデルをメモリにロードする場合、`512Mi`では不足します — `1Gi`から始めてください。Cloud Runのメモリメトリクスを観察した後でリサイズします。

---

## ゼロへのスケール：コールドスタートのトレードオフ

Cloud Runのデフォルト動作 — そしてコスト面での主な利点 — は**ゼロへのスケール**です：アクティブなリクエストがない場合、すべてのインスタンスがシャットダウンされ、何も課金されません。

トレードオフは**コールドスタートのレイテンシ**です：非アクティブ期間後にリクエストが到達すると、Cloud Runはレスポンスを返す前に新しいコンテナを起動しなければなりません。典型的な依存関係を持つPython APIでは、これに2〜5秒かかります。

| 設定 | 動作 | コスト |
|---------|----------|------|
| `--min-instances 0`（デフォルト） | ゼロへスケール；アイドル後のコールドスタートあり | アイドル時はゼロ |
| `--min-instances 1` | 常に1インスタンス稼働；コールドスタートなし | 512Mi/1 vCPUで月約$10〜15 |

トラフィックが予測不可能または断続的な場合、コールドスタートがユーザーに許容される場合、または初期開発中にほぼゼロのコストを望む場合は`--min-instances 0`を使用します。

サービスがユーザー向けで2〜5秒の初回リクエスト遅延が目に見えて許容できない場合、またはレイテンシSLAがある場合は`--min-instances 1`を使用します。

---

## 環境変数とシークレット

Cloud Runは`--set-env-vars`を通じてスタートアップ時に環境変数をコンテナに渡します：

```bash
gcloud run deploy my-service \
  --set-env-vars "API_KEY=abc123,DB_URL=postgres://..."
```

開発中にローカルの`.env`ファイルを使用するサービスの場合、デプロイスクリプトはそのファイルを読み込んで`--set-env-vars`文字列を自動的に構築できます：

```bash
ENV_VARS=""
while IFS= read -r line || [[ -n "$line" ]]; do
  [[ -z "$line" || "$line" == \#* ]] && continue
  key="${line%%=*}"
  val="${line#*=}"
  val="${val#\"}" val="${val%\"}"
  val="${val#\'}" val="${val%\'}"
  ENV_VARS="${ENV_VARS:+$ENV_VARS,}${key}=${val}"
done < .env

gcloud run deploy my-service --set-env-vars "$ENV_VARS" ...
```

これにより、シークレットをリポジトリから外しつつ、デプロイを再現可能に保てます。

**注意：** 値にカンマが含まれる場合、`--set-env-vars`は暗黙的に2つの変数に分割します。値をクォートで囲むか、`--set-secrets`を使って[Google Secret Manager](https://cloud.google.com/secret-manager)にそのシークレットを移行してください。*（Secret Managerの詳細ガイドは近日公開予定です。）*

---

## パブリックアクセスと認証

### IAM組織ポリシーの注意点

デプロイスクリプトの`--allow-unauthenticated`は常に十分とは限りません。多くのGCP組織では、組織ポリシー（`constraints/iam.allowedPolicyMemberTypes`）が`allUsers`へのIAMロール付与をブロックしています — Cloud Run Invokerロールも含まれます。

デプロイが成功したのにURLを呼び出すと`403 Forbidden`が返ってくる場合、これが原因です。

**Cloud Consoleから修正する：**

1. **Cloud Run** → サービスを選択します
2. **セキュリティ**タブをクリックします
3. 「認証」の下で**未認証の呼び出しを許可**を選択します
4. **保存**をクリックします

これはデプロイコマンド経由ではなく、サービスリソースに直接IAMポリシーを設定するため、CLIパスでの組織レベルの制限を通常バイパスできます。

### APIでの認証処理

ほとんどのAPI — 内部向けでも — はキーベースのアクセス制御が必要です。サードパーティゲートウェイ（RapidAPIなど）を持つパブリックCloud Runサービスの一般的なパターン：

```
呼び出し元 ──▶ ゲートウェイ ──▶ Cloud Run
               注入する          検証する
               X-RapidAPI-Proxy-Secret
```

| ヘッダー | 送信者 | 何を証明するか |
|--------|-------------|----------------|
| `X-RapidAPI-Key` | API呼び出し元 | 有効なサブスクリプション |
| `X-RapidAPI-Proxy-Secret` | ゲートウェイ（注入） | リクエストがゲートウェイを経由したこと |
| `X-Internal-Key` | あなた（運用/テスト） | ゲートウェイをバイパスした直接アクセス |

サービスは`X-RapidAPI-Proxy-Secret`を検証してリクエストがゲートウェイを通過したことを確認します。`X-Internal-Key`はテストやヘルスチェック中の直接アクセスのための別のシークレットです。

**`X-RapidAPI-Proxy-Secret`を呼び出し元の認証情報として使用しないでください。** これはゲートウェイによって注入されるものであり、呼び出し元が使用するものではありません。これを呼び出し元のキーとして扱うのはよくある間違いで、認証に失敗するか、バックエンドのシークレットがクライアント側のコードに漏洩します。

---

## デプロイ後の検証

すべてのデプロイは完了とみなす前に検証すべきです。

**ステップ1：ヘルスチェック** — コンテナが起動しサーバーがリッスンしていることを確認：

```bash
curl https://your-service-url/health
# 期待される結果: {"status": "ok"}
```

**ステップ2：機能スモークテスト** — サービスがエンドツーエンドでリクエストを処理することを確認：

```bash
SECRET=$(grep INTERNAL_KEY .env | cut -d'=' -f2- | tr -d '"')

curl -X POST https://your-service-url/your-endpoint \
  -H "X-Internal-Key: $SECRET" \
  -F "file=@tests/sample.gif" \
  --output /tmp/smoke_output.png

file /tmp/smoke_output.png
```

`.env`から直接シークレットを読み取ること（シェル環境からではなく）で、新しいターミナルセッションでもテストが動作することを保証します。

---

## クイックリファレンス：よくあるエラー

| 症状 | 考えられる原因 | 修正方法 |
|---------|-------------|-----|
| Cloud Runで`exec format error` | 誤ったCPUアーキテクチャ向けにイメージがビルドされた | `docker build`に`--platform linux/amd64`を追加する |
| デプロイ直後にヘルスチェックが失敗する | コンテナが誤ったホストまたはポートでリッスンしている | CMDで`--host 0.0.0.0 --port 8080`を使用する |
| `docker push`が`unauthorized`を返す | DockerがArtifact Registryに認証されていない | `gcloud auth configure-docker us-central1-docker.pkg.dev`を実行する |
| `--allow-unauthenticated`でデプロイ後に403 | 組織IAMポリシーが`allUsers`をブロックしている | Cloud Console（セキュリティタブ）からパブリックアクセスを設定する |
| デプロイ成功したが古い動作が続く | Cloud Runが古いイメージダイジェストをキャッシュしている | 強制再デプロイ：`gcloud run deploy ... --image ...:latest` |
| コールドスタートのレイテンシが許容できない | 大きなコンテナでゼロへスケールしている | `--min-instances 1`を設定するかイメージサイズを削減する |
| `--set-env-vars`が値を暗黙的にドロップする | 値にカンマが含まれる | クォートで囲むかSecret Managerに移行する |
| リクエスト処理中にコンテナが終了する | メモリ制限超過（OOM） | `--memory`を増加する（`1Gi`または`2Gi`を試す） |

---

## APIリファレンス（AIエージェント向け）

このガイドで定義したAPIエンドポイントのサンプル仕様です（機械可読形式）。実際のエンドポイントパスとリクエスト/レスポンスの形式はアプリケーションによって決まります — 以下のプレースホルダーを実際のルートに置き換えてください。

```json
{
  "baseUrl": "https://YOUR_SERVICE_URL.run.app",
  "authentication": {
    "type": "header",
    "header": "X-Internal-Key",
    "description": "Shared secret for direct access. Set as Cloud Run environment variable INTERNAL_KEY."
  },
  "endpoints": [
    {
      "name": "health_check",
      "method": "GET",
      "path": "/health",
      "description": "Liveness check. Returns 200 OK when the service is running. No authentication required.",
      "response": {
        "200": { "status": "ok" }
      }
    },
    {
      "name": "process",
      "method": "POST",
      "path": "/process",
      "description": "Main processing endpoint. Replace with your actual route and payload shape.",
      "requestBody": {
        "content-type": "application/json",
        "schema": {
          "type": "object",
          "properties": {
            "input": { "type": "string", "description": "Input data for processing" }
          },
          "required": ["input"]
        }
      },
      "response": {
        "200": {
          "output": "string — processing result"
        },
        "504": "Request exceeded --timeout limit. Increase timeout or break operation into smaller steps."
      }
    }
  ],
  "cloudRunConfig": {
    "memory": "512Mi",
    "cpu": 1,
    "concurrency": 1,
    "maxInstances": 100,
    "timeout": 60,
    "region": "us-central1"
  }
}
```

---

## 次のステップ

このガイドでは基礎をカバーしました。次の自然なステップは：

- *([CI/CDによるGCPでのデプロイ自動化](/blog/gcp-cicd-cloud-run) — 近日公開)* — gitのmainへのプッシュのたびに`release.sh`を自動でトリガーする
- *([Google Secret Managerによるシークレット管理](/blog/gcp-secret-manager) — 近日公開)* — 本番シークレットの監査ログ、ローテーション、きめ細かいIAMアクセス
- *([Cloud Run Jobsによる長時間実行ジョブ](/blog/gcp-cloud-run-jobs) — 近日公開)* — 60秒を超える処理には、Cloud Run Jobsが適切なツールです

---

## FAQ

**ブラウザでAPIをfetchするとCORSエラーが表示されます。なぜですか？**

ブラウザで見た目が同じに見える2つの原因があります。まず、APIにCORSヘッダーが設定されていない可能性があります — クロスオリジンリクエストにはサーバーが`Access-Control-Allow-Origin`ヘッダーで応答する必要があります。次に、より一般的なケースとして、APIがまったく動いていない場合：`fetch()`呼び出しがサーバーに全く届かない場合（ネットワークエラー、コールドスタートのタイムアウト、誤ったURL）、ブラウザは接続エラーではなくCORSエラーとして報告します。まずDevToolsのNetworkタブを確認してください — リクエストがレスポンスを受け取らない場合、問題はCORSヘッダーではなく接続性です。

**CORSの問題なのか、それともAPIが落ちているのかを判断するにはどうすればよいですか？**

ターミナルから`curl`で直接エンドポイントを呼び出してください。`curl`が有効なレスポンスを返す場合、サービスは動いていてCORSヘッダーの問題です。`curl`も失敗する場合（接続拒否、タイムアウト、404）、サービスに到達できていません — まずデプロイを修正してからCORSに対処してください。

**メモリはどれくらい割り当てるべきですか？**

ピーク時のメモリ使用量を見積もります：Pythonやフレームワークのベースオーバーヘッド（約50〜100 MB）、スタートアップ時にロードするモデルやデータ、単一リクエストペイロードの最大サイズを合計します。30%のヘッドルームを加え、次のCloud Runティア（256Mi、512Mi、1Gi、2Gi、4Gi、8Gi）に切り上げます。控えめに始め、最初の数日間でCloud Runのメモリ使用率メトリクスを観察してください — 増加は簡単で、OOMキルはログにすぐ表示されます。

**`--allow-unauthenticated`を追加したのにまだ403になります。なぜですか？**

GCP組織がCLI経由で`allUsers`にロールを付与することを制限するIAM組織ポリシーを持っている可能性が高いです。`--allow-unauthenticated`フラグはデプロイ時に`allUsers`にCloud Run Invokerロールを付与しようとしますが、組織ポリシーがそれをブロックします。Cloud RunのConsole → サービス → セキュリティタブ → 認証を「未認証の呼び出しを許可」に設定して保存することで修正できます。このルートは通常、CLIレベルのポリシー制限をバイパスします。

**APIの処理に5分以上かかります。それでもCloud Runを使えますか？**

Cloud Runの最大リクエストタイムアウトは60分（`--timeout`で設定）ですが、5〜10分を超える処理では直接APIのアプローチが脆弱になります — クライアントがタイムアウトし、接続が切れ、リトライが重複した処理を引き起こします。長時間実行の計算には、代わりに**Cloud Run Jobs**を使用してください：作業をサブミットし、すぐにジョブIDを返し、クライアントが完了をポーリングします。Cloud Run Jobsのガイドは近日公開予定です。

**無料枠が使い切れたらどうなりますか？**

Cloud RunとArtifact Registryは自動的に従量課金制の請求に切り替わります — サービスの中断や通知はありません。Cloud Runの請求はリクエストごとおよびリソース秒ごとなので、トラフィックがゼロのサービスは無料枠を使い切っても何も課金されません。コストが大きくなる前に通知を受けるよう、GCP Billingコンソールで予算アラートを設定してください。

**ポート8080以外のポートを使えますか？**

`gcloud run deploy`の`--port`フラグを使ってCloud Runを別のポートを使うよう設定できます。ただし、`8080`はデフォルトで広く期待されているポートです — 特定の理由がない限り変更しないでください。Cloud Runで設定するポートは、コンテナが実際にリッスンするポートと一致している必要があります。

**不具合のあるデプロイをロールバックするにはどうすればよいですか？**

Cloud Runはリビジョン履歴を保持しています。Consoleでサービス → Revisionsタブ → 任意の以前のリビジョンを選択 → 「トラフィックの管理」をクリックしてトラフィックの100%をそこに送ります。ロールバックは数秒で反映され、リビルドは必要ありません。
