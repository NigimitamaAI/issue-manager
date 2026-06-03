# web-lite

Static or generated HTML preview environment.

Use this when a project only needs to serve files from the project directory. It does not require a project-specific Dockerfile.

## Required variables

```powershell
$env:COMPOSE_PROJECT_NAME = "<project-id>-web-lite"
$env:IM_PROJECT_ID = "<project-id>"
$env:IM_HOST = "<project-id>.localhost"
$env:IM_PROJECT_DIR = "G:\codex\<project>"
```

Optional:

```powershell
$env:IM_INTERNAL_PORT = "8000"
```

## Start

```powershell
Set-Location -LiteralPath '<shared.dockerRoot>\web-lite'
docker compose up -d
```

Open:

```text
http://<project-id>.localhost:8280/
```
