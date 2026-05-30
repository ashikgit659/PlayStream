import { NextResponse } from 'next/server'

// This route just checks if the socket server is reachable
// The actual socket server runs as a separate mini-service on port 3003
export async function GET() {
  try {
    // Try to connect to the socket server to check if it's running
    const response = await fetch('http://localhost:3003/', {
      method: 'GET',
      signal: AbortSignal.timeout(3000),
    })
    return NextResponse.json({ 
      status: 'ok', 
      message: 'Socket server is running',
      running: true
    })
  } catch {
    // Socket server not running yet - that's OK, client will connect when it's ready
    return NextResponse.json({ 
      status: 'waiting', 
      message: 'Socket server not yet reachable',
      running: false
    })
  }
}
