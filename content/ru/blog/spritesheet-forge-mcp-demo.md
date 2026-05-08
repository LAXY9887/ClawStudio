---
title: "GIF в готовый к игре спрайтлист с Claude MCP: полное руководство"
description: "Пошаговое демонстрация: как Claude использует Spritesheet Forge MCP для преобразования GIF в PNG спрайтлист и JSON атлас совместимый с TexturePacker — с цепочками инструментов, выбором параметров и заметками по интеграции с Unity/Godot."
date: "2026-05-05"
readingTime: 8
tag: "tutorial"
---

Каждый игровой художник знает это: экспортировать GIF из инструмента анимации, открыть TexturePacker, настроить колонки кадров, справиться с прозрачными границами, сгенерировать атлас, проверить координаты JSON, импортировать в Unity или Godot. Измени один кадр — и ты повторишь все шаги сначала.

Spritesheet Forge — это размещённый MCP (Model Context Protocol) сервер, который перемещает весь этот рабочий процесс в разговор с Claude. Ты описываешь, что тебе нужно, Claude вызывает инструменты, и ты получаешь файлы вывода и метаданные. Никакого программного обеспечения для установки. Никакого запоминания форматов.

В этой статье рассматривается реальное преобразование — 9-кадровую GIF-анимацию в PNG спрайтлист и JSON атлас совместимый с TexturePacker — показывая точные вызовы инструментов, параметры, выбранные Claude, и как связывать операции в одном сеансе.

---

## Доступные инструменты

Spritesheet Forge предоставляет Claude шесть инструментов после подключения:

| Инструмент | Вход | Выход | Ключевые параметры |
|---|---|---|---|
| `gif_to_spritesheet` | Анимированный GIF | PNG спрайтлист | `columns`, `background_removal` |
| `png_to_spritesheet` | ZIP с PNG кадрами | PNG спрайтлист | `columns`, `padding` |
| `split_spritesheet` | PNG спрайтлист + количество кадров | Отдельные кадры + atlas JSON | `columns`, `rows` |
| `trim_png` | PNG с прозрачной границей | Обрезанный PNG + границы обрезки | — |
| `frames_to_animation` | ZIP с PNG кадрами | Анимированный GIF | `fps` |
| `spritesheet_to_animation` | PNG спрайтлист + количество кадров | Анимированный GIF | `columns`, `rows`, `fps` |

Инструменты предназначены для цепочки: URL выхода одного инструмента можно передать прямо как вход в следующий без какой-либо повторной загрузки. Все передачи файлов происходят на стороне сервера.

---

## Подключи Claude за 2 минуты

**Claude Desktop** — добавь в `claude_desktop_config.json` (найди через Settings → Developer):

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

При первом использовании Claude автоматически открывает страницу GitHub OAuth — нажми «Authorize» и токен сохраняется локально на 30 дней. Ты никогда не трогаешь файл конфигурации для аутентификации.

---

## Демонстрация 1: GIF в спрайтлист

Вход — 9-кадровая анимация «банановый кот» размером 75 × 165 пикселей за кадр:

<img src="/blog/spritesheet-forge-mcp-demo/input.gif" alt="Входной GIF — 9-кадровая анимация банана-кота размером 75×165 пикс." style="width:150px;height:auto;display:block;margin:0 auto;border-radius:0.5rem;border:1px solid var(--ui-border);">

Перетащи файл в Claude и опиши, что тебе нужно:

![Диалог Claude: пользователь отправляет GIF и просит преобразовать в спрайтлист](/blog/spritesheet-forge-mcp-demo/demo-1.png)

Claude автоматически загружает файл и вызывает `gif_to_spritesheet` с `background_removal: true`. Инструмент расставляет все кадры в один ряд и возвращает вывод как URL, сохранённый в Cloudflare R2:

![Claude вызывает MCP инструмент gif_to_spritesheet](/blog/spritesheet-forge-mcp-demo/demo-2.png)

Результат приходит с точными размерами в пиксели и шагами настройки Unity Sprite Editor:

![Claude возвращает результат спрайтлиста с таблицей размеров кадров](/blog/spritesheet-forge-mcp-demo/demo-3.png)

Выход — 675 × 165 пикс., 9 кадров в одном ряду, прозрачный фон:

![Выходной спрайтлист — 675×165 пикс., 9 кадров, прозрачный фон](/blog/spritesheet-forge-mcp-demo/spritesheet.png)

**Параметры, выбранные Claude:**
- `columns: 9` — все кадры в одной горизонтальной полосе, что соответствует ожидаемому по умолчанию в Unity и Godot для простых спрайт-анимаций
- `background_removal: true` — удаляет белый фон, производя PNG с прозрачностью для каждого пикселя

Ты можешь переопределить либо: попроси `columns: 3` для сетки 3×3, или опусти удаление фона, если твой движок использует цветовой ключ вместо альфа.

---

## Демонстрация 2: Sprite Atlas JSON

Единственный последующий запрос генерирует совместимый с TexturePacker атлас из выхода спрайтлиста — URL из предыдущего шага передаётся напрямую, повторная загрузка не требуется:

![Claude вызывает split_spritesheet для генерации Sprite Atlas JSON](/blog/spritesheet-forge-mcp-demo/demo-4.png)

![Claude возвращает исправленный Sprite Atlas с таблицей координат кадров](/blog/spritesheet-forge-mcp-demo/demo-5.png)

Claude может проверить выход против спецификации TexturePacker JSON Hash перед импортом:

![Claude проверяет формат Sprite Atlas JSON — все проверки пройдены](/blog/spritesheet-forge-mcp-demo/demo-6.png)

Итоговый атлас — 9 кадров по 75 × 165 пикс. каждый, координаты с нулевым индексом от верхнего левого угла:

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

Этот формат загружается напрямую в Unity (`SpriteAtlasImporter`), Godot (`AtlasTexture`), Phaser 3 (`Loader.atlas`) и любой другой движок, поддерживающий вывод TexturePacker JSON Hash.

---

## Цепочка инструментов

Две демонстрации выше — часть более крупной цепочки инструментов. Каждый выход инструмента — это URL, сохранённый в Cloudflare R2 с TTL в 1 час. Передача URL от одного инструмента напрямую в следующий избегает повторной загрузки:

```
gif_to_spritesheet(input.gif)
        │  URL спрайтлиста PNG
        ▼
split_spritesheet(spritesheet URL, columns=9)
        │  atlas JSON + URL отдельных кадров
        ▼
frames_to_animation(frame URLs, fps=12)   ← предпросмотр анимации
        │
        ▼
trim_png(any frame URL)                   ← дополнительная очистка
```

Ты можешь попросить Claude запустить всю эту цепочку в одном сообщении: *«Преобразуй этот GIF в спрайтлист, сгенерируй JSON атлас и дай мне предпросмотр анимации на 12 fps.»* Claude вызывает каждый инструмент по очереди, автоматически передавая URL между ними.

Одно ограничение, которое следует помнить: **выходные URL истекают через 60 минут**. Загрузи любые файлы, которые тебе нужны, перед концом сеанса.

---

## Справочник инструментов MCP (для ИИ-агентов)

Полные схемы входных данных для всех семи инструментов Spritesheet Forge. Эти определения описывают точные параметры, которые ИИ-агенты могут передавать при вызове каждого инструмента через MCP.

### gif_to_spritesheet

```json
{
  "name": "gif_to_spritesheet",
  "description": "Converts an animated GIF into a sprite sheet PNG.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "file": { "type": "string", "description": "GIF file — base64 data URI or HTTPS URL" },
      "columns": { "type": "integer", "description": "Grid columns (auto-calculated if omitted)" },
      "padding": { "type": "integer", "default": 0, "description": "Pixel gap between frames" },
      "remove_bg": { "type": "boolean", "default": false, "description": "Remove background from each frame" },
      "bg_color": { "type": "string", "default": "auto", "description": "\"auto\" or \"#RRGGBB\"" },
      "tolerance": { "type": "integer", "default": 30, "description": "Background removal threshold 0–255" }
    },
    "required": ["file"]
  }
}
```

### gif_to_frames

```json
{
  "name": "gif_to_frames",
  "description": "Extracts all frames from an animated GIF and returns them as individual PNG files in a ZIP archive.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "file": { "type": "string", "description": "GIF file — base64 data URI or HTTPS URL" },
      "remove_bg": { "type": "boolean", "default": false },
      "bg_color": { "type": "string", "default": "auto" },
      "tolerance": { "type": "integer", "default": 30 }
    },
    "required": ["file"]
  }
}
```

### png_to_spritesheet

```json
{
  "name": "png_to_spritesheet",
  "description": "Packs multiple PNG images into a single sprite sheet with optional atlas metadata.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "files": { "type": "array", "items": { "type": "string" }, "description": "PNG files — base64 data URIs or HTTPS URLs" },
      "layout": { "type": "string", "default": "grid", "enum": ["grid", "horizontal", "vertical", "packed"] },
      "columns": { "type": "integer", "description": "Grid columns (auto if omitted)" },
      "cell_mode": { "type": "string", "default": "auto_max", "enum": ["auto_max", "auto_uniform", "fixed"] },
      "cell_width": { "type": "integer", "description": "Required when cell_mode=fixed" },
      "cell_height": { "type": "integer", "description": "Required when cell_mode=fixed" },
      "padding": { "type": "integer", "default": 0 },
      "bg_color": { "type": "string", "default": "transparent" },
      "power_of_2": { "type": "boolean", "default": false, "description": "Pad canvas to next power of 2" },
      "trim_input": { "type": "boolean", "default": false, "description": "Auto-trim transparent edges before packing" },
      "extrude": { "type": "integer", "default": 0, "description": "Extrude outermost pixels by N px per frame" },
      "metadata_format": { "type": "string", "default": "none", "enum": ["none", "json_array", "json_hash", "css"] }
    },
    "required": ["files"]
  }
}
```

### split_spritesheet

```json
{
  "name": "split_spritesheet",
  "description": "Splits a sprite sheet PNG into individual frames and optionally exports an atlas JSON.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "file": { "type": "string", "description": "Spritesheet PNG — base64 data URI or HTTPS URL" },
      "columns": { "type": "integer" },
      "rows": { "type": "integer" },
      "cell_width": { "type": "integer" },
      "cell_height": { "type": "integer" },
      "padding": { "type": "integer", "default": 0 },
      "frame_count": { "type": "integer", "description": "Actual frame count if last row is incomplete" },
      "skip_empty": { "type": "boolean", "default": true },
      "output": { "type": "string", "default": "frames", "enum": ["frames", "metadata", "both"] },
      "metadata_format": { "type": "string", "enum": ["json_array", "json_hash", "css"] }
    },
    "required": ["file"]
  }
}
```

### spritesheet_to_animation

```json
{
  "name": "spritesheet_to_animation",
  "description": "Converts a sprite sheet PNG into an animated GIF or WebP.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "file": { "type": "string", "description": "Spritesheet PNG — base64 data URI or HTTPS URL" },
      "columns": { "type": "integer" },
      "rows": { "type": "integer" },
      "frame_count": { "type": "integer" },
      "duration": { "type": "integer", "default": 100, "description": "Frame duration in ms" },
      "loop": { "type": "integer", "default": 0, "description": "0 = infinite" },
      "output_format": { "type": "string", "default": "gif", "enum": ["gif", "webp"] }
    },
    "required": ["file"]
  }
}
```

### frames_to_animation

```json
{
  "name": "frames_to_animation",
  "description": "Combines multiple PNG frames into an animated GIF or WebP.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "files": { "type": "array", "items": { "type": "string" }, "description": "PNG frame files in order" },
      "duration": { "type": "integer", "default": 100, "description": "Frame duration in ms (10–10000)" },
      "loop": { "type": "integer", "default": 0 },
      "output_format": { "type": "string", "default": "gif", "enum": ["gif", "webp"] }
    },
    "required": ["files"]
  }
}
```

### trim_png

```json
{
  "name": "trim_png",
  "description": "Crops transparent edges from one or more PNG files.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "files": { "type": "array", "items": { "type": "string" }, "description": "PNG files — single returns PNG, multiple returns ZIP" },
      "threshold": { "type": "integer", "default": 0, "description": "Alpha threshold 0–255" },
      "padding": { "type": "integer", "default": 0, "description": "Transparent margin to preserve after trim" }
    },
    "required": ["files"]
  }
}
```

---

## Что дальше

- **[Building a Remote MCP Server with Cloudflare Workers and GCP Cloud Run](/blog/building-remote-mcp-server)** — если ты хочешь создать свой собственный MCP сервер вместо использования размещённого, здесь рассматривается полная архитектура: OAuth 2.1 + PKCE, внутренняя аутентификация сервиса, R2 file staging и проектирование инструментов.
- *([Importing Spritesheets into Unity and Godot: A Step-by-Step Guide](/blog/spritesheet-game-engine-import) — coming soon)* — подробные пошаговые руководства для рабочего процесса Unity Sprite Atlas и узла Godot AtlasTexture, включая как напрямую подключить выход JSON атласа.

Spritesheet Forge с открытым исходным кодом и бесплатен в использовании (100 операций/месяц на бесплатном уровне):

- **Руководство по настройке MCP** — [clawstudiouo.com/mcp](https://clawstudiouo.com/mcp)
- **Установка в один клик на Smithery** — [smithery.ai](https://smithery.ai/servers/lxya98874322688423/spritesheet-forge)
- **GitHub репозиторий** — [LAXY9887/Game-Dev.-Spritesheet-Forge](https://github.com/LAXY9887/Game-Dev.-Spritesheet-Forge)
- **Полная документация API** — [GitHub Pages](https://laxy9887.github.io/Game-Dev.-Spritesheet-Forge)

---

## Часто задаваемые вопросы

**Что такое Spritesheet Forge?**

Spritesheet Forge — это размещённый MCP сервер, который предоставляет Claude прямой доступ к инструментам обработки спрайтлистов. После подключения Claude может преобразовывать GIF в спрайтлисты, упаковывать PNG кадры, генерировать JSON атласы, разбивать существующие спрайтлисты и многое другое — через естественный язык, без установки локального программного обеспечения.

**Как мне подключить Spritesheet Forge к Claude?**

Для Claude Desktop добавь конфиг сервера в `claude_desktop_config.json`. Для Claude Code CLI запусти `claude mcp add spritesheet-forge --transport http https://mcp.clawstudiouo.com/mcp`. При первом использовании Claude автоматически открывает страницу GitHub OAuth — нажми «Authorize» и токен сохраняется на 30 дней. Полная настройка доступна на [clawstudiouo.com/mcp](https://clawstudiouo.com/mcp).

**Какие форматы файлов поддерживает Spritesheet Forge?**

`gif_to_spritesheet` принимает любой анимированный GIF. `png_to_spritesheet` и `frames_to_animation` принимают ZIP с PNG кадрами. Все выходы изображений — это PNG; выход атласа — это TexturePacker JSON Hash, совместимый с Unity, Godot, Phaser 3, Cocos2d и аналогичными движками.

**Является ли Spritesheet Forge бесплатным?**

Бесплатный уровень включает 100 операций в месяц — достаточно для активной разработки игр с умеренным объёмом анимации. Кредитная карта не требуется. Сам сервер является открытым исходным кодом на GitHub.

**Может ли Claude обрабатывать большие файлы спрайтов?**

Файлы размером менее ~185 КБ отправляются встроенно как base64. Для больших файлов Claude загружает на endpoint `/upload` сервера и передаёт возвращённый URL инструменту вместо этого. Ты не управляешь этим вручную — Claude обнаруживает размер файла и автоматически выбирает нужный метод.

**Как долго доступны выходные файлы?**

URL выхода инструмента сохраняются в Cloudflare R2 с TTL в 1 час. Если ты закроешь сеанс без загрузки, файлы истекут. Попроси Claude четко вывести ссылки для загрузки в конце рабочего процесса.

**Могу ли я связать несколько инструментов в одном запросе?**

Да. Claude вызывает инструменты по очереди автоматически, передавая каждый выходной URL как вход следующего инструмента. Например: *«Преобразуй этот GIF, разбей его на кадры и дай мне GIF предпросмотр на 12 fps»* запускает три инструмента без каких-либо ручных шагов между ними.

**С какими игровыми движками совместим JSON атлас?**

Выходной формат — TexturePacker JSON Hash — наиболее широко поддерживаемый формат атласа в разработке игр. Он совместим с Unity (`SpriteAtlasImporter`), Godot (`AtlasTexture`), Phaser 3 (`Loader.atlas`), Cocos2d и любым другим движком, поддерживающим вывод TexturePacker.
