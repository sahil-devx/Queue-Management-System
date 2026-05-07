import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

export function useSocket(userId: string, role: 'user' | 'admin') {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!userId) return;

    const token = localStorage.getItem('token');
    if (!token) return;

    const socket = io(import.meta.env.VITE_API_URL || 'http://localhost:5000', {
      auth: {
        token
      }
    });

    socketRef.current = socket;

    // Add connection logging
    socket.on('connect', () => {
      console.log(`Socket connected for ${role} ${userId}`);
    });

    socket.on('connect_error', (err) => {
      console.error('Socket connection error:', err.message);
    });

    return () => {
      socket.disconnect();
    };
  }, [userId, role]);

  return socketRef.current;
}
