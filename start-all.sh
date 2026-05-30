#!/bin/bash

# Start socket server in background
cd /home/z/my-project/mini-services/watchparty-service
bun index.ts &
SOCKET_PID=$!

# Start Next.js dev server
cd /home/z/my-project
next dev -p 3000 &

# Wait for any child to die
wait
