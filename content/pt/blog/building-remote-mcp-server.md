---
title: "Construindo um Servidor MCP Remoto com Cloudflare Workers e GCP Cloud Run"
description: "Guia passo a passo para construir um servidor MCP hospedado em Cloudflare Workers e GCP Cloud Run — cobrindo OAuth 2.1 + PKCE, autenticação de serviços internos, preparação de arquivos em R2, e manter seu código de backend privado."
date: "2026-05-06"
readingTime: 15
tag: "guide"
---

## Ponto de Partida: Uma API Existente

Antes de qualquer envolvimento com MCP, Spritesheet Forge já tinha um backend funcionando: um conjunto de APIs de processamento de imagens rodando no Google Cloud Platform. As APIs faziam o trabalho real — convertendo GIFs em spritesheets, aparando bordas transparentes, empacotando frames, gerando JSON de atlas.

MCP (Model Context Protocol) é um padrão aberto que permite assistentes de IA como Claude invocar diretamente ferramentas e APIs através de linguagem natural. O que MCP adiciona é uma **interface nativa para IA** sobre aquela API existente. Em vez de chamar endpoints diretamente, Claude agora pode invocar essas operações através de linguagem natural. O backend não mudou. O que mudou foi como ele é alcançado.

Essa distinção importa para entender a arquitetura: isso não é uma reconstrução do zero. É uma nova camada sentando na frente de algo que já funciona.

### Por que GCP

Se você está começando um novo projeto e ainda não escolheu um provedor de nuvem, a pilha serverless do GCP vale séria consideração — especialmente para ferramentas de desenvolvedor e utilitários onde o tráfego é imprevisível.

A propriedade chave é **escala para zero**. Cloud Run, o runtime de container gerenciado do GCP, desliga completamente quando não há requisições e volta em segundos quando uma requisição chega. Você paga apenas pelo tempo de computação realmente usado, cobrado a cada 100ms. Para um servidor MCP que trata chamadas esporádicas de ferramentas em vez de tráfego contínuo, isso se traduz em custos de operação que são praticamente zero.

Outros benefícios vale a pena conhecer:

- **Nenhuma infraestrutura para gerenciar** — Cloud Run lida com terminação HTTPS, escaling, verificações de saúde e rollbacks de deployment automaticamente
- **Qualquer linguagem, qualquer framework** — deploy qualquer container, nenhum runtime específico da plataforma necessário
- **Tier gratuito é generoso** — 2 milhões de requisições e 360.000 GB-segundos de computação por mês sem custo
- **Artifact Registry + Cloud Build** — o pipeline de deployment (construir imagem → enviar → fazer deploy) pode ser totalmente automatizado com um único comando `gcloud`

Um post dedicado cobrindo essa configuração do GCP do zero — deployment em Cloud Run, Artifact Registry, Cloud Build CI/CD, e configuração IAM — está vindo em breve. *([Setting Up an API Service on GCP](/blog/deploy-api-on-gcp-cloud-run))*

---

## Adicionando a Camada MCP

Com o backend já rodando, a questão era como expô-lo aos clientes de IA. A resposta foi um gateway fino em Cloudflare Workers que fala o protocolo MCP e traduz requisições para a API existente.

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

O Worker trata tudo na borda: análise do protocolo MCP, verificação de token OAuth, enforcing de quota por usuário, e preparação de arquivos. Workers são distribuídos globalmente com nenhum cold start — requisições chegam no ponto de presença mais próximo com overhead sub-milissegundo. A restrição é um limite de tempo de CPU rigoroso (50ms por requisição no tier gratuito), o que os torna inadequados para qualquer coisa compute-intensiva. É exatamente por isso que o trabalho pesado fica em Cloud Run.

### Cloudflare R2

R2 é o mecanismo de hand-off entre ferramentas. Toda saída de ferramenta é escrita em R2 com uma TTL de 1 hora e retornada como uma URL. A próxima ferramenta em uma cadeia recebe aquela URL como entrada — o Worker busca-a diretamente de R2 sem um extra HTTP round-trip. Isso torna workflows de agente em múltiplas etapas rápidos e baratos. R2 é compatível com S3, então qualquer SDK S3 existente funciona sem modificação.

### Cloudflare KV

KV armazena três tipos de dados: tokens de sessão OAuth (TTL de 30 dias), contadores de quota mensal por usuário, e estado PKCE OAuth durante o fluxo de autorização. KV é eventualmente consistente com leituras em cache na borda — bem adequado para esses valores write-once-read-many.

Para um passo a passo completo de configuração do Cloudflare Workers, configuração de domínios customizados, gerenciamento de DNS, e conectando R2 e KV, veja o guia complementar: *([Complete Cloudflare Worker Setup for MCP Servers](/blog/cloudflare-worker-setup-guide) — em breve)*

### A Vantagem do Repositório Privado

Separar o gateway do backend resolve um problema menos óbvio: **apenas o wrapper MCP precisa ser público**.

O código do Cloudflare Worker define sua superfície de API — nomes de ferramenta, parâmetros, autenticação. Publicá-lo permite que a comunidade inspecione a integração e construa clientes compatíveis. O backend do Cloud Run, onde a lógica de processamento real vive, pode ficar em um repositório privado. Seus algoritmos principais nunca são expostos.

Para um produto comercial, isso é significativo: você pode enviar uma integração MCP aberta, permitir que a comunidade contribua à camada de interface, e manter o backend proprietário completamente fechado. Você mostra a tecnologia MCP sem entregar detalhes de implementação.

---

## O que um Servidor MCP Completo Realmente Precisa

Quando Spritesheet Forge foi lançado pela primeira vez, o servidor MCP estava tecnicamente rodando — mas Claude mal conseguia usá-lo. As ferramentas existiam, mas o servidor estava faltando vários componentes que clientes MCP dependem antes de nem tentar chamar uma ferramenta. O agente se conectaria, ficaria confuso, e desistiria.

Aqui está a lista completa do que um servidor MCP remoto precisa para funcionar corretamente:

### Manipulador do Protocolo MCP (`POST /mcp`)

O endpoint principal recebe todo tráfego MCP. Ele precisa trata uma sequência específica de mensagens que cada cliente MCP envia antes de fazer qualquer coisa útil:

| Método | Quem envia | O que significa |
|--------|-----------|-----------------|
| `initialize` | Cliente, primeira mensagem | "Estou conectando, aqui estão meus capabilidades" |
| `notifications/initialized` | Cliente, depois que servidor responde a `initialize` | "Pronto para prosseguir" |
| `tools/list` | Cliente, para descobrir ferramentas disponíveis | "O que você pode fazer?" |
| `tools/call` | Cliente, para realmente invocar uma ferramenta | "Faça isto" |

As mensagens `initialize` e `notifications/initialized` devem retornar uma resposta válida mesmo sem autenticação — elas são o handshake que estabelece a sessão. Se qualquer uma falhar ou retornar um erro de auth, o cliente considera a conexão quebrada e para.

### Definições de Ferramenta

Cada ferramenta registrada em `tools/list` precisa de quatro coisas para estar completa:

```typescript
{
  name: 'gif_to_spritesheet',
  description: '...', // instruções para o LLM — veja seção Tool Design
  inputSchema: {       // JSON Schema para parâmetros
    type: 'object',
    properties: { ... },
    required: [...]
  },
  outputSchema: { ... },  // JSON Schema para o valor de retorno
  annotations: {          // dicas de comportamento para plataformas e LLMs
    title: 'GIF to Spritesheet',
    readOnlyHint: false,
    idempotentHint: false,
    openWorldHint: true
  }
}
```

Faltando `outputSchema` ou `annotations` não quebra chamadas de ferramenta, mas destrói sua pontuação de qualidade em toda plataforma de diretório. Mais importante, LLMs usam `outputSchema` para analisar e raciocinar sobre resultados de ferramenta — sem ele, o modelo está adivinhando a estrutura do que volta.

### Endpoints de Descoberta e Infraestrutura

Além do `/mcp`, um servidor completo também precisa de:

- **`GET /health`** — retorna `{"status":"ok"}` com HTTP 200, nenhuma auth necessária. Plataformas de diretório fazem polling disto para verificar que seu servidor está vivo.
- **`OPTIONS /mcp`** — trata CORS preflight. Necessário para qualquer cliente MCP baseado em navegador.
- **`GET /.well-known/oauth-authorization-server`** — se usando OAuth, é assim que clientes MCP descobrem seus endpoints de auth automaticamente. Sem ele, clientes caem para config manual ou falham completamente.

### A Consequência de Faltar Qualquer Um Desses

Claude se conecta a um servidor MCP executando `initialize` → `notifications/initialized` → `tools/list` em sequência. Se `tools/list` falhar (porque requer auth, ou porque a resposta está malformada), o cliente não tem definições de ferramenta para trabalhar. Da perspectiva de Claude, o servidor existe mas não tem capabilidades — ele não consegue invocar nada.

Isto é o que "Agente quase incapaz de usar o MCP" parecia na prática: a conexão teve sucesso, mas toda tentativa de usar uma ferramenta falhou porque a etapa de descoberta nunca completou corretamente.

### Exemplos de Protocolo

Toda mensagem no protocolo MCP é um objeto JSON-RPC 2.0 sobre HTTP POST. Aqui está como o exchange real parece.

**Passo 1 — Cliente envia `initialize`**

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

**Servidor responde com seus próprios capabilidades**

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

**Passo 2 — Cliente envia `notifications/initialized`** (nenhuma resposta esperada)

```json
{
  "jsonrpc": "2.0",
  "method": "notifications/initialized"
}
```

**Passo 3 — Cliente envia `tools/list`** (nenhuma auth necessária)

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/list"
}
```

**Servidor retorna todas as ferramentas registradas**

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

Uma vez que esse handshake completa, o cliente sabe exatamente quais ferramentas estão disponíveis e como chamá-las. Apenas após esse ponto é que autenticação se torna relevante — chamadas de ferramenta como `tools/call` requerem um Bearer token válido.

**`server_info` — uma chamada de ferramenta sem argumentos**

Isto é o que um requisição `tools/call` real e resposta parecem, usando a ferramenta `server_info` de Spritesheet Forge:

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

**Resposta real:**

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

`server_info` é o padrão a seguir para qualquer ferramenta que retorna configuração ou metadata: zero argumentos, saída determinística, útil para agentes consultarem antes de começar um workflow.

---

## Autenticação

### Por que Autenticar?

Sem autenticação, seu servidor MCP é uma API pública aberta — qualquer pessoa que descubra o endpoint pode rodar suas ferramentas indefinidamente, consumindo computação Cloud Run, queimando escritas de armazenamento R2, e esgotando quota que pertence aos usuários reais. Autenticação resolve três problemas de uma vez:

- **Proteção de recursos**: toda chamada de ferramenta se traduz diretamente em custo de computação. Sem saber quem está chamando, você não consegue enforcement de limites.
- **Gerenciamento de quota**: quotas mensais por usuário requerem uma identidade estável para rastrear. Nenhuma identidade significa nenhum enforcement justo.
- **Prevenção de abuso**: um endpoint público com nenhuma auth é trivialmente scriptável — um ator ruim consegue inflar suas contas ou degradar serviço para todos mais.

### Opções de Autenticação

| Método | Experiência do usuário | Implementação | Suporte de cliente MCP |
|--------|------------------------|----------------|-----------------------|
| Sem auth | Sem atrito | Trivial | Universal |
| Chave API estática | Pobre — usuário deve copiar-colar para config | Simples | Universal |
| OAuth 2.1 + PKCE | Transparente — um clique do navegador | Moderado | Claude Desktop, Claude Code |

**Sem auth** é apropriado apenas para servidores locais ou apenas-internos onde a rede é o limite de segurança. Para um servidor remoto público, isto significa qualquer um na internet consegue chamar suas ferramentas.

**Chaves API** são a escolha óbvia inicial: gere uma chave, dê para o usuário, pronto. O problema é a experiência de distribuição. O usuário tem que encontrar um dashboard ou página de docs, copiar uma string aleatória, abrir seu arquivo de config, colar nela, e reiniciar o cliente. Isso é um processo multi-passo com múltiplos pontos de falha, e não há recuperação se perderem. Cada novo cliente MCP que usam requer a mesma configuração manual.

**OAuth 2.1 + PKCE** é mais trabalho para implementar mas entrega uma experiência dramaticamente melhor. O cliente MCP trata o fluxo inteiro nativamente — abre o navegador automaticamente quando um token é necessário. O usuário vê uma página de login GitHub, clica "Autorizar", e o cliente armazena o token resultante internamente. Da perspectiva do usuário, é um clique com nenhuma config file envolvida.

### Como Spritesheet Forge Implementa

A implementação usa GitHub como provedor de identidade, Cloudflare KV para armazenamento de token, e o fluxo padrão OAuth 2.1 + PKCE:

**1. Auto-descoberta via `/.well-known/oauth-authorization-server`**

Clientes MCP lêem esse endpoint antes de iniciar qualquer fluxo OAuth. Ele retorna o endpoint de autorização, endpoint de token, e tipos de grant suportados. Sem ele, clientes requerem configuração manual ou falham em se conectar inteiramente.

**2. Registro de cliente dinâmico (RFC 7591)**

Qualquer cliente MCP consegue se registrar programaticamente fazendo POST ao endpoint de registro. Isto significa novos clientes conseguem se conectar sem serem pré-aprovados ou listados em qualquer lugar — o servidor trata registro automaticamente.

**3. Fluxo PKCE**

Previne interceptação do código de autorização. O cliente gera um `code_verifier` aleatório, envia seu hash (`code_challenge`) com a requisição de autorização, então prova que detém o verifier original ao trocar o código por um token. Isso fecha o vetor de ataque onde um código de autorização poderia ser roubado em trânsito.

**4. Armazenamento de sessão KV**

O token de sessão é armazenado em Cloudflare KV sob `session:{userId}` com uma TTL de 30 dias. Cada requisição `tools/call` valida o Bearer token contra KV antes da requisição alcançar Cloud Run.

**5. Fallback de script**

Para usuários trabalhando em scripts, pipelines CI, ou ambientes de benchmark onde OAuth baseado em navegador não é prático, um script `get-token.py` está disponível para download. Ele roda o fluxo OAuth completo em um terminal, imprime o token resultante, e salva em `~/.spritesheet-forge-token`.

### O X-MCP-Key: Autenticação de Serviço Interno

A arquitetura tem duas camadas: o Cloudflare Worker (gateway público) e Cloud Run (o backend privado). Cloud Run roda em uma URL que é tecnicamente alcançável da internet — qualquer pessoa que a descubra consegue fazer POST direto, burlando o Worker completamente. Isso significa burlando verificação OAuth, enforcement de quota, e rate limiting.

O header `X-MCP-Key` fecha essa lacuna. É um secret compartilhado conhecido apenas pelo Worker e Cloud Run. O Worker valida todo token OAuth chegando, então encaminha a requisição para Cloud Run com esse header anexado. Cloud Run rejeita qualquer requisição que não inclua a chave correta.

```
User → Worker:     Authorization: Bearer <oauth-token>   (public auth)
Worker → Cloud Run: X-MCP-Key: <internal-secret>         (internal auth)
```

Isto é **defesa em profundidade**: mesmo se a URL do Cloud Run vazar através de logs, mensagens de erro, ou reverse engineering, um atacante não consegue chamá-lo sem a chave interna. Todo tráfego é forçado através do gateway, e todo enforcement de segurança é preservado.

Sem isto, "backend privado" seria uma falsa afirmação — o backend ainda seria efetivamente público para qualquer um que olhasse com força suficiente.

---

## Design de Entrada de Arquivo

Essa seção é específica para servidores MCP cujas ferramentas processam arquivos — conversores de imagem, parsers de documento, processadores de audio, e similares. Se suas ferramentas apenas tratam texto ou dados estruturados, você não enfrentará esse problema. Mas para APIs pesadas em arquivo, é um dos problemas mais praticamente limitantes que você encontrará.

O problema central é que passar arquivos para um Agente é mais difícil do que parece. A abordagem instintiva — base64-codificar o arquivo e enviá-lo inline — funciona em teoria mas bate em uma restrição dura na prática: **a ferramenta shell do Claude Code tem um limite de contexto de ~256 KB de saída stdout**. Codificação base64 expande tamanho de arquivo por ~33%, o que significa o teto seguro real para base64 inline é cerca de 185 KB. Maioria das imagens, arquivos de audio, e documentos são maiores que isso.

Isso torna base64 impraticável para a maioria dos casos de uso de processamento de arquivo do mundo real. A solução que adicionamos foi um endpoint `/upload` dedicado na camada MCP — fora do próprio protocolo MCP. O usuário (ou Agente) faz POST do arquivo lá diretamente, recebe uma URL, e passa aquela URL para a ferramenta em vez de embutir o arquivo inline. O Worker então busca o arquivo lado-servidor de R2, burlando a restrição de tamanho de contexto completamente.

**Por que Cloudflare R2 para armazenamento de arquivo?**

R2 é o armazenamento de objeto compatível com S3 da Cloudflare, e é a escolha certa aqui por uma razão específica: **zero taxas de egress**. AWS S3 e a maioria de outros serviços de armazenamento de objeto cobram por transferência de dados — toda vez que uma saída de ferramenta é lida (o que acontece em toda chamada de ferramenta encadeada), você paga. R2 não cobra nada por egress. Para um servidor MCP que move arquivos entre ferramentas frequentemente, isso importa.

O tier gratuito de R2 também é generoso o suficiente que um servidor MCP com tráfego baixo-a-moderado consegue rodar completamente dentro dele:

| Recurso | Tier gratuito |
|---------|---------------|
| Armazenamento | 10 GB/mês |
| Operações Class A (escritas, exclusões) | 1 milhão/mês |
| Operações Class B (leituras) | 10 milhões/mês |
| Egress (transferência de dados out) | Gratuito, sempre |

Saídas de ferramenta são armazenadas com uma TTL de 1 hora e excluídas automaticamente — então uso de armazenamento fica baixo mesmo sob uso ativo. Um arquivo processado e descartado dentro de uma hora nunca conta pro total de armazenamento mensal de qualquer forma significativa.

Ferramentas MCP que aceitam arquivos precisam trata três cenários de entrada distintos:

| Cenário | Método |
|---------|--------|
| Arquivos pequenos (< ~185 KB) | data URI base64: `data:image/png;base64,...` |
| Arquivos grandes ou arquivos de shell | POST para endpoint `/upload`, passe a URL de volta |
| Saída de uma ferramenta prévia | Passe a URL de saída diretamente — Worker busca de R2 |

A restrição não-óbvia: a ferramenta shell do Claude Code tem um limite de contexto de ~256 KB em stdout. Codificação base64 expande tamanho de arquivo por ~33%, então o teto prático para base64 inline é cerca de 185 KB, não 4 MB. Suas descrições de ferramenta devem declarar esse limite explicitamente e apontar usuários para o endpoint de upload quando importa.

**O bug de nova linha base64.** Ferramentas de shell como `openssl base64` e o CLI `base64` inserem uma nova linha a cada 76 caracteres. Passar aquela string diretamente como data URI causa erros `INVALID_BASE64` no servidor. Coloque este aviso na sua descrição de ferramenta:

> "Strip all whitespace and newlines from the base64 string before prepending the data URI prefix. Example: `base64 file.png | tr -d '\n'`"

---

## Design de Ferramenta Que Funciona Com LLMs

### Passo 0: Conecte Claude ao Seu Servidor MCP

Antes de qualquer ferramenta ser usada, Claude precisa estar conectado ao servidor MCP. Isto parece óbvio, mas vale a pena esclarecer: Claude não descobre ou conecta automaticamente a servidores MCP. Você configura a conexão explicitamente, e até que faça isso, Claude não tem conhecimento que o servidor existe.

**Claude Desktop** — adicione à `claude_desktop_config.json` (encontre via Settings → Developer):

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

**Claude Code CLI** — adicione via terminal:

```bash
claude mcp add spritesheet-forge --transport http https://mcp.clawstudiouo.com/mcp
```

Se o servidor não está configurado, Claude não dirá "Não consigo achar aquela ferramenta." Ele apenas agirá como se a ferramenta não existisse — pesquisando a web por alternativas, alucinando ferramentas similares que não tem realmente, ou produzindo uma resposta genérica que completamente erra o que você pediu. O modo de falha é silencioso e confuso.

### Como Usuários Encontram Seu Servidor MCP

Colocar Claude conectado é passo um. Colocar usuários sabendo que o servidor existe em primeiro lugar é um problema separado. Existem vários canais, cada um alcançando uma audiência diferente:

**Fonte e documentação**
- [Repositório GitHub](https://github.com/LAXY9887/Game-Dev.-Spritesheet-Forge) — a fonte principal de verdade. Desenvolvedores olham aqui primeiro. Um README claro com a URL de endpoint e snippet de config é o mínimo.
- [Página de tutorial dedicada](https://sprite-forge-mcp.tutorial.clawstudiouo.com) — uma página standalone que caminha através de instalação, autenticação, e exemplos de prompts. Útil para não-desenvolvedores que não querem ler um README.

**Registros oficiais**
- [Registro MCP Anthropic](https://registry.modelcontextprotocol.io/?q=io.github.LAXY9887%2Fspritesheet-forge) — o índice oficial da Anthropic de servidores MCP. Aqui é onde aplicações cliente MCP consultam para mostrar listas de servidor curadas dentro do app.

**Marketplaces e diretórios**
- [Smithery.ai](https://smithery.ai/servers/lxya98874322688423/spritesheet-forge) — integrado diretamente ao navegador MCP do Claude Code. Usuários conseguem encontrar e instalar servidores sem sair do CLI.
- [MCP Marketplace](https://mcp-marketplace.io/server/game-dev-spritesheet-forge) — um marketplace dedicado com um modelo de revenue-sharing para tiers pagos.
- GitHub Marketplace — acessível ao ecossistema de desenvolvedores do GitHub.

Os canais se reforçam mutuamente. Um usuário que encontra o servidor em Smithery frequentemente checará o repo GitHub em seguida. A página de tutorial converte descoberta em instalação real. Cobrindo todos eles custa pouco para manter e alcança audiências que não se sobrepõem.

### Escrevendo Descrições de Ferramenta Que Realmente Funcionam

Descrições de ferramenta não são documentação para humanos — são instruções que LLMs usam para decidir *quando* e *como* chamar sua ferramenta. Uma descrição mal-escrita resulta no modelo chamando a ferramenta errada, passando os parâmetros errados, ou produzindo erros que são difíceis de debugar.

O que uma boa descrição de ferramenta inclui:

- **Formato de entrada**: URL? data URI? Quais tipos MIME são aceitos?
- **Saída**: o que a ferramenta retorna? Uma URL? Uma struct JSON? Qual a TTL?
- **Restrições**: limites de tamanho de arquivo, interações de parâmetro, gotchas conhecidas
- **Exemplos**: para regras de entrada complexas, dê um exemplo inline ou um comando de shell

**Design para encadeamento.** Faça toda saída de ferramenta URL diretamente usável como entrada de outra ferramenta. Isto permite que agentes componham workflows de múltiplas etapas naturalmente:

```
gif_to_spritesheet → split_spritesheet → frames_to_animation
```

**Adicione uma ferramenta `server_info`.** Forneça uma ferramenta sem argumentos que retorna configuração de runtime: URL de endpoint de upload, TTL de arquivo de saída, limites de tamanho de arquivo, e a regra para escolher entre base64 e upload. Isto previne aquela informação de ficar obsoleta através de descrições de ferramenta individuais e dá agentes um jeito confiável de consultá-la antes de começar workflows complexos.

---

## Referência Rápida de Erros

| Sintoma | Causa Raiz | Correção |
|---------|-----------|----------|
| Plataforma mostra "0 ferramentas encontradas" | `tools/list` requer auth | Adicione `initialize`, `notifications/initialized`, `tools/list` à whitelist de handshake |
| Smithery Quality Score é 0 | Faltando `outputSchema` / `annotations` | Adicione ambos os campos a todas as ferramentas |
| Erro de decodificação `INVALID_BASE64` | Ferramentas de shell inserem novas linhas em base64 | Avise na descrição de ferramenta; use `tr -d '\n'` |
| Agente diz "Não tenho aquela ferramenta" e começa pesquisa web | Servidor MCP não configurado no cliente | Adicione config de servidor a `claude_desktop_config.json`, ou rode `claude mcp add` |
| Página de autorização OAuth nunca abre | `/.well-known/oauth-authorization-server` não é acessível publicamente | Assegure o endpoint é alcançável sem auth |
| Endpoint de upload retorna `401` | Bearer token faltando ou expirado | Usuário re-autentica; rode `get-token.py` se necessário |
| URL de saída de ferramenta retorna 404 ou falha | TTL de objeto R2 expirou (60 minutos) | Re-rode a ferramenta originadora para obter uma URL fresca |
| Cloud Run retorna `403` em todas as requisições | Header `X-MCP-Key` faltando ou errado | Verifique o secret nas variáveis de ambiente do Worker |
| Cliente MCP baseado em navegador não consegue conectar | Headers CORS faltando em `/mcp` | Adicione manipulador `OPTIONS` preflight + `Access-Control-Allow-Origin: *` a todas as respostas |

---

## Referência de Definição de Ferramentas MCP (Para Agentes de IA)

A estrutura JSON completa que define uma ferramenta MCP. Agentes de IA e clientes MCP lêem essas definições para entender quais ferramentas estão disponíveis, quais parâmetros aceitam e o que cada parâmetro significa.

```json
{
  "name": "your_tool_name",
  "description": "One sentence describing what this tool does and what it returns. AI agents use this to decide when to call the tool.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "file": {
        "type": "string",
        "description": "Input file — base64 data URI (small files) or HTTPS URL (large files or pre-uploaded)"
      },
      "option_flag": {
        "type": "boolean",
        "default": false,
        "description": "What enabling this flag does. Always include a default."
      },
      "choice_param": {
        "type": "string",
        "default": "default_value",
        "enum": ["option_a", "option_b", "option_c"],
        "description": "Which output mode to use. List the trade-offs in the description."
      },
      "numeric_param": {
        "type": "integer",
        "default": 0,
        "description": "What this number controls. Include the valid range (e.g. 0–255)."
      }
    },
    "required": ["file"]
  }
}
```

**Regras para definições de ferramentas que funcionam bem com LLMs:**

- `description` na própria ferramenta: uma frase, orientada à ação, diz o que produz — não como funciona internamente
- `description` em cada propriedade: inclua o intervalo válido para parâmetros numéricos, liste todas as opções de enum com trade-offs, diga o que o padrão faz
- `required`: liste apenas os parâmetros que a ferramenta não consegue inferir ou definir por padrão. Todo parâmetro opcional precisa de um `default`
- Evite descrições vagas como "o arquivo de entrada" — diga quais formatos são aceitos e como fornecê-los

---

## Perguntas Frequentes

**O que é um servidor MCP remoto?**

Um servidor MCP remoto é um serviço hospedado em nuvem que implementa o Model Context Protocol, permitindo assistentes de IA como Claude invocar ferramentas sobre a internet através de linguagem natural. Diferentemente de servidores MCP locais — que rodam na máquina do usuário e são apenas acessíveis daquela máquina — um servidor remoto é acessível a qualquer cliente MCP autenticado em qualquer lugar, sem instalação local.

**Como eu adiciono um servidor MCP a Claude Desktop ou Claude Code?**

Para Claude Desktop, adicione a configuração do servidor a `claude_desktop_config.json` (encontre sob Settings → Developer). Para Claude Code, rode `claude mcp add <nome> --transport http <url>` no terminal. Até que a conexão seja explicitamente configurada, Claude não tem consciência que o servidor existe e não consegue usar nenhuma de suas ferramentas.

**É gratuito rodar um servidor MCP remoto em Cloudflare e GCP?**

Sim, para tráfego baixo-a-moderado. Cloudflare Workers inclui 100.000 requisições por dia no tier gratuito. Cloudflare R2 oferece 10 GB armazenamento, 1 milhão escritas, e 10 milhões leituras por mês sem custo — com zero taxas de egress. GCP Cloud Run fornece 2 milhões requisições e 360.000 GB-segundos de computação por mês gratuitamente. Uma ferramenta de desenvolvedor tratando chamadas esporádicas de ferramenta consegue rodar completamente dentro desses limites.

**Por que usar OAuth em vez de chaves API para autenticação MCP?**

OAuth 2.1 fornece uma experiência melhor para o usuário. Com chaves API, usuários devem manualmente copiar e colar um token em um arquivo de config — um processo multi-passo com nenhuma recuperação self-service se a chave for perdida. Com OAuth, Claude Desktop e Claude Code tratam o fluxo nativamente: abrem um navegador, o usuário clica "Autorizar", e o token é armazenado automaticamente. O usuário nunca toca um arquivo de config.

**Por que Claude não consegue encontrar minha ferramenta MCP?**

A causa mais comum é que o servidor MCP não foi configurado no cliente. Claude não descobre servidores automaticamente. Se o servidor está configurado mas ferramentas ainda não aparecem, verifique que `tools/list` é acessível sem autenticação — se requer um Bearer token, Claude não consegue recuperar a lista de ferramentas durante o handshake inicial e se comportará como se o servidor não tivesse ferramentas.

**Como eu passo arquivos grandes para uma ferramenta MCP?**

Para arquivos maiores que ~185 KB, use o endpoint `/upload` do servidor em vez de codificação base64. Faça POST do arquivo diretamente (multipart/form-data), receba uma URL na resposta, e passe aquela URL como parâmetro de arquivo da ferramenta. O servidor busca o arquivo lado-servidor, burlando o limite de ~256 KB de saída shell do Claude Code que torna base64 inline impraticável para maioria dos arquivos do mundo real.

**O que é o header X-MCP-Key?**

O X-MCP-Key é um secret compartilhado usado para autenticar requisições entre o Cloudflare Worker (o gateway público) e o backend GCP Cloud Run. Assegura que todo tráfego alcança Cloud Run apenas através do Worker — não diretamente da internet. Sem ele, qualquer pessoa que descubra a URL do Cloud Run conseguiria burlá-la completamente, contornando verificação OAuth e enforcement de quota.

**Preciso fazer meu código de backend público para rodar um servidor MCP?**

Não. Apenas o wrapper MCP (o Cloudflare Worker) precisa ser um repositório público — ele define sua superfície de API e deixa a comunidade inspecionar a integração. O backend do Cloud Run, onde a lógica de negócio real vive, consegue permanecer privado. Isto permite que você publique uma integração MCP aberta enquanto mantém algoritmos proprietários e detalhes de implementação em um repositório privado.
