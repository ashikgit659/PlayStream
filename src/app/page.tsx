'use client'

import { useEffect } from 'react'
import { useWatchPartyStore } from '@/store/watchparty-store'
import LandingPage from '@/components/watchparty/landing-page'
import RoomView from '@/components/watchparty/room-view'

export default function Home() {
  const { viewMode, username, setViewMode, setRoomId, setIsUsernameSet, setUsername } = useWatchPartyStore()

  // Check for room ID in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const room = params.get('room')
    if (room) {
      setRoomId(room)
      // Auto-set username and enter room
      const savedName = localStorage.getItem('watchparty-username')
      if (savedName) {
        setUsername(savedName)
        setIsUsernameSet(true)
      }
      setViewMode('room')
    }
  }, [setRoomId, setViewMode, setIsUsernameSet, setUsername])

  // Save username to localStorage when it changes
  useEffect(() => {
    if (username) {
      localStorage.setItem('watchparty-username', username)
    }
  }, [username])

  const handleCreateRoom = () => {
    const roomId = Math.random().toString(36).substr(2, 8)
    setRoomId(roomId)
    setViewMode('room')
    window.history.replaceState({}, '', `?room=${roomId}`)
  }

  return (
    <>
      {viewMode === 'landing' ? (
        <LandingPage onCreateRoom={handleCreateRoom} />
      ) : (
        <RoomView />
      )}
    </>
  )
}
