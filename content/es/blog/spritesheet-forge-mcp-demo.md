---
title: "De GIF a Spritesheet listo para juegos con Claude MCP: Una guía completa"
description: "Demo paso a paso: cómo Claude utiliza Spritesheet Forge MCP para convertir un GIF en un PNG de spritesheet y un atlas JSON compatible con TexturePacker, con encadenamiento de herramientas, selección de parámetros y notas de integración para Unity/Godot."
date: "2026-05-05"
readingTime: 8
tag: "tutorial"
---

Todo artista de videojuegos conoce el flujo: exportar un GIF desde tu herramienta de animación, abrir TexturePacker, configurar columnas de fotogramas, manejar bordes transparentes, generar el atlas, validar las coordenadas JSON, importar en Unity o Godot. Cambias un fotograma y repites cada paso.

Spritesheet Forge es un servidor MCP (Protocolo de Contexto de Modelo) alojado que traslada todo este flujo de trabajo a una conversación con Claude. Describes lo que necesitas, Claude llama a las herramientas, y obtienes los archivos de salida y metadatos. Sin software para instalar. Sin memorización de formatos.

Este artículo te muestra una conversión real: una animación GIF de 9 fotogramas a un spritesheet PNG y un atlas JSON compatible con TexturePacker, mostrando las llamadas exactas a herramientas, los parámetros que Claude eligió, y cómo encadenar operaciones en una sola sesión.

---

## Herramientas disponibles

Spritesheet Forge expone seis herramientas a Claude una vez conectado:

| Herramienta | Entrada | Salida | Parámetros clave |
|---|---|---|---|
| `gif_to_spritesheet` | GIF animado | PNG de spritesheet | `columns`, `background_removal` |
| `png_to_spritesheet` | ZIP de fotogramas PNG | PNG de spritesheet | `columns`, `padding` |
| `split_spritesheet` | PNG de spritesheet + conteo de fotogramas | Fotogramas individuales + atlas JSON | `columns`, `rows` |
| `trim_png` | PNG con borde transparente | PNG recortado + límites de recorte | — |
| `frames_to_animation` | ZIP de fotogramas PNG | GIF animado | `fps` |
| `spritesheet_to_animation` | PNG de spritesheet + conteo de fotogramas | GIF animado | `columns`, `rows`, `fps` |

Las herramientas están diseñadas para encadenarse: la URL de salida de una herramienta se puede pasar directamente como entrada a la siguiente sin necesidad de volver a cargar. Todas las transferencias de archivos ocurren del lado del servidor.

---

## Conecta Claude en 2 minutos

**Claude Desktop** — agregar a `claude_desktop_config.json` (encuéntralo en Configuración → Desarrollador):

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

En el primer uso, Claude abre automáticamente una página de OAuth de GitHub; haz clic en "Autorizar" y el token se almacena localmente durante 30 días. Nunca tocas un archivo de configuración para la autenticación.

---

## Demo 1: GIF a Spritesheet

La entrada es una animación de gato platanero de 9 fotogramas a 75 × 165 px por fotograma:

<img src="/blog/spritesheet-forge-mcp-demo/input.gif" alt="GIF de entrada — animación de gato platanero de 9 fotogramas a 75×165 px" style="width:150px;height:auto;display:block;margin:0 auto;border-radius:0.5rem;border:1px solid var(--ui-border);">

Arrastra el archivo a Claude y describe lo que necesitas:

![Conversación de Claude: el usuario envía un GIF y solicita conversión de spritesheet](/blog/spritesheet-forge-mcp-demo/demo-1.png)

Claude carga el archivo automáticamente y llama a `gif_to_spritesheet` con `background_removal: true`. La herramienta organiza todos los fotogramas en una sola fila y devuelve la salida como una URL almacenada en Cloudflare R2:

![Claude llamando a la herramienta MCP gif_to_spritesheet](/blog/spritesheet-forge-mcp-demo/demo-2.png)

El resultado regresa con dimensiones exactas en píxeles y pasos para configurar el Editor de Sprites de Unity:

![Claude devolviendo el resultado del spritesheet con tabla de dimensiones de fotogramas](/blog/spritesheet-forge-mcp-demo/demo-3.png)

Salida: 675 × 165 px, 9 fotogramas en una sola fila, fondo transparente:

![Spritesheet de salida — 675×165 px, 9 fotogramas, fondo transparente](/blog/spritesheet-forge-mcp-demo/spritesheet.png)

**Parámetros que Claude eligió:**
- `columns: 9` — todos los fotogramas en una tira horizontal, que coincide con la expectativa predeterminada de Unity y Godot para animaciones de sprites simples
- `background_removal: true` — elimina el fondo blanco, produciendo un PNG con transparencia alfa por píxel

Puedes anular cualquiera: pregunta por `columns: 3` para obtener una cuadrícula de 3×3, u omite la eliminación de fondo si tu motor utiliza una clave de color en lugar de alfa.

---

## Demo 2: JSON del Atlas de Sprites

Una única pregunta de seguimiento genera un atlas compatible con TexturePacker desde la URL de salida del spritesheet; la URL del paso anterior se pasa directamente sin necesidad de volver a cargar:

![Claude llamando a split_spritesheet para generar JSON de Atlas de Sprites](/blog/spritesheet-forge-mcp-demo/demo-4.png)

![Claude devolviendo el Atlas de Sprites corregido con tabla de coordenadas de fotogramas](/blog/spritesheet-forge-mcp-demo/demo-5.png)

Claude puede validar la salida contra la especificación TexturePacker JSON Hash antes de importarla:

![Claude validando el formato JSON del Atlas de Sprites — todas las verificaciones pasaron](/blog/spritesheet-forge-mcp-demo/demo-6.png)

Atlas final: 9 fotogramas a 75 × 165 px cada uno, coordenadas con índice cero desde la esquina superior izquierda:

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

Este formato se carga directamente en Unity (`SpriteAtlasImporter`), Godot (`AtlasTexture`), Phaser 3 (`Loader.atlas`), y cualquier otro motor que acepte la salida JSON Hash de TexturePacker.

---

## Encadenamiento de herramientas

Los dos demos anteriores son parte de una cadena de herramientas más grande. Cada salida de herramienta es una URL almacenada en Cloudflare R2 con un TTL de 1 hora. Pasar una URL de una herramienta directamente a la siguiente evita volver a cargar:

```
gif_to_spritesheet(input.gif)
        │  URL de spritesheet PNG
        ▼
split_spritesheet(spritesheet URL, columns=9)
        │  URL de atlas JSON + fotogramas individuales
        ▼
frames_to_animation(frame URLs, fps=12)   ← animación de vista previa
        │
        ▼
trim_png(any frame URL)                   ← limpieza opcional
```

Puedes pedirle a Claude que ejecute toda esta cadena en un solo mensaje: *"Convierte este GIF a un spritesheet, genera el atlas JSON y dame una animación de vista previa a 12 fps."* Claude llama a cada herramienta en secuencia, pasando URLs entre ellas automáticamente.

Una restricción a tener en cuenta: **las URL de salida expiran después de 60 minutos**. Descarga cualquier archivo que necesites antes de que termine la sesión.

---

## Referencia de Herramientas MCP (Para Agentes de IA)

Esquemas de entrada completos para las siete herramientas de Spritesheet Forge. Estas definiciones describen los parámetros exactos que los agentes de IA pueden pasar al llamar a cada herramienta a través de MCP.

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

## Siguiente paso

- **[Building a Remote MCP Server with Cloudflare Workers and GCP Cloud Run](/blog/building-remote-mcp-server)** — si quieres construir tu propio servidor MCP en lugar de usar uno alojado, esto cubre toda la arquitectura: OAuth 2.1 + PKCE, autenticación de servicio interno, ensayo de archivos R2, y diseño de herramientas.
- *([Importing Spritesheets into Unity and Godot: A Step-by-Step Guide](/blog/spritesheet-game-engine-import) — próximamente)* — guías detalladas para el flujo de trabajo de Sprite Atlas de Unity y el nodo AtlasTexture de Godot, incluyendo cómo conectar directamente la salida JSON del atlas.

Spritesheet Forge es de código abierto y gratis de usar (100 operaciones/mes en el nivel gratuito):

- **Guía de configuración MCP** — [clawstudiouo.com/mcp](https://clawstudiouo.com/mcp)
- **Instalación de un clic en Smithery** — [smithery.ai](https://smithery.ai/servers/lxya98874322688423/spritesheet-forge)
- **Repositorio de GitHub** — [LAXY9887/Game-Dev.-Spritesheet-Forge](https://github.com/LAXY9887/Game-Dev.-Spritesheet-Forge)
- **Documentación completa de API** — [GitHub Pages](https://laxy9887.github.io/Game-Dev.-Spritesheet-Forge)

---

## Preguntas frecuentes

**¿Qué es Spritesheet Forge?**

Spritesheet Forge es un servidor MCP alojado que le da a Claude acceso directo a herramientas de procesamiento de spritesheets. Una vez conectado, Claude puede convertir GIFs a spritesheets, empacar fotogramas PNG, generar JSON de atlas, dividir spritesheets existentes y más, a través del lenguaje natural, sin necesidad de instalar software local.

**¿Cómo conecto Spritesheet Forge a Claude?**

Para Claude Desktop, agrega la configuración del servidor a `claude_desktop_config.json`. Para Claude Code CLI, ejecuta `claude mcp add spritesheet-forge --transport http https://mcp.clawstudiouo.com/mcp`. En el primer uso, Claude abre automáticamente una página de OAuth de GitHub; haz clic en "Autorizar" y el token se almacena durante 30 días. La configuración completa está en [clawstudiouo.com/mcp](https://clawstudiouo.com/mcp).

**¿Qué formatos de archivo admite Spritesheet Forge?**

`gif_to_spritesheet` acepta cualquier GIF animado. `png_to_spritesheet` y `frames_to_animation` aceptan un ZIP de fotogramas PNG. Todas las salidas de imagen son PNG; la salida del atlas es JSON Hash de TexturePacker, compatible con Unity, Godot, Phaser 3, Cocos2d, y motores similares.

**¿Es Spritesheet Forge gratis?**

El nivel gratuito incluye 100 operaciones por mes, suficiente para desarrollo activo de videojuegos con volumen de animación moderado. No se requiere tarjeta de crédito. El servidor en sí es de código abierto en GitHub.

**¿Puede Claude manejar archivos de sprites grandes?**

Los archivos más pequeños que ~185 KB se envían en línea como base64. Para archivos más grandes, Claude los carga al punto de acceso `/upload` del servidor y pasa la URL devuelta a la herramienta. No lo haces manualmente; Claude detecta el tamaño del archivo y elige el método correcto automáticamente.

**¿Cuánto tiempo están disponibles los archivos de salida?**

Las URL de salida de herramientas se almacenan en Cloudflare R2 con un TTL de 1 hora. Si cierras la sesión sin descargar, los archivos expiran. Pregúntale a Claude que muestre claramente los enlaces de descarga al final de un flujo de trabajo.

**¿Puedo encadenar múltiples herramientas en una sola solicitud?**

Sí. Claude llama a las herramientas en secuencia automáticamente, pasando cada URL de salida como entrada de la siguiente herramienta. Por ejemplo: *"Convierte este GIF, divídelo en fotogramas y dame un GIF de vista previa a 12 fps"* ejecuta tres herramientas sin ningún paso manual entre ellas.

**¿Con qué motores de juego es compatible el JSON del atlas?**

El formato de salida es TexturePacker JSON Hash, el formato de atlas más ampliamente compatible en desarrollo de videojuegos. Es compatible con Unity (`SpriteAtlasImporter`), Godot (`AtlasTexture`), Phaser 3 (`Loader.atlas`), Cocos2d, y cualquier otro motor que acepte la salida de TexturePacker.
