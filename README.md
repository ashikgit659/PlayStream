# WatchParty

A real-time synchronized video watching platform — watch videos together with friends, chat, react, and share content in virtual rooms. Inspired by [watchparty.me](https://www.watchparty.me/).

## Features

### Video Playback
- **YouTube** — Full IFrame API integration with play/pause/seek sync
- **Twitch** — Channel and VOD embed support
- **Vimeo** — Player embed with autoplay
- **Direct Video Files** — HTML5 `<video>` player for mp4, webm, ogg, mov, avi, mkv
- **Generic URLs** — Iframe embed for any web page

### Room Features
- **Real-time Chat** — Send messages, see who's typing, colored usernames
- **Emoji Reactions** — Floating emoji reactions visible to all room members
- **Screenshare** — Share your screen, window, or browser tab with the room
- **VBrowser** — Launch a shared virtual browser (iframe) that everyone can see
- **File Upload** — Upload video files (up to 500MB) and play them for the room
- **Playlist** — Queue videos, auto-advance when current video ends
- **Theater Mode** — Expand the video player for a cinematic experience

### Social
- **Room Links** — Share a URL to invite friends directly to your room
- **User List** — See who's in the room with colored avatars
- **System Messages** — Join/leave/load notifications in chat

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser                               │
│                                                              │
│  ┌──────────────────┐    ┌───────────────────────────────┐  │
│  │   Next.js App     │    │   Socket.io Client            │  │
│  │   (Port 3000)     │    │   (via Caddy Gateway :3003)   │  │
│  │                    │    │                               │  │
│  │  ┌──────────────┐ │    │  Events:                      │  │
│  │  │ React UI     │ │    │  ├── join-room                │  │
│  │  │ (Zustand     │◄────►│  ├── chat-message             │  │
│  │  │  Store)      │ │    │  ├── video-load/play/pause    │  │
│  │  └──────────────┘ │    │  ├── reaction                 │  │
│  │                    │    │  ├── playlist-add/remove      │  │
│  │  ┌──────────────┐ │    │  └── video-load-source        │  │
│  │  │ YouTube      │ │    └───────────────────────────────┘  │
│  │  │ IFrame API   │ │                                       │
│  │  ├──────────────┤ │    ┌───────────────────────────────┐  │
│  │  │ HTML5 Video  │ │    │   REST API (Next.js Routes)   │  │
│  │  │ Player       │ │    │                               │  │
│  │  ├──────────────┤ │    │  POST /api/upload             │  │
│  │  │ Twitch/Vimeo │ │    │  GET  /api/upload/[file]      │  │
│  │  │ Iframe Embed │ │    │  (Range request support)      │  │
│  │  ├──────────────┤ │    └───────────────────────────────┘  │
│  │  │ Screenshare  │ │                                       │
│  │  │ (MediaStream)│ │                                       │
│  │  └──────────────┘ │                                       │
│  └──────────────────┘                                        │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                     Caddy Gateway                            │
│                                                              │
│  - Routes / to Next.js (port 3000)                          │
│  - Routes ?XTransformPort=3003 to Socket.io (port 3003)     │
│  - All API requests use relative paths with XTransformPort  │
└─────────────────────────────────────────────────────────────┘
                          │
              ┌───────────┴───────────┐
              ▼                       ▼
┌──────────────────────┐  ┌──────────────────────────────────┐
│  Next.js Server      │  │  Socket.io Server                │
│  (Port 3000)         │  │  (Port 3003)                     │
│                      │  │                                  │
│  - App Router        │  │  - Room management               │
│  - React SSR/RSC     │  │  - User sessions                 │
│  - API Routes:       │  │  - Video state sync              │
│    /api/upload       │  │  - Chat relay                    │
│    /api/upload/[f]   │  │  - Playlist management           │
│                      │  │  - Reaction broadcast            │
│  - Static Assets     │  │  - Screen share signaling        │
│                      │  │                                  │
│                      │  │  Storage: In-memory Maps         │
│                      │  │  ├── rooms (Map<roomId, Room>)   │
│                      │  │  └── userRoomMap                 │
└──────────────────────┘  └──────────────────────────────────┘
```

---

## Technology Stack

| Layer            | Technology                          |
|-----------------|-------------------------------------|
| Framework        | Next.js 16 (App Router, Turbopack) |
| Language         | TypeScript 5                        |
| Styling          | Tailwind CSS 4 + shadcn/ui         |
| State Management | Zustand                             |
| Real-time        | Socket.io                           |
| Video Players    | YouTube IFrame API, HTML5 Video     |
| File Upload      | Next.js API Routes + fs             |
| Icons            | Lucide React                        |
| Animations       | CSS Keyframes + Framer Motion       |

---

## Project Structure

```
src/
├── app/
│   ├── page.tsx                    # Main page (landing/room router)
│   ├── layout.tsx                  # Root layout (dark theme)
│   ├── globals.css                 # Global styles + animations
│   └── api/
│       └── upload/
│           ├── route.ts            # POST: Upload video files
│           └── [file]/
│               └── route.ts        # GET: Serve files with range requests
├── components/
│   ├── watchparty/
│   │   ├── landing-page.tsx        # Landing page with hero/stepper
│   │   └── room-view.tsx           # Main room component (video, chat, tabs)
│   └── ui/                         # shadcn/ui components
├── store/
│   └── watchparty-store.ts         # Zustand global state
└── lib/
    └── socket.ts                   # Socket.io client utility

mini-services/
└── watchparty-service/
    ├── index.ts                    # Socket.io server (port 3003)
    └── package.json                # Independent bun project

upload/                             # Uploaded video files (gitignored)
```

---

## Getting Started

### Prerequisites
- [Bun](https://bun.sh/) runtime
- Node.js 18+ (for Next.js compatibility)

### Installation

```bash
# Install dependencies
bun install

# Install socket server dependencies
cd mini-services/watchparty-service && bun install && cd ../..
```

### Running

```bash
# Start both servers (from project root)
bun run dev &
cd mini-services/watchparty-service && bun --hot index.ts &
```

- **Next.js App**: http://localhost:3000
- **Socket.io Server**: http://localhost:3003

### Linting

```bash
bun run lint
```

---

## How It Works

### Room Lifecycle

1. **Create Room** — User enters a display name and clicks "Create Room" or "Join Room"
2. **Socket Connection** — Client connects to Socket.io server via Caddy gateway
3. **Join Room** — Client emits `join-room` with roomId and username
4. **State Sync** — Server sends current room state (video URL, playlist, users) to the new joiner
5. **Real-time Events** — All actions (play/pause/chat/reactions) are broadcast to other room members
6. **Leave/Disconnect** — Users are removed from rooms; empty rooms are cleaned up

### Video Sync

Video synchronization uses a **relay model** through the Socket.io server:

1. **Local Action** — User presses play/pause or seeks on the video player
2. **Emit to Server** — Client emits `video-play`, `video-pause`, or `video-seek` with current time
3. **Server Relays** — Server broadcasts to all other clients in the room (via `socket.to(roomId)`)
4. **Remote Apply** — Other clients receive the event and apply it to their player
5. **Feedback Loop Prevention** — An `isRemoteAction` ref prevents re-emitting events triggered by remote sync

**Source-specific sync:**
- **YouTube**: Uses the IFrame Player API (`seekTo`, `playVideo`, `pauseVideo`)
- **HTML5 Video**: Uses native video element methods (`currentTime`, `play()`, `pause()`)
- **Twitch/Vimeo/Iframe**: No sync — each viewer controls their own playback (iframe limitations)
- **Screenshare**: Only broadcaster sees their screen (WebRTC peer connections needed for remote viewers)

### File Upload & Playback

1. User selects a video file via the File tab
2. File is uploaded via `POST /api/upload` with `FormData`
3. Server validates extension and size (max 500MB), writes to `/upload/` directory
4. Returns a URL like `/api/upload/filename.mp4`
5. URL is loaded as a `file` source type using HTML5 `<video>` with native controls
6. File serving supports **HTTP Range Requests** for video seeking (partial content 206 responses)

### Playlist

1. Users add URLs to the playlist queue
2. Playlist is stored on the server per room and broadcast to all clients
3. "Play Next" pops the first item and loads it for the room
4. When a video ends (`video-end` event), the server auto-advances to the next playlist item
5. Source type is auto-detected from the URL (YouTube, Vimeo, direct video, etc.)

### VBrowser

The VBrowser feature loads any URL in a shared iframe:

1. User enters a URL in the VBrowser tab
2. URL is loaded as an `iframe` source type, broadcast to the room
3. All users see the same web page in the video player area
4. Note: Many sites block iframe embedding via `X-Frame-Options` headers

### Screenshare

1. Broadcaster calls `navigator.mediaDevices.getDisplayMedia()` to capture screen
2. The `MediaStream` is set on a local `<video>` element via `srcObject`
3. Server is notified, which signals other users to show the "screen share in progress" overlay
4. If the broadcaster disconnects, the server resets the room's video source
5. **Limitation**: Remote viewers cannot see the actual screen — this requires WebRTC peer connections or an SFU server

---

## Socket.io Events Reference

### Client → Server

| Event              | Payload                                    | Description                        |
|--------------------|--------------------------------------------|------------------------------------|
| `join-room`        | `{ roomId, username }`                     | Join or create a room              |
| `chat-message`     | `{ content }`                              | Send a chat message                |
| `reaction`         | `{ emoji }`                                | Send a floating reaction           |
| `video-load`       | `{ url, source }`                          | Load a video for the room          |
| `video-load-source`| `{ source: 'screen'\|'file', url? }`       | Load a special source (screen/file)|
| `video-play`       | `{ time }`                                 | Play video at timestamp            |
| `video-pause`      | `{ time }`                                 | Pause video at timestamp           |
| `video-seek`       | `{ time }`                                 | Seek to timestamp                  |
| `video-end`        | `{}`                                       | Current video ended                |
| `playlist-add`     | `{ url, title }`                           | Add item to playlist               |
| `playlist-remove`  | `{ id }`                                   | Remove item from playlist          |
| `playlist-reorder` | `{ playlist }`                             | Reorder playlist                   |
| `playlist-play-next`| `{}`                                      | Play next playlist item            |
| `playlist-clear`   | `{}`                                       | Clear entire playlist              |

### Server → Client

| Event              | Payload                                            | Description                     |
|--------------------|----------------------------------------------------|---------------------------------|
| `room-joined`      | `{ room: { id, videoUrl, videoSource, ... } }`     | Room state on join              |
| `room-users`       | `{ users: User[] }`                                | Updated user list               |
| `chat-message`     | `ChatMessage`                                      | New chat message                |
| `reaction`         | `Reaction`                                         | Floating reaction               |
| `video-load`       | `{ url, source, username? }`                       | New video loaded                |
| `video-play`       | `{ time }`                                         | Play video                      |
| `video-pause`      | `{ time }`                                         | Pause video                     |
| `video-seek`       | `{ time }`                                         | Seek video                      |
| `video-ended`      | `{}`                                               | Video ended (no playlist items) |
| `playlist-update`  | `{ playlist: PlaylistItem[] }`                     | Updated playlist                |

---

## API Routes Reference

### POST /api/upload

Upload a video file to the server.

**Request:** `multipart/form-data` with field `video`

**Response (201):**
```json
{ "url": "/api/upload/filename_12345_abc.mp4", "filename": "filename_12345_abc.mp4" }
```

**Error Responses:**
- `400` — No file provided
- `413` — File exceeds 500MB limit
- `415` — Unsupported video format
- `500` — Server error

### GET /api/upload/[file]

Serve an uploaded video file with range request support.

**Headers:**
- `Range: bytes=0-1023` (optional, for video seeking)

**Response:**
- `200` — Full file (with `Accept-Ranges: bytes`)
- `206` — Partial content (with `Content-Range` header)
- `404` — File not found

---

## Known Limitations

1. **Screenshare is local-only** — The `MediaStream` from `getDisplayMedia()` is only visible to the broadcaster. Remote viewers see a placeholder. A full implementation requires WebRTC peer connections or an SFU media server (e.g., mediasoup, Janus).

2. **No persistent storage** — Room state (messages, playlist, users) is stored in-memory on the Socket.io server. Restarting the server clears all rooms.

3. **Iframe embedding restrictions** — Many websites block iframe embedding via `X-Frame-Options` or `Content-Security-Policy` headers. The VBrowser feature works best with sites that allow embedding.

4. **Video time drift** — When a new user joins a room with a playing video, they receive the `videoTime` from the last play/pause event, which may be slightly stale. No periodic time sync is implemented.

5. **Upload loads entire file into memory** — The upload API reads the full file into a `Buffer` before writing to disk. For very large files or concurrent uploads, this could cause memory pressure. A streaming approach would be more robust.

6. **No rate limiting** — Chat, reactions, and video events have no rate limiting, making the server vulnerable to spam.

---

## Environment

This project is designed to run in a cloud sandbox environment with a Caddy reverse proxy gateway. All cross-service communication uses `?XTransformPort=<port>` query parameters instead of direct port references in URLs.

For local development outside the sandbox, you may need to adjust:
- Socket.io client connection URL in `room-view.tsx`
- CORS settings in the Socket.io server
- The Caddyfile gateway configuration
