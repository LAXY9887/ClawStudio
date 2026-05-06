---
title: "От GIF к готовому спрайтшиту: Демонстрация Claude + MCP"
description: "Смотрите, как Claude преобразует GIF-анимацию в спрайтшит и совместимый с TexturePacker JSON-атлас с помощью MCP-сервера Spritesheet Forge — без необходимости в дополнительных инструментах."
date: "2026-05-05"
readingTime: 6
tag: "tutorial"
---

## Проблема с традиционными инструментами для спрайтшитов

Преобразование GIF-анимации в готовый для игр спрайтшит всегда было многоэтапным процессом: открыть TexturePacker, установить количество столбцов, решить, удалять ли фон, экспортировать, проверить координаты кадров, отрегулировать. Каждый раз, когда вы вносите изменения в анимацию, вы повторяете весь цикл.

Что если бы вы могли просто описать, что вам нужно, и получить результат?

## Spritesheet Forge: MCP-сервер для спрайтшитов для Claude

**Spritesheet Forge** — это размещённый MCP (Model Context Protocol) сервер, который даёт Claude прямой доступ к инструментам обработки спрайтшитов. После подключения вы можете попросить Claude преобразовать GIF, упаковать PNG в спрайтшиты, разбить существующие спрайтшиты, сгенерировать Sprite Atlas JSON и многое другое — всё через естественный язык.

Не требуется установка дополнительного ПО. Сервер работает на Cloudflare Workers и обрабатывает ваши файлы в облаке. Claude управляет загрузкой файлов, выбором параметров и результатом — вам просто нужно описать желаемый результат.

## Подключите Claude за 2 минуты

Вы можете подключиться через Claude Desktop или Claude Code CLI:

**Claude Desktop** — добавьте в `claude_desktop_config.json`:

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

При первом использовании Claude открывает страницу GitHub OAuth для аутентификации вашей сессии. Токен сохраняется локально и действует 30 дней.

## Демонстрация: GIF в спрайтшит

Вот входной файл — 9-кадровая анимация банан-кота размером 75 × 165 пикселей:

<img src="/blog/spritesheet-forge-mcp-demo/input.gif" alt="Входной GIF" style="width:150px;height:auto;display:block;margin:0 auto;border-radius:0.5rem;border:1px solid var(--ui-border);">

Перетащите файл в Claude и опишите, что вам нужно:

![Диалог Claude: пользователь отправляет GIF и просит преобразовать в спрайтшит](/blog/spritesheet-forge-mcp-demo/demo-1.png)

Claude автоматически загружает файл и вызывает `gif_to_spritesheet` с включённым удалением фона:

![Claude вызывает MCP-инструмент gif_to_spritesheet](/blog/spritesheet-forge-mcp-demo/demo-2.png)

Результат возвращается с точными размерами в пикселях и инструкциями по настройке Unity:

![Claude возвращает результат спрайтшита с таблицей размеров кадров](/blog/spritesheet-forge-mcp-demo/demo-3.png)

Выходной спрайтшит — 675 × 165 пикселей, 9 кадров в одной строке, прозрачный фон:

![Выходной спрайтшит](/blog/spritesheet-forge-mcp-demo/spritesheet.png)

## Демонстрация: Sprite Atlas JSON

Одного уточняющего вопроса достаточно для получения совместимого с TexturePacker атласа:

![Claude вызывает split_spritesheet для генерации Sprite Atlas JSON](/blog/spritesheet-forge-mcp-demo/demo-4.png)

![Claude возвращает исправленный Sprite Atlas с таблицей координат кадров](/blog/spritesheet-forge-mcp-demo/demo-5.png)

Вы можете попросить Claude проверить выход на соответствие спецификации TexturePacker JSON Hash:

![Claude проверяет формат Sprite Atlas JSON — все проверки пройдены](/blog/spritesheet-forge-mcp-demo/demo-6.png)

Финальный атлас — все 9 кадров размером 75 × 165 пикселей, готовые к загрузке в Unity, Godot (`AtlasTexture`) или любой механизм, совместимый с TexturePacker:

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

## Попробуйте сами

Spritesheet Forge — это открытый исходный код и бесплатное использование (100 операций/месяц на бесплатном плане):

- **Руководство по настройке MCP** — [clawstudiouo.com/mcp](https://clawstudiouo.com/mcp)
- **Установка в один клик на Smithery** — [smithery.ai](https://smithery.ai/servers/lxya98874322688423/spritesheet-forge)
- **Репозиторий на GitHub** — [LAXY9887/Game-Dev.-Spritesheet-Forge](https://github.com/LAXY9887/Game-Dev.-Spritesheet-Forge)
- **Полная документация API** — [GitHub Pages](https://laxy9887.github.io/Game-Dev.-Spritesheet-Forge)
