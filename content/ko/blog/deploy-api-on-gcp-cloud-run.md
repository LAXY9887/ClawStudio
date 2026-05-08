---
title: "GCP Cloud Run에 컨테이너화된 API 배포하기"
description: "Artifact Registry와 Cloud Run을 활용하여 GCP에 Python API를 배포하는 단계별 가이드 — Docker 설정부터 반복 가능한 단일 명령 릴리스 파이프라인까지, 모든 설정 매개변수를 상세히 설명합니다."
date: "2026-05-08"
readingTime: 19
tag: "tutorial"
---

여러분은 로컬 머신에서 잘 작동하는 무언가를 만들었습니다 — 이미지를 변환하는 스크립트, 계산을 수행하는 함수, 유용한 작업을 처리하는 작은 프로그램. 어느 시점이 되면 그것을 노트북 너머로 확장하고 싶어집니다. 웹사이트에 올려 방문자들이 사용할 수 있게 하거나, 친구나 동료에게 링크를 공유하거나, 유료로 제공할 수 있는 무언가로 패키징하고 싶어질 것입니다. 브라우저, 모바일 앱, 다른 서버 등 어디서든 여러분의 코드를 호출할 수 있게 하려면 API로 노출해야 합니다.

API(Application Programming Interface)는 코드를 안정적인 URL을 가진 서비스로 만들어 줍니다. 스크립트를 공유하고 사람들에게 실행 환경을 직접 설정하도록 요청하는 대신, 여러분이 한 번 실행해 두면 모두가 사용할 수 있습니다. 이 가이드에서 만드는 것이 바로 그것입니다.

이 튜토리얼을 마치면 GCP에서 컨테이너화된 API가 실행되고, 공개 HTTPS URL을 통해 접근 가능하며, 단일 명령으로 배포할 수 있게 됩니다. API 로직은 여러분이 결정합니다 — 이 가이드는 나머지 모든 것을 다룹니다: Docker 설정, Artifact Registry, Cloud Run 구성, 환경 변수, 공개 접근, 그리고 배포 후 검증.

예제는 Python(FastAPI + uvicorn)을 사용하지만, GCP 측 단계는 컨테이너에서 실행할 수 있는 모든 언어와 프레임워크에 적용됩니다.

---

## 전체 구조 이해하기

도구 작업에 착수하기 전에, 여러분이 만드는 것의 전체 그림을 먼저 살펴보겠습니다:

```
Local Machine                         GCP
──────────────────────────────────────────────────────────
                                      ┌───────────────────┐
1. Write Dockerfile                   │  Artifact         │
2. docker build ──────── docker push ▶│  Registry         │
3. docker run   (local test)          │  (image storage)  │
                                      └─────────┬─────────┘
                                                │ pull image
                                                ▼
                                      ┌───────────────────┐
                                      │   Cloud Run       │
                                      │   (managed        │
                                      │    runtime)       │
                                      └─────────┬─────────┘
                                                │
                                                ▼
                                      https://your-service-xxxx.run.app
                                      (public HTTPS API endpoint)
```

**Artifact Registry**는 Docker 이미지를 저장합니다 — GCP 프로젝트 내의 프라이빗 이미지 레지스트리입니다. **Cloud Run**은 이미지를 가져와 실행하고, HTTPS 종료와 스케일링을 자동으로 처리하며, 안정적인 URL에서 노출하는 관리형 컨테이너 런타임입니다.

그 외 모든 것 — Cloud Build, Cloud Storage, GKE — 은 선택 사항입니다. 최소한의 설정은 이 두 가지 서비스입니다.

---

## GCP 프로젝트 설정

가장 먼저 GCP 프로젝트가 필요합니다. 프로젝트는 모든 GCP 리소스의 컨테이너입니다 — 청구, API, IAM 권한, 서비스 모두 프로젝트 범위 내에 있습니다.

### gcloud CLI 설치 및 인증

[Google Cloud CLI](https://cloud.google.com/sdk/docs/install)를 설치한 후 인증합니다:

```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
```

Artifact Registry를 사용하도록 Docker를 인증합니다(머신당 한 번):

```bash
gcloud auth configure-docker us-central1-docker.pkg.dev
```

이 명령은 `~/.docker/config.json`에 자격 증명 헬퍼를 작성합니다. 한 번만 실행하면 되며 터미널 세션이 바뀌어도 유지됩니다.

### 프로젝트 생성

[Google Cloud Console](https://console.cloud.google.com)에 접속하여 상단의 프로젝트 선택기를 클릭한 후 **새 프로젝트**를 선택합니다. 이름을 지정하고 Project ID를 메모해 두세요 — 아래의 모든 CLI 명령에서 사용합니다.

또는 CLI를 통해:

```bash
gcloud projects create YOUR_PROJECT_ID --name="My API Project"
gcloud config set project YOUR_PROJECT_ID
```

### 청구 활성화

Cloud Run과 Artifact Registry는 사용량이 무료 등급 내에 있더라도 프로젝트에 청구 계정이 연결되어 있어야 사용할 수 있습니다. GCP는 청구 계정을 통해 비용 책임자를 식별하며, 즉시 요금을 청구하지는 않습니다.

콘솔에서: **청구** → **청구 계정 연결** → 청구 계정을 선택하거나 새로 만듭니다.

### 필요한 API 활성화

GCP 서비스는 기본적으로 비활성화되어 있습니다. 이 튜토리얼에서 사용하는 두 가지 서비스를 활성화합니다:

```bash
gcloud services enable artifactregistry.googleapis.com run.googleapis.com
```

약 30초 정도 소요되며 프로젝트당 한 번만 수행하면 됩니다.

### IAM 권한

프로젝트 소유자 — 프로젝트를 생성한 계정 — 라면 이미 전체 권한을 가지고 있으므로 이 섹션을 건너뛸 수 있습니다.

CI/CD 파이프라인에서 배포하거나 최소 권한 원칙을 따르고 싶다면, 필요한 역할만 부여된 전용 서비스 계정을 만듭니다:

| 역할 | 허용 작업 |
|------|---------------|
| `roles/artifactregistry.writer` | Artifact Registry에 이미지 푸시 |
| `roles/run.developer` | Cloud Run 서비스 배포 및 관리 |

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

개인 용도로 자신의 머신에서 사용하는 경우, 소유자 권한을 가진 사용자 계정으로 충분하며 서비스 계정이 필요하지 않습니다.

---

## 사전 요구 사항: Docker 설정

### Docker란 무엇이며 왜 사용하는가?

Docker는 컨테이너화 플랫폼입니다. **컨테이너**는 애플리케이션 코드와 런타임, 의존성, 설정을 하나의 이식 가능한 단위로 패키징하여 어디서나 동일하게 실행되도록 합니다.

컨테이너화 없이 원격 서버에 코드를 배포하면 서버에 정확한 Python 버전, `requirements.txt`에 나열된 정확한 패키지, 동일한 환경 변수, 노트북과 동일한 디렉토리 구조가 있는지 확인해야 합니다. 이는 취약합니다 — 로컬과 프로덕션 환경 간의 미묘한 차이가 재현하기 어렵고 진단하기 더욱 어려운 버그를 유발합니다.

컨테이너는 이러한 종류의 문제를 없애줍니다. **Dockerfile**에서 환경을 한 번 정의하고, **이미지**로 빌드하면 그 이미지는 노트북, GCP, Docker가 있는 모든 머신에서 동일하게 실행됩니다.

**이 가이드 전반에서 사용되는 두 가지 용어:**

- **이미지** — 파일 시스템과 시작 명령을 설명하는 읽기 전용 청사진. 빌드 후 변경 불가. 스냅샷으로 생각하면 됩니다.
- **컨테이너** — 이미지의 실행 인스턴스. Cloud Run이 요청을 받으면 이미지에서 컨테이너를 시작하여 처리합니다. 요청이 완료되면 다음 요청을 위해 워밍 상태로 유지되거나 종료될 수 있습니다.

이미지는 로컬에서 빌드하고, Artifact Registry(GCP의 이미지 저장소)에 푸시하면 Cloud Run이 거기서 가져와 실행합니다.

### Docker Desktop 설치

[docker.com](https://www.docker.com/products/docker-desktop/)에서 Docker Desktop을 다운로드하여 설치합니다. 설치 후 Docker Desktop을 시작하고 메뉴 바의 고래 아이콘 애니메이션이 멈출 때까지 기다립니다 — 데몬이 실행 중임을 의미합니다.

설치를 확인합니다:

```bash
docker --version
# Docker version 27.x.x, build ...

docker info
# Should print system info without errors
# If you see "Cannot connect to the Docker daemon" — Docker Desktop is not running
```

---

## 필요한 두 가지 서비스

GCP에는 방대한 서비스 카탈로그가 있습니다. 이 튜토리얼에서는 정확히 두 가지 서비스만 필요합니다.

**Artifact Registry**는 Docker 이미지를 저장합니다. GCP 프로젝트 내에 있는 프라이빗 Docker Hub로 생각하면 됩니다. Cloud Run은 배포 시 여기서 이미지를 가져옵니다.

**Cloud Run**은 관리형 컨테이너 런타임입니다. HTTPS 종료, 자동 스케일링, 헬스 체크, 배포 롤백을 처리합니다. 이미지와 매개변수 세트를 제공하면 컨테이너를 실행하고 안정적인 URL에서 노출합니다.

---

## 무료 등급 및 사용 한도

두 서비스 모두 영구 무료 등급이 있습니다 — 단순한 평가판 크레딧이 아닙니다.

| 서비스 | 무료 등급 | 무료 등급 초과 시 |
|---------|-----------|-----------------|
| Artifact Registry | 월 0.5 GB 스토리지 | GB당 월 $0.10 |
| Cloud Run | 월 200만 요청 | 100만 요청당 $0.40 |
| Cloud Run | 월 360,000 GB-초 메모리 | GB-초당 $0.00000250 |
| Cloud Run | 월 180,000 vCPU-초 | vCPU-초당 $0.00001000 |
| Cloud Run | 월 1 GB 네트워크 이그레스(북미) | GB당 $0.12 |

중저 트래픽 API(월 수만 건의 요청)의 경우 Cloud Run 무료 등급 내에 머물 가능성이 높습니다. Artifact Registry 비용은 보관하는 이미지 버전 수에 따라 달라집니다 — 아래의 정리 정책 섹션을 참조하세요.

---

## 일회성 설정: Artifact Registry

배포 전에 이미지를 저장할 Artifact Registry 내 리포지토리가 필요합니다. 프로젝트당 한 번 실행합니다:

```bash
gcloud artifacts repositories create my-service \
  --repository-format=docker \
  --location=us-central1 \
  --project=YOUR_PROJECT_ID \
  --description="Container images for my-service"
```

이후 이미지 이름은 다음 패턴을 따릅니다:

```
us-central1-docker.pkg.dev/YOUR_PROJECT_ID/my-service/my-service:latest
```

### 정리 정책

Artifact Registry는 스토리지 비용이 부과됩니다. 정리 정책 없이는 오래된 이미지 레이어가 조용히 쌓입니다. 최신 3개 버전을 유지하고 30일보다 오래된 것은 삭제하는 정책을 적용합니다:

```bash
gcloud artifacts repositories set-cleanup-policies my-service \
  --location=us-central1 \
  --project=YOUR_PROJECT_ID \
  --policy=cleanup-policy.json \
  --no-dry-run
```

`cleanup-policy.json`:

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

`--no-dry-run` 플래그는 필수입니다 — 이 플래그 없이는 정책이 평가되기만 하고 실제로 적용되지 않습니다.

---

## API 엔드포인트 정의

Cloud Run은 컨테이너를 실행하며 애플리케이션이 무엇을 하는지 알지 못합니다. 라우트는 애플리케이션이 정의하고, Cloud Run은 서비스 URL을 통해 이를 노출합니다.

배포 후 정의한 모든 엔드포인트는 다음 주소에서 접근할 수 있습니다:

```
https://{your-service-url}/{endpoint-path}
```

예를 들어 Cloud Run 서비스 URL이 `https://my-service-abc123-uc.a.run.app`이고 `/convert` 라우트를 정의했다면 `https://my-service-abc123-uc.a.run.app/convert`에서 접근할 수 있습니다.

### 헬스 체크 엔드포인트가 중요한 이유

헬스 체크 엔드포인트는 일반적으로 `/health`라는 전용 라우트로, 부작용 없이 즉시 `200 OK` 응답을 반환합니다. Cloud Run은 이를 통해 컨테이너가 올바르게 시작되었는지 확인합니다. 모니터링 도구는 이를 통해 장애를 감지합니다. 배포 후 검증 스크립트는 매 배포 후 가장 먼저 이것을 호출합니다.

`/health` 라우트가 없으면 배포 후 서비스가 살아있는지 확인하는 유일한 방법은 실제 엔드포인트 중 하나를 호출하여 올바르게 동작하기를 바라는 것뿐입니다 — 이는 취약한 대안입니다.

### 최소한의 Flask 예제

헬스 체크와 하나의 기능 엔드포인트를 갖춘 최소한의 Flask 애플리케이션입니다:

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

`requirements.txt`:

```
flask
gunicorn
```

배포 후 두 라우트 모두 서비스 URL을 통해 접근할 수 있습니다:

| 라우트 | 전체 URL |
|-------|----------|
| `/health` | `https://your-service-url/health` |
| `/process` | `https://your-service-url/process` |

### Dockerfile에서 Flask와 FastAPI 비교

선택하는 프레임워크는 Dockerfile의 `CMD` 줄에 영향을 줍니다. Flask는 **gunicorn**(프로덕션 WSGI 서버)을 사용하고, FastAPI는 **uvicorn**을 사용합니다:

```dockerfile
# Flask + gunicorn
CMD ["gunicorn", "--bind", "0.0.0.0:8080", "--workers", "1", "app.main:app"]

# FastAPI + uvicorn
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
```

Dockerfile의 나머지 부분 — 베이스 이미지, 포트, 작업 디렉토리 — 은 프레임워크와 관계없이 동일합니다.

---

## Dockerfile

Cloud Run은 포트 `8080`에서 수신하고 `SIGTERM`에서 깔끔하게 종료되는 모든 컨테이너를 실행합니다. Python API를 위한 최소한의 프로덕션 준비 Dockerfile:

```dockerfile
FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ ./app/

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
```

주목할 세 가지 사항:

- **`python:3.12-slim`**은 베이스 이미지에서 컴파일러, 테스트 도구, 문서를 제외합니다. 이미지가 작을수록 배포 시 풀 속도가 빠르고 Artifact Registry 스토리지 비용이 낮아집니다.
- **`--no-cache-dir`**은 pip가 다운로드 캐시를 이미지 레이어에 쓰는 것을 방지합니다. 캐시는 실행 중인 컨테이너 내에서 재사용되지 않으므로 순수한 낭비입니다.
- **포트 `8080`은 필수입니다.** Cloud Run은 모든 트래픽을 이 포트로 라우팅합니다. 호스트는 반드시 `0.0.0.0`이어야 하며 — `localhost`나 `127.0.0.1`이 아닙니다 — 그렇지 않으면 Cloud Run의 헬스 체크가 자동으로 실패합니다.

---

## 푸시 전 로컬 테스트

GCP에 푸시하기 전에 항상 컨테이너가 로컬에서 작동하는지 확인합니다. 손상된 이미지를 Artifact Registry에 푸시하면 시간과 스토리지가 낭비됩니다.

이미지 빌드:

```bash
docker build --platform linux/amd64 -t my-service:local .
```

Apple Silicon Mac을 사용하는 경우 `--platform linux/amd64` 플래그가 중요합니다. 이 플래그 없이는 Docker가 `arm64` 이미지를 빌드합니다. Cloud Run의 기반 하드웨어는 `amd64`이므로 잘못된 아키텍처는 자동으로 거부됩니다. 이 플래그는 크로스 플랫폼 빌드를 강제합니다.

컨테이너를 로컬에서 실행:

```bash
docker run --rm -p 8080:8080 \
  -e API_KEY=your-dev-key \
  my-service:local
```

`-p 8080:8080` 플래그는 컨테이너 내부의 포트 8080을 머신의 포트 8080에 매핑합니다. `-e` 플래그는 환경 변수를 전달합니다.

테스트:

```bash
curl http://localhost:8080/health
# Expected: {"status": "ok"}
```

헬스 체크가 통과되면 컨테이너가 올바르게 시작되고 서버가 수신 대기 중입니다. 계속 진행하기 전에 `Ctrl+C`로 중지합니다.

---

## 릴리스 파이프라인

빌드 → 푸시 → 배포 순서는 매 릴리스마다 실행됩니다. 각 단계를 독립적으로 테스트할 수 있도록 세 가지 조합 가능한 스크립트로 분리합니다:

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

**`scripts/release.sh`** — 세 단계를 모두 연결:

```bash
#!/usr/bin/env bash
set -euo pipefail
bash scripts/build.sh && bash scripts/push.sh && bash scripts/deploy.sh
```

이후 `bash scripts/release.sh`만으로 새 버전을 배포할 수 있습니다.

---

## Cloud Run 구성: 모든 매개변수 설명

| 매개변수 | 값 | 설명 |
|-----------|-------|-----------|
| `--memory` | `512Mi` | 대부분의 이미지 처리 및 연산 API는 512 MiB에 맞습니다. 더 필요한지는 Cloud Run 메트릭에서 확인할 수 있습니다. |
| `--cpu` | `1` | 인스턴스당 하나의 vCPU. CPU는 요청이 처리되는 동안에만 할당됩니다 — 유휴 시 요금이 청구되지 않습니다. |
| `--concurrency` | `1` | 각 인스턴스는 한 번에 하나의 요청을 처리합니다. 병렬 요청이 CPU를 놓고 경쟁하여 성능이 저하되는 CPU 바운드 작업에 적합합니다. I/O 바운드 서비스의 경우 10–80으로 높이세요. |
| `--max-instances` | `100` | 동시 인스턴스를 제한합니다. 트래픽 급증이나 공격으로 인한 무분별한 스케일링을 방지합니다. 예상 트래픽이 아닌 허용 가능한 최악의 비용을 기준으로 설정합니다. |
| `--timeout` | `60` | 요청 타임아웃(초). 처리가 이 시간을 초과하면 Cloud Run이 요청을 종료하고 504를 반환합니다. 가장 느린 예상 작업에 여유를 두고 설정합니다. |
| `--allow-unauthenticated` | — | URL을 공개적으로 접근 가능하게 만듭니다. IAM 주의사항은 다음 섹션을 참조하세요. |

**`--concurrency 1`의 실제 의미.** 동시성이 1로 설정되면 각 활성 요청은 자체 인스턴스를 갖습니다. 두 요청이 동시에 도착하면 Cloud Run은 두 번째 요청을 대기열에 넣는 대신 두 번째 인스턴스를 시작합니다. 이미지 처리, 파일 변환, 모델 추론 등 CPU 바운드 작업에 올바른 모델입니다. 요청 대기열 깊이가 아닌 인스턴스 수로 수평 확장됩니다.

**메모리 크기 조정은 미리 중요합니다.** 설정된 메모리 한도를 초과하면 Cloud Run이 컨테이너를 OOM 킬합니다. 배포 전에 최대 메모리 사용량을 추정하세요: API가 200 MB 모델을 메모리에 로드한다면 `512Mi`는 충분하지 않습니다 — `1Gi`에서 시작하세요. Cloud Run의 메모리 메트릭을 관찰한 후 조정합니다.

---

## 제로로 스케일링: 콜드 스타트 트레이드오프

Cloud Run의 기본 동작 — 그리고 주요 비용 이점 — 은 **제로로 스케일링**입니다: 활성 요청이 없으면 모든 인스턴스가 종료되고 비용이 발생하지 않습니다.

트레이드오프는 **콜드 스타트 지연 시간**입니다: 비활성 기간 후 요청이 도착하면 Cloud Run은 응답하기 전에 새 컨테이너를 시작해야 합니다. 일반적인 의존성이 있는 Python API의 경우 2–5초가 걸립니다.

| 설정 | 동작 | 비용 |
|---------|----------|------|
| `--min-instances 0` (기본값) | 제로로 스케일링; 유휴 기간 후 콜드 스타트 | 유휴 시 무료 |
| `--min-instances 1` | 항상 하나의 인스턴스 실행; 콜드 스타트 없음 | 512Mi/1 vCPU 기준 월 ~$10–15 |

트래픽이 예측 불가능하거나 버스트 형태이거나, 사용자에게 콜드 스타트가 허용 가능하거나, 초기 개발 중 비용을 최소화하고 싶을 때 `--min-instances 0`을 사용합니다.

서비스가 사용자 대면이고 2–5초의 첫 요청 지연이 눈에 띄게 허용되지 않거나 지연 시간 SLA가 있을 때 `--min-instances 1`을 사용합니다.

---

## 환경 변수 및 시크릿

Cloud Run은 `--set-env-vars`를 통해 시작 시 컨테이너에 환경 변수를 전달합니다:

```bash
gcloud run deploy my-service \
  --set-env-vars "API_KEY=abc123,DB_URL=postgres://..."
```

개발 중 로컬 `.env` 파일을 사용하는 서비스의 경우, 배포 스크립트가 해당 파일을 읽고 `--set-env-vars` 문자열을 자동으로 구성할 수 있습니다:

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

이렇게 하면 시크릿을 리포지토리에서 제외하면서 배포를 반복 가능하게 유지합니다.

**참고:** 값에 쉼표가 포함된 경우 `--set-env-vars`가 자동으로 두 개의 변수로 분리됩니다. 값을 따옴표로 감싸거나, `--set-secrets`를 사용하여 [Google Secret Manager](https://cloud.google.com/secret-manager)로 마이그레이션하세요. *(전체 Secret Manager 가이드는 곧 제공될 예정입니다.)*

---

## 공개 접근 및 인증

### IAM 조직 정책 주의사항

배포 스크립트의 `--allow-unauthenticated`가 항상 충분한 것은 아닙니다. 많은 GCP 조직에는 `allUsers`에게 IAM 역할을 부여하는 것을 차단하는 조직 정책(`constraints/iam.allowedPolicyMemberTypes`)이 있으며, Cloud Run Invoker 역할도 포함됩니다.

배포가 성공하지만 URL 호출 시 `403 Forbidden`이 발생한다면 이것이 원인입니다.

**Cloud Console을 통한 수정:**

1. **Cloud Run** → 서비스 선택으로 이동
2. **보안** 탭 클릭
3. "인증" 아래에서 **인증되지 않은 호출 허용** 선택
4. **저장** 클릭

이렇게 하면 배포 명령이 아닌 서비스 리소스에 직접 IAM 정책이 설정되며, 일반적으로 CLI 경로의 조직 수준 제한을 우회합니다.

### API에서 인증 처리

대부분의 API — 내부용이라도 — 는 키 기반 접근 제어가 필요합니다. 서드파티 게이트웨이(예: RapidAPI)를 사용하는 공개 Cloud Run 서비스의 일반적인 패턴:

```
Caller ──▶ Gateway ──▶ Cloud Run
           injects       validates
           X-RapidAPI-Proxy-Secret
```

| 헤더 | 발신자 | 증명하는 것 |
|--------|-------------|----------------|
| `X-RapidAPI-Key` | API 호출자 | 유효한 구독 |
| `X-RapidAPI-Proxy-Secret` | 게이트웨이(주입됨) | 게이트웨이를 통해 전달된 요청 |
| `X-Internal-Key` | 운영자/테스터 | 게이트웨이를 우회한 직접 접근 |

서비스는 `X-RapidAPI-Proxy-Secret`을 검증하여 요청이 게이트웨이를 통과했는지 확인합니다. `X-Internal-Key`는 테스트 및 헬스 체크 중 직접 접근을 위한 별도의 시크릿입니다.

**`X-RapidAPI-Proxy-Secret`을 호출자 자격 증명으로 사용하지 마세요.** 게이트웨이가 주입하는 것이지 호출자가 사용하는 것이 아닙니다. 이를 호출자 키로 취급하면 인증에 실패하거나 백엔드 시크릿이 클라이언트 측 코드에 노출되는 흔한 실수입니다.

---

## 배포 후 검증

모든 배포는 완료되었다고 간주되기 전에 검증해야 합니다.

**1단계: 헬스 체크** — 컨테이너가 시작되고 서버가 수신 대기 중임을 확인합니다:

```bash
curl https://your-service-url/health
# Expected: {"status": "ok"}
```

**2단계: 기능 스모크 테스트** — 서비스가 요청을 처음부터 끝까지 처리하는지 확인합니다:

```bash
SECRET=$(grep INTERNAL_KEY .env | cut -d'=' -f2- | tr -d '"')

curl -X POST https://your-service-url/your-endpoint \
  -H "X-Internal-Key: $SECRET" \
  -F "file=@tests/sample.gif" \
  --output /tmp/smoke_output.png

file /tmp/smoke_output.png
```

(셸 환경이 아닌) `.env`에서 직접 시크릿을 읽으면 새 터미널 세션에서도 테스트가 작동합니다.

---

## 빠른 참조: 일반적인 오류

| 증상 | 가능한 원인 | 수정 방법 |
|---------|-------------|-----|
| Cloud Run에서 `exec format error` | 잘못된 CPU 아키텍처로 빌드된 이미지 | `docker build`에 `--platform linux/amd64` 추가 |
| 배포 직후 헬스 체크 실패 | 컨테이너가 잘못된 호스트 또는 포트에서 수신 대기 | CMD에서 `--host 0.0.0.0 --port 8080` 사용 |
| `docker push`에서 `unauthorized` 반환 | Docker가 Artifact Registry에 인증되지 않음 | `gcloud auth configure-docker us-central1-docker.pkg.dev` 실행 |
| `--allow-unauthenticated`로 배포 후 403 | 조직 IAM 정책이 `allUsers` 차단 | Cloud Console(보안 탭)에서 공개 접근 설정 |
| 배포 성공 후 이전 동작 유지 | Cloud Run이 이전 이미지 다이제스트를 캐시함 | 강제 재배포: `gcloud run deploy ... --image ...:latest` |
| 허용 불가한 콜드 스타트 지연 시간 | 대용량 컨테이너에서 제로로 스케일링 | `--min-instances 1` 설정 또는 이미지 크기 축소 |
| `--set-env-vars`가 값을 자동으로 삭제 | 값에 쉼표 포함 | 따옴표로 감싸거나 Secret Manager로 마이그레이션 |
| 요청 중 컨테이너 종료 | 메모리 한도 초과(OOM) | `--memory` 증가(`1Gi` 또는 `2Gi` 시도) |

---

## API 참조 (AI 에이전트용)

이 가이드에서 정의된 예시 API 엔드포인트에 대한 머신 읽기 가능 사양입니다. 실제 엔드포인트 경로와 요청/응답 형태는 애플리케이션에 의해 결정됩니다 — 아래의 플레이스홀더를 실제 라우트로 교체하십시오.

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

## 다음 단계

이 가이드는 기본 사항을 다룹니다. 다음으로 자연스러운 단계:

- *([GCP에서 CI/CD로 배포 자동화](/blog/gcp-cicd-cloud-run) — 곧 제공)* — 모든 git main 브랜치 푸시 시 `release.sh` 자동 트리거
- *([Google Secret Manager로 시크릿 관리](/blog/gcp-secret-manager) — 곧 제공)* — 프로덕션 시크릿의 감사 로깅, 교체, 세분화된 IAM 접근
- *([Cloud Run Jobs로 장기 실행 작업](/blog/gcp-cloud-run-jobs) — 곧 제공)* — 60초 이상 걸리는 작업의 경우 Cloud Run Jobs가 적합한 도구

---

## 자주 묻는 질문

**브라우저에서 API를 fetch할 때 CORS 오류가 발생하는 이유는 무엇인가요?**

브라우저에서 동일하게 보이는 두 가지 원인이 있습니다. 첫째, API에 CORS 헤더가 구성되어 있지 않을 수 있습니다 — 서버는 교차 출처 요청에 `Access-Control-Allow-Origin` 헤더로 응답해야 합니다. 둘째, 더 흔하게는 API가 전혀 실행되지 않는 경우입니다: `fetch()` 호출이 서버에 전혀 도달하지 못하면(네트워크 오류, 콜드 스타트 타임아웃, 잘못된 URL) 브라우저는 연결 오류가 아닌 CORS 오류로 보고합니다. 먼저 DevTools의 네트워크 탭을 확인하세요 — 요청이 응답을 받지 못했다면 문제는 연결성이며 CORS 헤더가 아닙니다.

**CORS 문제인지 API가 다운된 것인지 어떻게 구분하나요?**

터미널에서 `curl`로 엔드포인트를 직접 호출합니다. `curl`이 유효한 응답을 반환하면 서비스는 작동 중이고 문제는 CORS 헤더입니다. `curl`도 실패한다면(연결 거부, 타임아웃, 404) 서비스에 접근할 수 없습니다 — 먼저 배포를 수정한 다음 CORS를 해결하세요.

**메모리를 얼마나 할당해야 하나요?**

최대 인메모리 사용량을 추정합니다: 기본 Python/프레임워크 오버헤드(~50–100 MB), 시작 시 로드하는 모델이나 데이터, 단일 요청 페이로드의 최대 크기를 합산합니다. 30% 여유를 추가하고 다음 Cloud Run 등급(256Mi, 512Mi, 1Gi, 2Gi, 4Gi, 8Gi)으로 올림합니다. 보수적으로 시작하고 처음 며칠 동안 Cloud Run의 메모리 사용률 메트릭을 모니터링하세요 — 늘리기는 쉽고 OOM 킬은 로그에서 즉시 확인할 수 있습니다.

**`--allow-unauthenticated`를 추가했는데 여전히 403이 발생합니다. 왜 그런가요?**

GCP 조직에 CLI를 통해 `allUsers`에게 역할을 부여하는 것을 제한하는 IAM 조직 정책이 있을 가능성이 높습니다. `--allow-unauthenticated` 플래그는 배포 시 `allUsers`에게 Cloud Run Invoker 역할을 부여하려고 시도하는데, 조직 정책이 이를 차단합니다. Cloud Run 콘솔 → 서비스 → 보안 탭 → 인증을 "인증되지 않은 호출 허용"으로 설정하고 저장하면 수정됩니다. 이 방법은 일반적으로 CLI 수준 정책 제한을 우회합니다.

**API 작업이 5분 이상 걸립니다. 그래도 Cloud Run을 사용할 수 있나요?**

Cloud Run의 최대 요청 타임아웃은 60분(`--timeout`으로 구성)이지만, 5–10분 이상의 작업은 직접 API 방식이 취약해집니다 — 클라이언트가 타임아웃되고, 연결이 끊어지며, 재시도로 인해 중복 작업이 발생합니다. 장기 실행 연산에는 **Cloud Run Jobs**를 대신 사용하세요: 작업을 제출하고 즉시 작업 ID를 반환한 다음 클라이언트가 완료를 폴링합니다. Cloud Run Jobs 가이드는 곧 제공될 예정입니다.

**무료 등급이 소진되면 어떻게 되나요?**

Cloud Run과 Artifact Registry는 자동으로 종량제 청구로 전환됩니다 — 서비스 중단이나 알림이 없습니다. Cloud Run 청구는 요청 단위 및 리소스-초 단위이므로 트래픽이 없는 서비스는 무료 등급이 소진된 후에도 비용이 발생하지 않습니다. GCP 청구 콘솔에서 예산 알림을 설정하여 비용이 커지기 전에 알림을 받으세요.

**8080 외의 다른 포트를 사용할 수 있나요?**

`gcloud run deploy`의 `--port` 플래그를 사용하여 Cloud Run이 다른 포트를 사용하도록 구성할 수 있습니다. 그러나 `8080`이 기본값이며 널리 사용됩니다 — 특별한 이유가 없다면 변경하지 마세요. Cloud Run에서 구성한 포트는 컨테이너가 실제로 수신 대기하는 포트와 일치해야 합니다.

**잘못된 배포를 롤백하려면 어떻게 하나요?**

Cloud Run은 리비전 히스토리를 유지합니다. 콘솔에서 서비스 → 리비전 탭 → 이전 리비전 선택 → "트래픽 관리"를 클릭하고 해당 리비전으로 트래픽의 100%를 전송합니다. 롤백은 몇 초 내에 적용되며 재빌드가 필요하지 않습니다.
