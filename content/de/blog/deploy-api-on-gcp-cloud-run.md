---
title: "Eine containerisierte API auf GCP Cloud Run bereitstellen"
description: "Schritt-für-Schritt-Anleitung zur Bereitstellung einer Python-API auf GCP mit Artifact Registry und Cloud Run - von der Docker-Einrichtung bis zu einer wiederholbaren Ein-Befehl-Release-Pipeline, mit Erklärung jedes Konfigurationsparameters."
date: "2026-05-08"
readingTime: 19
tag: "tutorial"
---

Sie haben etwas gebaut, das auf Ihrem Rechner funktioniert - ein Skript, das Bilder konvertiert, eine Funktion, die eine Berechnung durchführt, ein kleines Programm, das etwas Nützliches tut. Irgendwann möchten Sie es über Ihren Laptop hinaus bringen: auf Ihrer Website veröffentlichen, damit Besucher es nutzen können, einen Link an einen Freund oder Kollegen schicken oder es in etwas verpacken, für das Sie Geld verlangen können. In dem Moment, in dem andere Ihren Code von überall aufrufen sollen - aus einem Browser, einer mobilen App oder einem anderen Server - müssen Sie ihn als API bereitstellen.

Eine API (Application Programming Interface) verwandelt Ihren Code in einen Dienst mit einer stabilen URL. Anstatt ein Skript weiterzugeben und die Leute zu bitten, ihre eigene Umgebung einzurichten, um es auszuführen, starten Sie es einmal und sie nutzen es. Das ist es, was diese Anleitung aufbaut.

Am Ende dieses Tutorials werden Sie eine containerisierte API auf GCP haben, die über eine öffentliche HTTPS-URL erreichbar und mit einem einzigen Befehl bereitstellbar ist. Die API-Logik liegt bei Ihnen - diese Anleitung deckt alles andere ab: Docker-Einrichtung, Artifact Registry, Cloud Run-Konfiguration, Umgebungsvariablen, öffentlichen Zugriff und Überprüfung nach der Bereitstellung.

Die Beispiele verwenden Python (FastAPI + uvicorn), aber die GCP-seitigen Schritte gelten für jede Sprache oder jedes Framework, das in einem Container ausgeführt werden kann.

---

## Das Gesamtbild

Bevor Sie mit den Werkzeugen beginnen, hier das vollständige Bild dessen, was Sie aufbauen:

```
Local Machine                         GCP
──────────────────────────────────────────────────────────
                                      ┌───────────────────┐
1. Write Dockerfile                   │  Artifact         │
2. docker build ──────── docker push ▶│  Registry         │
3. docker run   (local test)          │  (image storage)  │
                                      └─────────┬─────────┘
                                                │ pull image
                                                ▼
                                      ┌───────────────────┐
                                      │   Cloud Run       │
                                      │   (managed        │
                                      │    runtime)       │
                                      └─────────┬─────────┘
                                                │
                                                ▼
                                      https://your-service-xxxx.run.app
                                      (public HTTPS API endpoint)
```

**Artifact Registry** speichert Ihre Docker-Images - eine private Image-Registry innerhalb Ihres GCP-Projekts. **Cloud Run** ist die verwaltete Container-Laufzeitumgebung, die Ihr Image abruft, ausführt, HTTPS-Terminierung und Skalierung automatisch übernimmt und es unter einer stabilen URL bereitstellt.

Alles andere - Cloud Build, Cloud Storage, GKE - ist optional. Das minimal funktionsfähige Setup besteht aus diesen zwei Diensten.

---

## Ihr GCP-Projekt einrichten

Bevor Sie beginnen, benötigen Sie ein GCP-Projekt. Ein Projekt ist der Container für alle Ihre GCP-Ressourcen - Abrechnung, APIs, IAM-Berechtigungen und Dienste sind alle einem Projekt zugeordnet.

### Die gcloud CLI installieren und authentifizieren

Installieren Sie die [Google Cloud CLI](https://cloud.google.com/sdk/docs/install) und authentifizieren Sie sich anschließend:

```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
```

Authentifizieren Sie Docker für die Nutzung von Artifact Registry (einmalig pro Rechner):

```bash
gcloud auth configure-docker us-central1-docker.pkg.dev
```

Dieser Befehl schreibt einen Credential-Helper in `~/.docker/config.json`. Sie müssen ihn nur einmal ausführen - er bleibt über Terminal-Sitzungen hinaus bestehen.

### Ein Projekt erstellen

Öffnen Sie die [Google Cloud Console](https://console.cloud.google.com), klicken Sie oben auf den Projektauswähler und dann auf **Neues Projekt**. Geben Sie ihm einen Namen und notieren Sie sich die Projekt-ID - Sie verwenden diese in jedem CLI-Befehl unten.

Oder über die CLI:

```bash
gcloud projects create YOUR_PROJECT_ID --name="My API Project"
gcloud config set project YOUR_PROJECT_ID
```

### Abrechnung aktivieren

Cloud Run und Artifact Registry erfordern ein mit dem Projekt verknüpftes Abrechnungskonto, bevor Sie sie nutzen können - selbst wenn Ihre Nutzung innerhalb des kostenlosen Kontingents bleibt. GCP verwendet das Abrechnungskonto, um festzustellen, wer für die Kosten verantwortlich ist, und belastet Sie nicht sofort.

In der Console: **Abrechnung** → **Abrechnungskonto verknüpfen** → Abrechnungskonto auswählen oder erstellen.

### Die erforderlichen APIs aktivieren

GCP-Dienste sind standardmäßig deaktiviert. Aktivieren Sie die zwei Dienste, die dieses Tutorial verwendet:

```bash
gcloud services enable artifactregistry.googleapis.com run.googleapis.com
```

Dies dauert etwa 30 Sekunden und muss nur einmal pro Projekt durchgeführt werden.

### IAM-Berechtigungen

Wenn Sie der Projektinhaber sind - das Konto, das das Projekt erstellt hat - haben Sie bereits alle Berechtigungen und können diesen Abschnitt überspringen.

Wenn Sie aus einer CI/CD-Pipeline heraus deployen oder dem Prinzip der minimalen Rechte folgen möchten, erstellen Sie ein dediziertes Dienstkonto mit nur den benötigten Rollen:

| Rolle | Was sie erlaubt |
|------|---------------|
| `roles/artifactregistry.writer` | Images in Artifact Registry pushen |
| `roles/run.developer` | Cloud Run-Dienste deployen und verwalten |

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

Für den persönlichen Gebrauch von Ihrem eigenen Rechner aus reicht Ihr Benutzerkonto mit Inhaberberechtigungen aus - kein Dienstkonto erforderlich.

---

## Voraussetzungen: Docker-Einrichtung

### Was ist Docker und warum verwenden wir es?

Docker ist eine Containerisierungsplattform. Ein **Container** verpackt Ihren Anwendungscode zusammen mit seiner Laufzeitumgebung, Abhängigkeiten und Konfiguration in eine einzige, portable Einheit, die überall gleich läuft.

Ohne Containerisierung bedeutet das Deployen Ihres Codes auf einem Remote-Server, sicherzustellen, dass der Server die exakt richtige Python-Version, die exakten Pakete aus Ihrer `requirements.txt`, dieselben Umgebungsvariablen und dasselbe Verzeichnis-Layout wie Ihr Laptop hat. Das ist fragil - subtile Unterschiede zwischen lokalen und Produktionsumgebungen verursachen Fehler, die schwer zu reproduzieren und noch schwerer zu diagnostizieren sind.

Ein Container eliminiert diese Art von Problem. Sie definieren die Umgebung einmal in einem **Dockerfile**, erstellen daraus ein **Image**, und dieses Image läuft identisch auf Ihrem Laptop, auf GCP oder auf jedem Rechner, der Docker hat.

**Zwei Begriffe, die Sie in dieser Anleitung immer wieder sehen werden:**

- **Image** - ein schreibgeschütztes Bauplan, das das Dateisystem und den Startbefehl beschreibt. Unveränderlich nach dem Erstellen. Stellen Sie es sich als Momentaufnahme vor.
- **Container** - eine laufende Instanz eines Images. Wenn Cloud Run eine Anfrage erhält, startet es einen Container aus Ihrem Image, um sie zu verarbeiten. Wenn die Anfrage abgeschlossen ist, kann der Container für die nächste Anfrage warm gehalten oder heruntergefahren werden.

Sie erstellen das Image lokal, pushen es in Artifact Registry (Ihren Image-Speicher auf GCP), und Cloud Run ruft es von dort ab und führt es aus.

### Docker Desktop installieren

Laden Sie Docker Desktop von [docker.com](https://www.docker.com/products/docker-desktop/) herunter und installieren Sie es. Nach der Installation starten Sie Docker Desktop und warten Sie, bis das Wal-Symbol in der Menüleiste aufgehört hat zu animieren - das bedeutet, dass der Daemon läuft.

Überprüfen Sie die Installation:

```bash
docker --version
# Docker version 27.x.x, build ...

docker info
# Should print system info without errors
# If you see "Cannot connect to the Docker daemon" — Docker Desktop is not running
```

---

## Die zwei benötigten Dienste

GCP hat einen umfangreichen Katalog. Für dieses Tutorial benötigen Sie genau zwei Dienste.

**Artifact Registry** speichert Ihre Docker-Images. Stellen Sie es sich als ein privates Docker Hub vor, das in Ihrem GCP-Projekt lebt. Cloud Run zieht beim Deployen Images von hier.

**Cloud Run** ist die verwaltete Container-Laufzeitumgebung. Sie übernimmt HTTPS-Terminierung, automatische Skalierung, Gesundheitsprüfungen und Deployment-Rollbacks. Sie stellen ein Image und eine Reihe von Parametern bereit; es führt Ihren Container aus und macht ihn unter einer stabilen URL zugänglich.

---

## Kostenloses Kontingent und Nutzungslimits

Beide Dienste haben dauerhafte kostenlose Kontingente - nicht nur Testkredite.

| Dienst | Kostenloses Kontingent | Darüber hinaus |
|---------|-----------|-----------------|
| Artifact Registry | 0,5 GB Speicher/Monat | 0,10 $/GB/Monat |
| Cloud Run | 2 Mio. Anfragen/Monat | 0,40 $ pro Million Anfragen |
| Cloud Run | 360.000 GB-Sekunden Arbeitsspeicher/Monat | 0,00000250 $/GB-Sekunde |
| Cloud Run | 180.000 vCPU-Sekunden/Monat | 0,00001000 $/vCPU-Sekunde |
| Cloud Run | 1 GB Netzwerk-Egress (Nordamerika)/Monat | 0,12 $/GB |

Für eine API mit niedrigem bis mittlerem Traffic (Zehntausende Anfragen pro Monat) bleiben Sie für Cloud Run wahrscheinlich innerhalb des kostenlosen Kontingents. Die Kosten für Artifact Registry hängen davon ab, wie viele Image-Versionen Sie behalten - siehe den Abschnitt zur Bereinigungsrichtlinie unten.

---

## Einmalige Einrichtung: Artifact Registry

Vor jedem Deployment benötigen Sie ein Repository innerhalb von Artifact Registry zum Speichern Ihrer Images. Führen Sie dies einmal pro Projekt aus:

```bash
gcloud artifacts repositories create my-service \
  --repository-format=docker \
  --location=us-central1 \
  --project=YOUR_PROJECT_ID \
  --description="Container images for my-service"
```

Danach folgt Ihr Image-Name diesem Muster:

```
us-central1-docker.pkg.dev/YOUR_PROJECT_ID/my-service/my-service:latest
```

### Bereinigungsrichtlinie

Artifact Registry berechnet Speicherkosten. Ohne eine Bereinigungsrichtlinie häufen sich alte Image-Schichten stillschweigend an. Wenden Sie eine Richtlinie an, die die drei neuesten Versionen behält und alles löscht, das älter als 30 Tage ist:

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

Das Flag `--no-dry-run` ist erforderlich - ohne es wird die Richtlinie ausgewertet, aber nicht angewendet.

---

## Ihre API-Endpunkte definieren

Cloud Run führt Ihren Container aus - es hat keine Kenntnis davon, was Ihre Anwendung tut. Ihre Anwendung definiert die Routen, und Cloud Run macht sie über die Dienst-URL zugänglich.

Nach dem Deployment ist jeder von Ihnen definierte Endpunkt erreichbar unter:

```
https://{ihre-dienst-url}/{endpunkt-pfad}
```

Wenn Ihre Cloud Run-Dienst-URL beispielsweise `https://my-service-abc123-uc.a.run.app` lautet und Sie eine `/convert`-Route definieren, ist sie unter `https://my-service-abc123-uc.a.run.app/convert` zugänglich.

### Warum der Gesundheitsprüfungs-Endpunkt wichtig ist

Ein Gesundheitsprüfungs-Endpunkt ist eine dedizierte Route - typischerweise `/health` - die sofort eine `200 OK`-Antwort zurückgibt, ohne Nebeneffekte. Cloud Run verwendet ihn, um zu bestätigen, dass der Container korrekt gestartet wurde. Überwachungstools verwenden ihn, um Ausfälle zu erkennen. Ihr Verifizierungsskript nach dem Deployment verwendet ihn als erstes, was es nach jedem Deployment aufruft.

Ohne eine `/health`-Route besteht die einzige Möglichkeit, nach einem Deployment zu bestätigen, dass der Dienst läuft, darin, einen Ihrer echten Endpunkte aufzurufen und zu hoffen, dass er sich korrekt verhält - ein fragiler Ersatz.

### Ein minimales Flask-Beispiel

Hier ist eine minimale Flask-Anwendung mit einer Gesundheitsprüfung und einem funktionalen Endpunkt:

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

Nach dem Deployment sind beide Routen über die Dienst-URL erreichbar:

| Route | Vollständige URL |
|-------|----------|
| `/health` | `https://ihre-dienst-url/health` |
| `/process` | `https://ihre-dienst-url/process` |

### Flask vs. FastAPI im Dockerfile

Das von Ihnen gewählte Framework beeinflusst die `CMD`-Zeile in Ihrem Dockerfile. Flask verwendet **gunicorn** (einen produktionstauglichen WSGI-Server); FastAPI verwendet **uvicorn**:

```dockerfile
# Flask + gunicorn
CMD ["gunicorn", "--bind", "0.0.0.0:8080", "--workers", "1", "app.main:app"]

# FastAPI + uvicorn
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
```

Alles andere im Dockerfile - das Basis-Image, der Port, das Arbeitsverzeichnis - ist unabhängig vom Framework gleich.

---

## Das Dockerfile

Cloud Run führt jeden Container aus, der auf Port `8080` lauscht und bei `SIGTERM` sauber beendet wird. Ein minimales, produktionsreifes Dockerfile für eine Python-API:

```dockerfile
FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ ./app/

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
```

Drei Dinge sind erwähnenswert:

- **`python:3.12-slim`** lässt Compiler, Test-Tools und Dokumentation aus dem Basis-Image weg. Ein kleineres Image bedeutet schnellere Pulls beim Deployment und niedrigere Artifact Registry-Speicherkosten.
- **`--no-cache-dir`** verhindert, dass pip seinen Download-Cache in die Image-Schicht schreibt. Der Cache wird innerhalb eines laufenden Containers nie wiederverwendet und ist daher reiner Ballast.
- **Port `8080` ist Pflicht.** Cloud Run leitet den gesamten Traffic an diesen Port weiter. Der Host muss `0.0.0.0` sein - nicht `localhost` oder `127.0.0.1` - sonst schlagen die Gesundheitsprüfungen von Cloud Run stillschweigend fehl.

---

## Lokales Testen vor dem Pushen

Überprüfen Sie immer, ob der Container lokal funktioniert, bevor Sie ihn auf GCP pushen. Ein fehlerhaftes Image, das in Artifact Registry gepusht wird, verschwendet Zeit und Speicher.

Image erstellen:

```bash
docker build --platform linux/amd64 -t my-service:local .
```

Das Flag `--platform linux/amd64` ist entscheidend, wenn Sie einen Apple Silicon Mac verwenden. Ohne es erstellt Docker ein `arm64`-Image. Die zugrunde liegende Hardware von Cloud Run ist `amd64` - es lehnt die falsche Architektur stillschweigend ab. Das Flag erzwingt einen plattformübergreifenden Build.

Container lokal ausführen:

```bash
docker run --rm -p 8080:8080 \
  -e API_KEY=your-dev-key \
  my-service:local
```

Das Flag `-p 8080:8080` bildet Port 8080 innerhalb des Containers auf Port 8080 auf Ihrem Rechner ab. Das Flag `-e` übergibt Umgebungsvariablen.

Testen:

```bash
curl http://localhost:8080/health
# Expected: {"status": "ok"}
```

Wenn die Gesundheitsprüfung erfolgreich ist, startet der Container korrekt und der Server lauscht. Stoppen Sie ihn mit `Ctrl+C`, bevor Sie fortfahren.

---

## Die Release-Pipeline

Die Sequenz Build → Push → Deploy läuft bei jedem Release ab. Aufgeteilt in drei kombinierbare Skripte, sodass jeder Schritt unabhängig getestet werden kann:

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

**`scripts/release.sh`** - verkettet alle drei:

```bash
#!/usr/bin/env bash
set -euo pipefail
bash scripts/build.sh && bash scripts/push.sh && bash scripts/deploy.sh
```

Danach ist `bash scripts/release.sh` der einzige Befehl, der zum Ausliefern einer neuen Version benötigt wird.

---

## Cloud Run-Konfiguration: Jeder Parameter erklärt

| Parameter | Wert | Begründung |
|-----------|-------|-----------|
| `--memory` | `512Mi` | Die meisten APIs zur Bildverarbeitung und Berechnung passen in 512 MiB. Die Cloud Run-Metriken zeigen, ob Sie mehr benötigen. |
| `--cpu` | `1` | Ein vCPU pro Instanz. Die CPU wird nur während der Verarbeitung einer Anfrage zugeteilt - keine Leerlaufabrechnung. |
| `--concurrency` | `1` | Jede Instanz bearbeitet eine Anfrage gleichzeitig. Korrekt für CPU-gebundene Arbeit, bei der parallele Anfragen um die CPU konkurrieren und beide verschlechtern würden. Für I/O-gebundene Dienste auf 10-80 erhöhen. |
| `--max-instances` | `100` | Begrenzt gleichzeitige Instanzen. Verhindert unkontrollierte Skalierung bei einem Traffic-Spike oder Angriff. Basierend auf akzeptablen Worst-Case-Kosten festlegen, nicht auf erwartetem Traffic. |
| `--timeout` | `60` | Anfrage-Timeout in Sekunden. Cloud Run beendet die Anfrage und gibt 504 zurück, wenn die Verarbeitung diese Zeit überschreitet. Bemessen Sie ihn an Ihrer langsamsten erwarteten Operation mit etwas Puffer. |
| `--allow-unauthenticated` | — | Macht die URL öffentlich zugänglich. Siehe nächsten Abschnitt für den IAM-Vorbehalt. |

**Was `--concurrency 1` in der Praxis bedeutet.** Mit auf 1 gesetzter Parallelität erhält jede aktive Anfrage ihre eigene Instanz. Wenn zwei Anfragen gleichzeitig eintreffen, startet Cloud Run eine zweite Instanz, anstatt die zweite Anfrage in die Warteschlange zu stellen. Für CPU-gebundene Arbeit - Bildverarbeitung, Dateikonvertierung, Modellinferenz - ist dies das richtige Modell. Es skaliert horizontal nach Instanzanzahl statt nach Warteschlangentiefe.

**Die Arbeitsspeichergröße ist im Voraus wichtig.** Cloud Run beendet Ihren Container mit einem OOM-Kill, wenn er das konfigurierte Arbeitsspeicherlimit überschreitet. Schätzen Sie Ihren maximalen Arbeitsspeicherbedarf vor dem Deployment: Wenn Ihre API ein 200-MB-Modell in den Arbeitsspeicher lädt, reicht `512Mi` nicht aus - starten Sie mit `1Gi`. Passen Sie die Größe an, nachdem Sie die Arbeitsspeicher-Metriken von Cloud Run beobachtet haben.

---

## Skalierung auf null: Der Kaltstart-Kompromiss

Das Standardverhalten von Cloud Run - und sein wichtigster Kostenvorteil - ist **Skalierung auf null**: Wenn keine aktiven Anfragen vorhanden sind, werden alle Instanzen heruntergefahren und Sie zahlen nichts.

Der Kompromiss ist **Kaltstart-Latenz**: Wenn eine Anfrage nach einer Inaktivitätsperiode eintrifft, muss Cloud Run einen neuen Container starten, bevor es antworten kann. Für eine Python-API mit typischen Abhängigkeiten dauert dies 2-5 Sekunden.

| Einstellung | Verhalten | Kosten |
|---------|----------|------|
| `--min-instances 0` (Standard) | Skalierung auf null; Kaltstarts nach Inaktivitätsphasen | Null bei Inaktivität |
| `--min-instances 1` | Eine Instanz läuft immer; keine Kaltstarts | ~10-15 $/Monat für 512Mi/1 vCPU |

Verwenden Sie `--min-instances 0`, wenn der Traffic unvorhersehbar oder stoßartig ist, Kaltstarts für Benutzer akzeptabel sind oder Sie nahezu null Kosten während der frühen Entwicklung wünschen.

Verwenden Sie `--min-instances 1`, wenn der Dienst benutzerorientiert ist und eine Verzögerung von 2-5 Sekunden bei der ersten Anfrage sichtbar inakzeptabel ist, oder wenn Sie ein Latenz-SLA haben.

---

## Umgebungsvariablen und Geheimnisse

Cloud Run übergibt Umgebungsvariablen beim Start über `--set-env-vars` an den Container:

```bash
gcloud run deploy my-service \
  --set-env-vars "API_KEY=abc123,DB_URL=postgres://..."
```

Für einen Dienst, der während der Entwicklung eine lokale `.env`-Datei verwendet, kann das Deploy-Skript diese Datei lesen und den `--set-env-vars`-String automatisch erstellen:

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

Dies hält Geheimnisse aus dem Repository heraus und macht Deployments wiederholbar.

**Hinweis:** Wenn ein Wert ein Komma enthält, teilt `--set-env-vars` ihn stillschweigend in zwei Variablen auf. Schließen Sie den Wert in Anführungszeichen ein oder migrieren Sie dieses Geheimnis zum [Google Secret Manager](https://cloud.google.com/secret-manager) mit `--set-secrets`. *(Eine vollständige Anleitung zum Secret Manager erscheint bald.)*

---

## Öffentlicher Zugriff und Authentifizierung

### Der IAM-Org-Richtlinien-Vorbehalt

`--allow-unauthenticated` im Deploy-Skript reicht nicht immer aus. Viele GCP-Organisationen haben eine Org-Richtlinie (`constraints/iam.allowedPolicyMemberTypes`), die verhindert, dass `allUsers` IAM-Rollen gewährt werden - einschließlich der Cloud Run Invoker-Rolle.

Wenn Ihr Deployment erfolgreich ist, Sie aber beim Aufrufen der URL eine `403 Forbidden`-Meldung erhalten, liegt das daran.

**Korrektur über die Cloud Console:**

1. Gehen Sie zu **Cloud Run** → wählen Sie Ihren Dienst aus
2. Klicken Sie auf die Registerkarte **Sicherheit**
3. Wählen Sie unter "Authentifizierung" **Nicht authentifizierte Aufrufe zulassen**
4. Klicken Sie auf **Speichern**

Dadurch wird die IAM-Richtlinie direkt auf der Dienstressource festgelegt, anstatt den Deploy-Befehl zu durchlaufen, und umgeht typischerweise organisationsweite Einschränkungen auf dem CLI-Pfad.

### Authentifizierung in Ihrer API handhaben

Die meisten APIs - selbst interne - benötigen schlüsselbasierte Zugriffskontrolle. Das übliche Muster für einen öffentlichen Cloud Run-Dienst mit einem Drittanbieter-Gateway (wie RapidAPI):

```
Caller ──▶ Gateway ──▶ Cloud Run
           injects       validates
           X-RapidAPI-Proxy-Secret
```

| Header | Wer sendet ihn | Was er beweist |
|--------|-------------|----------------|
| `X-RapidAPI-Key` | API-Aufrufer | Gültiges Abonnement |
| `X-RapidAPI-Proxy-Secret` | Gateway (eingefügt) | Anfrage kam durch das Gateway |
| `X-Internal-Key` | Sie (Betrieb/Tests) | Direkter Zugriff, am Gateway vorbei |

Ihr Dienst validiert `X-RapidAPI-Proxy-Secret`, um zu bestätigen, dass die Anfrage durch das Gateway gegangen ist. Der `X-Internal-Key` ist ein separates Geheimnis für direkten Zugriff während Tests und Gesundheitsprüfungen.

**Verwenden Sie `X-RapidAPI-Proxy-Secret` nicht als Aufrufer-Anmeldeinformation.** Es wird vom Gateway eingefügt und nicht von Aufrufern verwendet. Es als Aufrufer-Schlüssel zu behandeln ist ein häufiger Fehler, der entweder die Authentifizierung scheitern lässt oder ein Backend-Geheimnis in clientseitigen Code durchsickern lässt.

---

## Verifizierung nach dem Deployment

Jedes Deployment sollte verifiziert werden, bevor es als abgeschlossen gilt.

**Schritt 1: Gesundheitsprüfung** - bestätigt, dass der Container gestartet ist und der Server lauscht:

```bash
curl https://ihre-dienst-url/health
# Expected: {"status": "ok"}
```

**Schritt 2: Funktionaler Smoke-Test** - bestätigt, dass der Dienst eine Anfrage von Anfang bis Ende verarbeitet:

```bash
SECRET=$(grep INTERNAL_KEY .env | cut -d'=' -f2- | tr -d '"')

curl -X POST https://ihre-dienst-url/ihr-endpunkt \
  -H "X-Internal-Key: $SECRET" \
  -F "file=@tests/sample.gif" \
  --output /tmp/smoke_output.png

file /tmp/smoke_output.png
```

Das direkte Lesen des Geheimnisses aus `.env` (statt aus der Shell-Umgebung) stellt sicher, dass der Test in einer frischen Terminal-Sitzung funktioniert.

---

## Kurzreferenz: Häufige Fehler

| Symptom | Wahrscheinliche Ursache | Lösung |
|---------|-------------|-----|
| `exec format error` auf Cloud Run | Image für falsche CPU-Architektur erstellt | `--platform linux/amd64` zu `docker build` hinzufügen |
| Gesundheitsprüfung schlägt sofort nach dem Deployment fehl | Container lauscht auf falschem Host oder Port | `--host 0.0.0.0 --port 8080` in CMD verwenden |
| `docker push` gibt `unauthorized` zurück | Docker nicht bei Artifact Registry authentifiziert | `gcloud auth configure-docker us-central1-docker.pkg.dev` ausführen |
| 403 nach dem Deployment mit `--allow-unauthenticated` | Org-IAM-Richtlinie blockiert `allUsers` | Öffentlichen Zugriff über Cloud Console (Registerkarte Sicherheit) festlegen |
| Deployment erfolgreich, aber altes Verhalten besteht fort | Cloud Run hat alten Image-Digest zwischengespeichert | Neu deployen erzwingen: `gcloud run deploy ... --image ...:latest` |
| Kaltstart-Latenz ist inakzeptabel | Skalierung auf null mit einem großen Container | `--min-instances 1` setzen oder Image-Größe reduzieren |
| `--set-env-vars` lässt einen Wert stillschweigend weg | Wert enthält ein Komma | In Anführungszeichen einschließen oder zu Secret Manager migrieren |
| Container wird während der Anfrage beendet | Arbeitsspeicherlimit überschritten (OOM) | `--memory` erhöhen (versuchen Sie `1Gi` oder `2Gi`) |

---

## API-Referenz (für KI-Agenten)

Maschinenlesbare Spezifikation für die in dieser Anleitung definierten Beispiel-API-Endpunkte. Die tatsächlichen Endpunkt-Pfade und Anfrage-/Antwort-Strukturen werden von Ihrer Anwendung bestimmt — ersetzen Sie die Platzhalter unten durch Ihre echten Routen.

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

## Wie es weitergeht

Diese Anleitung deckt die Grundlagen ab. Die nächsten naheliegenden Schritte:

- *([Deployments mit CI/CD auf GCP automatisieren](/blog/gcp-cicd-cloud-run) - erscheint bald)* - `release.sh` automatisch bei jedem git push auf main auslösen
- *([Geheimnisse mit Google Secret Manager verwalten](/blog/gcp-secret-manager) - erscheint bald)* - Audit-Protokollierung, Rotation und feingranularer IAM-Zugriff für Produktionsgeheimnisse
- *([Langläufige Jobs mit Cloud Run Jobs](/blog/gcp-cloud-run-jobs) - erscheint bald)* - für Operationen, die länger als 60 Sekunden dauern, sind Cloud Run Jobs das richtige Werkzeug

---

## FAQ

**Warum zeigt mein Browser einen CORS-Fehler, wenn ich die API abrufe?**

Es gibt zwei unterschiedliche Ursachen, die im Browser identisch aussehen. Erstens hat Ihre API möglicherweise keine CORS-Header konfiguriert - der Server muss bei Cross-Origin-Anfragen mit `Access-Control-Allow-Origin`-Headern antworten. Zweitens, und häufiger, läuft die API überhaupt nicht: Wenn ein `fetch()`-Aufruf den Server überhaupt nicht erreicht (Netzwerkfehler, Kaltstart-Timeout, falsche URL), meldet der Browser es als CORS-Fehler statt als Verbindungsfehler. Überprüfen Sie zuerst die Registerkarte "Netzwerk" in den DevTools - wenn die Anfrage nie eine Antwort erhält, ist das Problem die Konnektivität, nicht die CORS-Header.

**Wie erkenne ich, ob es ein CORS-Problem ist oder die API nicht läuft?**

Rufen Sie den Endpunkt direkt mit `curl` von Ihrem Terminal aus auf. Wenn `curl` eine gültige Antwort zurückgibt, ist der Dienst aktiv und das Problem sind CORS-Header. Wenn `curl` ebenfalls scheitert (Verbindung abgelehnt, Timeout, 404), ist der Dienst nicht erreichbar - beheben Sie zuerst das Deployment, dann kümmern Sie sich um CORS.

**Wie viel Arbeitsspeicher sollte ich zuweisen?**

Schätzen Sie Ihren maximalen In-Memory-Fußabdruck: Summieren Sie den Basis-Overhead von Python/Framework (~50-100 MB), alle Modelle oder Daten, die Sie beim Start laden, und die maximale Größe eines einzelnen Anfrage-Payloads. Addieren Sie 30% Puffer und runden Sie auf die nächste Cloud Run-Stufe auf (256Mi, 512Mi, 1Gi, 2Gi, 4Gi, 8Gi). Beginnen Sie konservativ und beobachten Sie die Arbeitsspeicher-Auslastungsmetriken von Cloud Run in den ersten Tagen - es ist einfach zu erhöhen, und ein OOM-Kill ist sofort in den Logs sichtbar.

**Ich habe `--allow-unauthenticated` hinzugefügt, aber bekomme trotzdem 403. Warum?**

Ihre GCP-Organisation hat wahrscheinlich eine IAM-Org-Richtlinie, die die Gewährung von Rollen an `allUsers` über die CLI einschränkt. Das Flag `--allow-unauthenticated` versucht, die Cloud Run Invoker-Rolle beim Deployment an `allUsers` zu gewähren, was die Org-Richtlinie blockiert. Beheben Sie es, indem Sie in der Console zu Cloud Run gehen → Ihr Dienst → Registerkarte Sicherheit → Authentifizierung auf "Nicht authentifizierte Aufrufe zulassen" setzen und speichern. Dieser Weg umgeht typischerweise die CLI-Ebenen-Richtlinienbeschränkung.

**Meine API-Operation dauert länger als 5 Minuten. Kann ich trotzdem Cloud Run verwenden?**

Der maximale Anfrage-Timeout von Cloud Run beträgt 60 Minuten (konfiguriert über `--timeout`), aber für Operationen über 5-10 Minuten wird ein direkter API-Ansatz fragil - Clients laufen aus der Zeit, Verbindungen brechen ab und Wiederholungsversuche verursachen doppelte Arbeit. Verwenden Sie für langläufige Berechnungen stattdessen **Cloud Run Jobs**: Reichen Sie die Arbeit ein, geben Sie sofort eine Job-ID zurück und lassen Sie den Client auf den Abschluss warten. Eine Anleitung zu Cloud Run Jobs erscheint bald.

**Was passiert, wenn mein kostenloses Kontingent aufgebraucht ist?**

Cloud Run und Artifact Registry wechseln automatisch zur nutzungsbasierten Abrechnung - es gibt keine Dienstunterbrechung oder Benachrichtigung. Die Cloud Run-Abrechnung erfolgt pro Anfrage und pro Ressourcensekunde, sodass ein Dienst ohne Traffic auch nach Erschöpfung des kostenlosen Kontingents nichts kostet. Richten Sie Budgetwarnungen in der GCP-Abrechnungskonsole ein, um benachrichtigt zu werden, bevor die Kosten erheblich werden.

**Kann ich einen anderen Port als 8080 verwenden?**

Sie können Cloud Run mit dem Flag `--port` bei `gcloud run deploy` für einen anderen Port konfigurieren. Allerdings ist `8080` der Standard und weitgehend erwartet - ändern Sie ihn nur, wenn Sie einen bestimmten Grund haben. Welchen Port auch immer Sie in Cloud Run konfigurieren, er muss mit dem Port übereinstimmen, auf dem Ihr Container tatsächlich lauscht.

**Wie mache ich ein fehlerhaftes Deployment rückgängig?**

Cloud Run führt einen Revisions-Verlauf. Gehen Sie in der Console zu Ihrem Dienst → Registerkarte Revisionen → wählen Sie eine frühere Revision aus → klicken Sie auf "Traffic verwalten" und leiten Sie 100% des Traffics darauf um. Rollbacks treten innerhalb von Sekunden in Kraft und erfordern keinen Neuaufbau.
