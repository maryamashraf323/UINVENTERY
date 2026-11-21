import { io } from 'socket.io-client'

// Connect through same host — Vite proxies /socket.io to backend
// This means all admins on the network just open the same URL
const socket = io(window.location.origin, {
  path: '/socket.io',
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: Infinity,
  transports: ['websocket', 'polling'],
})

export default socket
