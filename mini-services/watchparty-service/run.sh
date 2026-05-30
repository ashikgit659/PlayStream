#!/bin/bash
cd /home/z/my-project/mini-services/watchparty-service
while true; do
  echo "Starting socket server..."
  bun index.ts
  echo "Socket server died, restarting in 1s..."
  sleep 1
done
