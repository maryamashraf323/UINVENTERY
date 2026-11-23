import { io } from 'socket.io-client'

const socket = io(import.meta.env.VITE_API_URL, {
  path: '/socket.io',
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: Infinity,
  transports: ['websocket', 'polling'],
})

export default socket
