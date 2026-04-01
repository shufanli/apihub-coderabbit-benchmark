#!/bin/bash
set -euo pipefail

# Start backend
cd /app/backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

# Start frontend
cd /app/frontend
npx next start -p 3000 &
FRONTEND_PID=$!

cleanup() {
  kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
  wait "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
}
trap cleanup SIGINT SIGTERM EXIT

# Wait for any process to exit
wait -n "$BACKEND_PID" "$FRONTEND_PID"
STATUS=$?

# Exit with status of process that exited first
exit $STATUS
