---
title: "在 GCP Cloud Run 上部署容器化 API 完整教學"
description: "從 Docker 安裝到一鍵部署 pipeline，完整說明 Artifact Registry 和 Cloud Run 的設定流程，讓你的 API 在 GCP 上跑起來並能被正常調用。"
date: "2026-05-08"
readingTime: 19
tag: "tutorial"
---

你在本機做好了一個東西——一個能轉換圖片的腳本、一個跑某種運算的函式、一個做了某件有用事情的小程式。到了某個時間點，你想把它帶出筆電以外的地方：放到自己的網站上讓使用者直接用、把連結傳給朋友或同事、或是把它包裝成一個可以盈利的服務。當你希望任何人都能從任何地方——瀏覽器、手機 app、另一台伺服器——調用你的程式碼時，你需要的就是把它做成 API。

API（應用程式介面）把你的程式碼變成一個有穩定 URL 的服務。你不再需要把腳本傳給別人、叫他們自己架環境來執行；你執行一次，他們直接使用。這篇教學就是在建這件事。

讀完這篇教學，你會有一個運行在 GCP 上的容器化 API，可以透過公開 HTTPS URL 被調用，並且能用一個指令完成每次的部署。API 的功能由你決定——這篇涵蓋其他所有事：Docker 設定、Artifact Registry、Cloud Run 設定、環境變數、公開存取，以及部署後的驗證。

範例使用 Python（FastAPI + uvicorn），但 GCP 側的步驟適用於任何可以容器化的語言或框架。

---

## 整體流程概覽

在開始動手之前，先看清楚你在建什麼：

```
本機                                  GCP
──────────────────────────────────────────────────────────
                                      ┌───────────────────┐
1. 撰寫 Dockerfile                    │  Artifact         │
2. docker build ───── docker push ──▶│  Registry         │
3. docker run   (本機測試)             │  (映像儲存庫)      │
                                      └─────────┬─────────┘
                                                │ 拉取映像
                                                ▼
                                      ┌───────────────────┐
                                      │   Cloud Run       │
                                      │   (受管容器        │
                                      │    執行環境)       │
                                      └─────────┬─────────┘
                                                │
                                                ▼
                                      https://your-service-xxxx.run.app
                                      (公開 HTTPS API 端點)
```

**Artifact Registry** 儲存你的 Docker 映像——它是 GCP 專案內建的私有映像庫。**Cloud Run** 是受管容器執行環境，負責拉取映像、執行容器、處理 HTTPS 終止和自動擴縮，並對外暴露穩定的 URL。

其他服務——Cloud Build、Cloud Storage、GKE——全部是可選的。最小可行架構就是這兩個服務。

---

## 建立 GCP 專案

在做任何事之前，你需要一個 GCP 專案。專案是你所有 GCP 資源的容器——billing、API、IAM 權限和服務都以專案為範圍。

### 安裝並驗證 gcloud CLI

安裝 [Google Cloud CLI](https://cloud.google.com/sdk/docs/install)，然後登入：

```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
```

設定 Docker 使用 Artifact Registry 的認證（每台機器只需執行一次）：

```bash
gcloud auth configure-docker us-central1-docker.pkg.dev
```

這個指令會將 credential helper 寫入 `~/.docker/config.json`，之後開新終端機仍然有效。

### 建立專案

前往 [Google Cloud Console](https://console.cloud.google.com)，點選頂部的專案選擇器，然後點 **New Project**。給它一個名稱，記下 Project ID——下面所有的 CLI 指令都會用到它。

或透過 CLI：

```bash
gcloud projects create YOUR_PROJECT_ID --name="My API Project"
gcloud config set project YOUR_PROJECT_ID
```

### 啟用計費帳戶

Cloud Run 和 Artifact Registry 需要在專案上綁定計費帳戶才能使用——即使你的用量在免費額度內也一樣。GCP 用計費帳戶識別誰應該負責費用，不是立刻向你收費。

在 Console：**Billing** → **Link a billing account** → 選取或建立計費帳戶。

### 啟用所需的 API

GCP 服務預設是停用的。啟用這篇教學會用到的兩個服務：

```bash
gcloud services enable artifactregistry.googleapis.com run.googleapis.com
```

這大約需要 30 秒，每個專案只需要做一次。

### IAM 權限

如果你是專案擁有者——也就是建立這個專案的帳號——你已經有完整的權限，可以跳過這個小節。

如果你要從 CI/CD pipeline 部署，或想遵循最小權限原則，建立一個只有所需角色的專用服務帳號：

| 角色 | 允許的操作 |
|------|----------|
| `roles/artifactregistry.writer` | 推送映像到 Artifact Registry |
| `roles/run.developer` | 部署和管理 Cloud Run 服務 |

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

個人從自己的機器部署時，帳號的 owner 權限已足夠——不需要建立服務帳號。

---

## 前置準備：Docker 安裝與設定

### Docker 是什麼，為什麼要用它？

Docker 是一個容器化平台。**容器**把你的應用程式碼、執行環境、依賴套件和設定，打包成一個可攜帶的單元，在任何地方都以完全相同的方式運行。

不用容器化的話，把程式碼部署到遠端伺服器意味著你要確保那台伺服器有完全正確的 Python 版本、完全符合 `requirements.txt` 的套件、一樣的環境變數、一樣的目錄結構。這很脆弱——本機和生產環境之間的細微差異會產生難以重現、更難診斷的 bug。

容器徹底消除了這類問題。你在 **Dockerfile** 裡定義一次環境，建置成**映像（image）**，這個映像在你的筆電、在 GCP、在任何有 Docker 的機器上的運行方式完全一樣。

**這篇教學會一直用到的兩個術語：**

- **映像（Image）** — 描述檔案系統和啟動指令的唯讀藍圖。建置完成後不可更改。把它想成一個快照。
- **容器（Container）** — 映像的一個執行中實例。Cloud Run 收到請求時，會從你的映像啟動一個容器來處理它。請求結束後，容器可能保持暖機狀態等待下一個請求，也可能被關閉。

你在本機建置映像，推送到 Artifact Registry（你在 GCP 上的映像儲存庫），Cloud Run 從那裡拉取並執行它。

### 安裝 Docker Desktop

前往 [docker.com](https://www.docker.com/products/docker-desktop/) 下載並安裝 Docker Desktop。安裝後啟動 Docker Desktop，等待選單列的鯨魚圖示停止動畫——代表 daemon 已在執行中。

確認安裝：

```bash
docker --version
# Docker version 27.x.x, build ...

docker info
# 應顯示系統資訊，沒有錯誤訊息
# 如果看到「Cannot connect to the Docker daemon」——Docker Desktop 尚未啟動
```

---

## 你需要的兩個服務

GCP 的服務目錄非常龐大。這篇教學只用到兩個。

**Artifact Registry** 儲存 Docker 映像——可以把它想成住在你 GCP 專案裡的私有 Docker Hub。Cloud Run 在部署時從這裡拉取映像。

**Cloud Run** 是受管容器執行環境。它自動處理 HTTPS 終止、自動擴縮、健康檢查和部署回滾。你提供映像和參數，它負責執行容器並暴露穩定的 URL。

---

## 免費用量與使用限制

兩個服務都有永久的免費方案——不只是試用額度。

| 服務 | 免費額度 | 超過後的費率 |
|------|---------|------------|
| Artifact Registry | 每月 0.5 GB 儲存 | $0.10/GB/月 |
| Cloud Run | 每月 200 萬次請求 | 每百萬次 $0.40 |
| Cloud Run | 每月 360,000 GB 秒記憶體 | $0.00000250/GB 秒 |
| Cloud Run | 每月 180,000 vCPU 秒 | $0.00001000/vCPU 秒 |
| Cloud Run | 每月 1 GB 網路輸出（北美） | $0.12/GB |

低到中等流量的 API（每月數萬次請求）通常都在 Cloud Run 免費額度內。Artifact Registry 的費用取決於你保留多少個映像版本——請參閱下方的清理策略說明。

---

## 一次性設定：Artifact Registry

在任何部署發生之前，你需要在 Artifact Registry 裡建立一個儲存庫。這只需要做一次：

```bash
gcloud artifacts repositories create my-service \
  --repository-format=docker \
  --location=us-central1 \
  --project=YOUR_PROJECT_ID \
  --description="Container images for my-service"
```

建立後，你的映像名稱格式如下：

```
us-central1-docker.pkg.dev/YOUR_PROJECT_ID/my-service/my-service:latest
```

### 清理策略

Artifact Registry 依儲存量收費。沒有清理策略的話，舊版映像層會無聲地累積。套用一個保留最新三個版本、刪除超過 30 天的策略：

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

`--no-dry-run` 是必要的——沒有這個 flag，策略只會被評估，不會實際套用。

---

## 定義你的 API 端點

Cloud Run 執行你的容器——它不知道你的應用程式在做什麼。你的應用程式定義路由，Cloud Run 透過 service URL 把它們對外暴露。

部署完成後，你定義的每個端點都可以透過以下格式存取：

```
https://{your-service-url}/{endpoint-path}
```

舉例來說，如果你的 Cloud Run service URL 是 `https://my-service-abc123-uc.a.run.app`，你定義了一個 `/convert` 路由，那麼它的完整 URL 就是 `https://my-service-abc123-uc.a.run.app/convert`。

### 健康檢查端點為什麼重要

健康檢查端點是一個專用路由——通常是 `/health`——立即回傳 `200 OK`，沒有任何副作用。Cloud Run 用它來確認容器是否正確啟動，監控工具用它來偵測服務中斷，你的部署後驗證腳本每次部署後第一個呼叫它。

沒有 `/health` 路由的話，確認服務部署後是否正常的唯一方法就是呼叫一個真正的功能端點，然後祈禱它運作正常——這是一個很脆弱的替代方案。

### 最小可用的 Flask 範例

以下是一個包含健康檢查和一個功能端點的最小 Flask 應用程式：

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

部署後，兩個路由都可以透過 service URL 存取：

| 路由 | 完整 URL |
|------|---------|
| `/health` | `https://your-service-url/health` |
| `/process` | `https://your-service-url/process` |

### Flask vs FastAPI 在 Dockerfile 的差異

你選擇的框架會影響 Dockerfile 的 `CMD` 那行。Flask 使用 **gunicorn**（生產等級的 WSGI 伺服器）；FastAPI 使用 **uvicorn**：

```dockerfile
# Flask + gunicorn
CMD ["gunicorn", "--bind", "0.0.0.0:8080", "--workers", "1", "app.main:app"]

# FastAPI + uvicorn
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
```

Dockerfile 的其他部分——基礎映像、port、工作目錄——不管用哪個框架都一樣。

---

## Dockerfile

Cloud Run 能執行任何監聽 port `8080` 並在收到 `SIGTERM` 時乾淨退出的容器。一個最小可用於生產環境的 Python API Dockerfile：

```dockerfile
FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ ./app/

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
```

三個重點說明：

- **`python:3.12-slim`** 省略了編譯器、測試工具和說明文件。更小的映像意味著部署時更快的拉取速度和更低的 Artifact Registry 儲存費用。
- **`--no-cache-dir`** 防止 pip 將下載快取寫入映像層。快取在執行中的容器裡永遠不會被重用，留著只是浪費空間。
- **Port `8080` 是強制要求。** Cloud Run 將所有流量路由到這個 port。Host 必須是 `0.0.0.0`——不能是 `localhost` 或 `127.0.0.1`——否則 Cloud Run 的健康檢查會無聲地失敗。

---

## 推送前先在本機測試

在推送到 GCP 之前，先確認容器在本機能正常運作。推上去一個壞掉的映像只是在浪費時間和儲存費用。

建置映像：

```bash
docker build --platform linux/amd64 -t my-service:local .
```

如果你用 Apple Silicon Mac 開發，`--platform linux/amd64` 是關鍵。沒有這個 flag，Docker 會建置 `arm64` 映像，而 Cloud Run 的底層硬體是 `amd64`——它會無聲地拒絕錯誤架構的映像。這個 flag 強制進行跨平台建置。

在本機執行容器：

```bash
docker run --rm -p 8080:8080 \
  -e API_KEY=your-dev-key \
  my-service:local
```

`-p 8080:8080` 將容器內的 port 8080 映射到本機的 port 8080。`-e` 傳入環境變數。

測試它：

```bash
curl http://localhost:8080/health
# 預期回應：{"status": "ok"}
```

健康檢查通過代表容器正常啟動且伺服器在監聽。繼續之前先用 `Ctrl+C` 停止它。

---

## 部署 Pipeline

每次發布都要執行 build → push → deploy 這個流程。拆成三個可組合的腳本，讓每個步驟可以獨立測試：

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

**`scripts/release.sh`** — 串接三個腳本：

```bash
#!/usr/bin/env bash
set -euo pipefail
bash scripts/build.sh && bash scripts/push.sh && bash scripts/deploy.sh
```

完成後，`bash scripts/release.sh` 就是你每次發布新版本唯一需要執行的指令。

---

## Cloud Run 設定：每個參數的說明

| 參數 | 值 | 說明 |
|------|---|------|
| `--memory` | `512Mi` | 大多數圖片處理和運算型 API 在 512 MiB 內都夠用。觀察 Cloud Run 的記憶體指標再決定是否需要調整。 |
| `--cpu` | `1` | 每個 instance 一個 vCPU。CPU 只在處理請求時分配——沒有閒置計費。 |
| `--concurrency` | `1` | 每個 instance 同時只處理一個請求。適合 CPU 密集型工作，多個請求在同一個 instance 上會互相搶佔 CPU、彼此降速。I/O 密集型服務可以調高到 10–80。 |
| `--max-instances` | `100` | 限制並發 instance 數量。防止流量激增或攻擊導致無限擴縮。根據可接受的最壞情況成本設定，而不是預期流量。 |
| `--timeout` | `60` | 請求逾時秒數。處理超時時 Cloud Run 會中止請求並回傳 504。根據最慢的預期操作加上餘裕來設定。 |
| `--allow-unauthenticated` | — | 讓 URL 可以公開存取。下一節有重要的 IAM 注意事項。 |

**`--concurrency 1` 的實際含義。** 設為 1 時，每個進行中的請求都有自己的 instance。兩個請求同時到達時，Cloud Run 會啟動第二個 instance，而不是把第二個請求排在第一個後面等。對於 CPU 密集型工作（圖片處理、檔案轉換、模型推論），這是正確的模式。

**記憶體規格需要提前規劃。** 如果容器超過設定的記憶體限制，Cloud Run 會 OOM kill 你的容器。部署前先估算峰值記憶體用量：如果 API 在啟動時載入 200 MB 的模型，`512Mi` 是不夠的——從 `1Gi` 開始。觀察 Cloud Run 的記憶體指標後再調整。

---

## 縮容至零：冷啟動的取捨

Cloud Run 的預設行為——也是它最大的成本優勢——是**縮容至零**：沒有請求時，所有 instance 關閉，閒置期間完全不計費。

代價是**冷啟動延遲**：請求在閒置一段時間後抵達時，Cloud Run 必須先啟動一個新容器才能回應。對於有典型依賴套件的 Python API，這大約需要 2–5 秒。

| 設定 | 行為 | 費用 |
|------|------|------|
| `--min-instances 0`（預設） | 縮容至零；閒置後的首個請求有冷啟動 | 閒置時零費用 |
| `--min-instances 1` | 始終保持一個 instance；沒有冷啟動 | 512Mi/1 vCPU 約 $10–15/月 |

流量不可預測或突發性、偶爾的 2–5 秒等待對使用者可接受、或開發初期想要接近零成本時，用 `--min-instances 0`。

服務面向使用者且首次請求延遲明顯不可接受、或有延遲 SLA 時，用 `--min-instances 1`。

---

## 環境變數與 Secrets

Cloud Run 在啟動時透過 `--set-env-vars` 將環境變數傳入容器：

```bash
gcloud run deploy my-service \
  --set-env-vars "API_KEY=abc123,DB_URL=postgres://..."
```

對於開發環境使用 `.env` 檔案的服務，部署腳本可以自動讀取該檔案並建構 `--set-env-vars` 字串：

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

這讓 secrets 不進入版本庫，同時保持部署的可重複性。

**注意：** 如果某個值包含逗號，`--set-env-vars` 會無聲地將它拆成兩個變數。用引號包住值，或將那個 secret 遷移到 [Google Secret Manager](https://cloud.google.com/secret-manager) 並使用 `--set-secrets`。*（Secret Manager 完整使用指南即將推出。）*

---

## 公開存取與認證

### IAM 組織政策的注意事項

部署腳本裡的 `--allow-unauthenticated` 並不總是足夠。許多 GCP 組織有 IAM 組織政策（`constraints/iam.allowedPolicyMemberTypes`），會阻擋透過 CLI 將 Cloud Run Invoker 角色授予 `allUsers`。

如果部署成功，但呼叫 URL 時收到 `403 Forbidden`，原因就在這裡。

**透過 Cloud Console 修復：**

1. 前往 **Cloud Run** → 選取你的服務
2. 點選 **Security** 標籤
3. 在「Authentication」下選擇 **Allow unauthenticated invocations**
4. 點選 **Save**

這個方法直接在服務資源上設定 IAM 政策，通常可以繞過 CLI 路徑上的組織級限制。

### 在 API 內部處理認證

大多數 API——即使是內部使用的——都需要 key-based 的存取控制。使用第三方閘道（例如 RapidAPI）的公開 Cloud Run 服務，常見的認證架構：

```
呼叫方 ──▶ 閘道 ──▶ Cloud Run
           注入         驗證
           X-RapidAPI-Proxy-Secret
```

| Header | 誰發送 | 證明什麼 |
|--------|--------|---------|
| `X-RapidAPI-Key` | API 呼叫方 | 有效的訂閱 |
| `X-RapidAPI-Proxy-Secret` | 閘道（自動注入） | 請求經過閘道轉發 |
| `X-Internal-Key` | 你（維運/測試） | 直接存取，繞過閘道 |

你的服務驗證 `X-RapidAPI-Proxy-Secret`，以確認請求是透過閘道傳入的。`X-Internal-Key` 是用於測試和健康檢查的獨立 secret，可以直接存取服務。

**不要把 `X-RapidAPI-Proxy-Secret` 當作呼叫方的憑證。** 它是閘道注入的，不是呼叫方使用的。把它當作呼叫憑證是常見的錯誤，會導致認證失敗，或把後端 secret 洩露到前端程式碼裡。

---

## 部署後驗證

每次部署後都應該驗證，確認完成才算完成。

**步驟一：健康檢查** — 確認容器啟動、伺服器在監聽：

```bash
curl https://your-service-url/health
# 預期：{"status": "ok"}
```

**步驟二：功能性 Smoke Test** — 確認服務能完整處理一個請求：

```bash
SECRET=$(grep INTERNAL_KEY .env | cut -d'=' -f2- | tr -d '"')

curl -X POST https://your-service-url/your-endpoint \
  -H "X-Internal-Key: $SECRET" \
  -F "file=@tests/sample.gif" \
  --output /tmp/smoke_output.png

file /tmp/smoke_output.png
```

直接從 `.env` 讀取 secret（而不是從 shell 環境變數讀取），確保在全新的終端機 session 裡也能正常執行。

---

## 常見錯誤快速參考

| 症狀 | 可能原因 | 修復方式 |
|------|---------|---------|
| Cloud Run 上出現 `exec format error` | 映像建置了錯誤的 CPU 架構 | 在 `docker build` 加上 `--platform linux/amd64` |
| 部署後健康檢查立即失敗 | 容器監聽了錯誤的 host 或 port | CMD 使用 `--host 0.0.0.0 --port 8080` |
| `docker push` 回傳 `unauthorized` | Docker 未向 Artifact Registry 認證 | 執行 `gcloud auth configure-docker us-central1-docker.pkg.dev` |
| 加了 `--allow-unauthenticated` 仍然 403 | 組織 IAM 政策阻擋 `allUsers` | 透過 Cloud Console 的 Security 標籤設定公開存取 |
| 部署成功但行為還是舊的 | Cloud Run 快取了舊的映像 digest | 強制重新部署：`gcloud run deploy ... --image ...:latest` |
| 冷啟動延遲無法接受 | 縮容至零加上較大的容器 | 設定 `--min-instances 1` 或縮小映像 |
| `--set-env-vars` 無聲地遺失一個值 | 值包含逗號 | 用引號包住，或遷移到 Secret Manager |
| 處理請求時容器被 kill | 超過記憶體限制（OOM） | 增加 `--memory`（試試 `1Gi` 或 `2Gi`） |

---

## 下一步

這篇教學涵蓋了基本功。自然的下一步：

- *（[在 GCP 上用 CI/CD 自動化部署](/blog/gcp-cicd-cloud-run) — 即將推出）* — 每次推送到 main 分支時自動觸發 `release.sh`
- *（[使用 Google Secret Manager 管理 Secrets](/blog/gcp-secret-manager) — 即將推出）* — 生產環境 secrets 的稽核日誌、輪換和細粒度 IAM 存取控制
- *（[使用 Cloud Run Jobs 處理長時間任務](/blog/gcp-cloud-run-jobs) — 即將推出）* — 超過 60 秒的操作，Cloud Run Jobs 是正確的工具

---

## FAQ

**為什麼我的瀏覽器在 fetch API 時顯示 CORS 錯誤？**

有兩種根本不同的原因看起來一模一樣。第一，你的 API 可能沒有設定 CORS headers——伺服器必須在跨來源請求的回應中加上 `Access-Control-Allow-Origin` headers。第二，也更常見的情況是：API 根本沒有在運作——當 `fetch()` 完全無法聯繫伺服器（網路錯誤、冷啟動逾時、URL 錯誤），瀏覽器會把它回報為 CORS 錯誤，而不是連線錯誤。先在 DevTools 的 Network 標籤確認——如果請求完全沒有收到回應，問題是連線，不是 CORS headers。

**怎麼判斷是 CORS 問題還是 API 掛掉了？**

直接用終端機的 `curl` 呼叫端點。如果 `curl` 能正常收到回應，服務是活著的，問題是 CORS headers。如果 `curl` 也失敗（connection refused、逾時、404），服務無法存取——先修好部署，再處理 CORS。

**應該分配多少記憶體？**

估算你的峰值記憶體用量：Python/框架基礎開銷（約 50–100 MB）+ 啟動時載入的模型或資料 + 單一請求 payload 的最大大小。加上 30% 的餘裕後，往上取整到下一個 Cloud Run 規格（256Mi、512Mi、1Gi、2Gi、4Gi、8Gi）。從保守的值開始，觀察前幾天的 Cloud Run 記憶體使用指標——調高很容易，OOM kill 在日誌裡會立刻看到。

**我加了 `--allow-unauthenticated`，還是收到 403，為什麼？**

你的 GCP 組織很可能有 IAM 組織政策，限制透過 CLI 將角色授予 `allUsers`。`--allow-unauthenticated` 在部署時嘗試將 Cloud Run Invoker 角色授予 `allUsers`，這個動作被組織政策阻擋了。修復方式：前往 Cloud Console 的 Cloud Run → 你的服務 → Security 標籤 → 將 Authentication 設為「Allow unauthenticated invocations」並儲存。這個路徑通常可以繞過 CLI 層級的政策限制。

**我的 API 操作需要超過 5 分鐘，還能用 Cloud Run 嗎？**

Cloud Run 的最大請求逾時是 60 分鐘（透過 `--timeout` 設定），但對於超過 5–10 分鐘的操作，直接 API 的方式會變得很脆弱——客戶端逾時、連線中斷、重試造成重複執行。長時間運算的正確工具是 **Cloud Run Jobs**：立即回傳一個 job ID，讓客戶端輪詢完成狀態。Cloud Run Jobs 的完整教學即將推出。

**免費額度用完了會怎樣？**

Cloud Run 和 Artifact Registry 會自動切換到按量計費——不會中斷服務，也不會有通知。Cloud Run 依請求次數和資源使用秒數計費，所以零流量的服務就算超過免費額度也不會產生費用。建議在 GCP Billing Console 設定預算警報，在費用變高之前收到通知。

**可以用 8080 以外的 port 嗎？**

可以，在 `gcloud run deploy` 加上 `--port` flag 即可設定其他 port。但 `8080` 是預設值且被廣泛預期——除非有特定理由，否則不要更改。無論你在 Cloud Run 設定什麼 port，容器實際監聽的 port 必須與之相符。

**部署出問題了怎麼回滾？**

Cloud Run 保留版本歷史記錄。在 Console 進入你的服務 → Revisions 標籤 → 選取任一個先前的版本 → 點選「Manage Traffic」，將 100% 的流量指向它。回滾幾秒內生效，不需要重新建置。
