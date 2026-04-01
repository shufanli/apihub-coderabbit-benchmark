#!/bin/bash
set -e

# Start backend
cd /app/backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 &

# Start frontend
cd /app/frontend
npx next start -p 3000 &

# Wait for any process to exit
wait -n

# Exit with status of process that exited first
exit $?
