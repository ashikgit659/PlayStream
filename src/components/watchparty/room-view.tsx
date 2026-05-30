'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import { useWatchPartyStore, ChatMessage, RoomUser, PlaylistItem, VideoSource } from '@/store/watchparty-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  CirclePlus,
  LogIn,
  ScreenShare,
  MonitorPlay,
  FileUp,
  ListVideo,
  Users,
  Settings,
  Copy,
  X,
  Plus,
  Send,
  SmilePlus,
  Check,
  User,
  Link2,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  MessageCircle,
  Shuffle,
  Trash2,
  GripVertical,
  Search,
  ExternalLink,
  MonitorOff,
  StopCircle,
  Upload,
  Globe,
  SkipForward,
  Loader2,
} from 'lucide-react'

const ADJECTIVES = ['Squeamish','Brave','Clever','Dazzling','Eager','Fierce','Gentle','Happy','Jolly','Keen','Lively','Mighty','Noble','Polite','Quick','Rapid','Silent','Tiny','Witty','Zany']
const NOUNS = ['Grape','Panda','Falcon','Otter','Llama','Moose','Crab','Fox','Koala','Parrot','Tiger','Whale','Zebra','Lynx','Hawk','Emu','Cobra','Puma','Dodo','Kiwi']

function generateName() {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)]
  return `${adj} ${noun}`
}

// ─── URL Detection Helpers ───

function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ]
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) return match[1]
  }
  return null
}

function isDirectVideoUrl(url: string): boolean {
  return /\.(mp4|webm|ogg|ogv|mov|m4v|avi|mkv)(\?.*)?$/i.test(url)
}

function isTwitchUrl(url: string): boolean {
  return /twitch\.tv/i.test(url)
}

function extractTwitchChannel(url: string): string | null {
  // https://www.twitch.tv/channel_name
  const match = url.match(/twitch\.tv\/([a-zA-Z0-9_]+)/)
  return match ? match[1] : null
}

function extractTwitchVideo(url: string): string | null {
  // https://www.twitch.tv/videos/123456
  const match = url.match(/twitch\.tv\/videos\/(\d+)/)
  return match ? match[1] : null
}

function isVimeoUrl(url: string): boolean {
  return /vimeo\.com/i.test(url)
}

function extractVimeoId(url: string): string | null {
  // https://vimeo.com/123456789
  const match = url.match(/vimeo\.com\/(\d+)/)
  return match ? match[1] : null
}

function isDailymotionUrl(url: string): boolean {
  return /dailymotion\.com/i.test(url)
}

function extractDailymotionId(url: string): string | null {
  // https://www.dailymotion.com/video/xxxxx
  const match = url.match(/dailymotion\.com\/video\/([a-zA-Z0-9]+)/)
  return match ? match[1] : null
}

function isUrl(str: string): boolean {
  return /^https?:\/\//i.test(str) || /^www\./i.test(str)
}

function detectVideoSource(url: string): { source: VideoSource; id: string | null } {
  // Check YouTube
  const ytId = extractYouTubeId(url)
  if (ytId) return { source: 'youtube', id: ytId }

  // Check Twitch
  if (isTwitchUrl(url)) return { source: 'twitch', id: null }

  // Check Vimeo
  if (isVimeoUrl(url)) return { source: 'vimeo', id: extractVimeoId(url) }

  // Check Dailymotion
  if (isDailymotionUrl(url)) return { source: 'iframe', id: null }

  // Check direct video
  if (isDirectVideoUrl(url)) return { source: 'direct', id: null }

  // Generic URL - try iframe embed
  if (isUrl(url)) return { source: 'iframe', id: null }

  // Not a URL - will be treated as YouTube search
  return { source: 'youtube', id: null }
}

function buildYouTubeSearchUrl(query: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`
}

const EMOJI_REACTIONS = ['👍', '😂', '😮', '🎉', '🔥', '❤️', '💀', '👀']

const TAB_ITEMS = [
  { id: 'screenshare', label: 'Screenshare', icon: ScreenShare, color: 'bg-[#2185d0]' },
  { id: 'vbrowser', label: 'VBrowser', icon: MonitorPlay, color: 'bg-[#21ba45]' },
  { id: 'file', label: 'File', icon: FileUp, color: 'bg-[#7c4dff]' },
  { id: 'playlist', label: 'Playlist', icon: ListVideo, color: 'bg-[#555]' },
]

type SidebarTab = 'people' | 'chat' | 'settings'

export default function RoomView() {
  const {
    roomId, username, isUsernameSet, isConnected,
    roomUsers, messages, videoUrl, videoSource, playlist,
    setViewMode, setUsername, setIsUsernameSet, setIsConnected,
    setRoomUsers, addMessage, setVideoUrl, setVideoSource, setVideoState, setVideoTime,
    setPlaylist, resetRoom, setRoomId, clearMessages
  } = useWatchPartyStore()

  const socketRef = useRef<Socket | null>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<any>(null)
  const htmlVideoRef = useRef<HTMLVideoElement | null>(null)
  const playerContainerRef = useRef<HTMLDivElement>(null)
  const [chatInput, setChatInput] = useState('')
  const [urlInput, setUrlInput] = useState('')
  const [currentSocketId, setCurrentSocketId] = useState('')
  const [copied, setCopied] = useState(false)
  const [nameInput, setNameInput] = useState(() => generateName())
  const [activeTab, setActiveTab] = useState<string | null>(null)
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('chat')
  const [isMuted, setIsMuted] = useState(false)
  const [isTheaterMode, setIsTheaterMode] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [floatingReactions, setFloatingReactions] = useState<{ id: string; emoji: string; x: number }[]>([])
  const [playerReady, setPlayerReady] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isPlayerLoading, setIsPlayerLoading] = useState(false)
  const [mobileShowChat, setMobileShowChat] = useState(false)
  const [searchSuggestions, setSearchSuggestions] = useState<{ title: string; videoId: string; thumbnail: string }[]>([])
  const [showSearchDropdown, setShowSearchDropdown] = useState(false)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isRemoteAction = useRef(false)
  const reactionTimers = useRef<Set<NodeJS.Timeout>>(new Set())
  const ytInitPollingRef = useRef<NodeJS.Timeout | null>(null)

  // Screenshare state
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const screenStreamRef = useRef<MediaStream | null>(null)
  const screenVideoRef = useRef<HTMLVideoElement | null>(null)

  // File upload state
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // VBrowser state
  const [vbrowserUrl, setVbrowserUrl] = useState('https://www.youtube.com')
  const [isVBrowserActive, setIsVBrowserActive] = useState(false)

  // Playlist input state (separate from URL input)
  const [playlistInput, setPlaylistInput] = useState('')

  // Compute YouTube ID from videoUrl
  const youtubeId = videoUrl ? extractYouTubeId(videoUrl) : null
  const hasVideo = !!videoUrl || videoSource === 'screen'

  // Initialize socket
  useEffect(() => {
    const initSocket = () => {
      // Connect to socket server on the same host, port 3003
      const host = window.location.hostname;
      const socketInstance = io(`http://${host}:3003`, {
        transports: ['websocket', 'polling'],
        forceNew: true,
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        timeout: 10000
      })
      socketRef.current = socketInstance

      socketInstance.on('connect', () => {
        setCurrentSocketId(socketInstance.id || '')
        setIsConnected(true)
        const state = useWatchPartyStore.getState()
        if (state.isUsernameSet && state.roomId && state.username) {
          socketInstance.emit('join-room', { roomId: state.roomId, username: state.username })
        }
      })

      socketInstance.on('disconnect', () => {
        setIsConnected(false)
      })

      socketInstance.on('room-joined', (data: any) => {
        if (data.room) {
          if (data.room.videoUrl) {
            const detected = detectVideoSource(data.room.videoUrl)
            setVideoUrl(data.room.videoUrl)
            setVideoSource(detected.source)
          }
          if (data.room.videoState) {
            setVideoState(data.room.videoState)
            setIsPlaying(data.room.videoState === 'playing')
          }
          if (data.room.videoTime !== undefined) setVideoTime(data.room.videoTime)
          if (data.room.users) setRoomUsers(data.room.users)
          if (data.room.playlist) setPlaylist(data.room.playlist)
        }
      })

      socketInstance.on('chat-message', (msg: ChatMessage) => addMessage(msg))
      socketInstance.on('room-users', (data: { users: RoomUser[] }) => setRoomUsers(data.users))

      socketInstance.on('video-load', (data: { url: string; source?: string }) => {
        const currentUrl = useWatchPartyStore.getState().videoUrl
        const currentSource = useWatchPartyStore.getState().videoSource
        // Update if URL changed OR if source type changed (e.g. switching to/from screen share)
        if (currentUrl !== data.url || currentSource !== data.source) {
          const detected = detectVideoSource(data.url)
          setVideoUrl(data.url)
          setVideoSource(data.source ? (data.source as VideoSource) : detected.source)
          setIsPlayerLoading(true)
        }
      })

      // NOTE: video-load-source handler is dead code - the server never emits this event.
      // The server converts video-load-source -> video-load broadcast.
      // Keeping handler as a safety net for future direct peer events.
      socketInstance.on('video-load-source', (data: { source: string; broadcasterId?: string }) => {
        setVideoSource(data.source as VideoSource)
        if (data.source === 'screen') {
          setIsPlaying(true)
          setVideoUrl('')
        }
      })

      socketInstance.on('video-ended', () => {
        setVideoState('paused')
        setIsPlaying(false)
      })

      socketInstance.on('video-play', (data: { time: number }) => {
        const source = useWatchPartyStore.getState().videoSource
        isRemoteAction.current = true
        if (source === 'youtube' && playerRef.current?.seekTo) {
          playerRef.current.seekTo(data.time, true)
          playerRef.current.playVideo()
        } else if ((source === 'direct' || source === 'file') && htmlVideoRef.current) {
          htmlVideoRef.current.currentTime = data.time
          htmlVideoRef.current.play().catch(() => {})
        }
        setVideoState('playing')
        setIsPlaying(true)
        setTimeout(() => { isRemoteAction.current = false }, 100)
      })

      socketInstance.on('video-pause', (data: { time: number }) => {
        const source = useWatchPartyStore.getState().videoSource
        isRemoteAction.current = true
        if (source === 'youtube' && playerRef.current?.seekTo) {
          playerRef.current.seekTo(data.time, true)
          playerRef.current.pauseVideo()
        } else if ((source === 'direct' || source === 'file') && htmlVideoRef.current) {
          htmlVideoRef.current.currentTime = data.time
          htmlVideoRef.current.pause()
        }
        setVideoState('paused')
        setIsPlaying(false)
        setTimeout(() => { isRemoteAction.current = false }, 100)
      })

      socketInstance.on('video-seek', (data: { time: number }) => {
        const source = useWatchPartyStore.getState().videoSource
        isRemoteAction.current = true
        if (source === 'youtube' && playerRef.current?.seekTo) {
          playerRef.current.seekTo(data.time, true)
        } else if ((source === 'direct' || source === 'file') && htmlVideoRef.current) {
          htmlVideoRef.current.currentTime = data.time
        }
        setVideoTime(data.time)
        setTimeout(() => { isRemoteAction.current = false }, 100)
      })

      socketInstance.on('playlist-update', (data: { playlist: PlaylistItem[] }) => setPlaylist(data.playlist))

      socketInstance.on('reaction', (data: { emoji: string }) => {
        const id = Math.random().toString(36).substr(2, 9)
        const x = 20 + Math.random() * 60
        setFloatingReactions(prev => [...prev, { id, emoji: data.emoji, x }])
        const timer = setTimeout(() => {
          setFloatingReactions(prev => prev.filter(r => r.id !== id))
        }, 3000)
        reactionTimers.current.add(timer)
      })
    }

    initSocket()

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect()
      }
      // Clean up reaction timers
      reactionTimers.current.forEach(t => clearTimeout(t))
      reactionTimers.current.clear()
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    }
  }, [])

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // YouTube IFrame API loader
  useEffect(() => {
    if (videoSource !== 'youtube' || !youtubeId) return

    Promise.resolve().then(() => {
      setPlayerReady(false)
      setIsPlayerLoading(true)
    })

    const loadPlayer = () => {
      const container = document.getElementById('yt-player-container')
      if (!container) return

      container.innerHTML = '<div id="yt-player"></div>'

      if (playerRef.current) {
        try { playerRef.current.destroy() } catch {}
        playerRef.current = null
      }

      const initPlayer = () => {
        if (!(window as any).YT?.Player) {
          ytInitPollingRef.current = setTimeout(initPlayer, 100)
          return
        }
        ytInitPollingRef.current = null

        playerRef.current = new (window as any).YT.Player('yt-player', {
          videoId: youtubeId,
          playerVars: {
            autoplay: 1,
            controls: 1,
            modestbranding: 1,
            rel: 0,
            playsinline: 1,
          },
          events: {
            onReady: () => {
              setPlayerReady(true)
              setIsPlayerLoading(false)
            },
            onStateChange: (event: any) => {
              if (isRemoteAction.current) return // Skip emit if triggered by remote sync
              if (!socketRef.current) return
              if (event.data === 1) { // Playing
                socketRef.current.emit('video-play', { time: playerRef.current?.getCurrentTime?.() || 0 })
                setVideoState('playing')
                setIsPlaying(true)
              }
              if (event.data === 2) { // Paused
                socketRef.current.emit('video-pause', { time: playerRef.current?.getCurrentTime?.() || 0 })
                setVideoState('paused')
                setIsPlaying(false)
              }
            },
          },
        })
      }

      if ((window as any).YT?.Player) {
        initPlayer()
      } else {
        if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
          const tag = document.createElement('script')
          tag.src = 'https://www.youtube.com/iframe_api'
          document.head.appendChild(tag)
        }
        ;(window as any).onYouTubeIframeAPIReady = initPlayer
      }
    }

    const timer = setTimeout(loadPlayer, 100)
    return () => {
      clearTimeout(timer)
      if (ytInitPollingRef.current) clearTimeout(ytInitPollingRef.current)
      try { playerRef.current?.destroy() } catch {}
      playerRef.current = null
    }
  }, [youtubeId, videoSource, setVideoState])

  // Direct video (HTML5) sync setup
  useEffect(() => {
    if ((videoSource !== 'direct' && videoSource !== 'file') || !videoUrl) return

    const video = htmlVideoRef.current
    if (!video) return

    // Set loading state via microtask to satisfy lint
    Promise.resolve().then(() => setIsPlayerLoading(true))

    const handleCanPlay = () => {
      setPlayerReady(true)
      setIsPlayerLoading(false)
      video.play().catch(() => {})
    }

    const handlePlay = () => {
      if (isRemoteAction.current) return // Skip emit if triggered by remote sync
      if (socketRef.current) {
        socketRef.current.emit('video-play', { time: video.currentTime })
      }
      setVideoState('playing')
      setIsPlaying(true)
    }

    const handlePause = () => {
      if (isRemoteAction.current) return // Skip emit if triggered by remote sync
      if (socketRef.current) {
        socketRef.current.emit('video-pause', { time: video.currentTime })
      }
      setVideoState('paused')
      setIsPlaying(false)
    }

    const handleSeeked = () => {
      if (isRemoteAction.current) return // Skip emit if triggered by remote sync
      if (socketRef.current) {
        socketRef.current.emit('video-seek', { time: video.currentTime })
      }
      setVideoTime(video.currentTime)
    }

    video.addEventListener('canplay', handleCanPlay)
    video.addEventListener('play', handlePlay)
    video.addEventListener('pause', handlePause)
    video.addEventListener('seeked', handleSeeked)

    return () => {
      video.removeEventListener('canplay', handleCanPlay)
      video.removeEventListener('play', handlePlay)
      video.removeEventListener('pause', handlePause)
      video.removeEventListener('seeked', handleSeeked)
    }
  }, [videoUrl, videoSource, setVideoState, setVideoTime])

  const handleJoin = useCallback(() => {
    if (!nameInput.trim()) return
    const name = nameInput.trim()
    const rid = roomId || Math.random().toString(36).substr(2, 8)
    setUsername(name)
    setIsUsernameSet(true)
    setRoomId(rid)

    if (socketRef.current) {
      socketRef.current.emit('join-room', { roomId: rid, username: name })
    }
    window.history.replaceState({}, '', `?room=${rid}`)
  }, [nameInput, roomId, setUsername, setIsUsernameSet, setRoomId])

  const handleSendMessage = useCallback(() => {
    if (!chatInput.trim() || !socketRef.current) return
    socketRef.current.emit('chat-message', { content: chatInput.trim() })
    setChatInput('')
  }, [chatInput])

  const handleLoadVideo = useCallback((url?: string) => {
    const videoUrlToLoad = url || urlInput.trim()
    if (!videoUrlToLoad) return

    // If it's not a URL, treat as YouTube search
    if (!isUrl(videoUrlToLoad)) {
      window.open(buildYouTubeSearchUrl(videoUrlToLoad), '_blank')
      setUrlInput('')
      return
    }

    // Detect source type
    const detected = detectVideoSource(videoUrlToLoad)

    // Optimistically set video URL locally
    setVideoUrl(videoUrlToLoad)
    setVideoSource(detected.source)
    setIsPlayerLoading(true)
    setUrlInput('')
    setShowSearchDropdown(false)

    // Broadcast to other users via socket
    if (socketRef.current) {
      socketRef.current.emit('video-load', { url: videoUrlToLoad, source: detected.source })
    } else {
      console.warn('Socket not available, video loaded locally only')
    }
  }, [urlInput, setVideoUrl, setVideoSource])

  const handleUrlInputChange = useCallback((value: string) => {
    setUrlInput(value)
    setShowSearchDropdown(false)

    // If not a URL, show search hint after a delay
    if (value.trim() && !isUrl(value.trim())) {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
      searchTimeoutRef.current = setTimeout(() => {
        setShowSearchDropdown(true)
      }, 500)
    }
  }, [])

  const handleReaction = useCallback((emoji: string) => {
    if (!socketRef.current) return
    socketRef.current.emit('reaction', { emoji })
    const id = Math.random().toString(36).substr(2, 9)
    const x = 20 + Math.random() * 60
    setFloatingReactions(prev => [...prev, { id, emoji, x }])
    const timer = setTimeout(() => {
      setFloatingReactions(prev => prev.filter(r => r.id !== id))
    }, 3000)
    reactionTimers.current.add(timer)
  }, [])

  const handleCopyLink = useCallback(() => {
    const link = `${window.location.origin}?room=${roomId}`
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(link).then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }).catch((err) => {
        console.error('Failed to copy link:', err)
        alert('Failed to copy link. Please try again.')
      })
    } else {
      // Fallback to using a temporary textarea
      const textarea = document.createElement('textarea')
      textarea.value = link
      // Avoid scrolling to bottom
      textarea.style.position = 'fixed'
      textarea.style.left = '-9999px'
      document.body.appendChild(textarea)
      textarea.select()
      try {
        const successful = document.execCommand('copy')
        if (successful) {
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
        } else {
          throw new Error('execCommand copy returned false')
        }
      } catch (err) {
        console.error('Fallback: Failed to copy text:', err)
        alert('Failed to copy link. Please try again.')
      } finally {
        document.body.removeChild(textarea)
      }
    }
  }, [roomId])

  const handleLeave = useCallback(() => {
    if (socketRef.current) socketRef.current.disconnect()
    resetRoom()
    setViewMode('landing')
    window.history.replaceState({}, '', '/')
  }, [resetRoom, setViewMode])

  const handleNewRoom = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect()
    }
    const newRoomId = Math.random().toString(36).substr(2, 8)
    const currentUsername = useWatchPartyStore.getState().username
    clearMessages()
    setRoomId(newRoomId)
    setVideoUrl('')
    setVideoSource('youtube')
    setRoomUsers([])
    setPlaylist([])
    setVideoState('paused')
    setIsConnected(false)

    const socketInstance = io(`http://${window.location.hostname}:3003`, {
      transports: ['websocket', 'polling'],
      forceNew: true,
      reconnection: true,
    })
    socketRef.current = socketInstance

    // Register event handlers on the new socket and auto-join the new room
    socketInstance.on('connect', () => {
      setCurrentSocketId(socketInstance.id || '')
      setIsConnected(true)
      if (currentUsername) {
        socketInstance.emit('join-room', { roomId: newRoomId, username: currentUsername })
      }
    })

    socketInstance.on('disconnect', () => {
      setIsConnected(false)
    })

    socketInstance.on('room-joined', (data: any) => {
      if (data.room) {
        if (data.room.videoUrl) {
          const detected = detectVideoSource(data.room.videoUrl)
          setVideoUrl(data.room.videoUrl)
          setVideoSource(detected.source)
        }
        if (data.room.videoState) setVideoState(data.room.videoState)
        if (data.room.videoTime !== undefined) setVideoTime(data.room.videoTime)
        if (data.room.users) setRoomUsers(data.room.users)
        if (data.room.playlist) setPlaylist(data.room.playlist)
      }
    })

    socketInstance.on('chat-message', (msg: ChatMessage) => addMessage(msg))
    socketInstance.on('room-users', (data: { users: RoomUser[] }) => setRoomUsers(data.users))

    socketInstance.on('video-load', (data: { url: string; source?: string }) => {
      const currentUrl = useWatchPartyStore.getState().videoUrl
      const currentSource = useWatchPartyStore.getState().videoSource
      if (currentUrl !== data.url || currentSource !== data.source) {
        const detected = detectVideoSource(data.url)
        setVideoUrl(data.url)
        setVideoSource(data.source ? (data.source as VideoSource) : detected.source)
        setIsPlayerLoading(true)
      }
    })

    socketInstance.on('video-play', (data: { time: number }) => {
      const source = useWatchPartyStore.getState().videoSource
      isRemoteAction.current = true
      if (source === 'youtube' && playerRef.current?.seekTo) {
        playerRef.current.seekTo(data.time, true)
        playerRef.current.playVideo()
      } else if ((source === 'direct' || source === 'file') && htmlVideoRef.current) {
        htmlVideoRef.current.currentTime = data.time
        htmlVideoRef.current.play().catch(() => {})
      }
      setVideoState('playing')
      setIsPlaying(true)
      setTimeout(() => { isRemoteAction.current = false }, 100)
    })

    socketInstance.on('video-pause', (data: { time: number }) => {
      const source = useWatchPartyStore.getState().videoSource
      isRemoteAction.current = true
      if (source === 'youtube' && playerRef.current?.seekTo) {
        playerRef.current.seekTo(data.time, true)
        playerRef.current.pauseVideo()
      } else if ((source === 'direct' || source === 'file') && htmlVideoRef.current) {
        htmlVideoRef.current.currentTime = data.time
        htmlVideoRef.current.pause()
      }
      setVideoState('paused')
      setIsPlaying(false)
      setTimeout(() => { isRemoteAction.current = false }, 100)
    })

    socketInstance.on('video-seek', (data: { time: number }) => {
      const source = useWatchPartyStore.getState().videoSource
      isRemoteAction.current = true
      if (source === 'youtube' && playerRef.current?.seekTo) {
        playerRef.current.seekTo(data.time, true)
      } else if ((source === 'direct' || source === 'file') && htmlVideoRef.current) {
        htmlVideoRef.current.currentTime = data.time
      }
      setVideoTime(data.time)
      setTimeout(() => { isRemoteAction.current = false }, 100)
    })

    socketInstance.on('playlist-update', (data: { playlist: PlaylistItem[] }) => setPlaylist(data.playlist))

    socketInstance.on('reaction', (data: { emoji: string }) => {
      const id = Math.random().toString(36).substr(2, 9)
      const x = 20 + Math.random() * 60
      setFloatingReactions(prev => [...prev, { id, emoji: data.emoji, x }])
      const timer = setTimeout(() => {
        setFloatingReactions(prev => prev.filter(r => r.id !== id))
      }, 3000)
      reactionTimers.current.add(timer)
    })

    window.history.replaceState({}, '', `?room=${newRoomId}`)
  }, [clearMessages, setRoomId, setVideoUrl, setVideoSource, setRoomUsers, setPlaylist, setVideoState, setIsConnected, addMessage, setVideoTime])

  const handlePlaylistAdd = useCallback(() => {
    if (!playlistInput.trim() || !socketRef.current) return
    socketRef.current.emit('playlist-add', { url: playlistInput.trim(), title: playlistInput.trim() })
    setPlaylistInput('')
  }, [playlistInput])

  const handlePlaylistRemove = useCallback((id: string) => {
    if (!socketRef.current) return
    socketRef.current.emit('playlist-remove', { id })
  }, [])

  const handlePlaylistClear = useCallback(() => {
    if (!socketRef.current) return
    socketRef.current.emit('playlist-clear', {})
  }, [])

  const handlePlaylistPlayNext = useCallback(() => {
    if (!socketRef.current) return
    socketRef.current.emit('playlist-play-next', {})
  }, [])

  // ─── Screenshare Handler ───
  const handleStopScreenshare = useCallback(() => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop())
      screenStreamRef.current = null
    }
    if (screenVideoRef.current) {
      screenVideoRef.current.srcObject = null
    }
    setIsScreenSharing(false)
    setVideoSource('youtube')
    setVideoUrl('')
    setIsPlaying(false)
    setActiveTab(null)

  // Notify room that screen sharing has stopped
  if (socketRef.current) {
    socketRef.current.emit('video-load', { url: '', source: 'youtube' })
  }
  }, [setVideoSource, setVideoUrl])

  const handleStartScreenshare = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always' } as MediaTrackConstraints,
        audio: true,
      })
      screenStreamRef.current = stream
      setIsScreenSharing(true)
      setVideoSource('screen')
      setIsPlaying(true)

      // Set the video element source
      if (screenVideoRef.current) {
        screenVideoRef.current.srcObject = stream
        screenVideoRef.current.play().catch(() => {})
      }

       // Notify room
       if (socketRef.current) {
         socketRef.current.emit('video-load-source', { source: 'screen' })
       }

      // Listen for stream ending (user clicks "Stop sharing")
      stream.getVideoTracks()[0].onended = () => {
        handleStopScreenshare()
      }
    } catch (err) {
      console.error('Screenshare failed:', err)
    }
  }

  // ─── File Upload Handler ───
  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    setUploadProgress(0)

    const formData = new FormData()
    formData.append('video', file)

    try {
      const xhr = new XMLHttpRequest()
      xhr.open('POST', '/api/upload')

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100)
          setUploadProgress(percent)
        }
      }

      xhr.onload = () => {
        if (xhr.status === 201) {
          const response = JSON.parse(xhr.responseText)
          const fileUrl = response.url

          // Load the uploaded file as a video source
          setVideoUrl(fileUrl)
          setVideoSource('file')
          setIsPlayerLoading(true)
          setActiveTab(null)

           // Broadcast to room
           if (socketRef.current) {
             socketRef.current.emit('video-load', { url: fileUrl, source: 'file' })
           }
        } else {
          console.error('Upload failed:', xhr.statusText)
        }
        setIsUploading(false)
        setUploadProgress(0)
      }

      xhr.onerror = () => {
        console.error('Upload error')
        setIsUploading(false)
        setUploadProgress(0)
      }

      xhr.send(formData)
    } catch (err) {
      console.error('Upload error:', err)
      setIsUploading(false)
    }

    // Reset the file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [setVideoUrl, setVideoSource])

  // ─── VBrowser Handler ───
  const handleStartVBrowser = useCallback(() => {
    setIsVBrowserActive(true)
    setVideoSource('iframe')
    setVideoUrl(vbrowserUrl)
    setIsPlaying(true)
    setActiveTab(null)

     // Broadcast to room
     if (socketRef.current) {
       socketRef.current.emit('video-load', { url: vbrowserUrl, source: 'iframe' })
     }
  }, [vbrowserUrl, setVideoUrl, setVideoSource])

  const handleStopVBrowser = useCallback(() => {
    setIsVBrowserActive(false)
    setVideoSource('youtube')
    setVideoUrl('')
    setIsPlaying(false)
  }, [setVideoUrl, setVideoSource])

  // ─── Render the video player based on source type ───
  const renderVideoPlayer = () => {
    if (!hasVideo) {
      return (
        <div className="flex-1 flex items-center justify-center bg-[#1b1b1b] relative">
          <div className="bg-[#8B6914] text-white px-6 py-4 rounded-lg flex items-center gap-3 max-w-md">
            <div>
              <div className="font-bold text-lg">You&apos;re not watching anything!</div>
              <div className="text-white/80 text-sm">Paste any video URL above to start watching.</div>
              <div className="text-white/60 text-xs mt-2">Supports: YouTube, Twitch, Vimeo, direct video links (mp4, webm), and more</div>
            </div>
            <Link2 className="w-6 h-6 text-[#2185d0] shrink-0" />
          </div>
          {/* Floating reactions */}
          <div className="absolute bottom-4 left-0 right-0 pointer-events-none">
            {floatingReactions.map(r => (
              <span key={r.id} className="absolute text-3xl animate-float-up" style={{ left: `${r.x}%` }}>{r.emoji}</span>
            ))}
          </div>
        </div>
      )
    }

    // YouTube Player
    if (videoSource === 'youtube' && youtubeId) {
      return (
        <div ref={playerContainerRef} className="flex-1 bg-black relative">
          <div id="yt-player-container" className="w-full h-full">
            <div id="yt-player" />
          </div>
          {isPlayerLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <div className="animate-spin w-8 h-8 border-2 border-white border-t-transparent rounded-full" />
            </div>
          )}
          <div className="absolute bottom-4 left-0 right-0 pointer-events-none">
            {floatingReactions.map(r => (
              <span key={r.id} className="absolute text-3xl animate-float-up" style={{ left: `${r.x}%` }}>{r.emoji}</span>
            ))}
          </div>
        </div>
      )
    }

    // Direct Video (HTML5 video element)
    if (videoSource === 'direct') {
      return (
        <div className="flex-1 bg-black relative flex items-center justify-center">
          <video
            ref={htmlVideoRef}
            src={videoUrl}
            autoPlay
            controls
            playsInline
            className="w-full h-full max-h-full object-contain"
            onLoadedData={() => {
              setPlayerReady(true)
              setIsPlayerLoading(false)
            }}
            onEnded={() => {
              if (socketRef.current) {
                socketRef.current.emit('video-end', {})
              }
            }}
          >
            Your browser does not support the video tag.
          </video>
          {isPlayerLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 pointer-events-none">
              <div className="animate-spin w-8 h-8 border-2 border-white border-t-transparent rounded-full" />
            </div>
          )}
          <div className="absolute bottom-4 left-0 right-0 pointer-events-none">
            {floatingReactions.map(r => (
              <span key={r.id} className="absolute text-3xl animate-float-up" style={{ left: `${r.x}%` }}>{r.emoji}</span>
            ))}
          </div>
        </div>
      )
    }

    // Twitch Player
    if (videoSource === 'twitch') {
      const channel = extractTwitchChannel(videoUrl)
      const video = extractTwitchVideo(videoUrl)
      const twitchSrc = video
        ? `https://player.twitch.tv/?video=${video}&parent=${typeof window !== 'undefined' ? window.location.hostname : 'localhost'}`
        : channel
          ? `https://player.twitch.tv/?channel=${channel}&parent=${typeof window !== 'undefined' ? window.location.hostname : 'localhost'}`
          : null

      return (
        <div className="flex-1 bg-black relative">
          {twitchSrc ? (
            <iframe
              src={twitchSrc}
              className="w-full h-full"
              allowFullScreen
              allow="autoplay; fullscreen"
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400">
              <p>Could not parse Twitch URL</p>
            </div>
          )}
          {isPlayerLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 pointer-events-none">
              <div className="animate-spin w-8 h-8 border-2 border-white border-t-transparent rounded-full" />
            </div>
          )}
          <div className="absolute bottom-4 left-0 right-0 pointer-events-none">
            {floatingReactions.map(r => (
              <span key={r.id} className="absolute text-3xl animate-float-up" style={{ left: `${r.x}%` }}>{r.emoji}</span>
            ))}
          </div>
        </div>
      )
    }

    // Vimeo Player
    if (videoSource === 'vimeo') {
      const vimeoId = extractVimeoId(videoUrl)
      return (
        <div className="flex-1 bg-black relative">
          {vimeoId ? (
            <iframe
              src={`https://player.vimeo.com/video/${vimeoId}?autoplay=1`}
              className="w-full h-full"
              allowFullScreen
              allow="autoplay; fullscreen"
            />
          ) : (
            <iframe
              src={videoUrl}
              className="w-full h-full"
              allowFullScreen
              allow="autoplay; fullscreen"
              sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
            />
          )}
          <div className="absolute bottom-4 left-0 right-0 pointer-events-none">
            {floatingReactions.map(r => (
              <span key={r.id} className="absolute text-3xl animate-float-up" style={{ left: `${r.x}%` }}>{r.emoji}</span>
            ))}
          </div>
        </div>
      )
    }

    // Screenshare Player
    if (videoSource === 'screen') {
      return (
        <div className="flex-1 bg-black relative flex items-center justify-center">
          <video
            ref={screenVideoRef}
            autoPlay
            playsInline
            muted={isScreenSharing}
            className="w-full h-full max-h-full object-contain"
          />
          {!isScreenSharing && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60">
              <div className="text-center">
                <MonitorPlay className="w-12 h-12 text-[#2185d0] mx-auto mb-2" />
                <p className="text-gray-300 text-sm">Screen share in progress</p>
                <p className="text-gray-500 text-xs mt-1">The broadcaster&apos;s screen is being shared</p>
              </div>
            </div>
          )}
          <div className="absolute bottom-4 left-0 right-0 pointer-events-none">
            {floatingReactions.map(r => (
              <span key={r.id} className="absolute text-3xl animate-float-up" style={{ left: `${r.x}%` }}>{r.emoji}</span>
            ))}
          </div>
        </div>
      )
    }

    // File Video Player (uploaded files - same as direct but with 'file' source)
    if (videoSource === 'file') {
      return (
        <div className="flex-1 bg-black relative flex items-center justify-center">
          <video
            ref={htmlVideoRef}
            src={videoUrl}
            autoPlay
            controls
            playsInline
            className="w-full h-full max-h-full object-contain"
            onLoadedData={() => {
              setPlayerReady(true)
              setIsPlayerLoading(false)
            }}
            onEnded={() => {
              if (socketRef.current) {
                socketRef.current.emit('video-end', {})
              }
            }}
          >
            Your browser does not support the video tag.
          </video>
          {isPlayerLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 pointer-events-none">
              <div className="animate-spin w-8 h-8 border-2 border-white border-t-transparent rounded-full" />
            </div>
          )}
          <div className="absolute bottom-4 left-0 right-0 pointer-events-none">
            {floatingReactions.map(r => (
              <span key={r.id} className="absolute text-3xl animate-float-up" style={{ left: `${r.x}%` }}>{r.emoji}</span>
            ))}
          </div>
        </div>
      )
    }

    // Generic iframe embed (for other URLs / VBrowser)
    if (videoSource === 'iframe') {
      return (
        <div className="flex-1 bg-black relative">
          <iframe
            src={videoUrl}
            className="w-full h-full"
            allowFullScreen
            allow="autoplay; fullscreen"
            sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
          />
          <div className="absolute bottom-4 left-0 right-0 pointer-events-none">
            {floatingReactions.map(r => (
              <span key={r.id} className="absolute text-3xl animate-float-up" style={{ left: `${r.x}%` }}>{r.emoji}</span>
            ))}
          </div>
        </div>
      )
    }

    // Fallback
    return (
      <div className="flex-1 flex items-center justify-center bg-[#1b1b1b]">
        <div className="text-gray-400 text-center">
          <p>Unsupported video source</p>
          <a href={videoUrl} target="_blank" rel="noopener noreferrer" className="text-[#2185d0] hover:underline text-sm mt-2 inline-flex items-center gap-1">
            Open in new tab <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    )
  }

  // ─── Render video controls bar ───
  const renderVideoControls = () => {
    if (!hasVideo) return null

    // Only show custom controls for YouTube and direct video
    if (videoSource === 'youtube' && youtubeId && playerReady) {
      return (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-[#222] border-t border-[#333] shrink-0">
          <button
            onClick={() => {
              if (playerRef.current) {
                if (isPlaying) playerRef.current.pauseVideo()
                else playerRef.current.playVideo()
              }
            }}
            className="text-white hover:text-gray-300 p-1"
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
          <button
            onClick={() => {
              if (playerRef.current) {
                if (isMuted) playerRef.current.unMute()
                else playerRef.current.mute()
                setIsMuted(!isMuted)
              }
            }}
            className="text-white hover:text-gray-300 p-1"
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-1">
            {EMOJI_REACTIONS.slice(0, 5).map(emoji => (
              <button key={emoji} onClick={() => handleReaction(emoji)} className="hover:scale-125 transition-transform text-base p-0.5">
                {emoji}
              </button>
            ))}
          </div>
          <button onClick={() => setIsTheaterMode(!isTheaterMode)} className="text-white hover:text-gray-300 p-1" title="Theater mode">
            <Maximize className="w-4 h-4" />
          </button>
        </div>
      )
    }

    // Direct video controls (HTML5 video has native controls, just add reactions + theater)
    if (videoSource === 'direct' || videoSource === 'file') {
      return (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-[#222] border-t border-[#333] shrink-0">
          <button
            onClick={() => {
              if (htmlVideoRef.current) {
                if (isPlaying) htmlVideoRef.current.pause()
                else htmlVideoRef.current.play().catch(() => {})
              }
            }}
            className="text-white hover:text-gray-300 p-1"
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
          <button
            onClick={() => {
              if (htmlVideoRef.current) {
                htmlVideoRef.current.muted = !isMuted
                setIsMuted(!isMuted)
              }
            }}
            className="text-white hover:text-gray-300 p-1"
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          {videoSource === 'file' && <span className="text-xs text-gray-400">Uploaded file</span>}
          <div className="flex-1" />
          <div className="flex items-center gap-1">
            {EMOJI_REACTIONS.slice(0, 5).map(emoji => (
              <button key={emoji} onClick={() => handleReaction(emoji)} className="hover:scale-125 transition-transform text-base p-0.5">
                {emoji}
              </button>
            ))}
          </div>
          <button onClick={() => setIsTheaterMode(!isTheaterMode)} className="text-white hover:text-gray-300 p-1" title="Theater mode">
            <Maximize className="w-4 h-4" />
          </button>
        </div>
      )
    }

    // Screenshare controls
    if (videoSource === 'screen') {
      return (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-[#222] border-t border-[#333] shrink-0">
          <span className="text-xs text-[#2185d0] flex items-center gap-1"><ScreenShare className="w-3 h-3" /> Screenshare</span>
          {isScreenSharing && (
            <Button size="sm" variant="destructive" className="h-6 text-xs gap-1 px-2" onClick={handleStopScreenshare}>
              <StopCircle className="w-3 h-3" /> Stop
            </Button>
          )}
          <div className="flex-1" />
          <div className="flex items-center gap-1">
            {EMOJI_REACTIONS.slice(0, 5).map(emoji => (
              <button key={emoji} onClick={() => handleReaction(emoji)} className="hover:scale-125 transition-transform text-base p-0.5">
                {emoji}
              </button>
            ))}
          </div>
          <button onClick={() => setIsTheaterMode(!isTheaterMode)} className="text-white hover:text-gray-300 p-1" title="Theater mode">
            <Maximize className="w-4 h-4" />
          </button>
        </div>
      )
    }

    // For iframe-based players (Twitch, Vimeo, generic), show limited controls
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-[#222] border-t border-[#333] shrink-0">
        <span className="text-xs text-gray-400 capitalize">{videoSource} player</span>
        <div className="flex-1" />
        <div className="flex items-center gap-1">
          {EMOJI_REACTIONS.slice(0, 5).map(emoji => (
            <button key={emoji} onClick={() => handleReaction(emoji)} className="hover:scale-125 transition-transform text-base p-0.5">
              {emoji}
            </button>
          ))}
        </div>
        <button onClick={() => setIsTheaterMode(!isTheaterMode)} className="text-white hover:text-gray-300 p-1" title="Theater mode">
          <Maximize className="w-4 h-4" />
        </button>
        <a href={videoUrl} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white p-1" title="Open in new tab">
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>
    )
  }

  // ─── URL Search Input with hints ───
  const renderUrlInput = () => (
    <div className="px-3 py-1.5 bg-[#222] border-b border-[#333] shrink-0 relative">
      <div className="flex items-center gap-2">
        <div className="flex-1 relative">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
            <Input
              value={urlInput}
              onChange={(e) => handleUrlInputChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && urlInput.trim()) {
                  handleLoadVideo()
                }
              }}
              onFocus={() => {
                if (urlInput.trim() && !isUrl(urlInput.trim())) {
                  setShowSearchDropdown(true)
                }
              }}
              onBlur={() => {
                // Delay to allow click on dropdown
                setTimeout(() => setShowSearchDropdown(false), 200)
              }}
              placeholder="Paste any URL — YouTube, Twitch, Vimeo, video files (mp4, webm)... or search YouTube"
              className="bg-[#333] border-[#555] text-white placeholder:text-gray-500 focus:border-[#2185d0] focus:ring-[#2185d0] h-9 text-sm pl-8 pr-8"
            />
            {urlInput && (
              <button onClick={() => { setUrlInput(''); setShowSearchDropdown(false) }} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          {/* Search hint dropdown */}
          {showSearchDropdown && urlInput.trim() && !isUrl(urlInput.trim()) && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-[#333] border border-[#555] rounded shadow-lg z-20 overflow-hidden">
              <button
                onClick={() => {
                  window.open(buildYouTubeSearchUrl(urlInput.trim()), '_blank')
                  setShowSearchDropdown(false)
                  setUrlInput('')
                }}
                className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-[#444] flex items-center gap-2"
              >
                <Search className="w-3.5 h-3.5 text-[#2185d0]" />
                Search YouTube for &quot;<span className="text-white font-medium">{urlInput.trim()}</span>&quot;
              </button>
            </div>
          )}
          {/* URL type indicator */}
          {urlInput.trim() && isUrl(urlInput.trim()) && (
            <div className="absolute top-full left-0 right-0 mt-1 z-20 pointer-events-none">
              <div className="bg-[#333] border border-[#555] rounded px-3 py-1.5 text-xs text-gray-400 flex items-center gap-1.5">
                {(() => {
                  const detected = detectVideoSource(urlInput.trim())
                  const sourceLabels: Record<string, string> = {
                    youtube: 'YouTube Video',
                    direct: 'Direct Video File',
                    twitch: 'Twitch Stream',
                    vimeo: 'Vimeo Video',
                    iframe: 'Web Page (iframe)',
                    file: 'Uploaded File',
                    screen: 'Screen Share',
                  }
                  const sourceIcons: Record<string, string> = {
                    youtube: '🎥',
                    direct: '🎬',
                    twitch: '🎮',
                    vimeo: '📹',
                    iframe: '🌐',
                    file: '📁',
                    screen: '🖥️',
                  }
                  return (
                    <>
                      <span>{sourceIcons[detected.source] || '🔗'}</span>
                      <span>Will load as: <span className="text-white">{sourceLabels[detected.source] || detected.source}</span></span>
                      {detected.source === 'iframe' && (
                        <span className="text-yellow-400 ml-1">(embed may not work for all sites)</span>
                      )}
                    </>
                  )
                })()}
              </div>
            </div>
          )}
        </div>
        <Button
          onClick={() => handleLoadVideo()}
          size="sm"
          className="bg-[#2185d0] hover:bg-[#1a6db5] text-white h-9 px-3"
          disabled={!urlInput.trim()}
        >
          <Play className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )

  // ─── HEADER (shared) ───
  const renderHeader = () => (
    <header className="flex items-center justify-between px-2 sm:px-3 py-1 bg-[#1b1b1b] border-b border-[#333] shrink-0">
      <div className="flex items-center gap-2">
        <a href="/" className="flex items-center no-underline" onClick={(e) => { e.preventDefault(); handleLeave() }}>
          <img src="/logo-icon.png" alt="WatchParty" className="w-10 h-10" />
          <span className="text-[22px] font-bold uppercase text-[#2185d0] leading-[22px]">Watch</span>
          <span className="text-[22px] font-bold uppercase text-[#21ba45] leading-[22px]">Party</span>
        </a>
        {isUsernameSet && (
          <div className={`flex items-center gap-1 text-[10px] ${isConnected ? 'text-green-400' : 'text-red-400'}`}>
            <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400 animate-pulse'}`} />
            {isConnected ? 'Connected' : 'Connecting...'}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        <Button size="sm" className="bg-[#2185d0] hover:bg-[#1a6db5] text-white font-semibold gap-1.5 h-8" onClick={handleNewRoom}>
          <CirclePlus className="w-4 h-4" />
          <span className="hidden sm:inline">New Room</span>
        </Button>
        <Button size="sm" variant="ghost" className="text-gray-400 hover:text-white gap-1.5 h-8">
          <LogIn className="w-4 h-4" />
          <span className="hidden sm:inline">Sign in</span>
        </Button>
      </div>
    </header>
  )

  // ─── Tab Bar ───
  const renderTabBar = () => (
    <div className="px-3 py-1 bg-[#222] border-b border-[#333] shrink-0">
      <div className="flex items-center gap-2">
        {TAB_ITEMS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(activeTab === tab.id ? null : tab.id)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-white text-xs font-medium ${tab.color} ${activeTab === tab.id ? 'ring-2 ring-white/30' : 'opacity-80 hover:opacity-100'} transition-opacity`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
            {tab.id === 'playlist' && playlist.length > 0 && (
              <span className="bg-white/20 text-white text-[10px] rounded-full px-1 min-w-[16px] text-center">{playlist.length}</span>
            )}
          </button>
        ))}
        {isUsernameSet && (
          <div className="ml-auto flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={handleCopyLink} className="text-gray-400 hover:text-white gap-1 h-7 px-2 text-xs">
              {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied!' : 'Share'}
            </Button>
          </div>
        )}
      </div>
    </div>
  )

  // ─── Playlist panel (enhanced) ───
  const renderPlaylistPanel = () => {
    if (activeTab !== 'playlist') return null
    return (
      <div className="bg-[#1a1a1a] border-t border-[#333] p-2.5 max-h-64 overflow-y-auto shrink-0">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-gray-300">Playlist ({playlist.length})</span>
          <div className="flex items-center gap-1">
            {playlist.length > 0 && (
              <>
                <Button onClick={handlePlaylistPlayNext} size="sm" className="bg-[#2185d0] text-white h-7 px-2 text-xs gap-1" title="Play next">
                  <SkipForward className="w-3 h-3" /> Next
                </Button>
                <Button onClick={handlePlaylistClear} size="sm" variant="ghost" className="text-red-400 hover:text-red-300 h-7 px-2 text-xs gap-1" title="Clear all">
                  <Trash2 className="w-3 h-3" /> Clear
                </Button>
              </>
            )}
            <button onClick={() => setActiveTab(null)} className="text-gray-500 hover:text-white ml-1">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        {/* Add to playlist input */}
        <div className="flex items-center gap-1 mb-2">
          <Input
            placeholder="Add URL to playlist..."
            className="bg-[#333] border-[#555] text-white h-7 text-xs flex-1"
            onKeyDown={(e) => { if (e.key === 'Enter') handlePlaylistAdd() }}
            onChange={(e) => setPlaylistInput(e.target.value)}
            value={playlistInput}
          />
          <Button onClick={handlePlaylistAdd} size="sm" className="bg-[#2185d0] text-white h-7 px-2">
            <Plus className="w-3 h-3" />
          </Button>
        </div>
        {playlist.length === 0 && (
          <div className="text-gray-500 text-xs text-center py-3">
            <ListVideo className="w-8 h-8 mx-auto mb-1 opacity-40" />
            No videos in queue. Add URLs above.
          </div>
        )}
        {playlist.map((item, idx) => (
          <div key={item.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/5 group">
            <GripVertical className="w-3 h-3 text-gray-600" />
            <span className="text-xs text-gray-500 w-4">{idx + 1}</span>
            <span className="text-xs text-gray-300 truncate flex-1">{item.title}</span>
            <button
              onClick={() => handleLoadVideo(item.url)}
              className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-green-400 transition-opacity"
              title="Play now"
            >
              <Play className="w-3 h-3" />
            </button>
            <button
              onClick={() => handlePlaylistRemove(item.id)}
              className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 transition-opacity"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
    )
  }

  // ─── Tab content panels (fully functional) ───
  const renderTabContent = () => {
    if (activeTab === 'screenshare') {
      return (
        <div className="bg-[#1a1a1a] border-t border-[#333] p-4 max-h-64 overflow-y-auto shrink-0">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-gray-300 flex items-center gap-1.5">
              <ScreenShare className="w-4 h-4 text-[#2185d0]" /> Screenshare
            </span>
            <button onClick={() => setActiveTab(null)} className="text-gray-500 hover:text-white"><X className="w-4 h-4" /></button>
          </div>
          <p className="text-xs text-gray-400 mb-3">Share your screen, window, or browser tab with everyone in the room. Others will see your screen in real-time.</p>
          {isScreenSharing ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs text-green-400">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                Currently sharing your screen
              </div>
              <Button size="sm" variant="destructive" className="h-7 text-xs gap-1" onClick={handleStopScreenshare}>
                <StopCircle className="w-3.5 h-3.5" /> Stop Sharing
              </Button>
            </div>
          ) : (
            <Button size="sm" className="bg-[#2185d0] hover:bg-[#1a6db5] text-white gap-1.5" onClick={handleStartScreenshare}>
              <ScreenShare className="w-4 h-4" />
              Start Screenshare
            </Button>
          )}
        </div>
      )
    }
    if (activeTab === 'vbrowser') {
      return (
        <div className="bg-[#1a1a1a] border-t border-[#333] p-4 max-h-64 overflow-y-auto shrink-0">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-gray-300 flex items-center gap-1.5">
              <MonitorPlay className="w-4 h-4 text-[#21ba45]" /> VBrowser
            </span>
            <button onClick={() => setActiveTab(null)} className="text-gray-500 hover:text-white"><X className="w-4 h-4" /></button>
          </div>
          <p className="text-xs text-gray-400 mb-3">Launch a virtual browser that everyone in the room can see. Navigate to any website and watch together.</p>
          {isVBrowserActive ? (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs text-green-400 mb-2">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                VBrowser is active
              </div>
              <div className="flex items-center gap-1">
                <Input
                  value={vbrowserUrl}
                  onChange={(e) => setVbrowserUrl(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleStartVBrowser() }}
                  placeholder="Enter URL to browse..."
                  className="bg-[#333] border-[#555] text-white h-7 text-xs flex-1"
                />
                <Button size="sm" className="bg-[#21ba45] text-white h-7 px-2 text-xs gap-1" onClick={handleStartVBrowser}>
                  <Globe className="w-3 h-3" /> Go
                </Button>
              </div>
              <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-300 h-7 text-xs gap-1" onClick={handleStopVBrowser}>
                <MonitorOff className="w-3.5 h-3.5" /> Close VBrowser
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-1">
                <Input
                  value={vbrowserUrl}
                  onChange={(e) => setVbrowserUrl(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleStartVBrowser() }}
                  placeholder="Enter URL to browse..."
                  className="bg-[#333] border-[#555] text-white h-7 text-xs flex-1"
                />
              </div>
              <Button size="sm" className="bg-[#21ba45] hover:bg-[#19a23a] text-white gap-1.5" onClick={handleStartVBrowser}>
                <MonitorPlay className="w-4 h-4" />
                Start VBrowser
              </Button>
            </div>
          )}
        </div>
      )
    }
    if (activeTab === 'file') {
      return (
        <div className="bg-[#1a1a1a] border-t border-[#333] p-4 max-h-64 overflow-y-auto shrink-0">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-gray-300 flex items-center gap-1.5">
              <FileUp className="w-4 h-4 text-[#7c4dff]" /> File Upload
            </span>
            <button onClick={() => setActiveTab(null)} className="text-gray-500 hover:text-white"><X className="w-4 h-4" /></button>
          </div>
          <p className="text-xs text-gray-400 mb-3">Upload a video file from your computer to share with everyone in the room. Supports MP4, WebM, OGG, MOV, and more (up to 500MB).</p>
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*,.mp4,.webm,.ogg,.ogv,.mov,.m4v,.avi,.mkv"
            className="hidden"
            onChange={handleFileUpload}
          />
          {isUploading ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 text-[#7c4dff] animate-spin" />
                <span className="text-xs text-gray-300">Uploading... {uploadProgress}%</span>
              </div>
              <div className="w-full bg-[#333] rounded-full h-1.5">
                <div
                  className="bg-[#7c4dff] h-1.5 rounded-full transition-all"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          ) : (
            <Button
              size="sm"
              className="bg-[#7c4dff] hover:bg-[#6a3de8] text-white gap-1.5"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-4 h-4" />
              Upload Video File
            </Button>
          )}
        </div>
      )
    }
    return renderPlaylistPanel()
  }

  // ─── Chat sidebar content ───
  const renderChatSidebar = () => (
    <div className={`w-80 lg:w-96 bg-[#1a1a1a] border-l border-[#333] flex flex-col shrink-0 
      ${mobileShowChat ? 'fixed inset-y-0 right-0 z-50 md:static' : 'hidden md:flex'}`}>

      {mobileShowChat && (
        <div className="md:hidden flex items-center justify-end p-2 bg-[#222] border-b border-[#333]">
          <button onClick={() => setMobileShowChat(false)} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Username row */}
      <div className="flex items-center gap-2 p-2 border-b border-[#333] shrink-0">
        <div
          className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
          style={{
            backgroundColor: roomUsers.find(u => u.id === currentSocketId)?.color + '33' || '#2185d033',
            color: roomUsers.find(u => u.id === currentSocketId)?.color || '#2185d0',
          }}
        >
          {username.charAt(0).toUpperCase()}
        </div>
        <span className="text-sm text-gray-300 truncate">{username}</span>
        <div className="ml-auto">
          <Button onClick={handleLeave} size="sm" variant="ghost" className="text-red-400 hover:text-red-300 hover:bg-red-400/10 h-7 px-2 text-xs">
            Leave
          </Button>
        </div>
      </div>

      {/* Sidebar tabs */}
      <div className="flex border-b border-[#333] shrink-0">
        <button
          onClick={() => setSidebarTab('chat')}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${sidebarTab === 'chat' ? 'text-white bg-[#444]' : 'text-gray-400 hover:text-white hover:bg-[#333]'}`}
        >
          <MessageCircle className="w-3.5 h-3.5" />
          Chat
        </button>
        <button
          onClick={() => setSidebarTab('people')}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${sidebarTab === 'people' ? 'text-white bg-[#444]' : 'text-gray-400 hover:text-white hover:bg-[#333]'}`}
        >
          <Users className="w-3.5 h-3.5" />
          People
          <span className="bg-[#2185d0] text-white text-[10px] rounded-full px-1 min-w-[14px] text-center">{roomUsers.length}</span>
        </button>
        <button
          onClick={() => setSidebarTab('settings')}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${sidebarTab === 'settings' ? 'text-white bg-[#444]' : 'text-gray-400 hover:text-white hover:bg-[#333]'}`}
        >
          <Settings className="w-3.5 h-3.5" />
          Settings
        </button>
      </div>

      {/* Sidebar content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {sidebarTab === 'chat' && (
          <>
            <ScrollArea className="flex-1 p-2.5">
              <div className="space-y-1.5">
                {messages.length === 0 && (
                  <div className="text-center py-4 text-gray-500 text-sm">No messages yet. Say hi!</div>
                )}
                {messages.map((msg) => (
                  <div key={msg.id} className={`px-2 py-1 rounded text-sm ${msg.type === 'system' ? 'text-gray-500 italic text-xs' : ''}`}>
                    {msg.type === 'user' && (
                      <span className="font-semibold mr-1" style={{ color: msg.color }}>{msg.username}</span>
                    )}
                    <span className={msg.type === 'system' ? '' : 'text-gray-300'}>{msg.content}</span>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
            </ScrollArea>
            <div className="p-2 border-t border-[#333] shrink-0">
              <div className="flex items-center gap-1.5">
                <Input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSendMessage() }}
                  placeholder="Send a message..."
                  className="bg-[#333] border-[#555] text-white h-8 text-sm focus:border-[#2185d0] flex-1"
                />
                <Button onClick={handleSendMessage} size="sm" className="bg-[#2185d0] hover:bg-[#1a6db5] text-white h-8 px-2.5">
                  <Send className="w-3.5 h-3.5" />
                </Button>
                <div className="relative">
                  <Button
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    size="sm"
                    variant="ghost"
                    className="text-gray-400 hover:text-white h-8 px-1.5"
                  >
                    <SmilePlus className="w-4 h-4" />
                  </Button>
                  {showEmojiPicker && (
                    <div className="absolute bottom-full right-0 mb-1 bg-[#333] border border-[#555] rounded-lg p-2 shadow-lg z-10">
                      <div className="grid grid-cols-4 gap-1">
                        {EMOJI_REACTIONS.map(emoji => (
                          <button
                            key={emoji}
                            onClick={() => { handleReaction(emoji); setShowEmojiPicker(false) }}
                            className="hover:scale-125 transition-transform text-lg p-1"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {sidebarTab === 'people' && (
          <div className="p-2.5 flex-1 overflow-y-auto">
            {roomUsers.length === 0 && (
              <div className="text-center py-4 text-gray-500 text-sm">No one here yet</div>
            )}
            {roomUsers.map((user) => (
              <div key={user.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/5">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                  style={{ backgroundColor: user.color + '33', color: user.color }}
                >
                  {user.username.charAt(0).toUpperCase()}
                </div>
                <span className="text-sm" style={{ color: user.color }}>{user.username}</span>
                {user.id === currentSocketId && <span className="text-xs text-gray-500">(you)</span>}
              </div>
            ))}
          </div>
        )}

        {sidebarTab === 'settings' && (
          <div className="p-2.5 flex-1 overflow-y-auto space-y-3">
            <div className="text-sm text-gray-400">Room Settings</div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">Theater Mode</span>
                <Button size="sm" variant="ghost" onClick={() => setIsTheaterMode(!isTheaterMode)} className="text-gray-400 hover:text-white h-7 px-2 text-xs">
                  {isTheaterMode ? 'On' : 'Off'}
                </Button>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">Room Link</span>
                <Button size="sm" variant="ghost" onClick={handleCopyLink} className="text-gray-400 hover:text-white h-7 px-2 text-xs gap-1">
                  <Copy className="w-3 h-3" />
                  Copy
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )

  // ─── NOT JOINED YET ───
  if (!isUsernameSet) {
    return (
      <div className="min-h-screen bg-[#1b1b1b] text-white flex flex-col">
        {renderHeader()}
        {renderUrlInput()}
        {renderTabBar()}

        {/* Main area - empty state */}
        <div className="flex-1 flex items-center justify-center relative">
          <div className="bg-[#8B6914] text-white px-6 py-4 rounded-lg flex items-center gap-3 max-w-md">
            <div>
              <div className="font-bold text-lg">You&apos;re not watching anything!</div>
              <div className="text-white/80 text-sm">Paste any URL above, then join to start watching.</div>
              <div className="text-white/60 text-xs mt-2">YouTube • Twitch • Vimeo • Direct video links (mp4, webm)</div>
            </div>
            <Link2 className="w-6 h-6 text-[#2185d0] shrink-0" />
          </div>

          <div className="absolute bottom-4 left-0 right-0 pointer-events-none">
            {floatingReactions.map(r => (
              <span key={r.id} className="absolute text-3xl animate-float-up" style={{ left: `${r.x}%` }}>{r.emoji}</span>
            ))}
          </div>
        </div>

        {/* Right sidebar - Username + People + Settings */}
        <div className="w-full bg-[#1a1a1a] border-t border-[#333] shrink-0 md:w-80 md:border-l md:border-t-0 md:fixed md:right-0 md:top-0 md:bottom-0 md:flex md:flex-col">
          {/* Username row */}
          <div className="flex items-center gap-2 p-2.5 border-b border-[#333]">
            <User className="w-5 h-5 text-gray-400 shrink-0" />
            <Input
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleJoin() }}
              placeholder="Username"
              className="bg-[#333] border-[#555] text-white h-8 text-sm focus:border-[#2185d0] flex-1"
            />
            <Button
              onClick={() => setNameInput(generateName())}
              size="sm"
              variant="ghost"
              className="text-[#2185d0] hover:text-[#1a6db5] hover:bg-[#2185d0]/10 px-2 h-8"
              title="Random name"
            >
              <Shuffle className="w-3.5 h-3.5" />
            </Button>
            <Button
              onClick={handleJoin}
              size="sm"
              className="bg-[#21ba45] hover:bg-[#19a23a] text-white px-3 h-8 font-semibold"
            >
              Join
            </Button>
          </div>

          {/* Sidebar tabs */}
          <div className="flex border-b border-[#333]">
            <button
              onClick={() => setSidebarTab('people')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${sidebarTab === 'people' ? 'text-white bg-[#444]' : 'text-gray-400 hover:text-white hover:bg-[#333]'}`}
            >
              <Users className="w-3.5 h-3.5" />
              People
              <span className="bg-[#2185d0] text-white text-[10px] rounded-full px-1 min-w-[14px] text-center">{roomUsers.length}</span>
            </button>
            <button
              onClick={() => setSidebarTab('chat')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${sidebarTab === 'chat' ? 'text-white bg-[#444]' : 'text-gray-400 hover:text-white hover:bg-[#333]'}`}
            >
              <MessageCircle className="w-3.5 h-3.5" />
              Chat
            </button>
            <button
              onClick={() => setSidebarTab('settings')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${sidebarTab === 'settings' ? 'text-white bg-[#444]' : 'text-gray-400 hover:text-white hover:bg-[#333]'}`}
            >
              <Settings className="w-3.5 h-3.5" />
              Settings
            </button>
          </div>

          {/* Sidebar content */}
          <div className="max-h-48 md:max-h-none md:flex-1 overflow-y-auto">
            {sidebarTab === 'people' && (
              <div className="p-2.5">
                {roomUsers.length === 0 && (
                  <div className="text-center py-4 text-gray-500 text-sm">No one here yet</div>
                )}
                {roomUsers.map((user) => (
                  <div key={user.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/5">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                      style={{ backgroundColor: user.color + '33', color: user.color }}
                    >
                      {user.username.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm" style={{ color: user.color }}>{user.username}</span>
                  </div>
                ))}
              </div>
            )}

            {sidebarTab === 'chat' && (
              <div className="p-2.5">
                <div className="text-center py-4 text-gray-500 text-sm">
                  Join the room to start chatting
                </div>
              </div>
            )}

            {sidebarTab === 'settings' && (
              <div className="p-2.5 space-y-3">
                <div className="text-sm text-gray-400">Room Settings</div>
                <div className="text-xs text-gray-500">Settings will be available after joining.</div>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ─── JOINED ROOM ───
  return (
    <div className={`min-h-screen bg-[#1b1b1b] text-white flex flex-col ${isTheaterMode ? 'fixed inset-0 z-50' : ''}`}>
      {renderHeader()}
      {renderUrlInput()}
      {renderTabBar()}

      {/* Main content area - video + sidebar */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left column - Video */}
        <div className="flex-1 flex flex-col min-w-0 relative">
          {renderVideoPlayer()}
          {renderVideoControls()}
          {renderTabContent()}

          {/* Mobile chat toggle */}
          <button
            onClick={() => setMobileShowChat(!mobileShowChat)}
            className="md:hidden fixed bottom-4 right-4 bg-[#2185d0] text-white w-12 h-12 rounded-full flex items-center justify-center shadow-lg z-50"
          >
            <MessageCircle className="w-6 h-6" />
          </button>
        </div>

        {/* Right sidebar */}
        {renderChatSidebar()}
      </div>
    </div>
  )
}
