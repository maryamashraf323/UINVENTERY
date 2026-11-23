import { io } from 'socket.io-client'

const BACKEND_URL = import.meta.env.VITE_API_URL

const socket = io(BACKEND_URL, {
  path: '/socket.io',
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: Infinity,
  transports: ['websocket', 'polling'],
})

export default socket
