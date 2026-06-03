# issue_manager shared Docker catalog

This directory contains shared Docker preview environments for issue_manager-managed projects.

Before creating project-specific Docker files, AI/Codex/Claude should read:

```text
<issue_manager config shared.dockerRoot>\catalog.json
```

Use a shared environment when it is sufficient. Projects should reference shared environments by `sharedEnvironmentId`; do not write the physical shared folder path into project metadata. Create project-specific Docker files under `<project>\_docker` only when the project needs custom OS packages, a custom build, a database seed, persistent volumes, secrets, or an application-specific entrypoint.

## Runtime separation

Shared templates do not use fixed `container_name` values. Run them with project-specific variables:

```powershell
$env:COMPOSE_PROJECT_NAME = "<project-id>-web-lite"
$env:IM_PROJECT_ID = "<project-id>"
$env:IM_HOST = "<project-id>.localhost"
$env:IM_PROJECT_DIR = "G:\codex\<project>"
docker compose -f <shared.dockerRoot>\web-lite\docker-compose.yml up -d
```

This keeps simultaneous projects separated by compose project name, generated container names, and Traefik router/service names. Shared templates use stable image tags such as `issue-manager/web-lite:1` so multiple projects do not create duplicate template images.

## Cleanup responsibility

Docker image, container, volume, build cache, and Docker Desktop disk usage are Docker Desktop responsibilities. issue_manager should guide users to Docker Desktop or Docker CLI for capacity management, and should not expose destructive cleanup actions as normal preview controls.
