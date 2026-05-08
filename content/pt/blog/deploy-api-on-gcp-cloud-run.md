---
title: "Implante uma API em Contêiner no GCP Cloud Run"
description: "Guia passo a passo para implantar uma API Python no GCP usando Artifact Registry e Cloud Run — desde a configuração do Docker até um pipeline de lançamento repetível com um único comando, com cada parâmetro de configuração explicado."
date: "2026-05-08"
readingTime: 19
tag: "tutorial"
---

Você criou algo que funciona na sua máquina — um script que converte imagens, uma função que executa um cálculo, um pequeno programa que faz algo útil. Em algum momento você quer ir além do seu laptop: publicar no seu site para que visitantes possam usá-lo, enviar um link para um amigo ou colega, ou empacotar em algo pelo qual possa cobrar. No momento em que você quer que outros possam chamar seu código de qualquer lugar — um navegador, um aplicativo móvel, outro servidor — você precisa expô-lo como uma API.

Uma API (Application Programming Interface) transforma seu código em um serviço com uma URL estável. Em vez de compartilhar um script e pedir às pessoas que configurem seu próprio ambiente para executá-lo, você o executa uma vez e elas o utilizam. É isso que este guia constrói.

Ao final deste tutorial você terá uma API em contêiner rodando no GCP, acessível via uma URL HTTPS pública, e implantável com um único comando. A lógica da API é por sua conta — este guia cobre todo o resto: configuração do Docker, Artifact Registry, configuração do Cloud Run, variáveis de ambiente, acesso público e verificação pós-implantação.

Os exemplos usam Python (FastAPI + uvicorn), mas as etapas do lado do GCP se aplicam a qualquer linguagem ou framework que possa rodar em um contêiner.

---

## Como Tudo se Encaixa

Antes de tocar em qualquer ferramenta, aqui está a visão completa do que você está construindo:

```
Máquina Local                         GCP
──────────────────────────────────────────────────────────
                                      ┌───────────────────┐
1. Escrever Dockerfile                │  Artifact         │
2. docker build ──────── docker push ▶│  Registry         │
3. docker run   (teste local)         │  (armazenamento   │
                                      │   de imagens)     │
                                      └─────────┬─────────┘
                                                │ pull image
                                                ▼
                                      ┌───────────────────┐
                                      │   Cloud Run       │
                                      │   (runtime        │
                                      │    gerenciado)    │
                                      └─────────┬─────────┘
                                                │
                                                ▼
                                      https://your-service-xxxx.run.app
                                      (endpoint público de API HTTPS)
```

O **Artifact Registry** armazena suas imagens Docker — um registro de imagens privado dentro do seu projeto GCP. O **Cloud Run** é o runtime de contêiner gerenciado que puxa sua imagem, a executa, trata o encerramento HTTPS e o escalonamento automaticamente, e a expõe em uma URL estável.

Todo o resto — Cloud Build, Cloud Storage, GKE — é opcional. A configuração mínima viável são esses dois serviços.

---

## Configurando seu Projeto GCP

Antes de qualquer coisa, você precisa de um projeto GCP. Um projeto é o contêiner para todos os seus recursos GCP — faturamento, APIs, permissões IAM e serviços estão todos vinculados a um projeto.

### Instalar e autenticar o gcloud CLI

Instale o [Google Cloud CLI](https://cloud.google.com/sdk/docs/install), depois autentique:

```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
```

Autentique o Docker para usar o Artifact Registry (uma vez por máquina):

```bash
gcloud auth configure-docker us-central1-docker.pkg.dev
```

Isso escreve um auxiliar de credenciais em `~/.docker/config.json`. Você só precisa executar isso uma vez — ele persiste entre as sessões do terminal.

### Criar um projeto

Acesse o [Google Cloud Console](https://console.cloud.google.com), clique no seletor de projetos no topo, depois em **Novo Projeto**. Dê um nome a ele e anote o ID do Projeto — você o usará em cada comando CLI abaixo.

Ou via CLI:

```bash
gcloud projects create YOUR_PROJECT_ID --name="My API Project"
gcloud config set project YOUR_PROJECT_ID
```

### Habilitar o faturamento

O Cloud Run e o Artifact Registry exigem que uma conta de faturamento esteja vinculada ao projeto antes de você poder usá-los — mesmo que seu uso fique dentro do nível gratuito. O GCP usa a conta de faturamento para identificar quem é responsável pelos custos, não para cobrar imediatamente.

No Console: **Faturamento** → **Vincular uma conta de faturamento** → selecione ou crie uma conta de faturamento.

### Habilitar as APIs necessárias

Os serviços GCP são desabilitados por padrão. Habilite os dois serviços que este tutorial usa:

```bash
gcloud services enable artifactregistry.googleapis.com run.googleapis.com
```

Isso leva cerca de 30 segundos e só precisa ser feito uma vez por projeto.

### Permissões IAM

Se você é o proprietário do projeto — a conta que criou o projeto — você já tem permissões completas e pode pular esta seção.

Se você está implantando a partir de um pipeline CI/CD ou quer seguir o princípio do menor privilégio, crie uma conta de serviço dedicada com apenas as funções de que precisa:

| Função | O que permite |
|------|---------------|
| `roles/artifactregistry.writer` | Enviar imagens para o Artifact Registry |
| `roles/run.developer` | Implantar e gerenciar serviços Cloud Run |

```bash
gcloud iam service-accounts create api-deployer \
  --display-name="API Deployer"

gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:api-deployer@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/artifactregistry.writer"

gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:api-deployer@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/run.developer"
```

Para uso pessoal a partir da sua própria máquina, sua conta de usuário com permissões de proprietário é suficiente — nenhuma conta de serviço é necessária.

---

## Pré-requisitos: Configuração do Docker

### O que é Docker e por que o usamos?

Docker é uma plataforma de contêinerização. Um **contêiner** empacota o código da sua aplicação junto com seu runtime, dependências e configuração em uma única unidade portátil que roda da mesma forma em qualquer lugar.

Sem contêinerização, implantar seu código em um servidor remoto significa garantir que o servidor tenha exatamente a versão correta do Python, exatamente os pacotes listados no seu `requirements.txt`, as mesmas variáveis de ambiente e o mesmo layout de diretório que o seu laptop. Isso é frágil — diferenças sutis entre ambientes locais e de produção causam bugs difíceis de reproduzir e ainda mais difíceis de diagnosticar.

Um contêiner elimina essa classe de problemas. Você define o ambiente uma vez em um **Dockerfile**, constrói em uma **imagem**, e essa imagem roda de forma idêntica no seu laptop, no GCP ou em qualquer máquina que tenha Docker.

**Dois termos que você verá ao longo deste guia:**

- **Imagem** — um blueprint somente leitura que descreve o sistema de arquivos e o comando de inicialização. Imutável após construída. Pense nela como um snapshot.
- **Contêiner** — uma instância em execução de uma imagem. Quando o Cloud Run recebe uma requisição, ele inicia um contêiner a partir da sua imagem para processá-la. Quando a requisição termina, o contêiner pode ser mantido aquecido para a próxima requisição ou encerrado.

Você constrói a imagem localmente, envia para o Artifact Registry (seu armazenamento de imagens no GCP), e o Cloud Run a puxa e executa a partir daí.

### Instalar o Docker Desktop

Baixe e instale o Docker Desktop em [docker.com](https://www.docker.com/products/docker-desktop/). Após a instalação, inicie o Docker Desktop e aguarde o ícone da baleia na barra de menus parar de animar — isso significa que o daemon está em execução.

Verifique a instalação:

```bash
docker --version
# Docker version 27.x.x, build ...

docker info
# Deve imprimir informações do sistema sem erros
# Se você ver "Cannot connect to the Docker daemon" — o Docker Desktop não está em execução
```

---

## Os Dois Serviços que Você Precisa

O GCP tem um catálogo extenso. Para este tutorial, você precisa exatamente de dois serviços.

O **Artifact Registry** armazena suas imagens Docker. Pense nele como um Docker Hub privado que vive dentro do seu projeto GCP. O Cloud Run puxa imagens daqui no momento da implantação.

O **Cloud Run** é o runtime de contêiner gerenciado. Ele trata o encerramento HTTPS, escalonamento automático, verificações de integridade e rollbacks de implantação. Você fornece uma imagem e um conjunto de parâmetros; ele executa seu contêiner e o expõe em uma URL estável.

---

## Nível Gratuito e Limites de Uso

Ambos os serviços têm níveis gratuitos permanentes — não apenas créditos de teste.

| Serviço | Nível gratuito | Além do nível gratuito |
|---------|-----------|-----------------|
| Artifact Registry | 0,5 GB de armazenamento/mês | $0,10/GB/mês |
| Cloud Run | 2M requisições/mês | $0,40 por milhão de requisições |
| Cloud Run | 360.000 GB-segundos de memória/mês | $0,00000250/GB-segundo |
| Cloud Run | 180.000 vCPU-segundos/mês | $0,00001000/vCPU-segundo |
| Cloud Run | 1 GB de saída de rede (América do Norte)/mês | $0,12/GB |

Para uma API de tráfego baixo a médio (dezenas de milhares de requisições por mês), você provavelmente ficará dentro do nível gratuito do Cloud Run. Os custos do Artifact Registry dependem de quantas versões de imagem você mantém — veja a seção de política de limpeza abaixo.

---

## Configuração Única: Artifact Registry

Antes de qualquer implantação, você precisa de um repositório dentro do Artifact Registry para armazenar suas imagens. Execute isso uma vez por projeto:

```bash
gcloud artifacts repositories create my-service \
  --repository-format=docker \
  --location=us-central1 \
  --project=YOUR_PROJECT_ID \
  --description="Container images for my-service"
```

Após isso, o nome da sua imagem segue este padrão:

```
us-central1-docker.pkg.dev/YOUR_PROJECT_ID/my-service/my-service:latest
```

### Política de limpeza

O Artifact Registry cobra pelo armazenamento. Sem uma política de limpeza, camadas antigas de imagens se acumulam silenciosamente. Aplique uma política que mantém as três versões mais recentes e exclui tudo com mais de 30 dias:

```bash
gcloud artifacts repositories set-cleanup-policies my-service \
  --location=us-central1 \
  --project=YOUR_PROJECT_ID \
  --policy=cleanup-policy.json \
  --no-dry-run
```

`cleanup-policy.json`:

```json
[
  {
    "name": "keep-latest-3",
    "action": {"type": "Keep"},
    "mostRecentVersions": {"keepCount": 3}
  },
  {
    "name": "delete-old",
    "action": {"type": "Delete"},
    "condition": {"olderThan": "30d"}
  }
]
```

A flag `--no-dry-run` é obrigatória — sem ela a política é avaliada mas não aplicada.

---

## Definindo os Endpoints da sua API

O Cloud Run executa seu contêiner — ele não tem conhecimento do que sua aplicação faz. Sua aplicação define as rotas, e o Cloud Run as expõe através da URL do serviço.

Uma vez implantado, todo endpoint que você definir é acessível em:

```
https://{sua-url-de-servico}/{caminho-do-endpoint}
```

Por exemplo, se a URL do seu serviço Cloud Run é `https://my-service-abc123-uc.a.run.app` e você define uma rota `/convert`, ela é acessível em `https://my-service-abc123-uc.a.run.app/convert`.

### Por que o endpoint de verificação de integridade é importante

Um endpoint de verificação de integridade é uma rota dedicada — tipicamente `/health` — que retorna uma resposta `200 OK` imediatamente, sem efeitos colaterais. O Cloud Run o usa para confirmar que o contêiner iniciou corretamente. Ferramentas de monitoramento o usam para detectar interrupções. Seu script de verificação pós-implantação o usa como a primeira coisa que chama após cada implantação.

Sem uma rota `/health`, a única forma de confirmar que o serviço está ativo após uma implantação é chamar um dos seus endpoints reais e torcer para que ele funcione — um substituto frágil.

### Um exemplo mínimo com Flask

Aqui está uma aplicação Flask mínima com verificação de integridade e um endpoint funcional:

```python
# app/main.py
from flask import Flask, jsonify, request

app = Flask(__name__)

@app.route("/health")
def health():
    return jsonify({"status": "ok"})

@app.route("/process", methods=["POST"])
def process():
    data = request.get_json()
    result = {"output": f"processed: {data.get('input', '')}"}
    return jsonify(result)
```

`requirements.txt`:

```
flask
gunicorn
```

Após a implantação, ambas as rotas são acessíveis através da URL do serviço:

| Rota | URL completa |
|-------|----------|
| `/health` | `https://your-service-url/health` |
| `/process` | `https://your-service-url/process` |

### Flask vs FastAPI no Dockerfile

O framework que você escolhe afeta a linha `CMD` no seu Dockerfile. Flask usa **gunicorn** (um servidor WSGI de produção); FastAPI usa **uvicorn**:

```dockerfile
# Flask + gunicorn
CMD ["gunicorn", "--bind", "0.0.0.0:8080", "--workers", "1", "app.main:app"]

# FastAPI + uvicorn
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
```

Todo o resto no Dockerfile — a imagem base, porta, diretório de trabalho — é o mesmo independentemente do framework.

---

## O Dockerfile

O Cloud Run executa qualquer contêiner que escuta na porta `8080` e sai de forma limpa em `SIGTERM`. Um Dockerfile mínimo pronto para produção para uma API Python:

```dockerfile
FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ ./app/

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
```

Três coisas que valem a pena notar:

- **`python:3.12-slim`** omite compiladores, ferramentas de teste e documentação da imagem base. Uma imagem menor significa pulls mais rápidos no momento da implantação e custos menores de armazenamento no Artifact Registry.
- **`--no-cache-dir`** impede que o pip grave seu cache de download na camada da imagem. O cache nunca é reutilizado dentro de um contêiner em execução, então é desperdício puro.
- **A porta `8080` é obrigatória.** O Cloud Run roteia todo o tráfego para esta porta. O host deve ser `0.0.0.0` — não `localhost` ou `127.0.0.1` — ou as verificações de integridade do Cloud Run falharão silenciosamente.

---

## Teste Local Antes de Enviar

Sempre verifique se o contêiner funciona localmente antes de enviar para o GCP. Uma imagem quebrada enviada ao Artifact Registry desperdiça tempo e armazenamento.

Construa a imagem:

```bash
docker build --platform linux/amd64 -t my-service:local .
```

A flag `--platform linux/amd64` é crítica se você estiver em um Mac com Apple Silicon. Sem ela, o Docker constrói uma imagem `arm64`. O hardware subjacente do Cloud Run é `amd64` — ele rejeitará silenciosamente a arquitetura errada. A flag força uma compilação multiplataforma.

Execute o contêiner localmente:

```bash
docker run --rm -p 8080:8080 \
  -e API_KEY=your-dev-key \
  my-service:local
```

A flag `-p 8080:8080` mapeia a porta 8080 dentro do contêiner para a porta 8080 na sua máquina. A flag `-e` passa variáveis de ambiente.

Teste:

```bash
curl http://localhost:8080/health
# Esperado: {"status": "ok"}
```

Se a verificação de integridade passar, o contêiner iniciou corretamente e o servidor está escutando. Pare com `Ctrl+C` antes de prosseguir.

---

## O Pipeline de Lançamento

A sequência construir → enviar → implantar é executada em cada lançamento. Dividida em três scripts combináveis para que cada etapa possa ser testada independentemente:

**`scripts/build.sh`**

```bash
#!/usr/bin/env bash
set -euo pipefail

IMAGE="us-central1-docker.pkg.dev/YOUR_PROJECT_ID/my-service/my-service:latest"

docker build --platform linux/amd64 -t "$IMAGE" .
```

**`scripts/push.sh`**

```bash
#!/usr/bin/env bash
set -euo pipefail

IMAGE="us-central1-docker.pkg.dev/YOUR_PROJECT_ID/my-service/my-service:latest"

gcloud auth configure-docker us-central1-docker.pkg.dev --quiet
docker push "$IMAGE"
```

**`scripts/deploy.sh`**

```bash
#!/usr/bin/env bash
set -euo pipefail

gcloud run deploy my-service \
  --image "us-central1-docker.pkg.dev/YOUR_PROJECT_ID/my-service/my-service:latest" \
  --platform managed \
  --region us-central1 \
  --memory 512Mi \
  --cpu 1 \
  --concurrency 1 \
  --max-instances 100 \
  --timeout 60 \
  --allow-unauthenticated \
  --project=YOUR_PROJECT_ID
```

**`scripts/release.sh`** — encadeia os três:

```bash
#!/usr/bin/env bash
set -euo pipefail
bash scripts/build.sh && bash scripts/push.sh && bash scripts/deploy.sh
```

Após isso, `bash scripts/release.sh` é o único comando necessário para lançar uma nova versão.

---

## Configuração do Cloud Run: Cada Parâmetro Explicado

| Parâmetro | Valor | Raciocínio |
|-----------|-------|-----------|
| `--memory` | `512Mi` | A maioria das APIs de processamento de imagem e computação se encaixa em 512 MiB. As métricas do Cloud Run mostrarão se você precisar de mais. |
| `--cpu` | `1` | Um vCPU por instância. A CPU é alocada apenas enquanto uma requisição está sendo processada — sem cobrança por ociosidade. |
| `--concurrency` | `1` | Cada instância trata uma requisição por vez. Correto para trabalho com uso intensivo de CPU, onde requisições paralelas competiriam pela CPU e degradariam ambas. Para serviços com uso intensivo de I/O, aumente para 10–80. |
| `--max-instances` | `100` | Limita as instâncias concorrentes. Evita escalonamento descontrolado por pico de tráfego ou ataque. Defina com base no custo máximo aceitável, não no tráfego esperado. |
| `--timeout` | `60` | Tempo limite da requisição em segundos. O Cloud Run encerra a requisição e retorna 504 se o processamento exceder este valor. Dimensione para sua operação mais lenta esperada com margem de segurança. |
| `--allow-unauthenticated` | — | Torna a URL publicamente acessível. Veja a próxima seção para a ressalva do IAM. |

**O que `--concurrency 1` significa na prática.** Com a concorrência definida como 1, cada requisição ativa recebe sua própria instância. Se duas requisições chegarem simultaneamente, o Cloud Run inicia uma segunda instância em vez de enfileirar a segunda requisição. Para trabalho com uso intensivo de CPU — processamento de imagens, conversão de arquivos, inferência de modelos — este é o modelo correto. Ele escala horizontalmente pela contagem de instâncias em vez da profundidade da fila de requisições.

**O dimensionamento de memória importa desde o início.** O Cloud Run vai encerrar seu contêiner com OOM se ele exceder o limite de memória configurado. Estime seu pico de uso de memória antes de implantar: se sua API carrega um modelo de 200 MB na memória, `512Mi` não é suficiente — comece em `1Gi`. Redimensione após observar as métricas de memória do Cloud Run.

---

## Escalonamento para Zero: O Trade-off do Cold Start

O comportamento padrão do Cloud Run — e sua principal vantagem de custo — é o **escalonamento para zero**: quando não há requisições ativas, todas as instâncias são encerradas e você não paga nada.

O trade-off é a **latência do cold start**: quando uma requisição chega após um período de inatividade, o Cloud Run deve iniciar um novo contêiner antes de poder responder. Para uma API Python com dependências típicas, isso leva de 2 a 5 segundos.

| Configuração | Comportamento | Custo |
|---------|----------|------|
| `--min-instances 0` (padrão) | Escala para zero; cold starts após períodos de ociosidade | Zero quando ocioso |
| `--min-instances 1` | Uma instância sempre em execução; sem cold starts | ~$10–15/mês para 512Mi/1 vCPU |

Use `--min-instances 0` quando o tráfego for imprevisível ou irregular, cold starts forem aceitáveis para os usuários, ou quando quiser custos quase zero durante o desenvolvimento inicial.

Use `--min-instances 1` quando o serviço for voltado ao usuário e um atraso de 2 a 5 segundos na primeira requisição for visivelmente inaceitável, ou quando você tiver um SLA de latência.

---

## Variáveis de Ambiente e Segredos

O Cloud Run passa variáveis de ambiente para o contêiner na inicialização via `--set-env-vars`:

```bash
gcloud run deploy my-service \
  --set-env-vars "API_KEY=abc123,DB_URL=postgres://..."
```

Para um serviço que usa um arquivo `.env` local durante o desenvolvimento, o script de implantação pode ler esse arquivo e construir a string `--set-env-vars` automaticamente:

```bash
ENV_VARS=""
while IFS= read -r line || [[ -n "$line" ]]; do
  [[ -z "$line" || "$line" == \#* ]] && continue
  key="${line%%=*}"
  val="${line#*=}"
  val="${val#\"}" val="${val%\"}"
  val="${val#\'}" val="${val%\'}"
  ENV_VARS="${ENV_VARS:+$ENV_VARS,}${key}=${val}"
done < .env

gcloud run deploy my-service --set-env-vars "$ENV_VARS" ...
```

Isso mantém os segredos fora do repositório enquanto torna as implantações repetíveis.

**Nota:** Se um valor contiver uma vírgula, `--set-env-vars` vai dividi-lo silenciosamente em duas variáveis. Envolva o valor entre aspas ou migre esse segredo para o [Google Secret Manager](https://cloud.google.com/secret-manager) com `--set-secrets`. *(Um guia completo do Secret Manager está chegando em breve.)*

---

## Acesso Público e Autenticação

### A ressalva da política de organização IAM

`--allow-unauthenticated` no script de implantação nem sempre é suficiente. Muitas organizações GCP têm uma política de organização (`constraints/iam.allowedPolicyMemberTypes`) que bloqueia a concessão de funções IAM a `allUsers` — incluindo a função Cloud Run Invoker.

Se sua implantação for bem-sucedida, mas você receber `403 Forbidden` ao chamar a URL, é por isso.

**Correção via Cloud Console:**

1. Vá para **Cloud Run** → selecione seu serviço
2. Clique na aba **Segurança**
3. Em "Autenticação", selecione **Permitir invocações não autenticadas**
4. Clique em **Salvar**

Isso define a política IAM diretamente no recurso do serviço em vez de passar pelo comando de implantação, e normalmente contorna as restrições em nível de organização no caminho CLI.

### Tratando autenticação na sua API

A maioria das APIs — mesmo as internas — precisa de controle de acesso baseado em chaves. O padrão comum para um serviço Cloud Run público com um gateway de terceiros (como RapidAPI):

```
Chamador ──▶ Gateway ──▶ Cloud Run
             injeta        valida
             X-RapidAPI-Proxy-Secret
```

| Cabeçalho | Quem envia | O que comprova |
|--------|-------------|----------------|
| `X-RapidAPI-Key` | Chamador da API | Assinatura válida |
| `X-RapidAPI-Proxy-Secret` | Gateway (injetado) | Requisição passou pelo gateway |
| `X-Internal-Key` | Você (operações/testes) | Acesso direto, contornando o gateway |

Seu serviço valida `X-RapidAPI-Proxy-Secret` para confirmar que a requisição passou pelo gateway. O `X-Internal-Key` é um segredo separado para acesso direto durante testes e verificações de integridade.

**Não use `X-RapidAPI-Proxy-Secret` como credencial do chamador.** Ele é injetado pelo gateway, não usado pelos chamadores. Tratá-lo como uma chave de chamador é um erro comum que ou falha na autenticação ou vaza um segredo de backend para o código do lado do cliente.

---

## Verificação Pós-Implantação

Cada implantação deve ser verificada antes de ser considerada concluída.

**Etapa 1: verificação de integridade** — confirma que o contêiner iniciou e o servidor está escutando:

```bash
curl https://your-service-url/health
# Esperado: {"status": "ok"}
```

**Etapa 2: smoke test funcional** — confirma que o serviço processa uma requisição de ponta a ponta:

```bash
SECRET=$(grep INTERNAL_KEY .env | cut -d'=' -f2- | tr -d '"')

curl -X POST https://your-service-url/your-endpoint \
  -H "X-Internal-Key: $SECRET" \
  -F "file=@tests/sample.gif" \
  --output /tmp/smoke_output.png

file /tmp/smoke_output.png
```

Ler o segredo diretamente do `.env` (em vez do ambiente shell) garante que o teste funcione em uma sessão de terminal nova.

---

## Referência Rápida: Erros Comuns

| Sintoma | Causa provável | Correção |
|---------|-------------|-----|
| `exec format error` no Cloud Run | Imagem construída para arquitetura de CPU errada | Adicione `--platform linux/amd64` ao `docker build` |
| Verificação de integridade falha imediatamente após a implantação | Contêiner escutando no host ou porta errados | Use `--host 0.0.0.0 --port 8080` no CMD |
| `docker push` retorna `unauthorized` | Docker não autenticado no Artifact Registry | Execute `gcloud auth configure-docker us-central1-docker.pkg.dev` |
| 403 após implantar com `--allow-unauthenticated` | Política IAM da organização bloqueando `allUsers` | Defina acesso público via Cloud Console (aba Segurança) |
| Implantação bem-sucedida mas comportamento antigo persiste | Cloud Run armazenou em cache o digest antigo da imagem | Force a reimplantação: `gcloud run deploy ... --image ...:latest` |
| Latência do cold start é inaceitável | Escalonamento para zero com contêiner grande | Defina `--min-instances 1` ou reduza o tamanho da imagem |
| `--set-env-vars` descarta silenciosamente um valor | Valor contém uma vírgula | Envolva entre aspas ou migre para o Secret Manager |
| Contêiner encerrado durante a requisição | Limite de memória excedido (OOM) | Aumente `--memory` (tente `1Gi` ou `2Gi`) |

---

## Referência de API (Para Agentes de IA)

Especificação legível por máquina para os endpoints de API de exemplo definidos neste guia. Os caminhos de endpoint e formatos de requisição/resposta reais são determinados pela sua aplicação — substitua os espaços reservados abaixo pelas suas rotas reais.

```json
{
  "baseUrl": "https://YOUR_SERVICE_URL.run.app",
  "authentication": {
    "type": "header",
    "header": "X-Internal-Key",
    "description": "Shared secret for direct access. Set as Cloud Run environment variable INTERNAL_KEY."
  },
  "endpoints": [
    {
      "name": "health_check",
      "method": "GET",
      "path": "/health",
      "description": "Liveness check. Returns 200 OK when the service is running. No authentication required.",
      "response": {
        "200": { "status": "ok" }
      }
    },
    {
      "name": "process",
      "method": "POST",
      "path": "/process",
      "description": "Main processing endpoint. Replace with your actual route and payload shape.",
      "requestBody": {
        "content-type": "application/json",
        "schema": {
          "type": "object",
          "properties": {
            "input": { "type": "string", "description": "Input data for processing" }
          },
          "required": ["input"]
        }
      },
      "response": {
        "200": {
          "output": "string — processing result"
        },
        "504": "Request exceeded --timeout limit. Increase timeout or break operation into smaller steps."
      }
    }
  ],
  "cloudRunConfig": {
    "memory": "512Mi",
    "cpu": 1,
    "concurrency": 1,
    "maxInstances": 100,
    "timeout": 60,
    "region": "us-central1"
  }
}
```

---

## O Que Vem a Seguir

Este guia cobre os fundamentos. Os próximos passos naturais:

- *([Automatizando Implantações com CI/CD no GCP](/blog/gcp-cicd-cloud-run) — em breve)* — acione o `release.sh` automaticamente a cada git push para main
- *([Gerenciando Segredos com o Google Secret Manager](/blog/gcp-secret-manager) — em breve)* — registro de auditoria, rotação e acesso IAM refinado para segredos de produção
- *([Jobs de Longa Duração com Cloud Run Jobs](/blog/gcp-cloud-run-jobs) — em breve)* — para operações que levam mais de 60 segundos, os Cloud Run Jobs são a ferramenta certa

---

## Perguntas Frequentes

**Por que meu navegador mostra um erro de CORS quando faço fetch da API?**

Existem duas causas distintas que parecem idênticas no navegador. Primeiro, sua API pode não ter cabeçalhos CORS configurados — o servidor deve responder com cabeçalhos `Access-Control-Allow-Origin` para requisições de origem cruzada. Segundo, e mais comumente, a API não está em execução: quando uma chamada `fetch()` falha em alcançar o servidor completamente (erro de rede, timeout de cold start, URL errada), o navegador relata como erro de CORS em vez de erro de conexão. Verifique a aba Network no DevTools primeiro — se a requisição nunca receber uma resposta, o problema é conectividade, não cabeçalhos CORS.

**Como saber se é um problema de CORS ou se a API está fora do ar?**

Chame o endpoint diretamente com `curl` no seu terminal. Se `curl` retornar uma resposta válida, o serviço está ativo e o problema são os cabeçalhos CORS. Se `curl` também falhar (conexão recusada, timeout, 404), o serviço não está acessível — corrija a implantação primeiro, depois trate o CORS.

**Quanta memória devo alocar?**

Estime seu pico de footprint em memória: some a sobrecarga base do Python/framework (~50–100 MB), quaisquer modelos ou dados que você carrega na inicialização, e o tamanho máximo de um único payload de requisição. Adicione 30% de margem e arredonde para o próximo nível do Cloud Run (256Mi, 512Mi, 1Gi, 2Gi, 4Gi, 8Gi). Comece conservador e acompanhe as métricas de utilização de memória do Cloud Run nos primeiros dias — é fácil aumentar, e um OOM kill é imediatamente visível nos logs.

**Adicionei `--allow-unauthenticated` mas ainda recebo 403. Por quê?**

Sua organização GCP provavelmente tem uma política de organização IAM que restringe a concessão de funções a `allUsers` via CLI. A flag `--allow-unauthenticated` tenta conceder a função Cloud Run Invoker a `allUsers` no momento da implantação, o que a política de organização bloqueia. Corrija indo para Cloud Run no Console → seu serviço → aba Segurança → defina Autenticação como "Permitir invocações não autenticadas" e salve. Esse caminho normalmente contorna a restrição de política no nível CLI.

**Minha operação de API leva mais de 5 minutos. Ainda posso usar o Cloud Run?**

O tempo limite máximo de requisição do Cloud Run é de 60 minutos (configurado via `--timeout`), mas para operações acima de 5 a 10 minutos, uma abordagem direta de API se torna frágil — clientes expiram, conexões caem e novas tentativas causam trabalho duplicado. Para computação de longa duração, use **Cloud Run Jobs**: submeta o trabalho, retorne um ID de job imediatamente e deixe o cliente consultar o status. Um guia sobre Cloud Run Jobs está chegando em breve.

**O que acontece quando meu nível gratuito se esgota?**

O Cloud Run e o Artifact Registry mudam automaticamente para faturamento pay-as-you-go — não há interrupção de serviço ou notificação. O faturamento do Cloud Run é por requisição e por segundo de recurso, então um serviço com tráfego zero não custa nada mesmo após o esgotamento do nível gratuito. Configure alertas de orçamento no console do GCP Billing para ser notificado antes que os custos se tornem significativos.

**Posso usar uma porta diferente de 8080?**

Você pode configurar o Cloud Run para usar uma porta diferente com a flag `--port` no `gcloud run deploy`. No entanto, `8080` é o padrão e amplamente esperado — mude apenas se tiver uma razão específica. Qualquer porta que você configurar no Cloud Run deve corresponder à porta em que seu contêiner realmente escuta.

**Como faço rollback de uma implantação problemática?**

O Cloud Run mantém um histórico de revisões. No Console, vá para seu serviço → aba Revisões → selecione qualquer revisão anterior → clique em "Gerenciar Tráfego" e envie 100% do tráfego para ela. Os rollbacks têm efeito em segundos e não exigem uma reconstrução.
