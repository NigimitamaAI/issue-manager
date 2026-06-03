FROM python:3-slim

WORKDIR /workspace

ENV PYTHONUNBUFFERED=1
ENV IM_INTERNAL_PORT=8000

CMD ["python", "-m", "http.server", "8000", "--bind", "0.0.0.0", "--directory", "/workspace"]
