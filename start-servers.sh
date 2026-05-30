#!/bin/bash
# Start Next.js dev server
cd /home/z/my-project
nohup bun run dev > /home/z/my-project/dev.log 2>&1 &
NEXT_PID=$!
echo "Next.js PID: $NEXT_PID"

# Start Socket.io server
cd /home/z/my-project/mini-services/watchparty-service
nohup bun --hot index.ts > /home/z/my-project/socket.log 2>&1 &
SOCKET_PID=$!
echo "Socket.io PID: $SOCKET_PID"

# Wait a bit and check
sleep 5
echo "Next.js log:"
tail -5 /home/z/my-project/dev.log
echo ""
echo "Socket.io log:"
tail -5 /home/z/my-project/socket.log

# Keep script alive
wait
