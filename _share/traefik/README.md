# issue_manager shared Traefik

This directory contains the shared local Traefik proxy for issue_manager Docker preview environments.

## Location

```text
<issue_manager config shared.traefikRoot>
```

## Start

```powershell
Set-Location -LiteralPath '<shared.traefikRoot>'
docker network create traefik
docker compose up -d
```

If the `traefik` network already exists, the network creation error is harmless.

## URLs

- HTTP entrypoint: `http://<project-id>.localhost:8280/`
- Dashboard: `http://localhost:8080/dashboard/`

Project compose files should not bind fixed host ports for web access. They should join the external `traefik` network and declare Traefik labels.

The container name is intentionally `traefik` to preserve compatibility with the earlier shared proxy location.
