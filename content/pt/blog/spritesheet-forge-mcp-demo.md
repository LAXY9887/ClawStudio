---
title: "De GIF para Spritesheet Pronto para Jogo: Uma Demonstração ao Vivo com Claude + MCP"
description: "Veja Claude converter uma animação GIF em um spritesheet e JSON de atlas compatível com TexturePacker usando o servidor MCP Spritesheet Forge — sem necessidade de ferramentas manuais."
date: "2026-05-05"
readingTime: 6
tag: "tutorial"
---

## O Problema com as Ferramentas Tradicionais de Spritesheet

Converter uma animação GIF em um spritesheet pronto para jogo sempre foi um processo com várias etapas: abrir TexturePacker, configurar contagem de colunas, decidir se remove o fundo, exportar, verificar coordenadas de frames, ajustar. Cada vez que você itera sobre uma animação, você repete o ciclo inteiro.

E se você pudesse apenas descrever o que precisa e obter o resultado?

## Spritesheet Forge: Um Servidor de Spritesheet para Claude

**Spritesheet Forge** é um servidor MCP (Model Context Protocol) hospedado que dá a Claude acesso direto a ferramentas de processamento de spritesheet. Uma vez conectado, você pode pedir a Claude para converter GIFs, empacotar PNGs em spritesheets, dividir spritesheets existentes, gerar Sprite Atlas JSON, e muito mais — tudo através de linguagem natural.

Não há software para instalar. O servidor é executado em Cloudflare Workers e processa seus arquivos na nuvem. Claude cuida do upload de arquivo, seleção de parâmetros e saída — você apenas descreve o resultado que deseja.

## Conecte Claude em 2 Minutos

Você pode conectar via Claude Desktop ou via Claude Code CLI:

**Claude Desktop** — adicione a `claude_desktop_config.json`:

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

No primeiro uso, Claude abre uma página de OAuth do GitHub para autenticar sua sessão. O token é armazenado localmente e é válido por 30 dias.

## Demonstração: GIF para Spritesheet

Aqui está a entrada — uma animação de gato banana com 9 frames em 75 × 165 px:

<img src="/blog/spritesheet-forge-mcp-demo/input.gif" alt="GIF de Entrada" style="width:150px;height:auto;display:block;margin:0 auto;border-radius:0.5rem;border:1px solid var(--ui-border);">

Solte o arquivo em Claude e descreva o que você precisa:

![Conversa Claude: usuário envia GIF e pede conversão de spritesheet](/blog/spritesheet-forge-mcp-demo/demo-1.png)

Claude faz upload do arquivo automaticamente e chama `gif_to_spritesheet` com remoção de fundo ativada:

![Claude chamando ferramenta MCP gif_to_spritesheet](/blog/spritesheet-forge-mcp-demo/demo-2.png)

O resultado volta com as dimensões de pixel exatas e etapas de setup do Unity incluídas:

![Claude retornando resultado de spritesheet com tabela de dimensões de frames](/blog/spritesheet-forge-mcp-demo/demo-3.png)

Spritesheet de saída — 675 × 165 px, 9 frames em uma única linha, fundo transparente:

![Spritesheet de saída](/blog/spritesheet-forge-mcp-demo/spritesheet.png)

## Demonstração: Sprite Atlas JSON

Uma única continuação é tudo o que é necessário para obter um atlas compatível com TexturePacker:

![Claude chamando split_spritesheet para gerar Sprite Atlas JSON](/blog/spritesheet-forge-mcp-demo/demo-4.png)

![Claude retornando Sprite Atlas corrigido com tabela de coordenadas de frames](/blog/spritesheet-forge-mcp-demo/demo-5.png)

Você pode pedir a Claude para validar a saída contra a especificação TexturePacker JSON Hash:

![Claude validando formato Sprite Atlas JSON — todas as verificações passaram](/blog/spritesheet-forge-mcp-demo/demo-6.png)

O atlas final — todos os 9 frames em 75 × 165 px, pronto para carregar em Unity, Godot (`AtlasTexture`), ou qualquer mecanismo compatível com TexturePacker:

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

## Experimente Você Mesmo

Spritesheet Forge é código aberto e gratuito para usar (100 operações/mês na camada gratuita):

- **Guia de setup MCP** — [clawstudiouo.com/mcp](https://clawstudiouo.com/mcp)
- **Instalação com um clique no Smithery** — [smithery.ai](https://smithery.ai/servers/lxya98874322688423/spritesheet-forge)
- **Repositório GitHub** — [LAXY9887/Game-Dev.-Spritesheet-Forge](https://github.com/LAXY9887/Game-Dev.-Spritesheet-Forge)
- **Documentação completa da API** — [GitHub Pages](https://laxy9887.github.io/Game-Dev.-Spritesheet-Forge)
