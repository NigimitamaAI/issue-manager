# python-lite

Lightweight Python preview environment.

It bind-mounts a project directory, installs `requirements.txt` when present, and runs:

1. `python app.py` when `app.py` exists
2. `python -m http.server` fallback

Use a project-specific `_docker` environment instead when the project needs databases, custom OS packages, seeds, persistent volumes, or a non-standard entrypoint.
