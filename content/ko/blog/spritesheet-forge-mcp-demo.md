---
title: "Claude MCP로 GIF를 게임용 스프라이트시트로 변환하기: 완벽한 가이드"
description: "단계별 데모: Claude가 Spritesheet Forge MCP를 사용하여 GIF를 스프라이트시트 PNG 및 TexturePacker 호환 atlas JSON으로 변환하는 방법 — 도구 연결, 매개변수 선택, Unity/Godot 통합 주의사항 포함."
date: "2026-05-05"
readingTime: 8
tag: "tutorial"
---

모든 게임 아티스트는 이 과정을 알고 있습니다: 애니메이션 도구에서 GIF를 내보내기, TexturePacker 열기, 프레임 열 구성, 투명 테두리 처리, 아틀라스 생성, JSON 좌표 검증, Unity 또는 Godot로 가져오기. 한 프레임을 변경하면 모든 단계를 반복합니다.

Spritesheet Forge는 호스팅되는 MCP(Model Context Protocol) 서버로, 이 전체 워크플로우를 Claude와의 대화로 이동합니다. 필요한 내용을 설명하면 Claude가 도구를 호출하고 출력 파일과 메타데이터를 받습니다. 설치할 소프트웨어가 없습니다. 형식을 외울 필요가 없습니다.

이 문서는 실제 변환을 단계별로 설명합니다 — 9프레임 GIF 애니메이션을 스프라이트시트 PNG 및 TexturePacker 호환 atlas JSON으로 변환합니다 — 정확한 도구 호출, Claude가 선택한 매개변수, 단일 세션에서 작업을 연결하는 방법을 보여줍니다.

---

## 사용 가능한 도구

Spritesheet Forge는 연결되면 Claude에 6가지 도구를 제공합니다:

| 도구 | 입력 | 출력 | 주요 매개변수 |
|---|---|---|---|
| `gif_to_spritesheet` | 애니메이션 GIF | 스프라이트시트 PNG | `columns`, `background_removal` |
| `png_to_spritesheet` | PNG 프레임 ZIP | 스프라이트시트 PNG | `columns`, `padding` |
| `split_spritesheet` | 스프라이트시트 PNG + 프레임 수 | 개별 프레임 + atlas JSON | `columns`, `rows` |
| `trim_png` | 투명 테두리가 있는 PNG | 트림된 PNG + 자르기 경계 | — |
| `frames_to_animation` | PNG 프레임 ZIP | 애니메이션 GIF | `fps` |
| `spritesheet_to_animation` | 스프라이트시트 PNG + 프레임 수 | 애니메이션 GIF | `columns`, `rows`, `fps` |

도구는 연결 가능하도록 설계되었습니다: 한 도구의 출력 URL을 다시 업로드하지 않고 다음 입력으로 직접 전달할 수 있습니다. 모든 파일 전송은 서버 측에서 발생합니다.

---

## 2분 안에 Claude 연결하기

**Claude Desktop** — `claude_desktop_config.json`에 추가합니다 (설정 → 개발자에서 찾기):

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

처음 사용할 때 Claude는 GitHub OAuth 페이지를 자동으로 엽니다 — "Authorize"를 클릭하면 토큰이 30일 동안 로컬에 저장됩니다. 인증을 위해 config 파일을 건드릴 필요가 없습니다.

---

## 데모 1: GIF를 스프라이트시트로

입력은 프레임당 75 × 165 px의 9프레임 바나나 고양이 애니메이션입니다:

<img src="/blog/spritesheet-forge-mcp-demo/input.gif" alt="입력 GIF — 프레임당 75×165 px의 9프레임 바나나 고양이 애니메이션" style="width:150px;height:auto;display:block;margin:0 auto;border-radius:0.5rem;border:1px solid var(--ui-border);">

파일을 Claude에 드롭하고 필요한 내용을 설명합니다:

![Claude 대화: 사용자가 GIF를 보내고 스프라이트시트 변환을 요청](/blog/spritesheet-forge-mcp-demo/demo-1.png)

Claude는 파일을 자동으로 업로드하고 `background_removal: true`로 `gif_to_spritesheet`를 호출합니다. 도구는 모든 프레임을 한 줄로 배열하고 출력을 Cloudflare R2에 저장된 URL로 반환합니다:

![Claude가 gif_to_spritesheet MCP 도구를 호출](/blog/spritesheet-forge-mcp-demo/demo-2.png)

결과는 정확한 픽셀 크기와 Unity Sprite Editor 설정 단계로 반환됩니다:

![Claude가 프레임 크기 테이블과 함께 스프라이트시트 결과를 반환](/blog/spritesheet-forge-mcp-demo/demo-3.png)

출력 — 675 × 165 px, 한 줄에 9프레임, 투명 배경:

![출력 스프라이트시트 — 675×165 px, 9프레임, 투명 배경](/blog/spritesheet-forge-mcp-demo/spritesheet.png)

**Claude가 선택한 매개변수:**
- `columns: 9` — 모든 프레임이 한 개의 수평 스트립에 있으며, 이는 Unity와 Godot의 단순 스프라이트 애니메이션 기본값과 일치합니다
- `background_removal: true` — 흰색 배경을 제거하여 픽셀 알파 투명도가 있는 PNG를 생성합니다

둘 다 재정의할 수 있습니다: `columns: 3`을 요청하여 3×3 그리드를 얻거나, 엔진에서 알파 대신 색상 키를 사용하는 경우 배경 제거를 생략합니다.

---

## 데모 2: 스프라이트 아틀라스 JSON

단일 후속 조치는 스프라이트시트 출력 URL에서 TexturePacker 호환 아틀라스를 생성합니다 — 이전 단계의 URL은 직접 전달되며 다시 업로드할 필요가 없습니다:

![Claude가 split_spritesheet를 호출하여 Sprite Atlas JSON 생성](/blog/spritesheet-forge-mcp-demo/demo-4.png)

![Claude가 수정된 Sprite Atlas를 프레임 좌표 테이블과 함께 반환](/blog/spritesheet-forge-mcp-demo/demo-5.png)

Claude는 가져오기 전에 TexturePacker JSON Hash 사양에 대해 출력을 검증할 수 있습니다:

![Claude가 Sprite Atlas JSON 형식을 검증 — 모든 검사 통과](/blog/spritesheet-forge-mcp-demo/demo-6.png)

최종 아틀라스 — 각각 75 × 165 px의 9프레임, 왼쪽 상단 모서리에서 0부터 시작하는 좌표:

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

이 형식은 Unity(`SpriteAtlasImporter`), Godot(`AtlasTexture`), Phaser 3(`Loader.atlas`) 및 TexturePacker JSON Hash 출력을 허용하는 다른 엔진에서 직접 로드됩니다.

---

## 도구 연결

위의 두 데모는 더 큰 도구 연결의 일부입니다. 모든 도구 출력은 Cloudflare R2에 저장된 1시간 TTL의 URL입니다. 한 도구의 URL을 다음에 직접 전달하면 다시 업로드를 피합니다:

```
gif_to_spritesheet(input.gif)
        │  스프라이트시트 PNG URL
        ▼
split_spritesheet(spritesheet URL, columns=9)
        │  atlas JSON + 개별 프레임 URL
        ▼
frames_to_animation(frame URLs, fps=12)   ← 미리보기 애니메이션
        │
        ▼
trim_png(any frame URL)                   ← 선택사항: 정리
```

한 메시지로 Claude에 전체 연결을 실행하도록 요청할 수 있습니다: *"이 GIF를 스프라이트시트로 변환하고, atlas JSON을 생성하며, 12 fps로 미리보기 애니메이션을 제공해주세요."* Claude는 각 도구를 순서대로 호출하여 URL을 자동으로 전달합니다.

한 가지 주의할 점: **출력 URL은 60분 후에 만료됩니다**. 세션이 끝나기 전에 필요한 파일을 다운로드하세요.

---

## 다음 단계

- **[Cloudflare Workers 및 GCP Cloud Run으로 원격 MCP 서버 구축](/blog/building-remote-mcp-server)** — 호스팅된 MCP 서버를 사용하지 않고 직접 MCP 서버를 구축하려면, 이는 전체 아키텍처를 다룹니다: OAuth 2.1 + PKCE, 내부 서비스 인증, R2 파일 스테이징, 도구 설계.
- *([스프라이트시트를 Unity 및 Godot로 가져오기: 단계별 가이드](/blog/spritesheet-game-engine-import) — 곧 출시)* — Unity의 Sprite Atlas 워크플로우 및 Godot의 AtlasTexture 노드에 대한 자세한 단계별 설명. atlas JSON 출력을 직접 연결하는 방법 포함.

Spritesheet Forge는 오픈소스이며 무료로 사용할 수 있습니다(무료 계층에서 월 100회 작업):

- **MCP 설정 가이드** — [clawstudiouo.com/mcp](https://clawstudiouo.com/mcp)
- **Smithery에서 원클릭 설치** — [smithery.ai](https://smithery.ai/servers/lxya98874322688423/spritesheet-forge)
- **GitHub 저장소** — [LAXY9887/Game-Dev.-Spritesheet-Forge](https://github.com/LAXY9887/Game-Dev.-Spritesheet-Forge)
- **전체 API 문서** — [GitHub Pages](https://laxy9887.github.io/Game-Dev.-Spritesheet-Forge)

---

## 자주 묻는 질문

**Spritesheet Forge란 무엇인가요?**

Spritesheet Forge는 Claude에 스프라이트시트 처리 도구에 대한 직접 액세스를 제공하는 호스팅된 MCP 서버입니다. 연결되면 Claude는 GIF를 스프라이트시트로 변환하고, PNG 프레임을 패킹하고, atlas JSON을 생성하고, 기존 스프라이트시트를 분할할 수 있습니다 — 자연어로, 로컬 소프트웨어 설치 없이.

**Spritesheet Forge를 Claude에 어떻게 연결하나요?**

Claude Desktop의 경우 `claude_desktop_config.json`에 서버 구성을 추가합니다. Claude Code CLI의 경우 `claude mcp add spritesheet-forge --transport http https://mcp.clawstudiouo.com/mcp`를 실행합니다. 처음 사용할 때 Claude는 GitHub OAuth 페이지를 자동으로 엽니다 — "Authorize"를 클릭하면 토큰이 30일 동안 저장됩니다. 전체 설정은 [clawstudiouo.com/mcp](https://clawstudiouo.com/mcp)에 있습니다.

**Spritesheet Forge는 어떤 파일 형식을 지원하나요?**

`gif_to_spritesheet`는 모든 애니메이션 GIF를 허용합니다. `png_to_spritesheet` 및 `frames_to_animation`은 PNG 프레임의 ZIP을 허용합니다. 모든 이미지 출력은 PNG이며, atlas 출력은 TexturePacker JSON Hash로, Unity, Godot, Phaser 3, Cocos2d 및 유사 엔진과 호환됩니다.

**Spritesheet Forge는 무료인가요?**

무료 계층에는 월 100회 작업이 포함됩니다 — 중간 정도의 애니메이션 양으로 적극적인 게임 개발을 충분히 지원합니다. 신용카드가 필요하지 않습니다. 서버 자체는 GitHub에서 오픈소스입니다.

**Claude는 큰 스프라이트 파일을 처리할 수 있나요?**

~185 KB보다 작은 파일은 base64로 인라인으로 전송됩니다. 더 큰 파일의 경우 Claude는 서버의 `/upload` 끝점으로 업로드하고 반환된 URL을 도구에 전달합니다. 이를 수동으로 관리할 필요가 없습니다 — Claude는 파일 크기를 감지하고 자동으로 올바른 방법을 선택합니다.

**출력 파일은 얼마나 오래 사용 가능한가요?**

도구 출력 URL은 Cloudflare R2에 1시간 TTL로 저장됩니다. 세션을 다운로드하지 않고 닫으면 파일이 만료됩니다. 워크플로우 끝에서 Claude가 다운로드 링크를 명확하게 표시하도록 요청하세요.

**한 요청에서 여러 도구를 연결할 수 있나요?**

네. Claude는 도구를 자동으로 순서대로 호출하여 각 출력 URL을 다음 도구의 입력으로 전달합니다. 예를 들어: *"이 GIF를 변환하고, 프레임으로 분할하고, 12 fps로 미리보기 GIF를 제공해주세요"*는 단계 없이 3개 도구를 실행합니다.

**atlas JSON은 어떤 게임 엔진과 호환되나요?**

출력 형식은 TexturePacker JSON Hash입니다 — 게임 개발에서 가장 널리 지원되는 아틀라스 형식입니다. Unity(`SpriteAtlasImporter`), Godot(`AtlasTexture`), Phaser 3(`Loader.atlas`), Cocos2d 및 TexturePacker 출력을 허용하는 다른 엔진과 호환됩니다.
