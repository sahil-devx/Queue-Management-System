import { useEffect, useState } from 'react';
import { useSocket } from '../hooks/useSocket';
import { useAuth } from '../context/AuthContext';

export default function SocketStatus() {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const socket = useSocket(user?.id || '', user?.role || 'user');

  useEffect(() => {
    if (!socket) return;

    const onConnect = () => {
      setIsConnected(true);
      console.log('Socket connected successfully');
    };

    const onDisconnect = () => {
      setIsConnected(false);
      console.log('Socket disconnected');
    };

    const onConnectError = (err: any) => {
      setIsConnected(false);
      console.error('Socket connection error:', err);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);

    // Set initial connection state
    setIsConnected(socket.connected);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
    };
  }, [socket]);

  if (import.meta.env.PROD) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50">
      <div className={`px-3 py-1 rounded-full text-xs font-medium ${
        isConnected 
          ? 'bg-green-100 text-green-800 border border-green-200' 
          : 'bg-red-100 text-red-800 border border-red-200'
      }`}>
        Socket: {isConnected ? 'Connected' : 'Disconnected'}
      </div>
    </div>
  );
}
