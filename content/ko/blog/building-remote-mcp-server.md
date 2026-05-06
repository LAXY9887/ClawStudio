---
title: "Cloudflare Workers와 GCP Cloud Run으로 원격 MCP 서버 구축하기"
description: "Cloudflare Workers 및 GCP Cloud Run에서 호스팅되는 MCP 서버 구축 단계별 가이드 — OAuth 2.1 + PKCE, 내부 서비스 인증, R2 파일 스테이징, 백엔드 코드 비공개 유지 포함."
date: "2026-05-06"
readingTime: 15
tag: "guide"
---

## 시작점: 기존 API

MCP가 관련되기 전에 Spritesheet Forge는 이미 작동하는 백엔드를 갖추고 있었습니다. Google Cloud Platform에서 실행되는 이미지 처리 API 세트입니다. API는 실제 작업을 처리했습니다 — GIF를 스프라이트시트로 변환, 투명한 테두리 제거, 프레임 패킹, 아틀라스 JSON 생성.

MCP(Model Context Protocol)는 Claude와 같은 AI 어시스턴트가 자연어를 통해 도구와 API를 직접 호출할 수 있게 해주는 개방형 표준입니다. MCP가 추가하는 것은 기존 API 위에 있는 **AI 네이티브 인터페이스**입니다. 엔드포인트를 직접 호출하는 대신, Claude는 이제 자연어를 통해 이러한 작업을 호출할 수 있습니다. 백엔드는 변하지 않았습니다. 변한 것은 이를 접근하는 방식입니다.

이 차이는 아키텍처를 이해하는 데 중요합니다. 이것은 처음부터 다시 구축하는 것이 아닙니다. 이미 작동하는 것의 앞에 있는 새로운 계층입니다.

### GCP를 선택한 이유

새로운 프로젝트를 시작하고 아직 클라우드 제공자를 선택하지 않았다면, GCP의 서버리스 스택은 진지한 고려의 가치가 있습니다 — 특히 트래픽이 예측 불가능한 개발자 도구 및 유틸리티에서.

핵심 속성은 **0까지의 스케일**입니다. GCP의 관리형 컨테이너 런타임인 Cloud Run은 요청이 없을 때 완전히 종료되고 요청이 도착하면 수 초 내에 시작됩니다. 실제로 사용한 컴퓨팅 시간에 대해서만 비용이 청구되며, 가장 가까운 100ms 단위로 청구됩니다. 연속적인 트래픽보다 산발적인 도구 호출을 처리하는 MCP 서버의 경우, 이는 실제로 거의 0에 가까운 실행 비용을 의미합니다.

알아야 할 추가 이점:

- **관리할 인프라 없음** — Cloud Run은 HTTPS 종료, 확장, 상태 확인, 배포 롤백을 자동으로 처리합니다
- **모든 언어, 모든 프레임워크** — 모든 컨테이너를 배포하고, 플랫폼 특정 런타임이 필요 없습니다
- **무료 계층이 넉넉함** — 월 2백만 건 요청과 360,000 GB-초의 컴퓨팅이 무료입니다
- **Artifact Registry + Cloud Build** — 배포 파이프라인(이미지 빌드 → 푸시 → 배포)을 단일 `gcloud` 명령으로 완전히 자동화할 수 있습니다

처음부터 이 GCP 설정을 다루는 별도의 게시물 — Cloud Run 배포, Artifact Registry, Cloud Build CI/CD, IAM 구성 — 이 곧 나올 예정입니다. *([GCP에서 API 서비스 설정](/blog/setting-up-gcp-api-service) — 곧 제공)*

---

## MCP 계층 추가

백엔드가 이미 실행 중이므로, AI 클라이언트에 이를 노출하는 방법이 문제였습니다. 답은 MCP 프로토콜을 말하고 요청을 기존 API로 변환하는 Cloudflare Workers의 얇은 게이트웨이였습니다.

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

Worker는 엣지에서 모든 것을 처리합니다: MCP 프로토콜 파싱, OAuth 토큰 검증, 사용자별 할당량 적용, 파일 스테이징. Worker는 전 세계적으로 분산되어 있으며 콜드 스타트가 없습니다 — 요청은 가장 가까운 현재 위치에 서브밀리초 오버헤드로 도착합니다. 제약은 엄격한 CPU 시간 제한입니다(무료 계층에서 요청당 50ms). 이는 컴퓨팅 집약적인 작업에는 부적합합니다. 바로 이 이유로 무거운 작업은 Cloud Run에 남아있습니다.

### Cloudflare R2

R2는 도구 간 핸드오프 메커니즘입니다. 모든 도구 출력은 1시간 TTL로 R2에 기록되고 URL로 반환됩니다. 체인의 다음 도구는 그 URL을 입력으로 받습니다 — Worker는 추가 HTTP 왕복 없이 R2에서 직접 가져옵니다. 이는 다단계 에이전트 워크플로우를 빠르고 저렴하게 만듭니다. R2는 S3 호환이므로 기존의 모든 S3 SDK가 수정 없이 작동합니다.

### Cloudflare KV

KV는 세 가지 유형의 데이터를 저장합니다: OAuth 세션 토큰(30일 TTL), 사용자별 월간 할당량 카운터, 인증 흐름 중 OAuth PKCE 상태. KV는 최종적으로 일관성 있으며 엣지 캐시 읽기를 포함합니다 — 이러한 쓰기 한 번, 읽기 많음 값에 잘 맞습니다.

Cloudflare Workers 설정, 커스텀 도메인 구성, DNS 관리, R2 및 KV 연결에 대한 완전한 설명을 보려면 동반 가이드를 참조하세요: *([MCP 서버용 완전한 Cloudflare Worker 설정](/blog/cloudflare-worker-setup-guide) — 곧 제공)*

### 비공개 저장소 이점

게이트웨이와 백엔드를 분리하면 덜 명백한 문제를 해결합니다: **MCP 래퍼만 공개하면 됩니다**.

Cloudflare Worker 코드는 API 표면을 정의합니다 — 도구 이름, 매개변수, 인증. 이를 게시하면 커뮤니티가 통합을 검사하고 호환 클라이언트를 구축할 수 있습니다. 실제 처리 로직이 있는 Cloud Run 백엔드는 비공개 저장소에 남아있을 수 있습니다. 핵심 알고리즘은 절대 노출되지 않습니다.

상용 제품의 경우, 이는 의미가 있습니다: 개방형 MCP 통합을 출시하고, 커뮤니티가 인터페이스 계층에 기여하도록 하고, 소유권이 있는 백엔드는 완전히 닫혀있게 유지할 수 있습니다. 구현 세부사항을 드러내지 않고 MCP 기술을 시연합니다.

---

## 완전한 MCP 서버가 실제로 필요한 것

Spritesheet Forge가 처음 출시되었을 때, MCP 서버는 기술적으로 실행 중이었습니다 — 하지만 Claude가 거의 사용할 수 없었습니다. 도구는 있었지만, 서버는 MCP 클라이언트가 도구 호출을 시도하기도 전에 의존하는 여러 구성 요소가 누락되어 있었습니다. 에이전트는 연결되었지만, 혼란스러워하고 포기했습니다.

원격 MCP 서버가 올바르게 작동하기 위해 필요한 완전한 목록입니다:

### MCP 프로토콜 핸들러 (`POST /mcp`)

주요 엔드포인트는 모든 MCP 트래픽을 수신합니다. 모든 MCP 클라이언트가 유용한 작업을 수행하기 전에 보내는 특정 메시지 시퀀스를 처리해야 합니다:

| Method | 누가 보냅니까 | 그것이 의미하는 것 |
|--------|-------------|---------------|
| `initialize` | 클라이언트, 첫 번째 메시지 | "연결 중, 여기 내 기능들입니다" |
| `notifications/initialized` | 클라이언트, 서버가 `initialize`에 응답한 후 | "계속 진행할 준비가 됨" |
| `tools/list` | 클라이언트, 사용 가능한 도구를 검색하려면 | "뭘 할 수 있나요?" |
| `tools/call` | 클라이언트, 도구를 실제로 호출하려면 | "이 일을 해주세요" |

`initialize` 및 `notifications/initialized` 메시지는 인증이 없어도 유효한 응답을 반환해야 합니다 — 이들은 세션을 설정하는 핸드셰이크입니다. 이 둘 중 하나가 실패하거나 인증 오류를 반환하면, 클라이언트는 연결이 끊겼다고 간주하고 중단합니다.

### 도구 정의

`tools/list`에 등록된 각 도구는 완전하기 위해 네 가지가 필요합니다:

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

누락된 `outputSchema` 또는 `annotations`는 도구 호출을 깨지지 않지만, 모든 디렉토리 플랫폼에서 품질 점수를 떨어뜨립니다. 더 중요한 것은, LLM은 `outputSchema`를 사용하여 도구 결과를 구문 분석하고 이유를 파악합니다 — 없으면, 모델은 반환되는 것의 구조를 추측합니다.

### 발견 및 인프라 엔드포인트

`/mcp` 외에도, 완전한 서버는 다음이 필요합니다:

- **`GET /health`** — 인증 필요 없음, HTTP 200으로 `{"status":"ok"}`를 반환합니다. 디렉토리 플랫폼은 이를 폴링하여 서버가 활성 상태인지 확인합니다.
- **`OPTIONS /mcp`** — CORS preflight를 처리합니다. 브라우저 기반 MCP 클라이언트에 필수입니다.
- **`GET /.well-known/oauth-authorization-server`** — OAuth를 사용하는 경우, MCP 클라이언트가 인증 엔드포인트를 자동으로 검색하는 방법입니다. 없으면, 클라이언트는 수동 구성으로 돌아가거나 완전히 실패합니다.

### 이 중 하나라도 누락될 경우의 결과

Claude는 `initialize` → `notifications/initialized` → `tools/list` 순서로 실행하여 MCP 서버에 연결됩니다. `tools/list`가 실패하면(인증이 필요하거나 응답이 잘못된 형식이기 때문에), 클라이언트는 작동할 도구 정의가 없습니다. Claude의 관점에서, 서버는 존재하지만 기능이 없습니다 — 아무것도 호출할 수 없습니다.

이것이 실제로는 "Agent가 MCP를 거의 사용할 수 없음"처럼 보였습니다: 연결은 성공했지만, 발견 단계가 올바르게 완료되지 않았기 때문에 도구 사용 시도가 모두 실패했습니다.

### 프로토콜 예제

MCP 프로토콜의 모든 메시지는 HTTP POST를 통한 JSON-RPC 2.0 객체입니다. 실제 교환은 다음과 같습니다.

**단계 1 — 클라이언트가 `initialize` 보냄**

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

**서버가 자체 기능으로 응답**

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

**단계 2 — 클라이언트가 `notifications/initialized` 보냄** (응답 예상 안 함)

```json
{
  "jsonrpc": "2.0",
  "method": "notifications/initialized"
}
```

**단계 3 — 클라이언트가 `tools/list` 보냄** (인증 필요 없음)

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/list"
}
```

**서버가 모든 등록된 도구 반환**

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

이 핸드셰이크가 완료되면, 클라이언트는 정확히 어떤 도구가 사용 가능하고 그것들을 어떻게 호출하는지 알게 됩니다. 이 시점 이후에만 인증이 관련됩니다 — `tools/call` 같은 도구 호출은 유효한 Bearer 토큰이 필요합니다.

**`server_info` — 인수가 0인 도구 호출**

이것이 Spritesheet Forge의 `server_info` 도구를 사용한 실제 `tools/call` 요청과 응답의 모습입니다:

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

**실제 응답:**

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

`server_info`는 구성 또는 메타데이터를 반환하는 모든 도구를 따를 패턴입니다: 인수 없음, 결정적 출력, 에이전트가 워크플로우를 시작하기 전에 쿼리하는 데 유용합니다.

---

## 인증

### 인증이 필요한 이유

인증이 없으면, MCP 서버는 공개 API입니다 — 엔드포인트를 발견한 누구든지 도구를 무기한 실행할 수 있고, Cloud Run 컴퓨팅을 소비하고, R2 저장소 쓰기를 태우고, 실제 사용자에게 속한 할당량을 소진합니다. 인증은 한 번에 세 가지 문제를 해결합니다:

- **리소스 보호**: 모든 도구 호출은 직접 컴퓨팅 비용으로 변환됩니다. 누가 호출하는지 모르면, 제한을 적용할 수 없습니다.
- **할당량 관리**: 사용자별 월간 할당량은 추적할 수 있는 안정적인 신원이 필요합니다. 신원이 없으면 공정한 적용이 없습니다.
- **학대 방지**: 인증이 없는 공개 엔드포인트는 자명하게 스크립트 가능합니다 — 한 명의 나쁜 행위자가 청구서를 급증시키거나 모두를 위한 서비스를 성능 저하시킬 수 있습니다.

### 인증 옵션

| 방법 | 사용자 경험 | 구현 | MCP 클라이언트 지원 |
|--------|-------------|---------|-----------|
| 인증 없음 | 마찰 없음 | 자명함 | 범용적 |
| 정적 API 키 | 나쁨 — 사용자는 구성에 복사-붙여넣기해야 함 | 간단함 | 범용적 |
| OAuth 2.1 + PKCE | 매끄러움 — 브라우저 클릭 하나 | 중간 | Claude Desktop, Claude Code |

**인증 없음**은 네트워크가 보안 경계인 로컬 또는 내부 전용 서버에만 적절합니다. 공개 원격 서버의 경우, 이는 인터넷의 누구나 도구를 호출할 수 있다는 뜻입니다.

**API 키**는 명백한 첫 선택입니다: 키를 생성하고, 사용자에게 주고, 완료. 문제는 배포 경험입니다. 사용자는 대시보드 또는 문서 페이지를 찾고, 무작위 문자열을 복사하고, 구성 파일을 열고, 붙여넣기하고, 클라이언트를 재시작해야 합니다. 그것은 여러 실패 지점이 있는 다단계 프로세스이며, 잃어버린 경우 복구가 없습니다. 그들이 사용하는 모든 새로운 MCP 클라이언트는 동일한 수동 설정이 필요합니다.

**OAuth 2.1 + PKCE**는 구현하기 더 많은 작업이지만 극적으로 더 나은 경험을 제공합니다. MCP 클라이언트는 전체 흐름을 기본적으로 처리합니다 — 토큰이 필요할 때 자동으로 브라우저를 엽니다. 사용자는 GitHub 로그인 페이지를 보고, "인증"을 클릭하고, 클라이언트는 결과 토큰을 내부적으로 저장합니다. 사용자의 관점에서, 구성 파일을 포함하지 않고 클릭 한 번입니다.

### Spritesheet Forge가 이를 구현하는 방법

구현은 GitHub을 신원 제공자로, Cloudflare KV를 토큰 저장소로, 표준 OAuth 2.1 + PKCE 흐름을 사용합니다:

**1. `/.well-known/oauth-authorization-server`를 통한 자동 발견**

MCP 클라이언트는 OAuth 흐름을 시작하기 전에 이 엔드포인트를 읽습니다. 인증 엔드포인트, 토큰 엔드포인트, 지원 그랜트 유형을 반환합니다. 없으면, 클라이언트는 수동 구성이 필요하거나 완전히 연결 실패합니다.

**2. 동적 클라이언트 등록 (RFC 7591)**

모든 MCP 클라이언트는 등록 엔드포인트에 POST하여 프로그래밍 방식으로 자신을 등록할 수 있습니다. 이는 어디에도 사전 승인되거나 나열될 필요 없이 새로운 클라이언트가 연결될 수 있다는 뜻입니다 — 서버는 등록을 자동으로 처리합니다.

**3. PKCE 흐름**

권한 코드 가로채기를 방지합니다. 클라이언트는 무작위 `code_verifier`를 생성하고, 인증 요청과 함께 해시(`code_challenge`)를 보내고, 코드를 토큰으로 교환할 때 원본 verifier를 보유하고 있음을 증명합니다. 이는 권한 코드가 전송 중에 도용될 수 있는 공격 벡터를 닫습니다.

**4. KV 세션 저장소**

세션 토큰은 Cloudflare KV의 `session:{userId}`에 30일 TTL로 저장됩니다. 각 `tools/call` 요청은 Cloud Run에 도달하기 전에 KV에 대해 Bearer 토큰을 검증합니다.

**5. 스크립트 폴백**

브라우저 OAuth가 실용적이지 않은 스크립트, CI 파이프라인, 벤치마크 환경에서 작업하는 사용자의 경우, `get-token.py` 스크립트를 다운로드할 수 있습니다. 터미널에서 전체 OAuth 흐름을 실행하고, 결과 토큰을 인쇄하고, `~/.spritesheet-forge-token`에 저장합니다.

### X-MCP-Key: 내부 서비스 인증

아키텍처는 두 계층이 있습니다: Cloudflare Worker(공개 대면 게이트웨이)와 Cloud Run(비공개 백엔드). Cloud Run은 기술적으로 인터넷에서 도달할 수 있는 URL에서 실행됩니다 — 이를 발견한 누구든지 직접 요청을 POST할 수 있으며, Worker를 완전히 우회합니다. 이는 OAuth 검증, 할당량 적용, 속도 제한을 우회한다는 뜻입니다.

`X-MCP-Key` 헤더는 이 격차를 닫습니다. 이것은 Worker과 Cloud Run만 아는 공유 비밀입니다. Worker는 들어오는 모든 OAuth 토큰을 검증한 다음, 이 헤더를 첨부하여 요청을 Cloud Run으로 전달합니다. Cloud Run은 올바른 키를 포함하지 않는 모든 요청을 거부합니다.

```
User → Worker:     Authorization: Bearer <oauth-token>   (public auth)
Worker → Cloud Run: X-MCP-Key: <internal-secret>         (internal auth)
```

이것은 **깊이 있는 방어**입니다: Cloud Run URL이 로그, 오류 메시지, 역엔지니어링을 통해 유출되더라도, 공격자는 내부 키 없이 호출할 수 없습니다. 모든 트래픽은 게이트웨이를 통해 강제되고, 모든 보안 적용이 보존됩니다.

없으면, "비공개 백엔드"는 거짓 주장입니다 — 백엔드는 여전히 충분히 찾아본 누구에게나 효과적으로 공개됩니다.

---

## 파일 입력 설계

이 섹션은 도구가 파일을 처리하는 MCP 서버에 특정합니다 — 이미지 변환기, 문서 파서, 오디오 프로세서, 및 유사합니다. 도구가 텍스트 또는 구조화된 데이터만 처리하면, 이 문제에 직면하지 않을 것입니다. 하지만 파일이 많은 API의 경우, 이것은 가장 실제적으로 제한하는 문제 중 하나입니다.

핵심 문제는 Agent에게 파일을 전달하는 것이 보이는 것보다 더 어렵다는 것입니다. 직관적인 접근법 — 파일을 base64-인코딩하고 인라인으로 보냄 — 이론상으로는 작동하지만 실제로 하드 제약에 부딪힙니다: **Claude Code의 셸 도구는 stdout 출력에 약 256 KB 컨텍스트 제한이 있습니다**. Base64 인코딩은 파일 크기를 약 33% 확장하며, 이는 인라인 base64의 실제 안전한 상한이 약 185 KB라는 의미입니다. 대부분의 이미지, 오디오 파일, 문서는 그것보다 큽니다.

이것은 대부분의 실제 파일 처리 사용 사례에 대해 base64를 불가능하게 합니다. 우리가 추가한 해결책은 MCP 계층에서 전용 `/upload` 엔드포인트입니다 — MCP 프로토콜 자체 외부. 사용자(또는 Agent)는 파일을 거기에 직접 POST하고, URL을 다시 받고, 파일을 인라인으로 포함하는 대신 그 URL을 도구에 전달합니다. Worker는 그 다음 R2에서 서버 측에서 파일을 가져오며, 컨텍스트 크기 제약을 완전히 우회합니다.

**파일 저장소에 왜 Cloudflare R2?**

R2는 Cloudflare의 S3 호환 객체 저장소이며, 한 가지 특정한 이유로 올바른 선택입니다: **0 이그레스 비용**. AWS S3 및 대부분의 다른 객체 저장소 서비스는 데이터 전송 아웃에 대해 청구합니다 — 도구 출력이 읽을 때마다(체인형 도구 호출마다 발생), 비용을 지불합니다. R2는 이그레스에 대해 아무것도 청구하지 않습니다. 도구 간에 파일을 자주 이동하는 MCP 서버의 경우, 이것이 중요합니다.

R2의 무료 계층도 충분히 넉넉해서 낮음 대 중간 트래픽 MCP 서버는 완전히 그 안에서 실행될 수 있습니다:

| 리소스 | 무료 계층 |
|----------|-----------|
| 저장소 | 월 10 GB |
| Class A 작업 (쓰기, 삭제) | 월 1백만 |
| Class B 작업 (읽기) | 월 1천만 |
| 이그레스 (데이터 전송 아웃) | 무료, 항상 |

도구 출력은 1시간 TTL로 저장되고 자동으로 삭제됩니다 — 그러므로 저장소 사용량은 활동적인 사용 중에도 낮게 유지됩니다. 한 시간 내에 처리되고 폐기된 파일은 어떤 의미있는 방식으로 월간 저장소 총계에 계산되지 않습니다.

파일을 수용하는 MCP 도구는 세 가지 뚜렷한 입력 시나리오를 처리해야 합니다:

| 시나리오 | 방법 |
|----------|--------|
| 작은 파일 (< ~185 KB) | base64 data URI: `data:image/png;base64,...` |
| 큰 파일 또는 셸의 파일 | `/upload` 엔드포인트에 POST, URL을 뒤로 전달 |
| 이전 도구의 출력 | 출력 URL을 직접 전달 — Worker가 R2에서 가져옴 |

명확하지 않은 제약: Claude Code의 셸 도구는 stdout 출력에 약 256 KB 컨텍스트 제한이 있습니다. Base64 인코딩은 파일 크기를 약 33% 확장하므로, 인라인 base64의 실제 상한은 4 MB가 아니라 약 185 KB입니다. 도구 설명은 이 제한을 명시적으로 명시하고 중요할 때 업로드 엔드포인트로 사용자를 가리켜야 합니다.

**base64 개행 버그.** `openssl base64` 및 `base64` CLI와 같은 셸 도구는 76자마다 개행을 삽입합니다. 그 문자열을 data URI로 직접 전달하면 서버에서 `INVALID_BASE64` 오류가 발생합니다. 도구 설명에 이 경고를 넣으세요:

> "base64 문자열에서 모든 공백과 개행을 제거한 후 data URI 접두사를 앞에 붙이세요. 예: `base64 file.png | tr -d '\n'`"

---

## LLM과 함께 작동하는 도구 설계

### 단계 0: Claude를 MCP 서버에 연결

도구를 사용하려면, Claude를 먼저 MCP 서버에 연결해야 합니다. 이것은 명백하게 들리지만, 명시할 가치가 있습니다: Claude는 MCP 서버를 자동으로 발견하거나 연결하지 않습니다. 명시적으로 연결을 구성하고, 할 때까지, Claude는 서버가 존재한다는 지식이 없습니다.

**Claude Desktop** — `claude_desktop_config.json`에 추가 (Settings → Developer를 통해 찾기):

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

**Claude Code CLI** — 터미널을 통해 추가:

```bash
claude mcp add spritesheet-forge --transport http https://mcp.clawstudiouo.com/mcp
```

서버가 구성되지 않으면, Claude는 "그 도구를 찾을 수 없습니다"라고 말하지 않을 것입니다. 도구가 존재하지 않는 것처럼 행동할 것입니다 — 웹에서 대안을 검색하고, 실제로 갖고 있지 않은 유사 이름의 도구를 환각하고, 묻던 것을 완전히 놓치는 일반적인 응답을 생성합니다. 실패 모드는 무음이고 혼란스럽습니다.

### 사용자가 MCP 서버를 어떻게 찾습니까

Claude 연결하기는 첫 번째 단계입니다. 서버가 존재한다는 것을 사용자가 먼저 알게 하는 것은 별개의 문제입니다. 여러 채널이 있으며, 각각 다른 청중에 도달합니다:

**소스 및 문서**
- [GitHub 저장소](https://github.com/LAXY9887/Game-Dev.-Spritesheet-Forge) — 진실의 주요 출처. 개발자는 여기를 먼저 봅니다. 엔드포인트 URL과 구성 스니펫이 있는 명확한 README가 최소입니다.
- [전용 튜토리얼 페이지](https://sprite-forge-mcp.tutorial.clawstudiouo.com) — 설치, 인증, 예제 프롬프트를 단계별로 설명하는 독립형 페이지. README를 읽고 싶지 않은 비개발자에게 유용합니다.

**공식 레지스트리**
- [Anthropic MCP 레지스트리](https://registry.modelcontextprotocol.io/?q=io.github.LAXY9887%2Fspritesheet-forge) — Anthropic의 공식 MCP 서버 인덱스. MCP 클라이언트 애플리케이션이 앱 내에 큐레이팅된 서버 목록을 표시하는 데 쿼리합니다.

**마켓플레이스 및 디렉토리**
- [Smithery.ai](https://smithery.ai/servers/lxya98874322688423/spritesheet-forge) — Claude Code의 MCP 브라우저에 직접 통합됩니다. 사용자는 CLI를 떠나지 않고 서버를 찾고 설치할 수 있습니다.
- [MCP Marketplace](https://mcp-marketplace.io/server/game-dev-spritesheet-forge) — 유료 계층을 위한 수익 공유 모델이 있는 전용 마켓플레이스.
- GitHub Marketplace — GitHub의 개발자 생태계에 액세스 가능합니다.

채널은 서로를 강화합니다. Smithery에서 서버를 찾는 사용자는 종종 GitHub 저장소를 다음에 확인합니다. 튜토리얼 페이지는 발견을 실제 설치로 변환합니다. 모두를 다루는 것은 유지하기에 적은 비용이 들고 겹치지 않는 청중에 도달합니다.

### 실제로 작동하는 도구 설명 작성

도구 설명은 인간을 위한 문서가 아닙니다 — 이들은 LLM이 *언제* 그리고 *어떻게* 도구를 호출할지 결정하는 데 사용하는 지침입니다. 잘못 작성된 설명은 모델이 잘못된 도구를 호출하거나, 잘못된 매개변수를 전달하거나, 디버그하기 어려운 오류를 생성합니다.

좋은 도구 설명에 포함되는 것:

- **입력 형식**: URL? data URI? 어떤 MIME 유형이 수용되나요?
- **출력**: 도구가 무엇을 반환하나요? URL? JSON 구조체? TTL은 무엇인가요?
- **제약**: 파일 크기 제한, 매개변수 상호작용, 알려진 문제
- **예제**: 복잡한 입력 규칙의 경우, 인라인 예제 또는 셸 명령을 제공합니다

**체이닝을 위해 설계하세요.** 모든 도구의 출력 URL을 다른 도구의 입력으로 직접 사용 가능하게 만드세요. 이를 통해 에이전트는 자연스럽게 다단계 워크플로우를 구성할 수 있습니다:

```
gif_to_spritesheet → split_spritesheet → frames_to_animation
```

**`server_info` 도구를 추가하세요.** 런타임 구성을 반환하는 인수 없는 도구를 제공합니다: 업로드 엔드포인트 URL, 출력 파일 TTL, 파일 크기 제한, base64와 업로드 중 선택 규칙. 이는 개별 도구 설명 전체에서 해당 정보가 오래되는 것을 방지하고 에이전트가 복잡한 워크플로우를 시작하기 전에 쿼리할 수 있는 신뢰할 수 있는 방법을 제공합니다.

---

## 빠른 오류 참조

| 증상 | 근본 원인 | 수정 |
|---------|-----------|-----|
| 플랫폼이 "0 도구 찾음" 표시 | `tools/list`가 인증을 요구함 | `initialize`, `notifications/initialized`, `tools/list`를 핸드셰이크 화이트리스트에 추가 |
| Smithery 품질 점수가 0 | 누락된 `outputSchema` / `annotations` | 모든 도구에 두 필드 모두 추가 |
| `INVALID_BASE64` 디코드 오류 | 셸 도구가 base64에 개행을 삽입 | 도구 설명에서 경고; `tr -d '\n'` 사용 |
| Agent가 "나는 그 도구를 갖고 있지 않다"고 말하고 웹 검색 시작 | MCP 서버가 클라이언트에서 구성되지 않음 | `claude_desktop_config.json`에 서버 구성을 추가하거나 `claude mcp add` 실행 |
| OAuth 인증 페이지가 절대 열리지 않음 | `/.well-known/oauth-authorization-server`가 공개적으로 액세스 가능하지 않음 | 엔드포인트가 인증 없이 도달 가능한지 확인 |
| 업로드 엔드포인트가 `401` 반환 | Bearer 토큰 누락 또는 만료 | 사용자 재인증; 필요한 경우 `get-token.py` 실행 |
| 도구 출력 URL이 404 반환 또는 실패 | R2 객체 TTL 만료 (60분) | 원본 도구를 다시 실행하여 새로운 URL을 얻습니다 |
| Cloud Run이 모든 요청에서 `403` 반환 | `X-MCP-Key` 헤더 누락 또는 잘못됨 | Worker의 환경 변수에서 비밀을 확인 |
| 브라우저 기반 MCP 클라이언트가 연결할 수 없음 | `/mcp`에서 누락된 CORS 헤더 | `OPTIONS` preflight 핸들러 추가 + 모든 응답에 `Access-Control-Allow-Origin: *` 추가 |

---

## 자주 묻는 질문

**원격 MCP 서버란 무엇입니까?**

원격 MCP 서버는 Model Context Protocol을 구현하는 클라우드 호스팅 서비스로, Claude와 같은 AI 어시스턴트가 자연어를 통해 인터넷을 통해 도구를 호출할 수 있게 합니다. 사용자의 머신에서 실행되고 그 머신에서만 액세스 가능한 로컬 MCP 서버와 달리, 원격 서버는 로컬 설치 없이 인증된 모든 MCP 클라이언트에서 어디서나 액세스 가능합니다.

**Claude Desktop 또는 Claude Code에 MCP 서버를 어떻게 추가합니까?**

Claude Desktop의 경우, `claude_desktop_config.json`에 서버 구성을 추가합니다 (Settings → Developer에서 찾기). Claude Code의 경우, 터미널에서 `claude mcp add <name> --transport http <url>`을 실행합니다. 연결이 명시적으로 구성될 때까지, Claude는 서버가 존재한다는 인식이 없고 도구를 사용할 수 없습니다.

**Cloudflare와 GCP에서 원격 MCP 서버를 실행하는 것이 무료입니까?**

네, 낮음 대 중간 트래픽의 경우. Cloudflare Workers는 무료 계층에서 일일 100,000 요청을 포함합니다. Cloudflare R2는 월 10 GB 저장소, 100만 쓰기, 천만 읽기를 무료로 제공합니다 — 이그레스 비용 없음. GCP Cloud Run은 월 2백만 요청과 360,000 GB-초의 컴퓨팅을 무료로 제공합니다. 산발적인 도구 호출을 처리하는 개발자 도구는 이 제한 전체 내에서 실행될 수 있습니다.

**MCP 인증에 API 키 대신 OAuth를 왜 사용합니까?**

OAuth 2.1은 더 나은 사용자 경험을 제공합니다. API 키를 사용하면 사용자는 토큰을 구성 파일에 수동으로 복사-붙여넣기해야 합니다 — 키를 잃어버린 경우 자체 복구가 없는 다단계 프로세스. OAuth를 사용하면 Claude Desktop과 Claude Code는 흐름을 기본적으로 처리합니다: 브라우저를 열고, 사용자가 "인증"을 클릭하고, 토큰은 자동으로 저장됩니다. 사용자는 절대 구성 파일을 건드리지 않습니다.

**Claude가 내 MCP 도구를 찾을 수 없는 이유는 무엇입니까?**

가장 일반적인 원인은 MCP 서버가 클라이언트에서 구성되지 않았다는 것입니다. Claude는 서버를 자동으로 발견하지 않습니다. 서버는 구성되었지만 도구가 여전히 표시되지 않으면, `tools/list`가 인증 없이 액세스 가능한지 확인하세요 — Bearer 토큰을 요구하면, Claude는 초기 핸드셰이크 중에 도구 목록을 검색할 수 없고 서버에 도구가 없는 것처럼 행동합니다.

**MCP 도구에 큰 파일을 어떻게 전달합니까?**

~185 KB보다 큰 파일의 경우, base64 인코딩 대신 서버의 `/upload` 엔드포인트를 사용합니다. 파일을 직접(multipart/form-data) POST하고, 응답에서 URL을 받고, 도구의 파일 매개변수로 URL을 전달합니다. 서버는 서버 측에서 파일을 가져오며, 인라인 base64를 대부분의 실제 파일에 불가능하게 만드는 Claude Code의 약 256 KB 셸 출력 제한을 우회합니다.

**X-MCP-Key 헤더란 무엇입니까?**

X-MCP-Key는 Cloudflare Worker(공개 대면 게이트웨이)와 GCP Cloud Run 백엔드 간에 요청을 인증하는 데 사용되는 공유 비밀입니다. 모든 트래픽이 Worker를 통해서만 Cloud Run에 도달하도록 합니다 — 인터넷에서 직접이 아닙니다. 없으면, Cloud Run URL을 발견하는 누구든지 OAuth 검증과 할당량 적용을 우회할 수 있습니다.

**MCP 서버를 실행하기 위해 백엔드 코드를 공개해야 합니까?**

아니오. MCP 래퍼(Cloudflare Worker)만 공개 저장소일 필요가 있습니다 — API 표면을 정의하고 커뮤니티가 통합을 검사하도록 합니다. 실제 비즈니스 로직이 있는 Cloud Run 백엔드는 비공개로 남아있을 수 있습니다. 이를 통해 개방형 MCP 통합을 게시하면서 비공개 저장소에서 소유권이 있는 알고리즘 및 구현 세부사항을 유지할 수 있습니다.
