FROM python:3-slim

WORKDIR /workspace

ENV PYTHONUNBUFFERED=1
ENV PIP_DISABLE_PIP_VERSION_CHECK=1
ENV IM_INTERNAL_PORT=8000

CMD ["sh", "-lc", "if [ -f requirements.txt ]; then pip install -r requirements.txt; fi; if [ -f app.py ]; then python app.py; else python -m http.server ${IM_INTERNAL_PORT:-8000} --bind 0.0.0.0 --directory /workspace; fi"]
