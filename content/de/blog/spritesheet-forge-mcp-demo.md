---
title: "Vom GIF zum spielfertigen Spritesheet: Eine Claude + MCP Live Demo"
description: "Beobachte Claude, wie er eine GIF-Animation in ein Spritesheet und TexturePacker-kompatibles Atlas-JSON mit dem Spritesheet Forge MCP-Server konvertiert — ohne manuelle Tools erforderlich."
date: "2026-05-05"
readingTime: 6
tag: "tutorial"
---

## Das Problem mit traditionellen Spritesheet-Tools

Das Konvertieren einer GIF-Animation in ein spielfertiges Spritesheet war schon immer ein mehrstufiger Prozess: TexturePacker öffnen, Spaltenzahlen konfigurieren, entscheiden, ob der Hintergrund entfernt werden soll, exportieren, Frame-Koordinaten überprüfen, anpassen. Jedes Mal, wenn du eine Animation überarbeitest, wiederholst du den gesamten Ablauf.

Was wäre, wenn du einfach beschreiben könntest, was du brauchst, und das Ergebnis bekommen würdest?

## Spritesheet Forge: Ein Spritesheet-Server für Claude

**Spritesheet Forge** ist ein gehosteter MCP-Server (Model Context Protocol), der Claude direkten Zugriff auf Spritesheet-Verarbeitungstools gibt. Nach der Verbindung kannst du Claude auffordern, GIFs zu konvertieren, PNGs in Spritesheets zu packen, vorhandene Spritesheets zu teilen, Sprite Atlas JSON zu generieren und vieles mehr — alles durch natürliche Sprache.

Es gibt keine Software zu installieren. Der Server läuft auf Cloudflare Workers und verarbeitet deine Dateien in der Cloud. Claude übernimmt den Datei-Upload, die Parameterauswahl und die Ausgabe — du beschreibst einfach das Ergebnis, das du möchtest.

## Verbinde Claude in 2 Minuten

Du kannst dich über Claude Desktop oder die Claude Code CLI verbinden:

**Claude Desktop** — hinzufügen zu `claude_desktop_config.json`:

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

Bei der ersten Verwendung öffnet Claude eine GitHub OAuth-Seite zur Authentifizierung deiner Sitzung. Das Token wird lokal gespeichert und ist 30 Tage lang gültig.

## Demo: GIF zu Spritesheet

Hier ist die Eingabe — eine 9-Frame-Bananen-Katzen-Animation bei 75 × 165 px:

<img src="/blog/spritesheet-forge-mcp-demo/input.gif" alt="Eingabe-GIF" style="width:150px;height:auto;display:block;margin:0 auto;border-radius:0.5rem;border:1px solid var(--ui-border);">

Lege die Datei in Claude ab und beschreibe, was du benötigst:

![Claude-Gespräch: Benutzer sendet GIF und fordert Spritesheet-Konvertierung an](/blog/spritesheet-forge-mcp-demo/demo-1.png)

Claude lädt die Datei automatisch hoch und ruft `gif_to_spritesheet` mit aktivierter Hintergrundentfernung auf:

![Claude ruft gif_to_spritesheet MCP-Tool auf](/blog/spritesheet-forge-mcp-demo/demo-2.png)

Das Ergebnis kommt mit den genauen Pixeldimensionen und Unity-Einrichtungsschritten zurück:

![Claude gibt Spritesheet-Ergebnis mit Frame-Dimensions-Tabelle zurück](/blog/spritesheet-forge-mcp-demo/demo-3.png)

Ausgabe-Spritesheet — 675 × 165 px, 9 Frames in einer einzelnen Reihe, transparenter Hintergrund:

![Ausgabe-Spritesheet](/blog/spritesheet-forge-mcp-demo/spritesheet.png)

## Demo: Sprite Atlas JSON

Eine einzelne Anschlussfrage genügt, um einen TexturePacker-kompatiblen Atlas zu erhalten:

![Claude ruft split_spritesheet auf, um Sprite Atlas JSON zu generieren](/blog/spritesheet-forge-mcp-demo/demo-4.png)

![Claude gibt korrigiertes Sprite Atlas mit Frame-Koordinaten-Tabelle zurück](/blog/spritesheet-forge-mcp-demo/demo-5.png)

Du kannst Claude auffordern, die Ausgabe gegen die TexturePacker JSON Hash-Spezifikation zu validieren:

![Claude validiert das Sprite Atlas JSON-Format — alle Überprüfungen bestanden](/blog/spritesheet-forge-mcp-demo/demo-6.png)

Der finale Atlas — alle 9 Frames bei 75 × 165 px, bereit zum Laden in Unity, Godot (`AtlasTexture`) oder einer beliebigen TexturePacker-kompatiblen Engine:

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

## Versuche es selbst

Spritesheet Forge ist open source und kostenlos zu nutzen (100 Operationen/Monat auf der kostenlosen Stufe):

- **MCP-Setup-Anleitung** — [clawstudiouo.com/mcp](https://clawstudiouo.com/mcp)
- **One-Click-Installation auf Smithery** — [smithery.ai](https://smithery.ai/servers/lxya98874322688423/spritesheet-forge)
- **GitHub-Repository** — [LAXY9887/Game-Dev.-Spritesheet-Forge](https://github.com/LAXY9887/Game-Dev.-Spritesheet-Forge)
- **Vollständige API-Dokumentation** — [GitHub Pages](https://laxy9887.github.io/Game-Dev.-Spritesheet-Forge)
