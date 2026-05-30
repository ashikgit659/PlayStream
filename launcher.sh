#!/bin/bash
# Start WatchParty services

# Kill any existing instances
pkill -f "next dev" 2>/dev/null
pkill -f "watchparty-service" 2>/dev/null
sleep 1

# Start socket server
cd /home/z/my-project/mini-services/watchparty-service
bun index.ts >>/tmp/socket.log 2>&1 &

# Start Next.js dev server
cd /home/z/my-project
npx next dev -p 3000 >>/tmp/nextjs.log 2>&1 &

# Wait for both to start
sleep 5
echo "Services started"
echo "Socket server log:"
tail -5 /tmp/socket.log
echo "Next.js log:"
tail -10 /tmp/nextjs.log
