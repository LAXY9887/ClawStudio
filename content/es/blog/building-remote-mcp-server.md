---
title: "Construir un Servidor MCP Remoto con Cloudflare Workers y GCP Cloud Run"
description: "Guía paso a paso para construir un servidor MCP alojado en Cloudflare Workers y GCP Cloud Run — cubriendo OAuth 2.1 + PKCE, autenticación de servicios internos, almacenamiento temporal de archivos en R2, y mantener el código del backend privado."
date: "2026-05-06"
readingTime: 15
tag: "guide"
---

## Punto de Partida: Una API Existente

Antes de que MCP estuviera involucrado, Spritesheet Forge ya tenía un backend funcional: un conjunto de APIs de procesamiento de imágenes ejecutándose en Google Cloud Platform. Las APIs hacían el trabajo real — convertir GIFs a spritesheets, recortar bordes transparentes, empaquetar frames, generar JSON de atlas.

MCP (Model Context Protocol) es un estándar abierto que permite que asistentes de IA como Claude invoquen directamente herramientas y APIs a través del lenguaje natural. Lo que MCP añade es una **interfaz nativa para IA** en la parte superior de esa API existente. En lugar de llamar endpoints directamente, Claude ahora puede invocar estas operaciones a través del lenguaje natural. El backend no cambió. Lo que cambió fue cómo se accede a él.

Esta distinción es importante para entender la arquitectura: esto no es una reconstrucción desde cero. Es una nueva capa sentada enfrente de algo que ya funciona.

### Por Qué GCP

Si estás iniciando un nuevo proyecto y aún no has elegido un proveedor en la nube, la pila serverless de GCP vale la pena considerarla seriamente — especialmente para herramientas para desarrolladores y utilidades donde el tráfico es impredecible.

La propiedad clave es **escalar a cero**. Cloud Run, el tiempo de ejecución de contenedor gestionado de GCP, se apaga completamente cuando no hay solicitudes e inicia nuevamente en segundos cuando llega una solicitud. Solo pagas por el tiempo de cómputo realmente utilizado, facturado al 100ms más cercano. Para un servidor MCP que maneja llamadas de herramientas esporádicas en lugar de tráfico continuo, esto se traduce en costos de ejecución que son prácticamente cero.

Otros beneficios que vale la pena conocer:

- **Sin infraestructura que gestionar** — Cloud Run maneja terminación HTTPS, escalado, verificaciones de salud y reversiones de despliegue automáticamente
- **Cualquier lenguaje, cualquier framework** — despliega cualquier contenedor, no se requiere runtime específico de la plataforma
- **El nivel gratuito es generoso** — 2 millones de solicitudes y 360.000 GB-segundos de cómputo por mes sin costo
- **Artifact Registry + Cloud Build** — el pipeline de despliegue (construir imagen → empujar → desplegar) puede ser completamente automatizado con un único comando `gcloud`

Un post dedicado cubriendo esta configuración de GCP desde cero — despliegue de Cloud Run, Artifact Registry, CI/CD de Cloud Build, e configuración de IAM — próximamente. *([Configurar un Servicio de API en GCP](/blog/deploy-api-on-gcp-cloud-run))*

---

## Añadiendo la Capa MCP

Con el backend ya ejecutándose, la pregunta era cómo exponerlo a clientes de IA. La respuesta fue una puerta de enlace delgada en Cloudflare Workers que habla el protocolo MCP y traduce solicitudes a la API existente.

```
Cliente MCP (Claude Desktop / Claude Code)
        │  HTTP Transmisible (protocolo MCP)
        ▼
Cloudflare Worker  ←── puerta de enlace MCP, Auth, Cuota, Almacenamiento temporal de archivos
        │  HTTP + X-MCP-Key
        ▼
GCP Cloud Run  ←── API existente (procesamiento de imágenes, etc.)
        │
        ▼
Cloudflare R2  ←── archivos de salida temporales (TTL de 1 hora)
Cloudflare KV  ←── Sesión, Cuota, estado OAuth
```

### Cloudflare Worker

El Worker maneja todo en el edge: análisis del protocolo MCP, verificación del token OAuth, aplicación de cuota por usuario, y almacenamiento temporal de archivos. Los Workers están distribuidos globalmente sin arranque en frío — las solicitudes llegan al punto de presencia más cercano con sobrecarga de submilisegundos. La restricción es un límite estricto de tiempo de CPU (50ms por solicitud en el nivel gratuito), lo cual los hace inadecuados para nada que sea computacionalmente intensivo. Es exactamente por eso que el trabajo pesado permanece en Cloud Run.

### Cloudflare R2

R2 es el mecanismo de transferencia entre herramientas. Cada salida de herramienta se escribe en R2 con un TTL de 1 hora y se devuelve como una URL. La siguiente herramienta en una cadena recibe esa URL como entrada — el Worker la obtiene directamente de R2 sin un viaje HTTP extra. Esto hace que los flujos de trabajo de agentes multi-paso sean rápidos y económicos. R2 es compatible con S3, por lo que cualquier SDK de S3 existente funciona sin modificación.

### Cloudflare KV

KV almacena tres tipos de datos: tokens de sesión OAuth (TTL de 30 días), contadores de cuota mensual por usuario, y estado PKCE de OAuth durante el flujo de autorización. KV es eventualmente consistente con lecturas almacenadas en caché en el edge — bien adaptado para estos valores de escritura-una-vez-lectura-muchas.

Para un recorrido completo de configuración de Cloudflare Workers, configuración de dominios personalizados, gestión de DNS, e integración de R2 y KV, consulta la guía complementaria: *([Configuración Completa de Cloudflare Worker para Servidores MCP](/blog/cloudflare-worker-setup-guide) — próximamente)*

### La Ventaja del Repositorio Privado

Dividir la puerta de enlace del backend resuelve un problema menos obvio: **solo el envoltorio MCP necesita ser público**.

El código de Cloudflare Worker define tu superficie de API — nombres de herramientas, parámetros, autenticación. Publicarlo permite que la comunidad inspeccione la integración y construya clientes compatibles. El backend de Cloud Run, donde vive la lógica de procesamiento real, puede permanecer en un repositorio privado. Tus algoritmos core nunca se exponen.

Para un producto comercial, esto es significativo: puedes enviar una integración MCP abierta, permitir que la comunidad contribuya a la capa de interfaz, y mantener el backend propietario completamente cerrado. Muestras la tecnología MCP sin dar away los detalles de implementación.

---

## Lo Que Realmente Necesita Un Servidor MCP Completo

Cuando Spritesheet Forge se lanzó por primera vez, el servidor MCP estaba técnicamente ejecutándose — pero Claude apenas podía usarlo. Las herramientas existían, pero al servidor le faltaban varios componentes en los que los clientes MCP dependen antes de que siquiera intenten llamar a una herramienta. El agente se conectaba, se confundía, y se rendía.

Aquí está la lista completa de lo que un servidor MCP remoto necesita para funcionar correctamente:

### Manejador de Protocolo MCP (`POST /mcp`)

El endpoint principal recibe todo el tráfico MCP. Necesita manejar una secuencia específica de mensajes que todo cliente MCP envía antes de hacer algo útil:

| Método | Quién lo envía | Qué significa |
|--------|-------------|---------------|
| `initialize` | Cliente, primer mensaje | "Me estoy conectando, aquí están mis capacidades" |
| `notifications/initialized` | Cliente, después de que el servidor responde a `initialize` | "Listo para proceder" |
| `tools/list` | Cliente, para descubrir herramientas disponibles | "¿Qué puedes hacer?" |
| `tools/call` | Cliente, para invocar realmente una herramienta | "Haz esta cosa" |

Los mensajes `initialize` y `notifications/initialized` deben devolver una respuesta válida incluso sin autenticación — son el apretón de manos que establece la sesión. Si alguno de estos falla o devuelve un error de auth, el cliente considera la conexión rota y se detiene.

### Definiciones de Herramientas

Cada herramienta registrada en `tools/list` necesita cuatro cosas para estar completa:

```typescript
{
  name: 'gif_to_spritesheet',
  description: '...', // instrucciones para el LLM — ver sección Tool Design
  inputSchema: {       // JSON Schema para parámetros
    type: 'object',
    properties: { ... },
    required: [...]
  },
  outputSchema: { ... },  // JSON Schema para el valor de retorno
  annotations: {          // sugerencias de comportamiento para plataformas y LLMs
    title: 'GIF to Spritesheet',
    readOnlyHint: false,
    idempotentHint: false,
    openWorldHint: true
  }
}
```

Falta `outputSchema` o `annotations` no rompe las llamadas de herramientas, pero arruina tu puntuación de calidad en toda plataforma de directorio. Más importante aún, los LLMs usan `outputSchema` para analizar y razonar sobre resultados de herramientas — sin él, el modelo está adivinando la estructura de lo que devuelve.

### Endpoints de Descubrimiento e Infraestructura

Más allá de `/mcp`, un servidor completo también necesita:

- **`GET /health`** — devuelve `{"status":"ok"}` con HTTP 200, sin autenticación requerida. Las plataformas de directorio investigan esto para verificar que tu servidor está vivo.
- **`OPTIONS /mcp`** — maneja preflight de CORS. Requerido para cualquier cliente MCP basado en navegador.
- **`GET /.well-known/oauth-authorization-server`** — si usas OAuth, así es como los clientes MCP descubren tus endpoints de auth automáticamente. Sin él, los clientes recurren a configuración manual o fallan completamente.

### La Consecuencia de Faltar Cualquiera de Esto

Claude se conecta a un servidor MCP ejecutándose a través de `initialize` → `notifications/initialized` → `tools/list` en secuencia. Si `tools/list` falla (porque requiere auth, o porque la respuesta está malformada), el cliente no tiene definiciones de herramientas con las que trabajar. Desde la perspectiva de Claude, el servidor existe pero no tiene capacidades — no puede invocar nada.

Así es como se veía "Agent casi incapaz de usar el MCP" en la práctica: la conexión tuvo éxito, pero todo intento de usar una herramienta falló porque el paso de descubrimiento nunca se completó correctamente.

### Ejemplos del Protocolo

Cada mensaje en el protocolo MCP es un objeto JSON-RPC 2.0 sobre HTTP POST. Así es como se ve el intercambio real.

**Paso 1 — Cliente envía `initialize`**

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

**El servidor responde con sus propias capacidades**

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

**Paso 2 — Cliente envía `notifications/initialized`** (sin respuesta esperada)

```json
{
  "jsonrpc": "2.0",
  "method": "notifications/initialized"
}
```

**Paso 3 — Cliente envía `tools/list`** (sin autenticación requerida)

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/list"
}
```

**El servidor devuelve todas las herramientas registradas**

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

Una vez que este apretón de manos se completa, el cliente sabe exactamente qué herramientas están disponibles y cómo llamarlas. Solo después de este punto la autenticación se vuelve relevante — llamadas de herramientas como `tools/call` requieren un token Bearer válido.

**`server_info` — una llamada de herramienta sin argumentos**

Así es como se ve una solicitud y respuesta real de `tools/call`, usando la herramienta `server_info` de Spritesheet Forge:

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

**Respuesta actual:**

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

`server_info` es el patrón a seguir para cualquier herramienta que devuelva configuración o metadatos: cero argumentos, salida determinística, útil para que los agentes consulten antes de iniciar un flujo de trabajo.

---

## Autenticación

### Por Qué Autenticar

Sin autenticación, tu servidor MCP es una API pública abierta — cualquiera que descubra el endpoint puede ejecutar tus herramientas indefinidamente, consumiendo cómputo de Cloud Run, quemando escrituras de almacenamiento de R2, y agotando cuota que pertenece a usuarios reales. La autenticación resuelve tres problemas a la vez:

- **Protección de recursos**: cada llamada de herramienta se traduce directamente en costo de cómputo. Sin saber quién está llamando, no puedes aplicar límites.
- **Gestión de cuota**: las cuotas mensuales por usuario requieren una identidad estable para seguimiento. Sin identidad significa sin aplicación justa.
- **Prevención de abuso**: un endpoint público sin auth es trivialmente scriptable — un mal actor puede disparar tus facturas o degradar el servicio para todos los demás.

### Opciones de Autenticación

| Método | Experiencia del usuario | Implementación | Soporte de cliente MCP |
|--------|----------------|----------------|-------------------|
| Sin auth | Sin fricción | Trivial | Universal |
| Clave API estática | Pobre — el usuario debe copiar y pegar en la configuración | Simple | Universal |
| OAuth 2.1 + PKCE | Perfecta — un clic en el navegador | Moderada | Claude Desktop, Claude Code |

**Sin auth** es solo apropiado para servidores locales o solo internos donde la red es el límite de seguridad. Para un servidor remoto público, esto significa que cualquiera en internet puede llamar a tus herramientas.

**Las claves API** son la opción obvia primera: genera una clave, dásela al usuario, listo. El problema es la experiencia de distribución. El usuario tiene que encontrar un panel de control o página de documentos, copiar una cadena aleatoria, abrir su archivo de configuración, pegarla, y reiniciar el cliente. Eso es un proceso multi-paso con múltiples puntos de falla, y no hay recuperación si la pierden. Cada nuevo cliente MCP que usen requiere la misma configuración manual.

**OAuth 2.1 + PKCE** es más trabajo implementar pero entrega una experiencia dramáticamente mejor. El cliente MCP maneja el flujo completo nativamente — abre automáticamente el navegador cuando se necesita un token. El usuario ve una página de inicio de sesión de GitHub, hace clic en "Autorizar", y el cliente almacena el token resultante internamente. Desde la perspectiva del usuario, es un clic sin archivo de configuración involucrado.

### Cómo Spritesheet Forge Lo Implementa

La implementación usa GitHub como el proveedor de identidad, Cloudflare KV para almacenamiento de tokens, y el flujo estándar OAuth 2.1 + PKCE:

**1. Auto-descubrimiento vía `/.well-known/oauth-authorization-server`**

Los clientes MCP leen este endpoint antes de iniciar cualquier flujo OAuth. Devuelve el endpoint de autorización, endpoint de token, y tipos de subvención soportados. Sin él, los clientes requieren configuración manual o fallan para conectarse completamente.

**2. Registro dinámico de cliente (RFC 7591)**

Cualquier cliente MCP puede registrarse a sí mismo programáticamente POSTeando al endpoint de registro. Esto significa que nuevos clientes pueden conectarse sin ser pre-aprobados o listados en ninguna parte — el servidor maneja el registro automáticamente.

**3. Flujo PKCE**

Previene la intercepción de código de autorización. El cliente genera un `code_verifier` aleatorio, envía su hash (`code_challenge`) con la solicitud de autorización, luego prueba que posee el verificador original cuando intercambia el código por un token. Esto cierra el vector de ataque donde un código de autorización podría ser robado en tránsito.

**4. Almacenamiento de sesión de KV**

El token de sesión se almacena en Cloudflare KV bajo `session:{userId}` con un TTL de 30 días. Cada solicitud de `tools/call` valida el token Bearer contra KV antes de que la solicitud llegue a Cloud Run.

**5. Fallback de script**

Para usuarios trabajando en scripts, pipelines de CI, o ambientes de benchmark donde OAuth del navegador no es práctico, un script `get-token.py` está disponible para descargar. Ejecuta el flujo OAuth completo en una terminal, imprime el token resultante, y lo guarda a `~/.spritesheet-forge-token`.

### La Clave X-MCP: Autenticación de Servicios Internos

La arquitectura tiene dos capas: el Cloudflare Worker (puerta de enlace pública) y Cloud Run (el backend privado). Cloud Run se ejecuta en una URL que es técnicamente alcanzable desde internet — cualquiera que la descubra podría POSTear solicitudes directamente, bypaseando el Worker completamente. Eso significa bypasear verificación OAuth, aplicación de cuota, y limitación de velocidad.

El encabezado `X-MCP-Key` cierra esta brecha. Es un secreto compartido conocido solo por el Worker y Cloud Run. El Worker valida cada token OAuth entrante, luego reenvía la solicitud a Cloud Run con este encabezado adjunto. Cloud Run rechaza cualquier solicitud que no incluya la clave correcta.

```
Usuario → Worker:     Authorization: Bearer <oauth-token>   (auth público)
Worker → Cloud Run: X-MCP-Key: <internal-secret>         (auth interno)
```

Esto es **defensa en profundidad**: incluso si la URL de Cloud Run se filtra a través de registros, mensajes de error, o ingeniería inversa, un atacante no puede llamarla sin la clave interna. Todo tráfico es forzado a través de la puerta de enlace, y toda aplicación de seguridad se preserva.

Sin esto, "backend privado" sería una falsa afirmación — el backend seguiría siendo efectivamente público para quien mirara lo suficientemente duro.

---

## Diseño de Entrada de Archivos

Esta sección es específica para servidores MCP cuyas herramientas procesan archivos — convertidores de imágenes, parseadores de documentos, procesadores de audio, y similares. Si tus herramientas solo manejan texto o datos estructurados, no enfrentarás este problema. Pero para APIs cargadas de archivos, es uno de los problemas más prácticamente limitantes con los que te encontrarás.

El problema core es que pasar archivos a un Agente es más difícil de lo que parece. El enfoque instintivo — base64-codificar el archivo y enviarlo inline — funciona en teoría pero golpea una restricción dura en la práctica: **la herramienta shell de Claude Code tiene un límite de contexto de ~256 KB en la salida stdout**. La codificación Base64 expande el tamaño del archivo por ~33%, lo cual significa que el techo seguro real para base64 inline es alrededor de 185 KB. La mayoría de imágenes, archivos de audio, y documentos son más grandes que eso.

Esto hace base64 impracticable para la mayoría de casos de uso reales de procesamiento de archivos. La solución que añadimos fue un endpoint `/upload` dedicado en la capa MCP — fuera del protocolo MCP mismo. El usuario (o Agente) POSTea el archivo directamente ahí, obtiene una URL de vuelta, y pasa esa URL a la herramienta en lugar de incrustar el archivo inline. El Worker luego obtiene el archivo server-side desde R2, bypasseando la restricción de tamaño de contexto completamente.

**¿Por Qué Cloudflare R2 para almacenamiento de archivos?**

R2 es el almacenamiento de objetos compatible con S3 de Cloudflare, y es la opción correcta aquí por una razón específica: **cero cargos de egreso**. AWS S3 y la mayoría de otros servicios de almacenamiento de objetos cobran por transferencia de datos — cada vez que una salida de herramienta se lee (lo cual sucede en cada llamada de herramienta encadenada), pagas. R2 no cobra nada por egreso. Para un servidor MCP que mueve archivos entre herramientas frecuentemente, esto importa.

El nivel gratuito de R2 también es generoso lo suficiente para que un servidor MCP de tráfico bajo-a-moderado pueda ejecutarse completamente dentro de él:

| Recurso | Nivel gratuito |
|----------|-----------|
| Almacenamiento | 10 GB/mes |
| Operaciones de Clase A (escrituras, eliminaciones) | 1 millón/mes |
| Operaciones de Clase B (lecturas) | 10 millones/mes |
| Egreso (transferencia de datos) | Gratuito, siempre |

Las salidas de herramienta se almacenan con un TTL de 1 hora y se eliminan automáticamente — entonces el uso de almacenamiento se mantiene bajo incluso bajo uso activo. Un archivo procesado y descartado dentro de una hora nunca cuenta hacia el total de almacenamiento mensual de forma significativa.

Las herramientas MCP que aceptan archivos necesitan manejar tres escenarios de entrada distintos:

| Escenario | Método |
|----------|--------|
| Archivos pequeños (< ~185 KB) | URI de datos base64: `data:image/png;base64,...` |
| Archivos grandes o archivos desde shell | POST al endpoint `/upload`, devuelve la URL |
| Salida de una herramienta anterior | Pasa la URL de salida directamente — Worker obtiene de R2 |

La restricción no obvia: la herramienta shell de Claude Code tiene un límite de contexto de ~256 KB en stdout. La codificación Base64 expande el tamaño del archivo por ~33%, entonces el techo práctico para base64 inline es alrededor de 185 KB, no 4 MB. Las descripciones de tus herramientas deben indicar este límite explícitamente y apuntar a los usuarios al endpoint de upload cuando importa.

**El bug de newline de base64.** Herramientas de shell como `openssl base64` y la CLI `base64` insertan una newline cada 76 caracteres. Pasar esa cadena directamente como un URI de datos causa errores `INVALID_BASE64` en el servidor. Pon esta advertencia en tu descripción de herramienta:

> "Quita toda whitespace y newlines de la cadena base64 antes de añadir el prefijo data URI. Ejemplo: `base64 file.png | tr -d '\n'`"

---

## Diseño de Herramientas Que Funciona Con LLMs

### Paso 0: Conectar Claude a Tu Servidor MCP

Antes de que cualquier herramienta pueda ser usada, Claude necesita estar conectado al servidor MCP. Esto suena obvio, pero vale la pena deletrearlo: Claude no descubre automáticamente o se conecta a servidores MCP. Configuras la conexión explícitamente, y hasta que lo hagas, Claude no tiene conocimiento de que el servidor existe.

**Claude Desktop** — añade a `claude_desktop_config.json` (encuéntralo vía Settings → Developer):

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

**Claude Code CLI** — añade vía terminal:

```bash
claude mcp add spritesheet-forge --transport http https://mcp.clawstudiouo.com/mcp
```

Si el servidor no está configurado, Claude no dirá "No puedo encontrar esa herramienta." Solo actuará como si la herramienta no existiera — buscando en la web alternativas, alucinando herramientas que suenen similar pero no tiene realmente, o produciendo una respuesta genérica que completamente falla lo que pediste. El modo de falla es silencioso y confuso.

### Cómo Los Usuarios Encuentran Tu Servidor MCP

Conseguir Claude conectado es el paso uno. Conseguir que usuarios sepan que el servidor existe en primer lugar es un problema separado. Hay varios canales, cada uno alcanzando una audiencia diferente:

**Fuente y documentación**
- [Repositorio de GitHub](https://github.com/LAXY9887/Game-Dev.-Spritesheet-Forge) — la fuente de verdad principal. Los desarrolladores miran aquí primero. Un README claro con la URL del endpoint y fragmento de configuración es el mínimo.
- [Página de tutorial dedicada](https://sprite-forge-mcp.tutorial.clawstudiouo.com) — una página autónoma que recorre instalación, autenticación, y prompts de ejemplo. Útil para no-desarrolladores que no quieren leer un README.

**Registros oficiales**
- [Registro MCP de Anthropic](https://registry.modelcontextprotocol.io/?q=io.github.LAXY9887%2Fspritesheet-forge) — el índice oficial de Anthropic de servidores MCP. Esto es donde aplicaciones clientes MCP consultan para mostrar listas de servidores curados dentro de la app.

**Marketplaces y directorios**
- [Smithery.ai](https://smithery.ai/servers/lxya98874322688423/spritesheet-forge) — integrado directamente en el navegador MCP de Claude Code. Los usuarios pueden encontrar e instalar servidores sin salir de la CLI.
- [MCP Marketplace](https://mcp-marketplace.io/server/game-dev-spritesheet-forge) — un marketplace dedicado con modelo de revenue-sharing para tiers pagados.
- GitHub Marketplace — accesible al ecosistema de desarrolladores de GitHub.

Los canales se refuerzan mutuamente. Un usuario que encuentra el servidor en Smithery frecuentemente verificará el repo de GitHub después. La página de tutorial convierte descubrimiento en instalación actual. Cubrir todos ellos cuesta poco mantener y alcanza audiencias que no se superponen.

### Escribir Descripciones de Herramientas Que Realmente Funcionan

Las descripciones de herramientas no son documentación para humanos — son instrucciones que los LLMs usan para decidir *cuándo* y *cómo* llamar tu herramienta. Una descripción mal-escrita resulta en el modelo llamando la herramienta incorrecta, pasando parámetros incorrectos, o produciendo errores que son difíciles de debuguear.

Lo que una buena descripción de herramienta incluye:

- **Formato de entrada**: ¿URL? ¿URI de datos? ¿Qué tipos MIME se aceptan?
- **Salida**: ¿qué devuelve la herramienta? ¿Una URL? ¿Una estructura JSON? ¿Cuál es el TTL?
- **Restricciones**: límites de tamaño de archivo, interacciones de parámetros, gotchas conocidas
- **Ejemplos**: para reglas de entrada complejas, da un ejemplo inline o comando shell

**Diseña para encadenamiento.** Haz que la salida de cada herramienta sea directamente usable como entrada de otra herramienta. Esto permite que los agentes compongan flujos de trabajo multi-paso naturalmente:

```
gif_to_spritesheet → split_spritesheet → frames_to_animation
```

**Añade una herramienta `server_info`.** Proporciona una herramienta sin argumentos que devuelve configuración runtime: URL de endpoint de upload, TTL de archivo de salida, límites de tamaño de archivo, y la regla para elegir entre base64 y upload. Esto previene que esa información se vuelva stale en descripciones de herramientas individuales y da a los agentes una forma confiable de consultarla antes de iniciar flujos de trabajo complejos.

---

## Referencia Rápida de Errores

| Síntoma | Causa Raíz | Solución |
|---------|-----------|-----|
| La plataforma muestra "0 herramientas encontradas" | `tools/list` requiere auth | Añade `initialize`, `notifications/initialized`, `tools/list` a whitelist de handshake |
| Puntuación de Calidad de Smithery es 0 | Falta `outputSchema` / `annotations` | Añade ambos campos a todas las herramientas |
| Error de decodificación `INVALID_BASE64` | Las herramientas shell insertan newlines en base64 | Advierte en descripción de herramienta; usa `tr -d '\n'` |
| El agente dice "No tengo esa herramienta" e inicia búsqueda web | Servidor MCP no configurado en el cliente | Añade configuración del servidor a `claude_desktop_config.json`, o corre `claude mcp add` |
| La página de autorización OAuth nunca se abre | `/.well-known/oauth-authorization-server` no públicamente accesible | Asegura que el endpoint sea alcanzable sin auth |
| El endpoint de upload devuelve `401` | Token Bearer faltante o expirado | El usuario se re-autentica; corre `get-token.py` si es necesario |
| La URL de salida de herramienta devuelve 404 o falla | TTL de objeto de R2 expirado (60 minutos) | Re-ejecuta la herramienta de origen para obtener una URL fresca |
| Cloud Run devuelve `403` en todas las solicitudes | Encabezado `X-MCP-Key` faltante o incorrecto | Verifica el secreto en variables de entorno del Worker |
| Cliente MCP basado en navegador no puede conectar | Encabezados CORS faltantes en `/mcp` | Añade manejador preflight `OPTIONS` + `Access-Control-Allow-Origin: *` a todas las respuestas |

---

## Preguntas Frecuentes

**¿Qué es un servidor MCP remoto?**

Un servidor MCP remoto es un servicio alojado en la nube que implementa el Model Context Protocol, permitiendo que asistentes de IA como Claude invoquen herramientas sobre internet a través del lenguaje natural. A diferencia de servidores MCP locales — que se ejecutan en la máquina del usuario y son solo accesibles desde esa máquina — un servidor remoto es accesible a cualquier cliente MCP autenticado en cualquier lugar, sin instalación local.

**¿Cómo añado un servidor MCP a Claude Desktop o Claude Code?**

Para Claude Desktop, añade la configuración del servidor a `claude_desktop_config.json` (encuéntrala bajo Settings → Developer). Para Claude Code, corre `claude mcp add <name> --transport http <url>` en la terminal. Hasta que la conexión esté explícitamente configurada, Claude no tiene conocimiento de que el servidor existe y no puede usar ninguna de sus herramientas.

**¿Es gratuito ejecutar un servidor MCP remoto en Cloudflare y GCP?**

Sí, para tráfico bajo-a-moderado. Cloudflare Workers incluye 100.000 solicitudes por día en el nivel gratuito. Cloudflare R2 ofrece 10 GB de almacenamiento, 1 millón de escrituras, y 10 millones de lecturas por mes sin costo — con cero cargos de egreso. GCP Cloud Run proporciona 2 millones de solicitudes y 360.000 GB-segundos de cómputo por mes de forma gratuita. Una herramienta para desarrolladores manejando llamadas de herramientas esporádicas puede ejecutarse completamente dentro de estos límites.

**¿Por Qué usar OAuth en lugar de claves API para autenticación MCP?**

OAuth 2.1 proporciona una mejor experiencia de usuario. Con claves API, los usuarios deben copiar y pegar manualmente un token en un archivo de configuración — un proceso multi-paso sin recuperación de auto-servicio si la clave se pierde. Con OAuth, Claude Desktop y Claude Code manejan el flujo nativamente: abren un navegador, el usuario hace clic en "Autorizar", y el token se almacena automáticamente. El usuario nunca toca un archivo de configuración.

**¿Por qué Claude no puede encontrar mi herramienta MCP?**

La causa más común es que el servidor MCP no ha sido configurado en el cliente. Claude no descubre servidores automáticamente. Si el servidor está configurado pero las herramientas aún no aparecen, verifica que `tools/list` sea accesible sin autenticación — si requiere un token Bearer, Claude no puede recuperar la lista de herramientas durante el handshake inicial y se comportará como si el servidor no tuviera herramientas.

**¿Cómo paso archivos grandes a una herramienta MCP?**

Para archivos más grandes que ~185 KB, usa el endpoint `/upload` del servidor en lugar de codificación base64. POSTea el archivo directamente (multipart/form-data), recibe una URL en la respuesta, y pasa esa URL como parámetro de archivo de la herramienta. El servidor obtiene el archivo server-side, bypasseando el límite de salida stdout de ~256 KB de Claude Code que hace base64 inline impracticable para la mayoría de archivos reales.

**¿Qué es el encabezado X-MCP-Key?**

El X-MCP-Key es un secreto compartido usado para autenticar solicitudes entre el Cloudflare Worker (la puerta de enlace pública) y el backend de GCP Cloud Run. Asegura que todo tráfico llegue a Cloud Run solo a través del Worker — no directamente desde internet. Sin él, cualquiera que descubra la URL de Cloud Run podría bypasear verificación OAuth y aplicación de cuota completamente.

**¿Necesito hacer público el código de mi backend para ejecutar un servidor MCP?**

No. Solo el envoltorio MCP (el Cloudflare Worker) necesita ser un repositorio público — define tu superficie de API y permite que la comunidad inspeccione la integración. El backend de Cloud Run, donde vive la lógica de negocio real, puede permanecer privado. Esto te permite publicar una integración MCP abierta mientras mantienes algoritmos propietarios y detalles de implementación en un repositorio privado.
