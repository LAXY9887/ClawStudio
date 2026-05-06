---
title: "GIF에서 게임 준비 완료 스프라이트시트까지: Claude + MCP 라이브 데모"
description: "Claude가 MCP 서버인 Spritesheet Forge를 사용하여 GIF 애니메이션을 스프라이트시트 및 TexturePacker 호환 atlas JSON으로 변환하는 과정을 확인하세요 — 수동 도구가 필요하지 않습니다."
date: "2026-05-05"
readingTime: 6
tag: "tutorial"
---

## 기존 스프라이트시트 도구의 문제점

GIF 애니메이션을 게임 준비 완료 스프라이트시트로 변환하는 것은 항상 여러 단계의 프로세스였습니다: TexturePacker를 열고, 열의 개수를 설정하고, 배경을 제거할지 결정하고, 내보내고, 프레임 좌표를 확인하고, 조정합니다. 애니메이션을 반복 개선할 때마다 전체 주기를 반복합니다.

필요한 것을 설명하고 결과를 얻을 수 있다면 어떨까요?

## Spritesheet Forge: Claude를 위한 스프라이트시트 서버

**Spritesheet Forge**는 Claude에게 스프라이트시트 처리 도구에 대한 직접 접근을 제공하는 호스팅된 MCP (Model Context Protocol) 서버입니다. 연결되면 자연스러운 언어를 통해 GIF를 변환하고, PNG를 스프라이트시트로 압축하고, 기존 스프라이트시트를 분할하고, Sprite Atlas JSON을 생성할 수 있습니다 — 모두 자연스러운 언어를 통해 수행됩니다.

설치할 소프트웨어가 없습니다. 서버는 Cloudflare Workers에서 실행되고 파일을 클라우드에서 처리합니다. Claude는 파일 업로드, 매개변수 선택 및 출력을 처리합니다 — 원하는 결과를 설명하기만 하면 됩니다.

## 2분 안에 Claude 연결하기

Claude Desktop 또는 Claude Code CLI를 통해 연결할 수 있습니다:

**Claude Desktop** — `claude_desktop_config.json`에 추가:

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

처음 사용할 때 Claude는 GitHub OAuth 페이지를 열어 세션을 인증합니다. 토큰은 로컬에 저장되고 30일 동안 유효합니다.

## 데모: GIF에서 스프라이트시트로

입력 예시 — 75 × 165 px인 9프레임 바나나 고양이 애니메이션입니다:

<img src="/blog/spritesheet-forge-mcp-demo/input.gif" alt="입력 GIF" style="width:150px;height:auto;display:block;margin:0 auto;border-radius:0.5rem;border:1px solid var(--ui-border);">

파일을 Claude에 드롭하고 필요한 것을 설명합니다:

![Claude 대화: 사용자가 GIF를 전송하고 스프라이트시트 변환을 요청합니다](/blog/spritesheet-forge-mcp-demo/demo-1.png)

Claude는 파일을 자동으로 업로드하고 배경 제거가 활성화된 상태로 `gif_to_spritesheet`를 호출합니다:

![Claude가 gif_to_spritesheet MCP 도구를 호출합니다](/blog/spritesheet-forge-mcp-demo/demo-2.png)

결과는 정확한 픽셀 치수와 Unity 설정 단계를 포함하여 반환됩니다:

![Claude가 프레임 치수 테이블이 있는 스프라이트시트 결과를 반환합니다](/blog/spritesheet-forge-mcp-demo/demo-3.png)

출력 스프라이트시트 — 675 × 165 px, 단일 행의 9프레임, 투명한 배경:

![출력 스프라이트시트](/blog/spritesheet-forge-mcp-demo/spritesheet.png)

## 데모: Sprite Atlas JSON

TexturePacker 호환 atlas를 얻기 위해 한 번의 후속 요청만 필요합니다:

![Claude가 split_spritesheet를 호출하여 Sprite Atlas JSON을 생성합니다](/blog/spritesheet-forge-mcp-demo/demo-4.png)

![Claude가 프레임 좌표 테이블이 있는 수정된 Sprite Atlas를 반환합니다](/blog/spritesheet-forge-mcp-demo/demo-5.png)

Claude에게 출력을 TexturePacker JSON Hash 사양에 대해 검증하도록 요청할 수 있습니다:

![Claude가 Sprite Atlas JSON 형식을 검증합니다 — 모든 검사 통과](/blog/spritesheet-forge-mcp-demo/demo-6.png)

최종 atlas — 모든 9프레임이 75 × 165 px이며, Unity, Godot (`AtlasTexture`) 또는 TexturePacker 호환 엔진에 로드할 준비가 완료되었습니다:

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

## 직접 시도해보기

Spritesheet Forge는 오픈 소스이며 무료로 사용할 수 있습니다(무료 티어에서 월 100회 작업):

- **MCP 설정 가이드** — [clawstudiouo.com/mcp](https://clawstudiouo.com/mcp)
- **Smithery에 한 번 클릭으로 설치** — [smithery.ai](https://smithery.ai/servers/lxya98874322688423/spritesheet-forge)
- **GitHub 저장소** — [LAXY9887/Game-Dev.-Spritesheet-Forge](https://github.com/LAXY9887/Game-Dev.-Spritesheet-Forge)
- **전체 API 문서** — [GitHub Pages](https://laxy9887.github.io/Game-Dev.-Spritesheet-Forge)
