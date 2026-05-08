---
title: "Despliega una API en Contenedor con GCP Cloud Run"
description: "Guía paso a paso para desplegar una API de Python en GCP usando Artifact Registry y Cloud Run — desde la configuración de Docker hasta un pipeline de lanzamiento reproducible con un solo comando, con cada parámetro de configuración explicado."
date: "2026-05-08"
readingTime: 19
tag: "tutorial"
---

Ha construido algo que funciona en su máquina — un script que convierte imágenes, una función que realiza un cálculo, un pequeño programa que hace algo útil. En algún momento querrá llevarlo más allá de su laptop: publicarlo en su sitio web para que los visitantes lo usen, enviar un enlace a un amigo o colega, o empaquetarlo en algo por lo que pueda cobrar. En el momento en que quiera que otros puedan llamar a su código desde cualquier lugar — un navegador, una aplicación móvil, otro servidor — necesita exponerlo como una API.

Una API (Application Programming Interface) convierte su código en un servicio con una URL estable. En lugar de compartir un script y pedirle a la gente que configure su propio entorno para ejecutarlo, usted lo ejecuta una vez y ellos lo usan. Eso es lo que esta guía construye.

Al final de este tutorial tendrá una API en contenedor ejecutándose en GCP, accesible a través de una URL pública HTTPS y desplegable con un solo comando. La lógica de la API es suya — esta guía cubre todo lo demás: configuración de Docker, Artifact Registry, configuración de Cloud Run, variables de entorno, acceso público y verificación post-despliegue.

Los ejemplos usan Python (FastAPI + uvicorn), pero los pasos del lado de GCP aplican a cualquier lenguaje o framework que pueda ejecutarse en un contenedor.

---

## Cómo Encaja Todo

Antes de tocar cualquier herramienta, aquí tiene el panorama completo de lo que está construyendo:

```
Máquina Local                         GCP
──────────────────────────────────────────────────────────
                                      ┌───────────────────┐
1. Escribir Dockerfile                │  Artifact         │
2. docker build ──────── docker push ▶│  Registry         │
3. docker run   (prueba local)        │  (almacén imágs.) │
                                      └─────────┬─────────┘
                                                │ pull image
                                                ▼
                                      ┌───────────────────┐
                                      │   Cloud Run       │
                                      │   (runtime        │
                                      │    gestionado)    │
                                      └─────────┬─────────┘
                                                │
                                                ▼
                                      https://your-service-xxxx.run.app
                                      (endpoint público HTTPS de la API)
```

**Artifact Registry** almacena sus imágenes Docker — un registro de imágenes privado dentro de su proyecto GCP. **Cloud Run** es el runtime de contenedores gestionado que descarga su imagen, la ejecuta, maneja la terminación HTTPS y el escalado automáticamente, y la expone en una URL estable.

Todo lo demás — Cloud Build, Cloud Storage, GKE — es opcional. La configuración mínima viable son estos dos servicios.

---

## Configuración de su Proyecto GCP

Antes de cualquier otra cosa, necesita un proyecto GCP. Un proyecto es el contenedor de todos sus recursos GCP — la facturación, las APIs, los permisos IAM y los servicios están todos dentro del alcance de un proyecto.

### Instalar y autenticar el gcloud CLI

Instale el [Google Cloud CLI](https://cloud.google.com/sdk/docs/install), luego autentíquese:

```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
```

Autentique Docker para usar Artifact Registry (una vez por máquina):

```bash
gcloud auth configure-docker us-central1-docker.pkg.dev
```

Esto escribe un helper de credenciales en `~/.docker/config.json`. Solo necesita ejecutarlo una vez — persiste entre sesiones de terminal.

### Crear un proyecto

Vaya a la [Google Cloud Console](https://console.cloud.google.com), haga clic en el selector de proyectos en la parte superior, luego en **Nuevo Proyecto**. Asígnele un nombre y anote el ID del Proyecto — lo usará en cada comando CLI a continuación.

O mediante el CLI:

```bash
gcloud projects create YOUR_PROJECT_ID --name="My API Project"
gcloud config set project YOUR_PROJECT_ID
```

### Habilitar la facturación

Cloud Run y Artifact Registry requieren que una cuenta de facturación esté vinculada al proyecto antes de poder usarlos — incluso si su uso se mantiene dentro del nivel gratuito. GCP usa la cuenta de facturación para identificar quién es responsable de los costos, no para cobrarle de inmediato.

En la Consola: **Facturación** → **Vincular una cuenta de facturación** → seleccione o cree una cuenta de facturación.

### Habilitar las APIs requeridas

Los servicios de GCP están deshabilitados por defecto. Habilite los dos servicios que usa este tutorial:

```bash
gcloud services enable artifactregistry.googleapis.com run.googleapis.com
```

Esto tarda unos 30 segundos y solo necesita hacerse una vez por proyecto.

### Permisos IAM

Si usted es el propietario del proyecto — la cuenta que lo creó — ya tiene permisos completos y puede omitir esta sección.

Si está desplegando desde un pipeline CI/CD o quiere seguir el principio de mínimo privilegio, cree una cuenta de servicio dedicada con solo los roles que necesita:

| Rol | Qué permite |
|------|---------------|
| `roles/artifactregistry.writer` | Subir imágenes a Artifact Registry |
| `roles/run.developer` | Desplegar y gestionar servicios de Cloud Run |

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

Para uso personal desde su propia máquina, su cuenta de usuario con permisos de propietario es suficiente — no se necesita cuenta de servicio.

---

## Requisitos Previos: Configuración de Docker

### ¿Qué es Docker y por qué lo usamos?

Docker es una plataforma de contenedores. Un **contenedor** empaqueta el código de su aplicación junto con su runtime, dependencias y configuración en una unidad única y portátil que se ejecuta de la misma manera en todas partes.

Sin contenedores, desplegar su código en un servidor remoto implica asegurarse de que el servidor tenga la versión exacta de Python, los paquetes exactos listados en su `requirements.txt`, las mismas variables de entorno y la misma estructura de directorios que su laptop. Esto es frágil — las diferencias sutiles entre los entornos local y de producción causan errores difíciles de reproducir y aún más difíciles de diagnosticar.

Un contenedor elimina esta clase de problemas. Usted define el entorno una vez en un **Dockerfile**, lo construye en una **imagen**, y esa imagen se ejecuta de manera idéntica en su laptop, en GCP o en cualquier máquina que tenga Docker.

**Dos términos que verá a lo largo de esta guía:**

- **Imagen** — un plano de solo lectura que describe el sistema de archivos y el comando de inicio. Inmutable una vez construida. Piense en ella como una instantánea.
- **Contenedor** — una instancia en ejecución de una imagen. Cuando Cloud Run recibe una solicitud, inicia un contenedor desde su imagen para procesarla. Cuando la solicitud termina, el contenedor puede mantenerse activo para la siguiente solicitud o apagarse.

Usted construye la imagen localmente, la sube a Artifact Registry (su almacenamiento de imágenes en GCP), y Cloud Run la descarga y ejecuta desde allí.

### Instalar Docker Desktop

Descargue e instale Docker Desktop desde [docker.com](https://www.docker.com/products/docker-desktop/). Tras la instalación, inicie Docker Desktop y espere a que el ícono de la ballena en la barra de menús deje de animarse — eso significa que el daemon está en ejecución.

Verifique la instalación:

```bash
docker --version
# Docker version 27.x.x, build ...

docker info
# Debe imprimir información del sistema sin errores
# Si ve "Cannot connect to the Docker daemon" — Docker Desktop no está en ejecución
```

---

## Los Dos Servicios que Necesita

GCP tiene un catálogo extenso. Para este tutorial, necesita exactamente dos servicios.

**Artifact Registry** almacena sus imágenes Docker. Piense en él como un Docker Hub privado que vive dentro de su proyecto GCP. Cloud Run descarga las imágenes desde aquí en el momento del despliegue.

**Cloud Run** es el runtime de contenedores gestionado. Maneja la terminación HTTPS, el escalado automático, los health checks y los rollbacks de despliegue. Usted proporciona una imagen y un conjunto de parámetros; ejecuta su contenedor y lo expone en una URL estable.

---

## Nivel Gratuito y Límites de Uso

Ambos servicios tienen niveles gratuitos permanentes — no son solo créditos de prueba.

| Servicio | Nivel gratuito | Más allá del nivel gratuito |
|---------|-----------|-----------------|
| Artifact Registry | 0.5 GB de almacenamiento/mes | $0.10/GB/mes |
| Cloud Run | 2M solicitudes/mes | $0.40 por millón de solicitudes |
| Cloud Run | 360,000 GB-segundos de memoria/mes | $0.00000250/GB-segundo |
| Cloud Run | 180,000 vCPU-segundos/mes | $0.00001000/vCPU-segundo |
| Cloud Run | 1 GB de salida de red (América del Norte)/mes | $0.12/GB |

Para una API de tráfico bajo a medio (decenas de miles de solicitudes por mes), probablemente se mantendrá dentro del nivel gratuito de Cloud Run. Los costos de Artifact Registry dependen de cuántas versiones de imágenes conserve — consulte la sección de política de limpieza a continuación.

---

## Configuración Única: Artifact Registry

Antes de cualquier despliegue, necesita un repositorio dentro de Artifact Registry para almacenar sus imágenes. Ejecute esto una vez por proyecto:

```bash
gcloud artifacts repositories create my-service \
  --repository-format=docker \
  --location=us-central1 \
  --project=YOUR_PROJECT_ID \
  --description="Container images for my-service"
```

Después de esto, el nombre de su imagen sigue este patrón:

```
us-central1-docker.pkg.dev/YOUR_PROJECT_ID/my-service/my-service:latest
```

### Política de limpieza

Artifact Registry cobra por almacenamiento. Sin una política de limpieza, las capas antiguas de imágenes se acumulan silenciosamente. Aplique una política que conserve las tres versiones más recientes y elimine todo lo que tenga más de 30 días:

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

El flag `--no-dry-run` es obligatorio — sin él la política se evalúa pero no se aplica.

---

## Definición de los Endpoints de su API

Cloud Run ejecuta su contenedor — no tiene conocimiento de lo que hace su aplicación. Su aplicación define las rutas, y Cloud Run las expone a través de la URL del servicio.

Una vez desplegado, cada endpoint que defina es accesible en:

```
https://{su-url-de-servicio}/{ruta-del-endpoint}
```

Por ejemplo, si la URL de su servicio Cloud Run es `https://my-service-abc123-uc.a.run.app` y define una ruta `/convert`, es accesible en `https://my-service-abc123-uc.a.run.app/convert`.

### Por qué importa el endpoint de health check

Un endpoint de health check es una ruta dedicada — típicamente `/health` — que devuelve una respuesta `200 OK` de inmediato, sin efectos secundarios. Cloud Run lo usa para confirmar que el contenedor arrancó correctamente. Las herramientas de monitoreo lo usan para detectar interrupciones. Su script de verificación post-despliegue lo usa como primera llamada después de cada despliegue.

Sin una ruta `/health`, la única forma de confirmar que el servicio está activo después de un despliegue es llamar a uno de sus endpoints reales y esperar que se comporte — un sustituto frágil.

### Un ejemplo mínimo con Flask

Aquí hay una aplicación Flask mínima con un health check y un endpoint funcional:

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

Tras el despliegue, ambas rutas son accesibles a través de la URL del servicio:

| Ruta | URL completa |
|-------|----------|
| `/health` | `https://your-service-url/health` |
| `/process` | `https://your-service-url/process` |

### Flask vs FastAPI en el Dockerfile

El framework que elija afecta la línea `CMD` en su Dockerfile. Flask usa **gunicorn** (un servidor WSGI de producción); FastAPI usa **uvicorn**:

```dockerfile
# Flask + gunicorn
CMD ["gunicorn", "--bind", "0.0.0.0:8080", "--workers", "1", "app.main:app"]

# FastAPI + uvicorn
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
```

Todo lo demás en el Dockerfile — la imagen base, el puerto, el directorio de trabajo — es igual independientemente del framework.

---

## El Dockerfile

Cloud Run ejecuta cualquier contenedor que escuche en el puerto `8080` y salga limpiamente al recibir `SIGTERM`. Un Dockerfile mínimo listo para producción para una API de Python:

```dockerfile
FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ ./app/

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
```

Tres cosas que vale la pena destacar:

- **`python:3.12-slim`** omite compiladores, herramientas de prueba y documentación de la imagen base. Una imagen más pequeña significa descargas más rápidas en el momento del despliegue y menores costos de almacenamiento en Artifact Registry.
- **`--no-cache-dir`** impide que pip escriba su caché de descargas en la capa de la imagen. La caché nunca se reutiliza dentro de un contenedor en ejecución, por lo que es un desperdicio puro.
- **El puerto `8080` es obligatorio.** Cloud Run enruta todo el tráfico a este puerto. El host debe ser `0.0.0.0` — no `localhost` ni `127.0.0.1` — o los health checks de Cloud Run fallarán silenciosamente.

---

## Pruebas Locales Antes de Subir

Siempre verifique que el contenedor funciona localmente antes de subirlo a GCP. Una imagen defectuosa subida a Artifact Registry desperdicia tiempo y almacenamiento.

Construya la imagen:

```bash
docker build --platform linux/amd64 -t my-service:local .
```

El flag `--platform linux/amd64` es fundamental si está en un Mac con Apple Silicon. Sin él, Docker construye una imagen `arm64`. El hardware subyacente de Cloud Run es `amd64` — rechazará silenciosamente la arquitectura incorrecta. El flag fuerza una construcción multiplataforma.

Ejecute el contenedor localmente:

```bash
docker run --rm -p 8080:8080 \
  -e API_KEY=your-dev-key \
  my-service:local
```

El flag `-p 8080:8080` mapea el puerto 8080 dentro del contenedor al puerto 8080 de su máquina. El flag `-e` pasa variables de entorno.

Pruébelo:

```bash
curl http://localhost:8080/health
# Esperado: {"status": "ok"}
```

Si el health check pasa, el contenedor arranca correctamente y el servidor está escuchando. Deténgalo con `Ctrl+C` antes de continuar.

---

## El Pipeline de Lanzamiento

La secuencia construcción → subida → despliegue se ejecuta en cada lanzamiento. Dividida en tres scripts componibles para que cada paso pueda probarse de forma independiente:

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

**`scripts/release.sh`** — encadena los tres:

```bash
#!/usr/bin/env bash
set -euo pipefail
bash scripts/build.sh && bash scripts/push.sh && bash scripts/deploy.sh
```

Después de esto, `bash scripts/release.sh` es el único comando necesario para lanzar una nueva versión.

---

## Configuración de Cloud Run: Cada Parámetro Explicado

| Parámetro | Valor | Razonamiento |
|-----------|-------|-----------|
| `--memory` | `512Mi` | La mayoría de las APIs de procesamiento de imágenes y cómputo caben en 512 MiB. Las métricas de Cloud Run mostrarán si necesita más. |
| `--cpu` | `1` | Un vCPU por instancia. La CPU solo se asigna mientras se procesa una solicitud — sin facturación en inactividad. |
| `--concurrency` | `1` | Cada instancia maneja una solicitud a la vez. Correcto para trabajo con uso intensivo de CPU donde las solicitudes paralelas competirían por la CPU y degradarían ambas. Para servicios con uso intensivo de I/O, auméntelo a 10–80. |
| `--max-instances` | `100` | Limita las instancias concurrentes. Previene el escalado descontrolado por un pico de tráfico o un ataque. Configúrelo según el costo máximo aceptable en el peor caso, no según el tráfico esperado. |
| `--timeout` | `60` | Tiempo de espera de la solicitud en segundos. Cloud Run termina la solicitud y devuelve 504 si el procesamiento supera este valor. Configúrelo según su operación más lenta esperada con margen. |
| `--allow-unauthenticated` | — | Hace la URL de acceso público. Consulte la siguiente sección sobre la advertencia de IAM. |

**Qué significa `--concurrency 1` en la práctica.** Con la concurrencia configurada en 1, cada solicitud activa obtiene su propia instancia. Si dos solicitudes llegan simultáneamente, Cloud Run inicia una segunda instancia en lugar de poner en cola la segunda solicitud. Para trabajo con uso intensivo de CPU — procesamiento de imágenes, conversión de archivos, inferencia de modelos — este es el modelo correcto. Escala horizontalmente por conteo de instancias en lugar de profundidad de cola de solicitudes.

**El dimensionamiento de memoria importa desde el inicio.** Cloud Run matará su contenedor por OOM si supera el límite de memoria configurado. Estime su uso máximo de memoria antes de desplegar: si su API carga un modelo de 200 MB en memoria, `512Mi` no es suficiente — comience con `1Gi`. Redimensione después de observar las métricas de memoria de Cloud Run.

---

## Escala a Cero: La Compensación del Cold Start

El comportamiento predeterminado de Cloud Run — y su principal ventaja en costos — es **escala a cero**: cuando no hay solicitudes activas, todas las instancias se apagan y usted no paga nada.

La compensación es la **latencia del cold start**: cuando llega una solicitud después de un período de inactividad, Cloud Run debe iniciar un nuevo contenedor antes de poder responder. Para una API de Python con dependencias típicas, esto tarda 2–5 segundos.

| Configuración | Comportamiento | Costo |
|---------|----------|------|
| `--min-instances 0` (predeterminado) | Escala a cero; cold starts después de períodos de inactividad | Cero cuando está inactivo |
| `--min-instances 1` | Una instancia siempre en ejecución; sin cold starts | ~$10–15/mes para 512Mi/1 vCPU |

Use `--min-instances 0` cuando el tráfico sea impredecible o intermitente, los cold starts sean aceptables para los usuarios, o quiera costos cercanos a cero durante el desarrollo temprano.

Use `--min-instances 1` cuando el servicio sea orientado al usuario y un retraso de 2–5 segundos en la primera solicitud sea visiblemente inaceptable, o cuando tenga un SLA de latencia.

---

## Variables de Entorno y Secretos

Cloud Run pasa variables de entorno al contenedor al inicio mediante `--set-env-vars`:

```bash
gcloud run deploy my-service \
  --set-env-vars "API_KEY=abc123,DB_URL=postgres://..."
```

Para un servicio que usa un archivo `.env` local durante el desarrollo, el script de despliegue puede leer ese archivo y construir automáticamente la cadena `--set-env-vars`:

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

Esto mantiene los secretos fuera del repositorio mientras hace los despliegues reproducibles.

**Nota:** Si un valor contiene una coma, `--set-env-vars` lo dividirá silenciosamente en dos variables. Envuelva el valor entre comillas, o migre ese secreto a [Google Secret Manager](https://cloud.google.com/secret-manager) con `--set-secrets`. *(Una guía completa de Secret Manager estará disponible próximamente.)*

---

## Acceso Público y Autenticación

### La advertencia de la política org de IAM

`--allow-unauthenticated` en el script de despliegue no siempre es suficiente. Muchas organizaciones de GCP tienen una política org (`constraints/iam.allowedPolicyMemberTypes`) que bloquea que se otorguen roles de IAM a `allUsers` — incluido el rol de Cloud Run Invoker.

Si su despliegue tiene éxito pero obtiene un `403 Forbidden` al llamar a la URL, esta es la razón.

**Corrección mediante Cloud Console:**

1. Vaya a **Cloud Run** → seleccione su servicio
2. Haga clic en la pestaña **Seguridad**
3. En "Autenticación", seleccione **Permitir invocaciones no autenticadas**
4. Haga clic en **Guardar**

Esto establece la política IAM directamente en el recurso del servicio en lugar de pasar por el comando de despliegue, y normalmente evita las restricciones a nivel de org en la ruta del CLI.

### Manejo de la autenticación en su API

La mayoría de las APIs — incluso las internas — necesitan control de acceso basado en claves. El patrón común para un servicio público de Cloud Run con un gateway de terceros (como RapidAPI):

```
Llamante ──▶ Gateway ──▶ Cloud Run
             inyecta       valida
             X-RapidAPI-Proxy-Secret
```

| Encabezado | Quién lo envía | Qué demuestra |
|--------|-------------|----------------|
| `X-RapidAPI-Key` | Llamante de la API | Suscripción válida |
| `X-RapidAPI-Proxy-Secret` | Gateway (inyectado) | La solicitud pasó por el gateway |
| `X-Internal-Key` | Usted (ops/pruebas) | Acceso directo, sin pasar por el gateway |

Su servicio valida `X-RapidAPI-Proxy-Secret` para confirmar que la solicitud pasó por el gateway. El `X-Internal-Key` es un secreto separado para acceso directo durante pruebas y health checks.

**No use `X-RapidAPI-Proxy-Secret` como credencial del llamante.** Lo inyecta el gateway, no lo usan los llamantes. Tratarlo como una clave del llamante es un error común que o bien falla la autenticación o filtra un secreto del backend en el código del cliente.

---

## Verificación Post-Despliegue

Cada despliegue debe verificarse antes de considerarse completado.

**Paso 1: health check** — confirma que el contenedor arrancó y el servidor está escuchando:

```bash
curl https://your-service-url/health
# Esperado: {"status": "ok"}
```

**Paso 2: prueba de humo funcional** — confirma que el servicio procesa una solicitud de extremo a extremo:

```bash
SECRET=$(grep INTERNAL_KEY .env | cut -d'=' -f2- | tr -d '"')

curl -X POST https://your-service-url/your-endpoint \
  -H "X-Internal-Key: $SECRET" \
  -F "file=@tests/sample.gif" \
  --output /tmp/smoke_output.png

file /tmp/smoke_output.png
```

Leer el secreto directamente desde `.env` (en lugar de desde el entorno del shell) asegura que la prueba funcione en una sesión de terminal nueva.

---

## Referencia Rápida: Errores Comunes

| Síntoma | Causa probable | Solución |
|---------|-------------|-----|
| `exec format error` en Cloud Run | Imagen construida para arquitectura de CPU incorrecta | Agregue `--platform linux/amd64` a `docker build` |
| El health check falla inmediatamente después del despliegue | El contenedor escucha en el host o puerto incorrecto | Use `--host 0.0.0.0 --port 8080` en CMD |
| `docker push` devuelve `unauthorized` | Docker no autenticado en Artifact Registry | Ejecute `gcloud auth configure-docker us-central1-docker.pkg.dev` |
| 403 después de desplegar con `--allow-unauthenticated` | Política org de IAM bloqueando `allUsers` | Configure el acceso público mediante Cloud Console (pestaña Seguridad) |
| El despliegue tiene éxito pero persiste el comportamiento anterior | Cloud Run almacenó en caché el digest de la imagen antigua | Force re-deploy: `gcloud run deploy ... --image ...:latest` |
| La latencia del cold start es inaceptable | Escala a cero con un contenedor grande | Configure `--min-instances 1` o reduzca el tamaño de la imagen |
| `--set-env-vars` descarta silenciosamente un valor | El valor contiene una coma | Envuelva entre comillas o migre a Secret Manager |
| El contenedor muere durante una solicitud | Límite de memoria superado (OOM) | Aumente `--memory` (intente `1Gi` o `2Gi`) |

---

## Qué Sigue

Esta guía cubre los fundamentos. Los próximos pasos naturales:

- *([Automatización de Despliegues con CI/CD en GCP](/blog/gcp-cicd-cloud-run) — próximamente)* — activar `release.sh` automáticamente en cada git push a main
- *([Gestión de Secretos con Google Secret Manager](/blog/gcp-secret-manager) — próximamente)* — registro de auditoría, rotación y acceso IAM detallado para secretos de producción
- *([Trabajos de Larga Duración con Cloud Run Jobs](/blog/gcp-cloud-run-jobs) — próximamente)* — para operaciones que tardan más de 60 segundos, Cloud Run Jobs es la herramienta correcta

---

## Preguntas Frecuentes

**¿Por qué mi navegador muestra un error CORS cuando consulto la API?**

Hay dos causas distintas que se ven idénticas en el navegador. Primero, su API puede no tener los encabezados CORS configurados — el servidor debe responder con encabezados `Access-Control-Allow-Origin` para solicitudes de origen cruzado. Segundo, y más comúnmente, la API no está ejecutándose en absoluto: cuando una llamada `fetch()` no logra alcanzar el servidor (error de red, tiempo de espera del cold start, URL incorrecta), el navegador lo reporta como un error CORS en lugar de un error de conexión. Revise la pestaña Red en DevTools primero — si la solicitud nunca recibe respuesta, el problema es de conectividad, no de encabezados CORS.

**¿Cómo sé si es un problema de CORS o si la API está caída?**

Llame al endpoint directamente con `curl` desde su terminal. Si `curl` devuelve una respuesta válida, el servicio está activo y el problema son los encabezados CORS. Si `curl` también falla (conexión rechazada, tiempo de espera, 404), el servicio no es accesible — corrija el despliegue primero, luego resuelva CORS.

**¿Cuánta memoria debo asignar?**

Estime su huella máxima en memoria: sume la sobrecarga base de Python/framework (~50–100 MB), cualquier modelo o dato que cargue al inicio, y el tamaño máximo de un único payload de solicitud. Agregue un 30% de margen y redondee al siguiente nivel de Cloud Run (256Mi, 512Mi, 1Gi, 2Gi, 4Gi, 8Gi). Comience conservadoramente y observe las métricas de utilización de memoria de Cloud Run en los primeros días — es fácil aumentarlo, y una muerte por OOM es inmediatamente visible en los logs.

**Agregué `--allow-unauthenticated` pero sigo obteniendo 403. ¿Por qué?**

Su organización de GCP probablemente tiene una política org de IAM que restringe otorgar roles a `allUsers` mediante el CLI. El flag `--allow-unauthenticated` intenta otorgar el rol de Cloud Run Invoker a `allUsers` en el momento del despliegue, lo cual la política org bloquea. Corríjalo yendo a Cloud Run en la Consola → su servicio → pestaña Seguridad → establezca la Autenticación en "Permitir invocaciones no autenticadas" y guarde. Esta ruta normalmente evita la restricción de política a nivel del CLI.

**Mi operación de API tarda más de 5 minutos. ¿Puedo seguir usando Cloud Run?**

El tiempo de espera máximo de solicitud de Cloud Run es 60 minutos (configurado mediante `--timeout`), pero para operaciones de más de 5–10 minutos, un enfoque directo de API se vuelve frágil — los clientes agotan el tiempo de espera, las conexiones se caen y los reintentos causan trabajo duplicado. Para cómputo de larga duración, use **Cloud Run Jobs** en su lugar: envíe el trabajo, devuelva un ID de trabajo de inmediato y deje que el cliente consulte por el resultado. Una guía de Cloud Run Jobs estará disponible próximamente.

**¿Qué ocurre cuando se agota mi nivel gratuito?**

Cloud Run y Artifact Registry cambian automáticamente a facturación por uso — no hay interrupción del servicio ni notificación. La facturación de Cloud Run es por solicitud y por segundo de recurso, por lo que un servicio con tráfico cero no cuesta nada incluso después de agotar el nivel gratuito. Configure alertas de presupuesto en la consola de Facturación de GCP para recibir notificaciones antes de que los costos se vuelvan significativos.

**¿Puedo usar un puerto diferente al 8080?**

Puede configurar Cloud Run para usar un puerto diferente con el flag `--port` en `gcloud run deploy`. Sin embargo, `8080` es el predeterminado y ampliamente esperado — cámbielo solo si tiene una razón específica. Cualquier puerto que configure en Cloud Run debe coincidir con el puerto en el que realmente escucha su contenedor.

**¿Cómo revierto un despliegue defectuoso?**

Cloud Run mantiene un historial de revisiones. En la Consola, vaya a su servicio → pestaña Revisiones → seleccione cualquier revisión anterior → haga clic en "Administrar Tráfico" y envíe el 100% del tráfico a ella. Los rollbacks tienen efecto en segundos y no requieren reconstrucción.
