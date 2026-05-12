#!/usr/bin/env bash
# issue_manager start script (macOS/Linux)
# - Checks if the server is already running
# - If yes, just opens the browser
# - If no, starts the server in background and opens the browser

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_PATH="${SCRIPT_DIR}/config.json"

# Read port/nodeExe from config.json if available
PORT=5180
NODE_EXE="node"
if [ -f "${CONFIG_PATH}" ]; then
  if command -v node >/dev/null 2>&1; then
    cfg_port=$(node -e "try{const c=require(process.argv[1]); process.stdout.write(String(c.port||''))}catch(e){}" "${CONFIG_PATH}" 2>/dev/null || true)
    cfg_node=$(node -e "try{const c=require(process.argv[1]); process.stdout.write(c.nodeExe||'')}catch(e){}" "${CONFIG_PATH}" 2>/dev/null || true)
    if [ -n "$cfg_port" ]; then
      PORT="$cfg_port"
    fi
    if [ -n "$cfg_node" ]; then
      NODE_EXE="$cfg_node"
    fi
  fi
fi
if [ "${NODE_EXE}" != "node" ] && ! command -v "${NODE_EXE}" >/dev/null 2>&1 && [ ! -x "${NODE_EXE}" ]; then
  echo "[WARN] configured nodeExe is not executable on this shell: ${NODE_EXE}"
  echo "[WARN] falling back to node in PATH."
  NODE_EXE="node"
fi
if ! command -v "${NODE_EXE}" >/dev/null 2>&1 && [ ! -x "${NODE_EXE}" ]; then
  echo "[ERROR] Node.js executable was not found: ${NODE_EXE}"
  echo "Please install Node.js or set nodeExe in config.json to a valid executable for this shell."
  exit 1
fi

URL="http://127.0.0.1:${PORT}/"
PING="http://127.0.0.1:${PORT}/api/ping"
SERVER_PATH="${SCRIPT_DIR}/core/server.mjs"

check_server() {
  local response
  response=$(curl -s --max-time 1 "${PING}" 2>/dev/null || echo "")
  if echo "$response" | grep -q '"server"[[:space:]]*:[[:space:]]*"issue_manager"'; then
    echo "OURS"
  elif [ -n "$response" ]; then
    echo "OTHER"
  else
    echo "DOWN"
  fi
}

open_browser() {
  if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$URL" >/dev/null 2>&1 &
  elif command -v open >/dev/null 2>&1; then
    open "$URL"
  else
    echo "[INFO] Please open ${URL} manually in your browser"
  fi
}

status=$(check_server)

if [ "$status" = "OURS" ]; then
  echo "[OK] existing issue_manager server detected."
  open_browser
  exit 0
fi

if [ "$status" = "OTHER" ]; then
  echo ""
  echo "[ERROR] Port ${PORT} is already used by another server."
  echo "Please close the other process or change PORT in this script."
  echo ""
  exit 1
fi

echo "[INFO] Starting issue_manager server..."
nohup "$NODE_EXE" "${SERVER_PATH}" --config "${CONFIG_PATH}" >/dev/null 2>&1 &
SERVER_PID=$!
disown "$SERVER_PID" 2>/dev/null || true

# Wait for startup (max 10 seconds)
for i in $(seq 1 10); do
  sleep 1
  status=$(check_server)
  if [ "$status" = "OURS" ]; then
    echo "[OK] Server started (pid: $SERVER_PID)"
    open_browser
    exit 0
  fi
done

echo ""
echo "[ERROR] Server startup check failed."
echo "Please run manually: ${NODE_EXE} ${SERVER_PATH} --config ${CONFIG_PATH}"
exit 1
