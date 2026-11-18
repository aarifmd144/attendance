import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../store/authStore';

let socket: Socket | null = null;

export const getSocketUrl = (): string => {
  const customUrl = import.meta.env.VITE_WS_URL || import.meta.env.VITE_BACKEND_URL;
  if (customUrl) return customUrl;
  // If in browser and on port 5173, backend is on 5000
  if (typeof window !== 'undefined') {
    if (window.location.port === '5173') {
      return `${window.location.protocol}//${window.location.hostname}:5000`;
    }
    return window.location.origin;
  }
  return 'http://localhost:5000';
};

export const initSocket = (): Socket | null => {
  const token = useAuthStore.getState().accessToken;
  if (!token) {
    disconnectSocket();
    return null;
  }

  if (socket && socket.connected) {
    return socket;
  }

  if (socket) {
    socket.disconnect();
  }

  const socketUrl = getSocketUrl();

  socket = io(socketUrl, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000,
  });

  socket.on('connect', () => {
    // console.log('Socket connected:', socket?.id);
  });

  socket.on('connect_error', (_err) => {
    // console.warn('Socket connect error:', _err.message);
  });

  return socket;
};

export const getSocket = (): Socket | null => {
  if (!socket) {
    return initSocket();
  }
  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
