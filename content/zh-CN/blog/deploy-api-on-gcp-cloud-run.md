---
title: "在 GCP Cloud Run 上部署容器化 API 完整教程"
description: "从 Docker 安装到一键部署 pipeline，完整讲解 Artifact Registry 和 Cloud Run 的配置流程，让你的 API 在 GCP 上运行起来并能被正常调用——每个配置参数都有详细说明。"
date: "2026-05-08"
readingTime: 19
tag: "tutorial"
---

你在本机做好了一个东西——一个能转换图片的脚本、一个跑某种运算的函数、一个做了某件有用事情的小程序。到了某个时间点，你想把它带出笔记本电脑以外的地方：放到自己的网站上让用户直接用、把链接发给朋友或同事、或是把它包装成一个可以盈利的服务。当你希望任何人都能从任何地方——浏览器、手机 app、另一台服务器——调用你的代码时，你需要的就是把它做成 API。

API（Application Programming Interface，应用程序接口）把你的代码变成一个有稳定 URL 的服务。你不再需要把脚本传给别人、让他们自己搭环境来运行；你运行一次，他们直接使用。这篇教程就是在构建这件事。

读完这篇教程，你会有一个运行在 GCP 上的容器化 API，可以通过公开 HTTPS URL 被调用，并且能用一个命令完成每次的部署。API 的功能由你决定——这篇涵盖其他所有内容：Docker 配置、Artifact Registry、Cloud Run 配置、环境变量、公开访问，以及部署后的验证。

示例使用 Python（FastAPI + uvicorn），但 GCP 侧的步骤适用于任何可以容器化的语言或框架。

---

## 整体流程概览

在开始动手之前，先看清楚你在构建什么：

```
本机                                  GCP
──────────────────────────────────────────────────────────
                                      ┌───────────────────┐
1. 编写 Dockerfile                    │  Artifact         │
2. docker build ──────── docker push ▶│  Registry         │
3. docker run   (本机测试)             │  (镜像存储库)      │
                                      └─────────┬─────────┘
                                                │ 拉取镜像
                                                ▼
                                      ┌───────────────────┐
                                      │   Cloud Run       │
                                      │   (托管容器        │
                                      │    运行环境)       │
                                      └─────────┬─────────┘
                                                │
                                                ▼
                                      https://your-service-xxxx.run.app
                                      (公开 HTTPS API 端点)
```

**Artifact Registry** 存储你的 Docker 镜像——它是 GCP 项目内置的私有镜像仓库。**Cloud Run** 是托管容器运行环境，负责拉取镜像、运行容器、处理 HTTPS 终止和自动扩缩，并对外暴露稳定的 URL。

其他服务——Cloud Build、Cloud Storage、GKE——全部是可选的。最小可行架构就是这两个服务。

---

## 创建 GCP 项目

在做任何事之前，你需要一个 GCP 项目。项目是你所有 GCP 资源的容器——billing、API、IAM 权限和服务都以项目为范围。

### 安装并验证 gcloud CLI

安装 [Google Cloud CLI](https://cloud.google.com/sdk/docs/install)，然后登录：

```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
```

配置 Docker 使用 Artifact Registry 的认证（每台机器只需执行一次）：

```bash
gcloud auth configure-docker us-central1-docker.pkg.dev
```

这个命令会将 credential helper 写入 `~/.docker/config.json`，之后打开新终端仍然有效。

### 创建项目

前往 [Google Cloud Console](https://console.cloud.google.com)，点击顶部的项目选择器，然后点 **New Project**。给它一个名称，记下 Project ID——下面所有的 CLI 命令都会用到它。

或通过 CLI：

```bash
gcloud projects create YOUR_PROJECT_ID --name="My API Project"
gcloud config set project YOUR_PROJECT_ID
```

### 启用结算账号

Cloud Run 和 Artifact Registry 需要在项目上绑定结算账号才能使用——即使你的用量在免费额度内也一样。GCP 用结算账号识别谁应该负责费用，不是立刻向你收费。

在 Console：**Billing** → **Link a billing account** → 选取或创建结算账号。

### 启用所需的 API

GCP 服务默认是禁用的。启用这篇教程会用到的两个服务：

```bash
gcloud services enable artifactregistry.googleapis.com run.googleapis.com
```

这大约需要 30 秒，每个项目只需要做一次。

### IAM 权限

如果你是项目所有者——也就是创建这个项目的账号——你已经有完整的权限，可以跳过这个小节。

如果你要从 CI/CD pipeline 部署，或想遵循最小权限原则，创建一个只有所需角色的专用服务账号：

| 角色 | 允许的操作 |
|------|----------|
| `roles/artifactregistry.writer` | 推送镜像到 Artifact Registry |
| `roles/run.developer` | 部署和管理 Cloud Run 服务 |

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

个人从自己的机器部署时，账号的 owner 权限已足够——不需要创建服务账号。

---

## 前置准备：Docker 安装与配置

### Docker 是什么，为什么要用它？

Docker 是一个容器化平台。**容器**把你的应用代码、运行环境、依赖包和配置，打包成一个可携带的单元，在任何地方都以完全相同的方式运行。

不用容器化的话，把代码部署到远端服务器意味着你要确保那台服务器有完全正确的 Python 版本、完全符合 `requirements.txt` 的包、一样的环境变量、一样的目录结构。这很脆弱——本机和生产环境之间的细微差异会产生难以复现、更难诊断的 bug。

容器彻底消除了这类问题。你在 **Dockerfile** 里定义一次环境，构建成**镜像（image）**，这个镜像在你的笔记本、在 GCP、在任何有 Docker 的机器上的运行方式完全一样。

**这篇教程会一直用到的两个术语：**

- **镜像（Image）** — 描述文件系统和启动命令的只读蓝图。构建完成后不可更改。把它想成一个快照。
- **容器（Container）** — 镜像的一个运行中实例。Cloud Run 收到请求时，会从你的镜像启动一个容器来处理它。请求结束后，容器可能保持热机状态等待下一个请求，也可能被关闭。

你在本机构建镜像，推送到 Artifact Registry（你在 GCP 上的镜像存储库），Cloud Run 从那里拉取并运行它。

### 安装 Docker Desktop

前往 [docker.com](https://www.docker.com/products/docker-desktop/) 下载并安装 Docker Desktop。安装后启动 Docker Desktop，等待菜单栏的鲸鱼图标停止动画——代表 daemon 已在运行中。

确认安装：

```bash
docker --version
# Docker version 27.x.x, build ...

docker info
# 应显示系统信息，没有错误信息
# 如果看到「Cannot connect to the Docker daemon」——Docker Desktop 尚未启动
```

---

## 你需要的两个服务

GCP 的服务目录非常庞大。这篇教程只用到两个。

**Artifact Registry** 存储 Docker 镜像——可以把它想成住在你 GCP 项目里的私有 Docker Hub。Cloud Run 在部署时从这里拉取镜像。

**Cloud Run** 是托管容器运行环境。它自动处理 HTTPS 终止、自动扩缩、健康检查和部署回滚。你提供镜像和参数，它负责运行容器并暴露稳定的 URL。

---

## 免费额度与使用限制

两个服务都有永久的免费方案——不只是试用额度。

| 服务 | 免费额度 | 超过后的费率 |
|------|---------|------------|
| Artifact Registry | 每月 0.5 GB 存储 | $0.10/GB/月 |
| Cloud Run | 每月 200 万次请求 | 每百万次 $0.40 |
| Cloud Run | 每月 360,000 GB 秒内存 | $0.00000250/GB 秒 |
| Cloud Run | 每月 180,000 vCPU 秒 | $0.00001000/vCPU 秒 |
| Cloud Run | 每月 1 GB 网络输出（北美） | $0.12/GB |

低到中等流量的 API（每月数万次请求）通常都在 Cloud Run 免费额度内。Artifact Registry 的费用取决于你保留多少个镜像版本——请参阅下方的清理策略说明。

---

## 一次性配置：Artifact Registry

在任何部署发生之前，你需要在 Artifact Registry 里创建一个存储库。这只需要做一次：

```bash
gcloud artifacts repositories create my-service \
  --repository-format=docker \
  --location=us-central1 \
  --project=YOUR_PROJECT_ID \
  --description="Container images for my-service"
```

创建后，你的镜像名称格式如下：

```
us-central1-docker.pkg.dev/YOUR_PROJECT_ID/my-service/my-service:latest
```

### 清理策略

Artifact Registry 按存储量收费。没有清理策略的话，旧版镜像层会无声地累积。应用一个保留最新三个版本、删除超过 30 天的策略：

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

`--no-dry-run` 是必要的——没有这个 flag，策略只会被评估，不会实际应用。

---

## 定义你的 API 端点

Cloud Run 运行你的容器——它不知道你的应用程序在做什么。你的应用程序定义路由，Cloud Run 通过 service URL 把它们对外暴露。

部署完成后，你定义的每个端点都可以通过以下格式访问：

```
https://{your-service-url}/{endpoint-path}
```

举例来说，如果你的 Cloud Run service URL 是 `https://my-service-abc123-uc.a.run.app`，你定义了一个 `/convert` 路由，那么它的完整 URL 就是 `https://my-service-abc123-uc.a.run.app/convert`。

### 健康检查端点为什么重要

健康检查端点是一个专用路由——通常是 `/health`——立即返回 `200 OK`，没有任何副作用。Cloud Run 用它来确认容器是否正确启动，监控工具用它来检测服务中断，你的部署后验证脚本每次部署后第一个调用它。

没有 `/health` 路由的话，确认服务部署后是否正常的唯一方法就是调用一个真正的功能端点，然后祈祷它运作正常——这是一个很脆弱的替代方案。

### 最小可用的 Flask 示例

以下是一个包含健康检查和一个功能端点的最小 Flask 应用程序：

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

部署后，两个路由都可以通过 service URL 访问：

| 路由 | 完整 URL |
|------|---------|
| `/health` | `https://your-service-url/health` |
| `/process` | `https://your-service-url/process` |

### Flask vs FastAPI 在 Dockerfile 的差异

你选择的框架会影响 Dockerfile 的 `CMD` 那一行。Flask 使用 **gunicorn**（生产级的 WSGI 服务器）；FastAPI 使用 **uvicorn**：

```dockerfile
# Flask + gunicorn
CMD ["gunicorn", "--bind", "0.0.0.0:8080", "--workers", "1", "app.main:app"]

# FastAPI + uvicorn
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
```

Dockerfile 的其他部分——基础镜像、port、工作目录——不管用哪个框架都一样。

---

## Dockerfile

Cloud Run 能运行任何监听 port `8080` 并在收到 `SIGTERM` 时干净退出的容器。一个最小可用于生产环境的 Python API Dockerfile：

```dockerfile
FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ ./app/

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
```

三个重点说明：

- **`python:3.12-slim`** 省略了编译器、测试工具和文档。更小的镜像意味着部署时更快的拉取速度和更低的 Artifact Registry 存储费用。
- **`--no-cache-dir`** 防止 pip 将下载缓存写入镜像层。缓存在运行中的容器里永远不会被复用，留着只是浪费空间。
- **Port `8080` 是强制要求。** Cloud Run 将所有流量路由到这个 port。Host 必须是 `0.0.0.0`——不能是 `localhost` 或 `127.0.0.1`——否则 Cloud Run 的健康检查会无声地失败。

---

## 推送前先在本机测试

在推送到 GCP 之前，先确认容器在本机能正常运行。推上去一个损坏的镜像只是在浪费时间和存储费用。

构建镜像：

```bash
docker build --platform linux/amd64 -t my-service:local .
```

如果你用 Apple Silicon Mac 开发，`--platform linux/amd64` 是关键。没有这个 flag，Docker 会构建 `arm64` 镜像，而 Cloud Run 的底层硬件是 `amd64`——它会无声地拒绝错误架构的镜像。这个 flag 强制进行跨平台构建。

在本机运行容器：

```bash
docker run --rm -p 8080:8080 \
  -e API_KEY=your-dev-key \
  my-service:local
```

`-p 8080:8080` 将容器内的 port 8080 映射到本机的 port 8080。`-e` 传入环境变量。

测试它：

```bash
curl http://localhost:8080/health
# 预期响应：{"status": "ok"}
```

健康检查通过代表容器正常启动且服务器在监听。继续之前先用 `Ctrl+C` 停止它。

---

## 部署 Pipeline

每次发布都要执行 build → push → deploy 这个流程。拆成三个可组合的脚本，让每个步骤可以独立测试：

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

**`scripts/release.sh`** — 串联三个脚本：

```bash
#!/usr/bin/env bash
set -euo pipefail
bash scripts/build.sh && bash scripts/push.sh && bash scripts/deploy.sh
```

完成后，`bash scripts/release.sh` 就是你每次发布新版本唯一需要执行的命令。

---

## Cloud Run 配置：每个参数的说明

| 参数 | 值 | 说明 |
|------|---|------|
| `--memory` | `512Mi` | 大多数图片处理和运算型 API 在 512 MiB 内都够用。观察 Cloud Run 的内存指标再决定是否需要调整。 |
| `--cpu` | `1` | 每个实例一个 vCPU。CPU 只在处理请求时分配——没有空闲计费。 |
| `--concurrency` | `1` | 每个实例同时只处理一个请求。适合 CPU 密集型工作，多个请求在同一个实例上会互相抢占 CPU、彼此降速。I/O 密集型服务可以调高到 10–80。 |
| `--max-instances` | `100` | 限制并发实例数量。防止流量激增或攻击导致无限扩缩。根据可接受的最坏情况成本设定，而不是预期流量。 |
| `--timeout` | `60` | 请求超时秒数。处理超时时 Cloud Run 会中止请求并返回 504。根据最慢的预期操作加上余量来设定。 |
| `--allow-unauthenticated` | — | 让 URL 可以公开访问。下一节有重要的 IAM 注意事项。 |

**`--concurrency 1` 的实际含义。** 设为 1 时，每个进行中的请求都有自己的实例。两个请求同时到达时，Cloud Run 会启动第二个实例，而不是把第二个请求排在第一个后面等。对于 CPU 密集型工作（图片处理、文件转换、模型推理），这是正确的模式。它通过实例数量水平扩展，而不是请求队列深度。

**内存规格需要提前规划。** 如果容器超过配置的内存限制，Cloud Run 会 OOM kill 你的容器。部署前先估算峰值内存用量：如果 API 在启动时加载 200 MB 的模型，`512Mi` 是不够的——从 `1Gi` 开始。观察 Cloud Run 的内存指标后再调整。

---

## 缩容至零：冷启动的取舍

Cloud Run 的默认行为——也是它最大的成本优势——是**缩容至零**：没有请求时，所有实例关闭，空闲期间完全不计费。

代价是**冷启动延迟**：请求在空闲一段时间后到达时，Cloud Run 必须先启动一个新容器才能响应。对于有典型依赖包的 Python API，这大约需要 2–5 秒。

| 设置 | 行为 | 费用 |
|------|------|------|
| `--min-instances 0`（默认） | 缩容至零；空闲后的首个请求有冷启动 | 空闲时零费用 |
| `--min-instances 1` | 始终保持一个实例；没有冷启动 | 512Mi/1 vCPU 约 $10–15/月 |

流量不可预测或突发性、偶尔的 2–5 秒等待对用户可接受、或开发初期想要接近零成本时，使用 `--min-instances 0`。

服务面向用户且首次请求延迟明显不可接受、或有延迟 SLA 时，使用 `--min-instances 1`。

---

## 环境变量与 Secrets

Cloud Run 在启动时通过 `--set-env-vars` 将环境变量传入容器：

```bash
gcloud run deploy my-service \
  --set-env-vars "API_KEY=abc123,DB_URL=postgres://..."
```

对于开发环境使用 `.env` 文件的服务，部署脚本可以自动读取该文件并构建 `--set-env-vars` 字符串：

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

这让 secrets 不进入代码仓库，同时保持部署的可重复性。

**注意：** 如果某个值包含逗号，`--set-env-vars` 会无声地将它拆成两个变量。用引号包住值，或将那个 secret 迁移到 [Google Secret Manager](https://cloud.google.com/secret-manager) 并使用 `--set-secrets`。*（Secret Manager 完整使用指南即将推出。）*

---

## 公开访问与认证

### IAM 组织策略的注意事项

部署脚本里的 `--allow-unauthenticated` 并不总是足够。许多 GCP 组织有 IAM 组织策略（`constraints/iam.allowedPolicyMemberTypes`），会阻止通过 CLI 将 Cloud Run Invoker 角色授予 `allUsers`。

如果部署成功，但调用 URL 时收到 `403 Forbidden`，原因就在这里。

**通过 Cloud Console 修复：**

1. 前往 **Cloud Run** → 选取你的服务
2. 点击 **Security** 标签
3. 在「Authentication」下选择 **Allow unauthenticated invocations**
4. 点击 **Save**

这个方法直接在服务资源上设置 IAM 策略，通常可以绕过 CLI 路径上的组织级限制。

### 在 API 内部处理认证

大多数 API——即使是内部使用的——都需要基于 key 的访问控制。使用第三方网关（例如 RapidAPI）的公开 Cloud Run 服务，常见的认证架构：

```
调用方 ──▶ 网关 ──▶ Cloud Run
           注入         验证
           X-RapidAPI-Proxy-Secret
```

| Header | 谁发送 | 证明什么 |
|--------|--------|---------|
| `X-RapidAPI-Key` | API 调用方 | 有效的订阅 |
| `X-RapidAPI-Proxy-Secret` | 网关（自动注入） | 请求经过网关转发 |
| `X-Internal-Key` | 你（运维/测试） | 直接访问，绕过网关 |

你的服务验证 `X-RapidAPI-Proxy-Secret`，以确认请求是通过网关传入的。`X-Internal-Key` 是用于测试和健康检查的独立 secret，可以直接访问服务。

**不要把 `X-RapidAPI-Proxy-Secret` 当作调用方的凭据。** 它是网关注入的，不是调用方使用的。把它当作调用凭据是常见的错误，会导致认证失败，或把后端 secret 泄露到前端代码里。

---

## 部署后验证

每次部署后都应该验证，确认完成才算完成。

**步骤一：健康检查** — 确认容器启动、服务器在监听：

```bash
curl https://your-service-url/health
# 预期：{"status": "ok"}
```

**步骤二：功能性 Smoke Test** — 确认服务能完整处理一个请求：

```bash
SECRET=$(grep INTERNAL_KEY .env | cut -d'=' -f2- | tr -d '"')

curl -X POST https://your-service-url/your-endpoint \
  -H "X-Internal-Key: $SECRET" \
  -F "file=@tests/sample.gif" \
  --output /tmp/smoke_output.png

file /tmp/smoke_output.png
```

直接从 `.env` 读取 secret（而不是从 shell 环境变量读取），确保在全新的终端 session 里也能正常执行。

---

## 常见错误快速参考

| 症状 | 可能原因 | 修复方式 |
|------|---------|---------|
| Cloud Run 上出现 `exec format error` | 镜像构建了错误的 CPU 架构 | 在 `docker build` 加上 `--platform linux/amd64` |
| 部署后健康检查立即失败 | 容器监听了错误的 host 或 port | CMD 使用 `--host 0.0.0.0 --port 8080` |
| `docker push` 返回 `unauthorized` | Docker 未向 Artifact Registry 认证 | 执行 `gcloud auth configure-docker us-central1-docker.pkg.dev` |
| 加了 `--allow-unauthenticated` 仍然 403 | 组织 IAM 策略阻止 `allUsers` | 通过 Cloud Console 的 Security 标签设置公开访问 |
| 部署成功但行为还是旧的 | Cloud Run 缓存了旧的镜像 digest | 强制重新部署：`gcloud run deploy ... --image ...:latest` |
| 冷启动延迟无法接受 | 缩容至零加上较大的容器 | 设置 `--min-instances 1` 或缩小镜像 |
| `--set-env-vars` 无声地丢失一个值 | 值包含逗号 | 用引号包住，或迁移到 Secret Manager |
| 处理请求时容器被 kill | 超过内存限制（OOM） | 增加 `--memory`（试试 `1Gi` 或 `2Gi`） |

---

## 下一步

这篇教程涵盖了基础知识。自然的下一步：

- *（[在 GCP 上用 CI/CD 自动化部署](/blog/gcp-cicd-cloud-run) — 即将推出）* — 每次推送到 main 分支时自动触发 `release.sh`
- *（[使用 Google Secret Manager 管理 Secrets](/blog/gcp-secret-manager) — 即将推出）* — 生产环境 secrets 的审计日志、轮换和细粒度 IAM 访问控制
- *（[使用 Cloud Run Jobs 处理长时间任务](/blog/gcp-cloud-run-jobs) — 即将推出）* — 超过 60 秒的操作，Cloud Run Jobs 是正确的工具

---

## FAQ

**为什么我的浏览器在 fetch API 时显示 CORS 错误？**

有两种根本不同的原因看起来一模一样。第一，你的 API 可能没有配置 CORS headers——服务器必须在跨域请求的响应中加上 `Access-Control-Allow-Origin` headers。第二，也更常见的情况是：API 根本没有在运行——当 `fetch()` 完全无法联系服务器（网络错误、冷启动超时、URL 错误），浏览器会把它报告为 CORS 错误，而不是连接错误。先在 DevTools 的 Network 标签确认——如果请求完全没有收到响应，问题是连接，不是 CORS headers。

**怎么判断是 CORS 问题还是 API 挂掉了？**

直接用终端的 `curl` 调用端点。如果 `curl` 能正常收到响应，服务是活着的，问题是 CORS headers。如果 `curl` 也失败（connection refused、超时、404），服务无法访问——先修好部署，再处理 CORS。

**应该分配多少内存？**

估算你的峰值内存用量：Python/框架基础开销（约 50–100 MB）+ 启动时加载的模型或数据 + 单个请求 payload 的最大大小。加上 30% 的余量后，向上取整到下一个 Cloud Run 规格（256Mi、512Mi、1Gi、2Gi、4Gi、8Gi）。从保守的值开始，观察前几天的 Cloud Run 内存使用指标——调高很容易，OOM kill 在日志里会立刻看到。

**我加了 `--allow-unauthenticated`，还是收到 403，为什么？**

你的 GCP 组织很可能有 IAM 组织策略，限制通过 CLI 将角色授予 `allUsers`。`--allow-unauthenticated` 在部署时尝试将 Cloud Run Invoker 角色授予 `allUsers`，这个操作被组织策略阻止了。修复方式：前往 Cloud Console 的 Cloud Run → 你的服务 → Security 标签 → 将 Authentication 设为「Allow unauthenticated invocations」并保存。这个路径通常可以绕过 CLI 层级的策略限制。

**我的 API 操作需要超过 5 分钟，还能用 Cloud Run 吗？**

Cloud Run 的最大请求超时是 60 分钟（通过 `--timeout` 设置），但对于超过 5–10 分钟的操作，直接 API 的方式会变得很脆弱——客户端超时、连接中断、重试造成重复执行。长时间运算的正确工具是 **Cloud Run Jobs**：立即返回一个 job ID，让客户端轮询完成状态。Cloud Run Jobs 的完整教程即将推出。

**免费额度用完了会怎样？**

Cloud Run 和 Artifact Registry 会自动切换到按量计费——不会中断服务，也不会有通知。Cloud Run 按请求次数和资源使用秒数计费，所以零流量的服务就算超过免费额度也不会产生费用。建议在 GCP Billing Console 设置预算告警，在费用变高之前收到通知。

**可以用 8080 以外的 port 吗？**

可以，在 `gcloud run deploy` 加上 `--port` flag 即可设置其他 port。但 `8080` 是默认值且被广泛预期——除非有特定理由，否则不要更改。无论你在 Cloud Run 配置什么 port，容器实际监听的 port 必须与之相符。

**部署出问题了怎么回滚？**

Cloud Run 保留版本历史记录。在 Console 进入你的服务 → Revisions 标签 → 选取任一个之前的版本 → 点击「Manage Traffic」，将 100% 的流量指向它。回滚几秒内生效，不需要重新构建。
