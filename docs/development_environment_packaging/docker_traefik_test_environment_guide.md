# Docker Desktop + Traefik test environment first-run guide

This guide is the generic first-run procedure for using project-local Docker Compose files as issue_manager Preview Lane test environments.
It is based on the kikiChronicle verification run on 2026-06-01 and is intended to be reused for other projects.

## Goals

- Keep each project self-contained with its own `docker-compose.yml` and optional `.devcontainer/devcontainer.json`.
- Bind-mount the host project directory into the app container so source edits are reflected immediately.
- Let each project install dependencies on container startup (`npm install`, `pip install -r requirements.txt`, etc.).
- Route browser access through a shared Traefik proxy at `http://<project-name>.localhost`.
- Avoid breaking existing Docker environments, ports, networks, or user containers.

## Safety principles

- Do not remove existing containers, images, volumes, or networks during first-run setup.
- Prefer creating only the missing shared network and shared Traefik container.
- Use fixed commands and argument arrays from issue_manager code; do not build shell command strings from user input.
- Treat `hosts` file edits as an explicit administrator-level operation. If it fails, leave the Docker environment running and report the exact manual command.
- Keep the shared Traefik compose in a stable shared path, for example `G:\codex\_shared\traefik\docker-compose.yml`.
- Do not assume port 80 or 8080 is free. Check before starting Traefik and report conflicts instead of replacing other services.

## Shared Traefik compose

Create `G:\codex\_shared\traefik\docker-compose.yml`:

```yaml
services:
  traefik:
    image: traefik:v3.0
    container_name: traefik
    command:
      - --api.dashboard=true
      - --api.insecure=true
      - --providers.docker=true
      - --providers.docker.exposedbydefault=false
      - --entrypoints.web.address=:80
    ports:
      - "80:80"
      - "8080:8080"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
    networks:
      - traefik
    restart: unless-stopped

networks:
  traefik:
    external: true
    name: traefik
```

Notes:

- `--providers.docker.exposedbydefault=false` prevents unrelated containers from being exposed accidentally.
- `--api.insecure=true` is acceptable only for local Docker Desktop test environments. Do not use it on a network-exposed host.
- The shared Docker socket mount is read-only.

## First-run checklist

1. Confirm Docker Desktop is running.

```powershell
docker ps
```

2. Create the shared network only if it does not already exist.

```powershell
docker network ls --format "{{.Name}}"
docker network create traefik
```

If `traefik` already exists, do not recreate it.

3. Start the shared proxy.

```powershell
docker compose -f G:\codex\_shared\traefik\docker-compose.yml up -d
```

4. Start the project environment from the project root.

```powershell
cd <project-root>
docker compose up -d
```

5. Verify both containers are running and joined to the expected network.

```powershell
docker ps --format "{{.Names}}\t{{.Image}}\t{{.Ports}}\t{{.Networks}}"
```

6. Verify Traefik routing without depending on Windows name resolution.

```powershell
Invoke-WebRequest `
  -Uri "http://127.0.0.1/" `
  -Headers @{ Host = "<project-name>.localhost" } `
  -UseBasicParsing
```

For a project-specific health endpoint, replace `/` with the expected path, for example `/data_out/parse_report.json`.

7. Verify the Traefik dashboard.

```text
http://localhost:8080
```

## Windows hosts entry

Some Windows environments do not resolve arbitrary `*.localhost` names. If `http://<project-name>.localhost` fails with name resolution errors, add an explicit hosts entry.

Run PowerShell as Administrator:

```powershell
Add-Content -Path C:\Windows\System32\drivers\etc\hosts -Value "127.0.0.1 <project-name>.localhost"
```

If automation attempts this and receives `Access is denied`, do not retry destructively. Report the command above to the user.

## Project docker-compose.yml requirements

Each project service should include:

```yaml
services:
  app:
    working_dir: /workspace
    volumes:
      - .:/workspace:cached
    labels:
      - traefik.enable=true
      - traefik.http.routers.<project-id>.rule=Host(`<project-name>.localhost`)
      - traefik.http.routers.<project-id>.entrypoints=web
      - traefik.http.services.<project-id>.loadbalancer.server.port=<container-port>
    networks:
      - default
      - traefik

networks:
  traefik:
    external: true
    name: traefik
```

Use a project-specific router and service id. Keep it lowercase ASCII, for example `kikichronicle`.

## Dependency installation on startup

Use an entrypoint script stored in the project, for example `.devcontainer/docker-entrypoint.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

cd /workspace

if [ -f requirements.txt ]; then
  python -m pip install --requirement requirements.txt
fi

if [ -f package.json ]; then
  if [ -f package-lock.json ]; then
    npm ci
  else
    npm install
  fi
fi

exec "$@"
```

Write this file as UTF-8 without BOM so Linux containers can execute it reliably.

## Troubleshooting

### `external network traefik not found`

Create it once:

```powershell
docker network create traefik
```

### Host route works with Host header but not in browser

Routing is fine; Windows name resolution is missing. Add the hosts entry as Administrator.

### Traefik dashboard works but project route returns 404

Check project labels and confirm the app container is on the `traefik` network:

```powershell
docker inspect <project-container> --format "{{json .NetworkSettings.Networks}}"
```

Also confirm the project app actually serves the configured internal port.

### Port 80 or 8080 is already in use

Do not stop the unknown service automatically. Report the conflict. Either reuse the existing proxy if it is Traefik-compatible, or change the shared proxy ports deliberately.

### Docker Desktop pipe access denied

Docker Desktop may not be running, or the current shell lacks Docker access. Start Docker Desktop and retry from a shell that can run `docker ps`.

## kikiChronicle reference result

Observed successful verification:

```text
Container: kikichronicle-app
Network: traefik,kikichronicle_default
Internal route: Host kikichronicle.localhost -> /data_out/parse_report.json -> HTTP 200
SQLite verification: nodes=46323, cords=117493, seeds=209, duplicate URI=0, dangling=0
```

The only remaining host-side step was adding `127.0.0.1 kikichronicle.localhost` to the Windows hosts file with Administrator rights.