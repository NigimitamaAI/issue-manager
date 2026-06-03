FROM node:lts-slim

WORKDIR /workspace

ENV NODE_ENV=development
ENV IM_INTERNAL_PORT=3000

CMD ["sh", "-lc", "if [ -f package.json ]; then if [ -f package-lock.json ]; then npm ci; else npm install; fi; if npm run | grep -q \" dev\"; then npm run dev -- --host 0.0.0.0; elif npm run | grep -q \" start\"; then npm start; else npx --yes http-server . -p ${IM_INTERNAL_PORT:-3000}; fi; else npx --yes http-server . -p ${IM_INTERNAL_PORT:-3000}; fi"]
