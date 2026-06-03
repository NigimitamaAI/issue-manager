# node-lite

Lightweight Node.js preview environment.

It bind-mounts a project directory, installs dependencies on container startup, and runs:

1. `npm run dev -- --host 0.0.0.0` when a `dev` script exists
2. `npm start` when a `start` script exists
3. `npx http-server` fallback

Use a project-specific `_docker` environment instead when the project needs custom OS packages, a custom build image, a database, or a non-standard entrypoint.
