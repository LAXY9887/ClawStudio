---
title: "Einen Remote MCP Server mit Cloudflare Workers und GCP Cloud Run aufbauen"
description: "Schritt-für-Schritt-Anleitung zum Aufbau eines gehosteten MCP Servers auf Cloudflare Workers und GCP Cloud Run — mit OAuth 2.1 + PKCE, interner Service-Authentifizierung, R2 File Staging und privatem Backend-Code."
date: "2026-05-06"
readingTime: 15
tag: "guide"
---

## Ausgangspunkt: Eine bestehende API

Bevor MCP ins Spiel kam, verfügte Spritesheet Forge bereits über ein funktionierendes Backend: eine Reihe von Bildverarbeitungs-APIs, die auf Google Cloud Platform laufen. Die APIs erledigten die eigentliche Arbeit — Konvertierung von GIFs zu Spritesheets, Entfernung transparenter Ränder, Packen von Frames, Generierung von Atlas-JSON.

MCP (Model Context Protocol) ist ein offener Standard, der es KI-Assistenten wie Claude ermöglicht, Tools und APIs direkt durch natürliche Sprache aufzurufen. Was MCP bietet, ist eine **KI-native Schnittstelle** auf Basis dieser existierenden API. Anstatt Endpoints direkt aufzurufen, kann Claude diese Operationen nun durch natürliche Sprache aufrufen. Das Backend blieb unverändert. Was sich geändert hat, ist, wie man es erreicht.

Diese Unterscheidung ist wichtig für das Verständnis der Architektur: Dies ist kein Neubau von Grund auf. Es ist eine neue Schicht, die vor etwas sitzt, das bereits funktioniert.

### Warum GCP?

Wenn Sie ein neues Projekt starten und sich noch nicht für einen Cloud-Provider entschieden haben, ist der serverlose GCP-Stack ernsthaft zu beachten — besonders für Entwickler-Tools und Dienstprogramme mit unvorhersehbarem Datenverkehr.

Die Schlüsseleigenschaft ist **Scale to Zero**. Cloud Run, GCPs verwaltete Container-Runtime, wird komplett heruntergefahren, wenn keine Anfragen vorhanden sind, und startet in Sekunden wieder, wenn eine Anfrage ankommt. Sie zahlen nur für die tatsächlich genutzten Rechenzeit, abgerechnet auf die nächsten 100ms. Für einen MCP-Server, der sporadische Tool-Aufrufe verarbeitet statt kontinuierlichen Datenverkehr zu handhaben, bedeutet dies Betriebskosten, die praktisch bei Null liegen.

Weitere nennenswerte Vorteile:

- **Keine Infrastruktur zu verwalten** — Cloud Run verwaltet HTTPS-Terminierung, Skalierung, Gesundheitsprüfungen und Deployment-Rollbacks automatisch
- **Beliebige Sprache, beliebiges Framework** — stellen Sie beliebige Container bereit, keine Platform-spezifische Runtime erforderlich
- **Großzügiger kostenloser Tarif** — 2 Millionen Anfragen und 360.000 GB-Sekunden Rechenzeit pro Monat kostenlos
- **Artifact Registry + Cloud Build** — die Deployment-Pipeline (Image erstellen → hochladen → deployen) kann vollständig mit einem einzigen `gcloud`-Befehl automatisiert werden

Ein dedizierter Beitrag, der diese GCP-Einrichtung von Grund auf abdeckt — Cloud Run Deployment, Artifact Registry, Cloud Build CI/CD und IAM-Konfiguration — erscheint bald. *([Setting Up an API Service on GCP](/blog/setting-up-gcp-api-service) — coming soon)*

---

## Hinzufügen der MCP-Schicht

Mit dem bereits laufenden Backend war die Frage, wie man es AI-Clients zugänglich macht. Die Antwort war ein dünner Gateway auf Cloudflare Workers, das das MCP-Protokoll spricht und Anfragen an die existierende API übersetzt.

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

Der Worker verwaltet alles am Edge: MCP-Protokoll-Parsing, OAuth-Token-Verifizierung, Quota-Durchsetzung pro Benutzer und File-Staging. Worker sind global verteilt und haben keine Cold-Start-Zeiten — Anfragen landen am nächsten Point of Presence mit Sub-Millisekunden-Overhead. Die Einschränkung ist ein striktes CPU-Zeit-Limit (50ms pro Anfrage im kostenlos Tarif), das sie ungeeignet für rechenintensive Aufgaben macht. Deshalb bleibt die schwere Arbeit auf Cloud Run.

### Cloudflare R2

R2 ist der Übergabemechanismus zwischen Tools. Jede Tool-Ausgabe wird auf R2 mit 1-Stunden-TTL geschrieben und als URL zurückgegeben. Das nächste Tool in einer Kette erhält diese URL als Eingabe — der Worker ruft sie direkt von R2 ab, ohne einen zusätzlichen HTTP-Roundtrip. Dies macht Multi-Schritt-Agent-Workflows schnell und kostengünstig. R2 ist S3-kompatibel, daher funktioniert jedes existierende S3-SDK ohne Änderungen.

### Cloudflare KV

KV speichert drei Datentypen: OAuth-Session-Tokens (30-Tage-TTL), pro-Benutzer monatliche Quota-Zähler und OAuth PKCE-Status während des Autorisierungsflusses. KV ist eventual consistent mit Edge-gecachten Lesezugriffen — gut geeignet für diese Write-Once-Read-Many-Werte.

Eine vollständige Anleitung zum Einrichten von Cloudflare Workers, Konfigurieren von benutzerdefinierten Domains, Verwalten von DNS und Anschließen von R2 und KV finden Sie im Begleitleitfaden: *([Complete Cloudflare Worker Setup for MCP Servers](/blog/cloudflare-worker-setup-guide) — coming soon)*

### Der Private-Repo-Vorteil

Die Aufteilung des Gateway vom Backend löst ein weniger offensichtliches Problem: **nur der MCP-Wrapper muss öffentlich sein**.

Der Cloudflare Worker Code definiert Ihre API-Oberfläche — Tool-Namen, Parameter, Authentifizierung. Ihn zu veröffentlichen ermöglicht der Community, die Integration zu überprüfen und kompatible Clients zu erstellen. Das Cloud Run Backend, wo die eigentliche Verarbeitungslogik lebt, kann in einem privaten Repository bleiben. Ihre Kernalgorithmen sind nie exponiert.

Für ein kommerzielles Produkt ist dies bedeutsam: Sie können eine offene MCP-Integration versenden, die Community zur Teilnahme an der Interface-Schicht einladen und das proprietary Backend komplett geschlossen halten. Sie zeigen MCP-Technologie, ohne Implementierungsdetails preiszugeben.

---

## Was ein vollständiger MCP-Server wirklich benötigt

Als Spritesheet Forge zum ersten Mal gestartet wurde, lief der MCP-Server technisch — aber Claude konnte ihn kaum nutzen. Die Tools existierten, aber dem Server fehlten mehrere Komponenten, auf die MCP-Clients verlassen, bevor sie versuchen, ein Tool aufzurufen. Der Agent würde verbinden, verwirrt sein und aufgeben.

Hier ist die vollständige Liste, was ein Remote-MCP-Server zum korrekten Funktionieren benötigt:

### MCP-Protokoll-Handler (`POST /mcp`)

Der Hauptendpoint empfängt den gesamten MCP-Datenverkehr. Er muss eine spezifische Nachrichtenfolge verarbeiten, die jeder MCP-Client vor der Ausführung nützlicher Arbeiten sendet:

| Method | Wer sendet | Bedeutung |
|--------|-------------|-----------|
| `initialize` | Client, erste Nachricht | "Ich verbinde mich, hier sind meine Fähigkeiten" |
| `notifications/initialized` | Client, nachdem Server auf `initialize` antwortet | "Bereit zum Fortfahren" |
| `tools/list` | Client, zum Entdecken verfügbarer Tools | "Was kannst du tun?" |
| `tools/call` | Client, zum eigentlichen Aufrufen eines Tools | "Tu das" |

Die Nachrichten `initialize` und `notifications/initialized` müssen eine gültige Antwort auch ohne Authentifizierung zurückgeben — sie sind der Handshake, der die Sitzung aufbaut. Wenn eines dieser Beiden fehlschlägt oder einen Auth-Fehler zurückgibt, gilt die Verbindung für den Client als unterbrochen und es wird nicht mehr versucht.

### Tool-Definitionen

Jedes Tool, das unter `tools/list` registriert ist, benötigt vier Dinge, um vollständig zu sein:

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

Fehlende `outputSchema` oder `annotations` unterbrechen Tool-Aufrufe nicht, aber sie ruinieren Ihren Quality Score auf jeder Directory-Plattform. Noch wichtiger ist, dass LLMs `outputSchema` verwenden, um Tool-Ergebnisse zu analysieren und darüber nachzudenken — ohne es rät das Modell über die Struktur dessen, was zurückkommt.

### Discovery- und Infrastructure-Endpoints

Über `/mcp` hinaus benötigt ein vollständiger Server auch:

- **`GET /health`** — gibt `{"status":"ok"}` mit HTTP 200 zurück, keine Auth erforderlich. Directory-Plattformen pollen dies, um zu überprüfen, ob Ihr Server aktiv ist.
- **`OPTIONS /mcp`** — verarbeitet CORS-Preflight. Erforderlich für jeden browserbasierten MCP-Client.
- **`GET /.well-known/oauth-authorization-server`** — wenn OAuth verwendet wird, so entdecken MCP-Clients Ihre Auth-Endpoints automatisch. Ohne dies greifen Clients auf manuelle Konfiguration zurück oder schlagen fehl.

### Die Folge des Fehlens eines dieser Dinge

Claude verbindet sich mit einem MCP-Server, indem es `initialize` → `notifications/initialized` → `tools/list` nacheinander durchläuft. Wenn `tools/list` fehlschlägt (weil es Auth erfordert oder die Antwort falsch formatiert ist), hat der Client keine Tool-Definitionen zum Arbeiten. Aus Claudia's Perspektive existiert der Server, hat aber keine Fähigkeiten — er kann nichts aufrufen.

So sah "Agent konnte den MCP kaum nutzen" in der Praxis aus: die Verbindung gelang, aber jeder Versuch, ein Tool zu nutzen, scheiterte, weil der Discovery-Schritt niemals korrekt abgeschlossen wurde.

### Protokoll-Beispiele

Jede Nachricht im MCP-Protokoll ist ein JSON-RPC 2.0-Objekt über HTTP POST. Hier sieht der tatsächliche Austausch aus.

**Schritt 1 — Client sendet `initialize`**

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

**Server antwortet mit seinen eigenen Fähigkeiten**

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

**Schritt 2 — Client sendet `notifications/initialized`** (keine Antwort erwartet)

```json
{
  "jsonrpc": "2.0",
  "method": "notifications/initialized"
}
```

**Schritt 3 — Client sendet `tools/list`** (keine Auth erforderlich)

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/list"
}
```

**Server gibt alle registrierten Tools zurück**

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

Sobald dieser Handshake abgeschlossen ist, weiß der Client genau, welche Tools verfügbar sind und wie man sie aufruft. Erst danach wird Authentifizierung relevant — Tool-Aufrufe wie `tools/call` erfordern einen gültigen Bearer-Token.

**`server_info` — ein Tool-Aufruf ohne Argumente**

Das ist, wie eine echte `tools/call`-Anfrage und -Antwort aussieht, unter Verwendung des `server_info`-Tools von Spritesheet Forge:

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

**Tatsächliche Antwort:**

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

`server_info` ist das Muster zum Folgen für jedes Tool, das Konfiguration oder Metadaten zurückgibt: keine Argumente, deterministische Ausgabe, nützlich für Agenten, Workflows abzufragen, bevor eine Workflow beginnt.

---

## Authentifizierung

### Warum Authentifizierung?

Ohne Authentifizierung ist Ihr MCP-Server eine offene öffentliche API — jeder, der den Endpoint entdeckt, kann Ihre Tools unbegrenzt ausführen, Cloud Run-Rechenzeit verbrauchen, R2-Speicher-Schreibvorgänge verbrennen und Quota aufbrauchen, die echten Benutzern gehört. Authentifizierung löst drei Probleme auf einmal:

- **Ressourcenschutz**: Jeder Tool-Aufruf transloziert direkt in Rechenkosten. Ohne zu wissen, wer aufruft, können Sie Limits nicht durchsetzen.
- **Quota-Management**: Pro-Benutzer monatliche Quotas erfordern eine stabile Identität zum Tracking. Keine Identität bedeutet keine faire Durchsetzung.
- **Missbrauchs-Prävention**: Ein öffentlicher Endpoint ohne Auth ist trivial skriptierbar — ein Bösewicht kann Ihre Rechnungen hochfahren oder den Dienst für alle anderen verschlechtern.

### Authentifizierungs-Optionen

| Method | Benutzererfahrung | Implementierung | MCP-Client-Unterstützung |
|--------|----------------|----------------|-------------------|
| Keine Auth | Friktionslos | Trivial | Universal |
| Statischer API-Schlüssel | Schlecht — Benutzer muss in Config kopieren-einfügen | Einfach | Universal |
| OAuth 2.1 + PKCE | Nahtlos — ein Browser-Klick | Moderat | Claude Desktop, Claude Code |

**Keine Auth** ist nur für lokale oder interne-nur Server geeignet, wo das Netzwerk die Sicherheitsgrenze ist. Für einen öffentlichen Remote-Server bedeutet dies, dass jeder im Internet Ihre Tools aufrufen kann.

**API-Schlüssel** sind die offensichtliche erste Wahl: Schlüssel generieren, Benutzer geben, fertig. Das Problem ist die Verteilungserfahrung. Der Benutzer muss ein Dashboard oder Docs-Seite finden, einen zufälligen String kopieren, seine Config-Datei öffnen, einfügen und den Client neu starten. Das ist ein mehrstufiger Prozess mit mehreren Fehlerpunkten, und es gibt keine Wiederherstellung, wenn er ihn verliert. Jeder neue MCP-Client, den er nutzt, erfordert die gleiche manuelle Einrichtung.

**OAuth 2.1 + PKCE** ist mehr Arbeit umzusetzen, aber liefert dramatisch bessere Erfahrung. Der MCP-Client verarbeitet den gesamten Fluss nativ — er öffnet automatisch den Browser, wenn ein Token gebraucht wird. Der Benutzer sieht eine GitHub-Anmeldeseite, klickt „Autorisieren", und der Client speichert den resultierenden Token intern. Aus des Benutzers Sicht ist es ein Klick ohne Config-Datei-Beteiligung.

### Wie Spritesheet Forge es implementiert

Die Implementierung nutzt GitHub als Identity Provider, Cloudflare KV für Token-Speicherung und den standardmäßigen OAuth 2.1 + PKCE-Fluss:

**1. Auto-Erkennung über `/.well-known/oauth-authorization-server`**

MCP-Clients lesen diesen Endpoint, bevor sie irgendeinen OAuth-Fluss initiieren. Er gibt den Autorisierungs-Endpoint, Token-Endpoint und unterstützte Grant-Typen zurück. Ohne ihn erfordern Clients manuelle Konfiguration oder schlagen fehl, sich zu verbinden.

**2. Dynamische Client-Registrierung (RFC 7591)**

Jeder MCP-Client kann sich selbst programmatisch registrieren, indem er zum Registrierungs-Endpoint POSTet. Das bedeutet neue Clients können sich verbinden, ohne vorab genehmigt oder irgendwo aufgelistet zu sein — der Server behandelt die Registrierung automatisch.

**3. PKCE-Fluss**

Verhindert Abfangen von Autorisierungscodes. Der Client generiert einen zufälligen `code_verifier`, sendet seinen Hash (`code_challenge`) mit der Autorisierungsanfrage, dann weist er nach, dass er den ursprünglichen Verifier hält, wenn der Code gegen einen Token ausgetauscht wird. Dies schließt den Attack Vector, wo ein Autorisierungscode in Transit gestohlen werden könnte.

**4. KV-Session-Speicherung**

Das Session-Token wird in Cloudflare KV unter `session:{userId}` mit 30-Tage-TTL gespeichert. Jede `tools/call`-Anfrage validiert den Bearer-Token gegen KV, bevor die Anfrage Cloud Run erreicht.

**5. Script-Fallback**

Für Benutzer, die in Scripts, CI-Pipelines oder Benchmark-Umgebungen arbeiten, wo Browser-OAuth unpraktisch ist, ist ein herunterladbares `get-token.py`-Script verfügbar. Es führt den vollständigen OAuth-Fluss in einem Terminal aus, gibt das resultierende Token aus und speichert es unter `~/.spritesheet-forge-token`.

### Der X-MCP-Key: Interne Service-Authentifizierung

Die Architektur hat zwei Schichten: den Cloudflare Worker (öffentlich-seitig Gateway) und Cloud Run (private Backend). Cloud Run läuft unter einer URL, die technisch aus dem Internet erreichbar ist — jeder, der sie entdeckt, könnte direkt POSTing-Anfragen senden, den Worker ganz umgehen. Das bedeutet OAuth-Verifikation, Quota-Enforcement und Rate Limiting umgehen.

Der `X-MCP-Key`-Header schließt diese Lücke. Es ist ein gemeinsames Geheimnis, nur dem Worker und Cloud Run bekannt. Der Worker validiert jedes eingehende OAuth-Token, dann leitet die Anfrage an Cloud Run mit diesem Header weiter. Cloud Run lehnt jede Anfrage ab, die nicht den korrekten Schlüssel enthält.

```
User → Worker:     Authorization: Bearer <oauth-token>   (public auth)
Worker → Cloud Run: X-MCP-Key: <internal-secret>         (internal auth)
```

Das ist **Defense in Depth**: Auch wenn die Cloud Run URL durch Logs, Fehlermeldungen oder Reverse Engineering durchsickert, kann ein Angreifer sie ohne den internen Schlüssel nicht aufrufen. Der gesamte Datenverkehr wird durch das Gateway erzwungen, und der gesamte Sicherheits-Enforcement wird beibehalten.

Ohne dies wäre "Private Backend" ein falscher Anspruch — das Backend wäre immer noch effektiv öffentlich für jeden, der hart genug schaut.

---

## File Input Design

Dieser Abschnitt ist spezifisch für MCP-Server, deren Tools Dateien verarbeiten — Bild-Konverter, Dokument-Parser, Audio-Prozessoren und ähnliche. Wenn Ihre Tools nur Text oder strukturierte Daten verarbeiten, werden Sie dieses Problem nicht treffen. Aber für datei-intensive APIs ist es eines der praktisch limitierendsten Probleme, das Sie antreffen.

Das Kernproblem ist, dass Dateien an einen Agent zu übergeben ist schwieriger, als es aussieht. Der instinktive Ansatz — base64-kodiere die Datei und sende sie inline — funktioniert in der Theorie, trifft aber auf eine harte Einschränkung in der Praxis: **Claude Code's Shell-Tool hat ein ~256 KB-Kontext-Limit auf stdout-Ausgabe**. Base64-Kodierung erweitert Dateigröße um ~33%, was bedeutet, die echte sichere Obergrenze für Inline-Base64 liegt um 185 KB. Die meisten Bilder, Audio-Dateien und Dokumente sind größer als das.

Das macht Base64 unpraktisch für die Mehrheit der realen File-Processing-Use-Cases. Die Lösung, die wir hinzufügten, war ein dedizierter `/upload`-Endpoint auf der MCP-Schicht — außerhalb des MCP-Protokolls selbst. Der Benutzer (oder Agent) POSTet die Datei dort direkt, erhält eine URL zurück und übergibt diese URL zum Tool, statt die Datei inline einzubetten. Der Worker holt sich dann die Datei server-seitig von R2, umgeht das Context-Size-Limit ganz.

**Warum Cloudflare R2 für File-Speicherung?**

R2 ist Cloudflare's S3-kompatibles Object Storage, und es ist die richtige Wahl hier für einen spezifischen Grund: **null Egress-Gebühren**. AWS S3 und die meisten anderen Object Storage Services berechnen Datenübertragung raus — jedes Mal wenn eine Tool-Ausgabe gelesen wird (was bei jedem verketteten Tool-Aufruf geschieht), zahlen Sie. R2 berechnet nichts für Egress. Für einen MCP-Server, der Dateien zwischen Tools häufig bewegt, spielt das eine Rolle.

R2's kostenlos Tarif ist auch großzügig genug, dass ein niedriger bis mittlerer Traffic MCP-Server ganz in ihm laufen kann:

| Resource | Free tier |
|----------|-----------|
| Storage | 10 GB/month |
| Class A operations (writes, deletes) | 1 million/month |
| Class B operations (reads) | 10 million/month |
| Egress (data transfer out) | Free, always |

Tool-Ausgaben werden mit 1-Stunden-TTL gespeichert und automatisch gelöscht — so bleibt Speichernutzung niedrig, auch unter aktiver Nutzung. Eine Datei, die verarbeitet und gelöscht wird innerhalb einer Stunde, zählt niemals zu der monatlichen Speicher-Gesamtzahl in einer bedeutsamen Weise.

MCP-Tools, die Dateien akzeptieren, müssen drei unterschiedliche Eingabe-Szenarios verarbeiten:

| Scenario | Method |
|----------|--------|
| Kleine Dateien (< ~185 KB) | base64 data URI: `data:image/png;base64,...` |
| Große Dateien oder Dateien aus Shell | POST zu `/upload` Endpoint, URL zurück übergeben |
| Ausgabe von einem bisherigen Tool | Die Output-URL direkt übergeben — Worker holt von R2 |

Die nicht-offensichtliche Einschränkung: Claude Code's Shell-Tool hat ein ~256 KB-Kontext-Limit auf stdout. Base64-Kodierung erweitert Dateigröße um ~33%, daher liegt die praktische Obergrenze für Inline-Base64 bei 185 KB, nicht 4 MB. Ihre Tool-Beschreibungen sollten dieses Limit explizit angeben und Benutzer zum Upload-Endpoint zeigen, wenn's wichtig ist.

**Der Base64-Newline-Bug.** Shell Tools wie `openssl base64` und die `base64` CLI fügen jedes 76 Zeichen ein Newline ein. Diese String direkt als Data URI übergeben verursacht `INVALID_BASE64`-Fehler auf dem Server. Legen Sie diese Warnung in Ihre Tool-Beschreibung:

> "Strip all whitespace and newlines from the base64 string before prepending the data URI prefix. Example: `base64 file.png | tr -d '\n'`"

---

## Tool Design, das mit LLMs funktioniert

### Schritt 0: Claude zu Ihrem MCP-Server verbinden

Bevor ein Tool verwendet werden kann, muss Claude zu dem MCP-Server verbunden sein. Das hört sich offensichtlich an, aber es ist wert, es auszusprechen: Claude entdeckt oder verbindet sich nicht automatisch zu MCP-Servern. Sie konfigurieren die Verbindung explizit, und bis Sie das tun, hat Claude keine Kenntnis, dass der Server existiert.

**Claude Desktop** — zum `claude_desktop_config.json` hinzufügen (finden Sie es via Einstellungen → Developer):

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

**Claude Code CLI** — über Terminal hinzufügen:

```bash
claude mcp add spritesheet-forge --transport http https://mcp.clawstudiouo.com/mcp
```

Wenn der Server nicht konfiguriert ist, wird Claude nicht sagen "Ich kann das Tool nicht finden." Es wird einfach agieren, als ob das Tool nicht existiert — das Web durchsuchen nach Alternativen, ähnlich klingende Tools halluzinieren, die es eigentlich nicht hat, oder eine generische Antwort produzieren, die völlig das verfehlt, was Sie gefragt haben. Der Fehlermodus ist still und verwirrend.

### Wie Benutzer Ihren MCP-Server finden

Claude zu verbinden ist Schritt eins. Benutzer darüber, dass der Server existiert, zum ersten Mal zu bekommen, ist ein separates Problem. Es gibt mehrere Kanäle, jeder erreicht eine andere Audience:

**Source und Dokumentation**
- [GitHub Repository](https://github.com/LAXY9887/Game-Dev.-Spritesheet-Forge) — die primäre Quelle der Wahrheit. Entwickler schauen hier zuerst. Ein klares README mit der Endpoint-URL und Config-Snippet ist das Minimum.
- [Dedizierte Tutorial-Seite](https://sprite-forge-mcp.tutorial.clawstudiouo.com) — eine Standalone-Seite, die Installation, Authentifizierung und Beispiel-Prompts durchgeht. Nützlich für Nicht-Entwickler, die keine README lesen wollen.

**Offizielle Registrare**
- [Anthropic MCP Registry](https://registry.modelcontextprotocol.io/?q=io.github.LAXY9887%2Fspritesheet-forge) — Anthropics offizieller Index von MCP-Servern. Dies ist, wo MCP-Client-Anwendungen abfragen, um kuratierte Server-Listen innerhalb der App anzuzeigen.

**Marktplätze und Verzeichnisse**
- [Smithery.ai](https://smithery.ai/servers/lxya98874322688423/spritesheet-forge) — direkt in Claude Code's MCP-Browser integriert. Benutzer können Server finden und installieren, ohne die CLI zu verlassen.
- [MCP Marketplace](https://mcp-marketplace.io/server/game-dev-spritesheet-forge) — ein dedizierter Marktplatz mit einem Revenue-Sharing-Model für bezahlte Tiers.
- GitHub Marketplace — zugänglich für Githubs Developer-Ökosystem.

Die Kanäle verstärken sich gegenseitig. Ein Benutzer, der den Server auf Smithery findet, wird oft als nächstes das GitHub Repo prüfen. Die Tutorial-Seite wandelt Entdeckung in tatsächliche Installation um. Alle abzudecken kostet wenig zu warten und erreicht Audiences, die sich nicht überlappen.

### Tool-Beschreibungen schreiben, die wirklich funktionieren

Tool-Beschreibungen sind nicht Dokumentation für Menschen — sie sind Instruktionen, die LLMs nutzen, um zu entscheiden, *wann* und *wie* Ihr Tool aufgerufen wird. Eine schlecht geschriebene Beschreibung führt dazu, dass das Modell das falsche Tool aufruft, falsche Parameter übergibt oder Fehler produziert, die schwer zu debuggen sind.

Was eine gute Tool-Beschreibung enthält:

- **Eingabe-Format**: URL? Data URI? Welche MIME-Typen werden akzeptiert?
- **Ausgabe**: Was gibt das Tool zurück? Eine URL? Eine JSON-Struktur? Was ist die TTL?
- **Beschränkungen**: Dateigröße-Limits, Parameter-Interaktionen, bekannte Gotchas
- **Beispiele**: für komplexe Input-Regeln, geben Sie ein Inline-Beispiel oder einen Shell-Befehl

**Design für Verkettung.** Machen Sie jede Tool-Ausgabe URL direkt als Input für ein anderes Tool verwendbar. Das lässt Agenten Multi-Schritt-Workflows natürlich komponieren:

```
gif_to_spritesheet → split_spritesheet → frames_to_animation
```

**Fügen Sie ein `server_info`-Tool hinzu.** Stellen Sie ein Zero-Argument-Tool bereit, das Runtime-Konfiguration zurückgibt: Upload-Endpoint-URL, Output-Datei-TTL, Dateigröße-Limits und die Regel zum Wählen zwischen Base64 und Upload. Das verhindert, dass diese Informationen über einzelne Tool-Beschreibungen stale werden und gibt Agenten einen zuverlässigen Weg, es vor dem Start komplexer Workflows abzufragen.

---

## Schnelle Fehler-Referenz

| Symptom | Root Cause | Fix |
|---------|-----------|-----|
| Plattform zeigt "0 tools found" | `tools/list` erfordert Auth | `initialize`, `notifications/initialized`, `tools/list` zur Handshake-Whitelist hinzufügen |
| Smithery Quality Score ist 0 | Fehlende `outputSchema` / `annotations` | Beide Felder zu allen Tools hinzufügen |
| `INVALID_BASE64` Decode-Fehler | Shell Tools fügen Newlines in Base64 ein | In Tool-Beschreibung warnen; `tr -d '\n'` verwenden |
| Agent sagt "Ich habe das Tool nicht" und beginnt Web-Suche | MCP-Server nicht im Client konfiguriert | Server-Config zu `claude_desktop_config.json` hinzufügen oder `claude mcp add` ausführen |
| OAuth-Autorisierungsseite öffnet sich nie | `/.well-known/oauth-authorization-server` nicht öffentlich zugänglich | Sicherstellen, dass der Endpoint ohne Auth erreichbar ist |
| Upload-Endpoint gibt `401` zurück | Bearer-Token fehlt oder abgelaufen | Benutzer re-authentifiziert sich; `get-token.py` ausführen, falls nötig |
| Tool-Ausgabe-URL gibt 404 oder Fehler zurück | R2-Objekt-TTL abgelaufen (60 Minuten) | Originating-Tool neu ausführen, um frische URL zu bekommen |
| Cloud Run gibt `403` auf alle Anfragen zurück | `X-MCP-Key`-Header fehlt oder falsch | Das Geheimnis in den Worker's Umgebungsvariablen überprüfen |
| Browserbased MCP-Client kann nicht verbinden | Fehlende CORS-Header auf `/mcp` | `OPTIONS`-Preflight-Handler + `Access-Control-Allow-Origin: *` zu alle Antworten hinzufügen |

---

## Häufig gestellte Fragen

**Was ist ein Remote-MCP-Server?**

Ein Remote-MCP-Server ist ein Cloud-gehosteter Service, der das Model Context Protocol implementiert, das KI-Assistenten wie Claude ermöglicht, Tools über das Internet durch natürliche Sprache aufzurufen. Im Unterschied zu lokalen MCP-Servern — die auf dem Machine des Benutzers laufen und nur von dieser Machine zugänglich sind — ist ein Remote-Server für jeden authentifizierten MCP-Client überall zugänglich, ohne lokale Installation.

**Wie füge ich einen MCP-Server zu Claude Desktop oder Claude Code hinzu?**

Für Claude Desktop, fügen Sie die Server-Konfiguration zu `claude_desktop_config.json` hinzu (finden Sie sie unter Einstellungen → Developer). Für Claude Code, führen Sie `claude mcp add <name> --transport http <url>` im Terminal aus. Bis die Verbindung explizit konfiguriert ist, hat Claude keine Kenntnis, dass der Server existiert und kann keine seiner Tools nutzen.

**Ist es kostenlos, einen Remote-MCP-Server auf Cloudflare und GCP zu betreiben?**

Ja, für niedriger bis mittlerer Traffic. Cloudflare Workers enthält 100.000 Anfragen pro Tag im kostenlosen Tarif. Cloudflare R2 bietet 10 GB Speicher, 1 Million Schreibvorgänge und 10 Millionen Lesevorgänge pro Monat kostenlos — ohne Egress-Gebühren. GCP Cloud Run bietet 2 Millionen Anfragen und 360.000 GB-Sekunden Rechenzeit pro Monat kostenlos. Ein Developer Tool, das sporadische Tool-Aufrufe verarbeitet, kann ganz in diese Limits laufen.

**Warum OAuth statt API-Schlüsseln für MCP-Authentifizierung verwenden?**

OAuth 2.1 bietet bessere Benutzererfahrung. Mit API-Schlüsseln müssen Benutzer manuell einen Token kopieren und in eine Config-Datei einfügen — ein mehrstufiger Prozess ohne Self-Service-Wiederherstellung, wenn der Schlüssel verloren ist. Mit OAuth verarbeiten Claude Desktop und Claude Code den Fluss nativ: Sie öffnen ein Browser, der Benutzer klickt „Autorisieren" und das Token wird automatisch gespeichert. Der Benutzer berührt nie eine Config-Datei.

**Warum kann Claude mein MCP-Tool nicht finden?**

Die häufigste Ursache ist, dass der MCP-Server nicht im Client konfiguriert wurde. Claude entdeckt Server nicht automatisch. Wenn der Server konfiguriert ist, aber Tools immer noch nicht erscheinen, überprüfen Sie, dass `tools/list` ohne Authentifizierung zugänglich ist — wenn es einen Bearer-Token erfordert, kann Claude die Tool-Liste während des initialen Handshake nicht abrufen und verhält sich, als ob der Server keine Tools hat.

**Wie übergebe ich große Dateien zu einem MCP-Tool?**

Für Dateien größer als ~185 KB verwenden Sie den `/upload`-Endpoint des Servers statt Base64-Kodierung. POST die Datei direkt (multipart/form-data), empfangen Sie eine URL in der Antwort und übergeben diese URL als Tool's Dateiparameter. Der Server holt die Datei server-seitig, umgeht Claude Code's ~256 KB Shell-Output-Limit, das Inline-Base64 für die meisten realen Dateien unpraktisch macht.

**Was ist der X-MCP-Key-Header?**

Der X-MCP-Key ist ein gemeinsames Geheimnis zum Authentifizieren von Anfragen zwischen dem Cloudflare Worker (dem öffentlich-seitigen Gateway) und dem GCP Cloud Run Backend. Es stellt sicher, dass der gesamte Datenverkehr Cloud Run nur durch den Worker erreicht — nicht direkt aus dem Internet. Ohne ihn könnte jeder, der die Cloud Run URL entdeckt, OAuth-Verifikation und Quota-Enforcement ganz umgehen.

**Muss ich meinen Backend-Code öffentlich machen, um einen MCP-Server zu betreiben?**

Nein. Nur der MCP-Wrapper (der Cloudflare Worker) muss ein öffentliches Repository sein — er definiert Ihre API-Oberfläche und lässt die Community die Integration überprüfen. Das Cloud Run Backend, wo die echte Business-Logik lebt, kann privat bleiben. Das lässt Sie eine offene MCP-Integration veröffentlichen, während proprietary Algorithmen und Implementierungsdetails in einem privaten Repository bleibt.
