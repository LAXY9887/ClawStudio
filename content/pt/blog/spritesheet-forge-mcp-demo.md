---
title: "GIF para Spritesheet Pronto para Jogo com Claude MCP: Um Guia Completo"
description: "Demo passo a passo: como Claude usa Spritesheet Forge MCP para converter um GIF em PNG de spritesheet e atlas JSON compatível com TexturePacker — com encadeamento de ferramentas, escolhas de parâmetros e notas de integração com Unity/Godot."
date: "2026-05-05"
readingTime: 8
tag: "tutorial"
---

Todo artista de jogos conhece o ciclo: exportar um GIF da sua ferramenta de animação, abrir TexturePacker, configurar colunas de frames, lidar com bordas transparentes, gerar o atlas, validar as coordenadas JSON, importar para Unity ou Godot. Mudar um frame e você repete cada passo.

Spritesheet Forge é um servidor MCP (Model Context Protocol) hospedado que move todo esse fluxo de trabalho para uma conversa com Claude. Você descreve o que precisa, Claude chama as ferramentas e você recebe de volta os arquivos de saída e metadados. Nenhum software para instalar. Nenhuma memorização de formato.

Este artigo percorre uma conversão real — uma animação GIF com 9 frames para um PNG de spritesheet e atlas JSON compatível com TexturePacker — mostrando as chamadas de ferramentas exatas, os parâmetros que Claude escolheu e como encadear operações em uma única sessão.

---

## Ferramentas Disponíveis

Spritesheet Forge expõe seis ferramentas para Claude uma vez conectado:

| Ferramenta | Entrada | Saída | Parâmetros-chave |
|---|---|---|---|
| `gif_to_spritesheet` | GIF Animado | PNG de Spritesheet | `columns`, `background_removal` |
| `png_to_spritesheet` | ZIP de frames PNG | PNG de Spritesheet | `columns`, `padding` |
| `split_spritesheet` | PNG de Spritesheet + contagem de frames | Frames individuais + atlas JSON | `columns`, `rows` |
| `trim_png` | PNG com borda transparente | PNG cortado + limites de corte | — |
| `frames_to_animation` | ZIP de frames PNG | GIF Animado | `fps` |
| `spritesheet_to_animation` | PNG de Spritesheet + contagem de frames | GIF Animado | `columns`, `rows`, `fps` |

As ferramentas são projetadas para encadear: a URL de saída de uma ferramenta pode ser passada diretamente como entrada para a próxima sem qualquer re-upload. Todas as transferências de arquivo ocorrem no lado do servidor.

---

## Conectar Claude em 2 Minutos

**Claude Desktop** — adicione a `claude_desktop_config.json` (encontre via Configurações → Desenvolvedor):

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

Na primeira utilização, Claude abre uma página OAuth do GitHub automaticamente — clique em "Autorizar" e o token é armazenado localmente por 30 dias. Você nunca toca em um arquivo de configuração para autenticação.

---

## Demo 1: GIF para Spritesheet

A entrada é uma animação de gato banana com 9 frames em 75 × 165 px por frame:

<img src="/blog/spritesheet-forge-mcp-demo/input.gif" alt="GIF de entrada — animação de gato banana com 9 frames em 75×165 px" style="width:150px;height:auto;display:block;margin:0 auto;border-radius:0.5rem;border:1px solid var(--ui-border);">

Solte o arquivo em Claude e descreva o que você precisa:

![Conversa Claude: usuário envia GIF e pede conversão de spritesheet](/blog/spritesheet-forge-mcp-demo/demo-1.png)

Claude carrega o arquivo automaticamente e chama `gif_to_spritesheet` com `background_removal: true`. A ferramenta arranja todos os frames em uma única linha e retorna a saída como uma URL armazenada em Cloudflare R2:

![Claude chamando ferramenta MCP gif_to_spritesheet](/blog/spritesheet-forge-mcp-demo/demo-2.png)

O resultado volta com dimensões exatas de pixel e etapas de configuração do Unity Sprite Editor:

![Claude retornando resultado de spritesheet com tabela de dimensões de frame](/blog/spritesheet-forge-mcp-demo/demo-3.png)

Saída — 675 × 165 px, 9 frames em uma única linha, fundo transparente:

![Spritesheet de saída — 675×165 px, 9 frames, fundo transparente](/blog/spritesheet-forge-mcp-demo/spritesheet.png)

**Parâmetros que Claude escolheu:**
- `columns: 9` — todos os frames em uma única faixa horizontal, que corresponde à expectativa padrão de Unity e Godot para animações de sprite simples
- `background_removal: true` — remove o fundo branco, produzindo um PNG com transparência alfa por pixel

Você pode sobrescrever qualquer um: peça `columns: 3` para obter uma grade 3×3, ou omita a remoção de fundo se seu mecanismo usa uma chave de cor em vez de alfa.

---

## Demo 2: Atlas JSON de Sprite

Um único acompanhamento gera um atlas compatível com TexturePacker a partir da URL de saída do spritesheet — a URL do passo anterior é passada diretamente, nenhum re-upload necessário:

![Claude chamando split_spritesheet para gerar Atlas JSON de Sprite](/blog/spritesheet-forge-mcp-demo/demo-4.png)

![Claude retornando Atlas de Sprite corrigido com tabela de coordenadas de frame](/blog/spritesheet-forge-mcp-demo/demo-5.png)

Claude pode validar a saída contra a especificação TexturePacker JSON Hash antes de você importá-la:

![Claude validando formato Atlas JSON de Sprite — todas as verificações passaram](/blog/spritesheet-forge-mcp-demo/demo-6.png)

Atlas final — 9 frames em 75 × 165 px cada, coordenadas indexadas a zero do canto superior esquerdo:

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

Este formato carrega diretamente em Unity (`SpriteAtlasImporter`), Godot (`AtlasTexture`), Phaser 3 (`Loader.atlas`), e qualquer outro mecanismo que aceita saída TexturePacker JSON Hash.

---

## Encadeamento de Ferramentas

Os dois demos acima são parte de uma cadeia de ferramentas maior. Cada saída de ferramenta é uma URL armazenada em Cloudflare R2 com TTL de 1 hora. Passar uma URL de uma ferramenta diretamente para a próxima evita re-upload:

```
gif_to_spritesheet(input.gif)
        │  URL de PNG spritesheet
        ▼
split_spritesheet(URL spritesheet, columns=9)
        │  atlas JSON + URLs de frames individuais
        ▼
frames_to_animation(URLs de frames, fps=12)   ← animação preview
        │
        ▼
trim_png(qualquer URL de frame)               ← limpeza opcional
```

Você pode pedir a Claude para executar essa cadeia inteira em uma única mensagem: *"Converta este GIF em um spritesheet, gere o atlas JSON e me dê uma animação preview em 12 fps."* Claude chama cada ferramenta em sequência, passando URLs entre elas automaticamente.

Uma restrição a ter em mente: **as URLs de saída expiram após 60 minutos**. Baixe todos os arquivos que você precisar antes da sessão terminar.

---

## Referência de Ferramentas MCP (Para Agentes de IA)

Esquemas de entrada completos para todas as sete ferramentas do Spritesheet Forge. Essas definições descrevem os parâmetros exatos que agentes de IA podem passar ao chamar cada ferramenta via MCP.

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

## Próximos Passos

- **[Construindo um Servidor MCP Remoto com Cloudflare Workers e GCP Cloud Run](/blog/building-remote-mcp-server)** — se você quiser construir seu próprio servidor MCP em vez de usar um hospedado, isto cobre a arquitetura completa: OAuth 2.1 + PKCE, autenticação de serviço interno, preparação de arquivo R2 e design de ferramenta.
- *([Importando Spritesheets em Unity e Godot: Um Guia Passo a Passo](/blog/spritesheet-game-engine-import) — em breve)* — tutoriais detalhados para fluxo de trabalho Sprite Atlas do Unity e nó AtlasTexture do Godot, incluindo como conectar a saída atlas JSON diretamente.

Spritesheet Forge é código aberto e gratuito para usar (100 operações/mês no nível gratuito):

- **Guia de configuração MCP** — [clawstudiouo.com/mcp](https://clawstudiouo.com/mcp)
- **Instalação de um clique no Smithery** — [smithery.ai](https://smithery.ai/servers/lxya98874322688423/spritesheet-forge)
- **Repositório GitHub** — [LAXY9887/Game-Dev.-Spritesheet-Forge](https://github.com/LAXY9887/Game-Dev.-Spritesheet-Forge)
- **Documentação completa da API** — [GitHub Pages](https://laxy9887.github.io/Game-Dev.-Spritesheet-Forge)

---

## Perguntas Frequentes

**O que é Spritesheet Forge?**

Spritesheet Forge é um servidor MCP hospedado que dá a Claude acesso direto a ferramentas de processamento de spritesheet. Uma vez conectado, Claude pode converter GIFs em spritesheets, empacotar frames PNG, gerar atlas JSON, dividir spritesheets existentes e mais — através de linguagem natural, sem qualquer instalação de software local.

**Como conecto Spritesheet Forge ao Claude?**

Para Claude Desktop, adicione a configuração do servidor a `claude_desktop_config.json`. Para Claude Code CLI, execute `claude mcp add spritesheet-forge --transport http https://mcp.clawstudiouo.com/mcp`. Na primeira utilização, Claude abre uma página OAuth do GitHub automaticamente — clique em "Autorizar" e o token é armazenado por 30 dias. A configuração completa está em [clawstudiouo.com/mcp](https://clawstudiouo.com/mcp).

**Que formatos de arquivo Spritesheet Forge suporta?**

`gif_to_spritesheet` aceita qualquer GIF animado. `png_to_spritesheet` e `frames_to_animation` aceitam um ZIP de frames PNG. Todas as saídas de imagem são PNG; a saída de atlas é TexturePacker JSON Hash, compatível com Unity, Godot, Phaser 3, Cocos2d e mecanismos similares.

**Spritesheet Forge é gratuito?**

O nível gratuito inclui 100 operações por mês — suficiente para desenvolvimento ativo de jogos com volume moderado de animação. Nenhum cartão de crédito é necessário. O servidor em si é código aberto no GitHub.

**Claude consegue lidar com arquivos de sprite grandes?**

Arquivos menores que ~185 KB são enviados inline como base64. Para arquivos maiores, Claude carrega no ponto de extremidade `/upload` do servidor e passa a URL retornada para a ferramenta. Você não gerencia isto manualmente — Claude detecta o tamanho do arquivo e escolhe o método correto automaticamente.

**Por quanto tempo os arquivos de saída estão disponíveis?**

As URLs de saída de ferramentas são armazenadas em Cloudflare R2 com TTL de 1 hora. Se você fechar a sessão sem baixar, os arquivos expiram. Peça a Claude para exibir os links de download claramente no final de um fluxo de trabalho.

**Posso encadear múltiplas ferramentas em um único pedido?**

Sim. Claude chama ferramentas em sequência automaticamente, passando cada URL de saída como entrada da próxima ferramenta. Por exemplo: *"Converta este GIF, divida-o em frames e me dê um GIF preview em 12 fps"* executa três ferramentas sem nenhuma etapa manual entre elas.

**Com quais mecanismos de jogo o atlas JSON é compatível?**

O formato de saída é TexturePacker JSON Hash — o formato de atlas mais amplamente suportado no desenvolvimento de jogos. Ele é compatível com Unity (`SpriteAtlasImporter`), Godot (`AtlasTexture`), Phaser 3 (`Loader.atlas`), Cocos2d e qualquer outro mecanismo que aceita saída TexturePacker.
