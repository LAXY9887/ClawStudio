---
title: "De GIF a Spritesheet Listo para Juegos: Una Demostración en Vivo de Claude + MCP"
description: "Mira cómo Claude convierte una animación GIF en un spritesheet y un atlas JSON compatible con TexturePacker usando el servidor MCP Spritesheet Forge sin necesidad de herramientas manuales."
date: "2026-05-05"
readingTime: 6
tag: "tutorial"
---

## El Problema con las Herramientas de Spritesheet Tradicionales

Convertir una animación GIF en un spritesheet listo para juegos siempre ha sido un proceso de varios pasos: abrir TexturePacker, configurar recuentos de columnas, decidir si eliminar el fondo, exportar, verificar coordenadas de fotogramas, ajustar. Cada vez que iteras sobre una animación, repites todo el ciclo.

¿Y si simplemente pudieras describir lo que necesitas y obtener el resultado?

## Spritesheet Forge: Un Servidor de Spritesheet para Claude

**Spritesheet Forge** es un servidor MCP (Model Context Protocol) alojado que le da a Claude acceso directo a herramientas de procesamiento de spritesheet. Una vez conectado, puedes pedirle a Claude que convierta GIFs, empaque PNGs en spritesheets, divida spritesheets existentes, genere JSON de Sprite Atlas, y más, todo a través del lenguaje natural.

No hay software para instalar. El servidor se ejecuta en Cloudflare Workers y procesa tus archivos en la nube. Claude se encarga de la carga de archivos, la selección de parámetros y la salida, simplemente describes el resultado que deseas.

## Conecta Claude en 2 Minutos

Puedes conectar a través de Claude Desktop o la CLI de Claude Code:

**Claude Desktop** — agregar a `claude_desktop_config.json`:

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

**CLI de Claude Code:**

```bash
claude mcp add spritesheet-forge --transport http https://mcp.clawstudiouo.com/mcp
```

En el primer uso, Claude abre una página de OAuth de GitHub para autenticar tu sesión. El token se almacena localmente y es válido durante 30 días.

## Demostración: GIF a Spritesheet

Aquí está la entrada: una animación de gato-plátano de 9 fotogramas a 75 × 165 px:

<img src="/blog/spritesheet-forge-mcp-demo/input.gif" alt="GIF de entrada" style="width:150px;height:auto;display:block;margin:0 auto;border-radius:0.5rem;border:1px solid var(--ui-border);">

Suelta el archivo en Claude y describe lo que necesitas:

![Conversación de Claude: el usuario envía un GIF y solicita conversión de spritesheet](/blog/spritesheet-forge-mcp-demo/demo-1.png)

Claude carga el archivo automáticamente y llama a `gif_to_spritesheet` con la eliminación de fondo habilitada:

![Claude llamando a la herramienta MCP gif_to_spritesheet](/blog/spritesheet-forge-mcp-demo/demo-2.png)

El resultado vuelve con las dimensiones exactas de píxeles e incluye los pasos de configuración de Unity:

![Claude devolviendo el resultado del spritesheet con tabla de dimensiones de fotogramas](/blog/spritesheet-forge-mcp-demo/demo-3.png)

Spritesheet de salida: 675 × 165 px, 9 fotogramas en una sola fila, fondo transparente:

![Spritesheet de salida](/blog/spritesheet-forge-mcp-demo/spritesheet.png)

## Demostración: JSON de Sprite Atlas

Un único seguimiento es todo lo que se necesita para obtener un atlas compatible con TexturePacker:

![Claude llamando a split_spritesheet para generar JSON de Sprite Atlas](/blog/spritesheet-forge-mcp-demo/demo-4.png)

![Claude devolviendo Sprite Atlas corregido con tabla de coordenadas de fotogramas](/blog/spritesheet-forge-mcp-demo/demo-5.png)

Puedes pedirle a Claude que valide la salida contra la especificación de TexturePacker JSON Hash:

![Claude validando el formato de JSON de Sprite Atlas: todas las verificaciones pasaron](/blog/spritesheet-forge-mcp-demo/demo-6.png)

El atlas final: los 9 fotogramas a 75 × 165 px, listos para cargar en Unity, Godot (`AtlasTexture`), o cualquier motor compatible con TexturePacker:

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

## Pruébalo Tú Mismo

Spritesheet Forge es de código abierto y gratuito (100 operaciones/mes en el nivel gratuito):

- **Guía de configuración de MCP** — [clawstudiouo.com/mcp](https://clawstudiouo.com/mcp)
- **Instalación de un clic en Smithery** — [smithery.ai](https://smithery.ai/servers/lxya98874322688423/spritesheet-forge)
- **Repositorio de GitHub** — [LAXY9887/Game-Dev.-Spritesheet-Forge](https://github.com/LAXY9887/Game-Dev.-Spritesheet-Forge)
- **Documentación completa de API** — [GitHub Pages](https://laxy9887.github.io/Game-Dev.-Spritesheet-Forge)
