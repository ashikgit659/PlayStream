import { create } from 'zustand'

export type ViewMode = 'landing' | 'room'
export type VideoSource = 'youtube' | 'direct' | 'twitch' | 'vimeo' | 'iframe' | 'file' | 'screen'

export interface ChatMessage {
  id: string
  username: string
  color: string
  content: string
  timestamp: number
  type: 'user' | 'system'
}

export interface RoomUser {
  id: string
  username: string
  color: string
}

export interface ReactionData {
  emoji: string
  username: string
  color: string
  timestamp: number
}

export interface PlaylistItem {
  id: string
  url: string
  title: string
  addedBy: string
}

interface WatchPartyState {
  // View
  viewMode: ViewMode
  
  // Room
  roomId: string
  username: string
  isUsernameSet: boolean
  isConnected: boolean
  
  // Users
  roomUsers: RoomUser[]
  
  // Chat
  messages: ChatMessage[]
  
  // Video
  videoUrl: string
  videoSource: VideoSource
  videoState: 'playing' | 'paused'
  videoTime: number
  
  // Reactions
  reactions: ReactionData[]
  
  // Playlist
  playlist: PlaylistItem[]
  
  // Theater mode
  isTheaterMode: boolean
  
  // Actions
  setViewMode: (mode: ViewMode) => void
  setRoomId: (id: string) => void
  setUsername: (name: string) => void
  setIsUsernameSet: (set: boolean) => void
  setIsConnected: (connected: boolean) => void
  setRoomUsers: (users: RoomUser[]) => void
  addMessage: (msg: ChatMessage) => void
  clearMessages: () => void
  setVideoUrl: (url: string) => void
  setVideoSource: (source: VideoSource) => void
  setVideoState: (state: 'playing' | 'paused') => void
  setVideoTime: (time: number) => void
  addReaction: (reaction: ReactionData) => void
  setPlaylist: (items: PlaylistItem[]) => void
  toggleTheaterMode: () => void
  resetRoom: () => void
}

export const useWatchPartyStore = create<WatchPartyState>((set) => ({
  viewMode: 'landing',
  roomId: '',
  username: '',
  isUsernameSet: false,
  isConnected: false,
  roomUsers: [],
  messages: [],
  videoUrl: '',
  videoSource: 'youtube',
  videoState: 'paused',
  videoTime: 0,
  reactions: [],
  playlist: [],
  isTheaterMode: false,

  setViewMode: (mode) => set({ viewMode: mode }),
  setRoomId: (id) => set({ roomId: id }),
  setUsername: (name) => set({ username: name }),
  setIsUsernameSet: (setFlag) => set({ isUsernameSet: setFlag }),
  setIsConnected: (connected) => set({ isConnected: connected }),
  setRoomUsers: (users) => set({ roomUsers: users }),
  addMessage: (msg) => set((state) => ({ messages: [...state.messages, msg].slice(-500) })),
  clearMessages: () => set({ messages: [] }),
  setVideoUrl: (url) => set({ videoUrl: url }),
  setVideoSource: (source) => set({ videoSource: source }),
  setVideoState: (videoState) => set({ videoState }),
  setVideoTime: (time) => set({ videoTime: time }),
  addReaction: (reaction) => set((state) => ({ reactions: [...state.reactions, reaction] })),
  setPlaylist: (items) => set({ playlist: items }),
  toggleTheaterMode: () => set((state) => ({ isTheaterMode: !state.isTheaterMode })),
  resetRoom: () => set({
    viewMode: 'landing',
    roomId: '',
    messages: [],
    roomUsers: [],
    videoUrl: '',
    videoSource: 'youtube',
    videoState: 'paused',
    videoTime: 0,
    reactions: [],
    playlist: [],
    isTheaterMode: false,
    isConnected: false,
    isUsernameSet: false,
    username: '',
  }),
}))
