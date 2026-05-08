---
title: "GIF zu spielfertiger Spritesheet mit Claude MCP: Eine vollständige Anleitung"
description: "Schritt-für-Schritt-Demo: Wie Claude Spritesheet Forge MCP nutzt, um eine GIF in eine Spritesheet-PNG und TexturePacker-kompatible Atlas-JSON umzuwandeln — mit Tool-Verkettung, Parameterauswahl und Notizen zur Integration in Unity/Godot."
date: "2026-05-05"
readingTime: 8
tag: "tutorial"
---

Jeder Spielgrafiker kennt den Ablauf: GIF aus dem Animationsprogramm exportieren, TexturePacker öffnen, Frame-Spalten konfigurieren, transparente Ränder behandeln, Atlas generieren, JSON-Koordinaten validieren, in Unity oder Godot importieren. Ändern Sie einen Frame und wiederholen Sie jeden Schritt.

Spritesheet Forge ist ein gehosteter MCP-Server (Model Context Protocol), der diesen gesamten Workflow in eine Konversation mit Claude verlegt. Sie beschreiben, was Sie benötigen, Claude ruft die Tools auf, und Sie erhalten die Ausgabedateien und Metadaten zurück. Keine Software zum Installieren. Keine Formatmemorialisierung erforderlich.

Dieser Artikel zeigt eine echte Konvertierung — eine 9-Frame-GIF-Animation zu einer Spritesheet-PNG und TexturePacker-kompatible Atlas-JSON — mit den genauen Tool-Aufrufen, den von Claude gewählten Parametern und wie Sie Operationen in einer einzigen Sitzung verketten.

---

## Verfügbare Tools

Spritesheet Forge stellt Claude nach der Verbindung sechs Tools zur Verfügung:

| Tool | Eingabe | Ausgabe | Wichtigste Parameter |
|---|---|---|---|
| `gif_to_spritesheet` | Animierte GIF | Spritesheet PNG | `columns`, `background_removal` |
| `png_to_spritesheet` | ZIP von PNG-Frames | Spritesheet PNG | `columns`, `padding` |
| `split_spritesheet` | Spritesheet PNG + Frame-Anzahl | Einzelne Frames + Atlas JSON | `columns`, `rows` |
| `trim_png` | PNG mit transparentem Rand | Gekürzte PNG + Zuschneiderahmen | — |
| `frames_to_animation` | ZIP von PNG-Frames | Animierte GIF | `fps` |
| `spritesheet_to_animation` | Spritesheet PNG + Frame-Anzahl | Animierte GIF | `columns`, `rows`, `fps` |

Tools sind für Verkettung ausgelegt: Die Ausgabe-URL eines Tools kann direkt als Eingabe für das nächste übergeben werden, ohne dass ein erneuter Upload erforderlich ist. Alle Dateiübertragungen finden serverseitig statt.

---

## Claude in 2 Minuten verbinden

**Claude Desktop** — zu `claude_desktop_config.json` hinzufügen (über Einstellungen → Entwickler finden):

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

Bei der ersten Verwendung öffnet Claude automatisch eine GitHub OAuth-Seite — klicken Sie auf „Authorize" und das Token wird lokal für 30 Tage gespeichert. Sie müssen sich nie mit einer Konfigurationsdatei für die Authentifizierung befassen.

---

## Demo 1: GIF zu Spritesheet

Die Eingabe ist eine 9-Frame-Banana-Katzen-Animation mit 75 × 165 px pro Frame:

<img src="/blog/spritesheet-forge-mcp-demo/input.gif" alt="Eingabe-GIF — 9-Frame-Banana-Katzen-Animation mit 75×165 px" style="width:150px;height:auto;display:block;margin:0 auto;border-radius:0.5rem;border:1px solid var(--ui-border);">

Ziehen Sie die Datei in Claude und beschreiben Sie, was Sie benötigen:

![Claude-Konversation: Benutzer sendet GIF und fragt nach Spritesheet-Konvertierung](/blog/spritesheet-forge-mcp-demo/demo-1.png)

Claude lädt die Datei automatisch hoch und ruft `gif_to_spritesheet` mit `background_removal: true` auf. Das Tool ordnet alle Frames in einer einzelnen Reihe an und gibt die Ausgabe als URL zurück, die in Cloudflare R2 gespeichert ist:

![Claude ruft gif_to_spritesheet MCP-Tool auf](/blog/spritesheet-forge-mcp-demo/demo-2.png)

Das Ergebnis wird mit exakten Pixelabmessungen und Unity Sprite Editor-Konfigurationsschritten zurückgegeben:

![Claude gibt Spritesheet-Ergebnis mit Frame-Dimensionstabelle zurück](/blog/spritesheet-forge-mcp-demo/demo-3.png)

Ausgabe — 675 × 165 px, 9 Frames in einer einzelnen Reihe, transparenter Hintergrund:

![Ausgabe-Spritesheet — 675×165 px, 9 Frames, transparenter Hintergrund](/blog/spritesheet-forge-mcp-demo/spritesheet.png)

**Parameter, die Claude gewählt hat:**
- `columns: 9` — alle Frames in einem horizontalen Streifen, was der Standarderwartung von Unity und Godot für einfache Sprite-Animationen entspricht
- `background_removal: true` — entfernt den weißen Hintergrund und erzeugt eine PNG mit Pro-Pixel-Alpha-Transparenz

Sie können beide überschreiben: Fragen Sie nach `columns: 3`, um ein 3×3-Gitter zu erhalten, oder lassen Sie die Hintergrundentfernung weg, wenn Ihre Engine einen Farbschlüssel statt Alpha verwendet.

---

## Demo 2: Sprite Atlas JSON

Eine einzelne Folgefrage generiert ein TexturePacker-kompatibles Atlas aus der Spritesheet-Ausgabe-URL — die URL aus dem vorherigen Schritt wird direkt übergeben, kein erneuter Upload erforderlich:

![Claude ruft split_spritesheet auf, um Sprite Atlas JSON zu generieren](/blog/spritesheet-forge-mcp-demo/demo-4.png)

![Claude gibt korrigierte Sprite Atlas mit Frame-Koordinatentabelle zurück](/blog/spritesheet-forge-mcp-demo/demo-5.png)

Claude kann die Ausgabe vor dem Import gegen die TexturePacker JSON Hash-Spezifikation validieren:

![Claude validiert das Sprite Atlas JSON-Format — alle Checks bestanden](/blog/spritesheet-forge-mcp-demo/demo-6.png)

Finales Atlas — 9 Frames mit je 75 × 165 px, Koordinaten null-indiziert von der oberen linken Ecke:

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

Dieses Format wird direkt in Unity (`SpriteAtlasImporter`), Godot (`AtlasTexture`), Phaser 3 (`Loader.atlas`) und jedem anderen Engine geladen, das TexturePacker JSON Hash-Ausgabe akzeptiert.

---

## Tool-Verkettung

Die beiden oben gezeigten Demos sind Teil einer größeren Tool-Verkettung. Jede Tool-Ausgabe ist eine URL, die in Cloudflare R2 mit einer 1-Stunden-TTL gespeichert ist. Eine URL von einem Tool direkt in den nächsten zu übergeben, vermeidet erneute Uploads:

```
gif_to_spritesheet(input.gif)
        │  Spritesheet PNG-URL
        ▼
split_spritesheet(Spritesheet-URL, columns=9)
        │  Atlas JSON + einzelne Frame-URLs
        ▼
frames_to_animation(Frame-URLs, fps=12)   ← Vorschau-Animation
        │
        ▼
trim_png(beliebige Frame-URL)                   ← optionale Bereinigung
```

Sie können Claude bitten, diese gesamte Kette in einer einzigen Nachricht auszuführen: *„Konvertiere diese GIF zu einer Spritesheet, generiere die Atlas-JSON und gib mir eine Vorschau-Animation mit 12 fps."* Claude ruft jedes Tool der Reihe nach auf und übergebe URLs zwischen ihnen automatisch.

Eine Einschränkung, die Sie im Hinterkopf behalten sollten: **Ausgabe-URLs verfallen nach 60 Minuten**. Laden Sie alle benötigten Dateien vor Ende der Sitzung herunter.

---

## MCP-Tool-Referenz (für KI-Agenten)

Vollständige Eingabe-Schemata für alle sieben Spritesheet Forge Tools. Diese Definitionen beschreiben die genauen Parameter, die KI-Agenten beim Aufrufen der jeweiligen Tools über MCP übergeben können.

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

## Was kommt als nächstes

- **[Einen Remote MCP Server mit Cloudflare Workers und GCP Cloud Run erstellen](/blog/building-remote-mcp-server)** — wenn Sie Ihren eigenen MCP Server erstellen möchten, anstatt einen gehosteten zu nutzen, deckt dies die vollständige Architektur ab: OAuth 2.1 + PKCE, interne Service-Auth, R2-Datei-Staging und Tool-Design.
- *([Spritesheets in Unity und Godot importieren: Ein Schritt-für-Schritt-Leitfaden](/blog/spritesheet-game-engine-import) — demnächst)* — detaillierte Anleitungen für Unitys Sprite Atlas-Workflow und Godots AtlasTexture-Knoten, einschließlich wie die Atlas-JSON-Ausgabe direkt verdrahtet wird.

Spritesheet Forge ist Open Source und kostenlos zu nutzen (100 Operationen/Monat in der kostenlosen Version):

- **MCP-Konfigurationsanleitung** — [clawstudiouo.com/mcp](https://clawstudiouo.com/mcp)
- **One-Click-Installation auf Smithery** — [smithery.ai](https://smithery.ai/servers/lxya98874322688423/spritesheet-forge)
- **GitHub-Repository** — [LAXY9887/Game-Dev.-Spritesheet-Forge](https://github.com/LAXY9887/Game-Dev.-Spritesheet-Forge)
- **Vollständige API-Dokumentation** — [GitHub Pages](https://laxy9887.github.io/Game-Dev.-Spritesheet-Forge)

---

## Häufig gestellte Fragen

**Was ist Spritesheet Forge?**

Spritesheet Forge ist ein gehosteter MCP Server, der Claude direkten Zugriff auf Spritesheet-Verarbeitungstools gibt. Nach der Verbindung kann Claude GIFs in Spritesheets konvertieren, PNG-Frames packen, Atlas-JSON generieren, vorhandene Spritesheets aufteilen und mehr — durch natürliche Sprache, ohne dass eine lokale Softwareinstallation erforderlich ist.

**Wie verbinde ich Spritesheet Forge mit Claude?**

Für Claude Desktop fügen Sie die Server-Konfiguration zu `claude_desktop_config.json` hinzu. Für Claude Code CLI führen Sie `claude mcp add spritesheet-forge --transport http https://mcp.clawstudiouo.com/mcp` aus. Bei der ersten Verwendung öffnet Claude automatisch eine GitHub OAuth-Seite — klicken Sie auf „Authorize" und das Token wird für 30 Tage gespeichert. Die vollständige Konfiguration befindet sich unter [clawstudiouo.com/mcp](https://clawstudiouo.com/mcp).

**Welche Dateiformate unterstützt Spritesheet Forge?**

`gif_to_spritesheet` akzeptiert beliebige animierte GIFs. `png_to_spritesheet` und `frames_to_animation` akzeptieren ein ZIP von PNG-Frames. Alle Bildausgaben sind PNG; Atlas-Ausgabe ist TexturePacker JSON Hash, kompatibel mit Unity, Godot, Phaser 3, Cocos2d und ähnlichen Engines.

**Ist Spritesheet Forge kostenlos?**

Die kostenlose Version umfasst 100 Operationen pro Monat — ausreichend für aktive Spielentwicklung mit moderatem Animationsvolumen. Keine Kreditkarte erforderlich. Der Server selbst ist Open Source auf GitHub.

**Kann Claude große Spritedateien verarbeiten?**

Dateien kleiner als ~185 KB werden inline als Base64 gesendet. Bei größeren Dateien lädt Claude auf den `/upload`-Endpoint des Servers hoch und übergibt die zurückgegebene URL stattdessen dem Tool. Sie verwalten dies nicht manuell — Claude erkennt die Dateigröße und wählt automatisch die richtige Methode.

**Wie lange sind Ausgabedateien verfügbar?**

Tool-Ausgabe-URLs werden in Cloudflare R2 mit einer 1-Stunden-TTL gespeichert. Wenn Sie die Sitzung schließen, ohne herunterzuladen, verfallen die Dateien. Bitten Sie Claude, die Download-Links am Ende eines Workflows deutlich anzuzeigen.

**Kann ich mehrere Tools in einer Anfrage verketten?**

Ja. Claude ruft Tools automatisch der Reihe nach auf und übergibt jede Ausgabe-URL als Eingabe des nächsten Tools. Zum Beispiel: *„Konvertiere diese GIF, teile sie in Frames auf und gib mir eine Vorschau-GIF mit 12 fps"* führt drei Tools ohne manuelle Schritte dazwischen aus.

**Mit welchen Game Engines ist die Atlas-JSON kompatibel?**

Das Ausgabeformat ist TexturePacker JSON Hash — das am weitesten unterstützte Atlas-Format in der Spieleentwicklung. Es ist kompatibel mit Unity (`SpriteAtlasImporter`), Godot (`AtlasTexture`), Phaser 3 (`Loader.atlas`), Cocos2d und jedem anderen Engine, das TexturePacker-Ausgabe akzeptiert.
