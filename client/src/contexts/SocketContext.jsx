import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { getAccessToken } from '../api/client';

export const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const { isAuthenticated, user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [socketError, setSocketError] = useState(null);
  const socketRef = useRef(null);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setIsConnected(false);
      }
      return;
    }

    const token = getAccessToken();
    const socketUrl = import.meta.env.VITE_WS_URL || window.location.origin;

    const socket = io(socketUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
      timeout: 10000
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      setSocketError(null);
    });

    socket.on('disconnect', (reason) => {
      setIsConnected(false);
      if (reason === 'io server disconnect') {
        // the disconnection was initiated on the server, you need to reconnect manually
        socket.connect();
      }
    });

    socket.on('connect_error', (err) => {
      setIsConnected(false);
      setSocketError(err.message);
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setIsConnected(false);
      }
    };
  }, [isAuthenticated, user]);

  const joinDevice = useCallback((deviceId) => {
    return new Promise((resolve) => {
      if (!socketRef.current || !socketRef.current.connected) {
        resolve({ success: false, error: 'Socket not connected' });
        return;
      }
      socketRef.current.emit('join:device', { deviceId }, (response) => {
        resolve(response || { success: true });
      });
    });
  }, []);

  const leaveDevice = useCallback((deviceId) => {
    return new Promise((resolve) => {
      if (!socketRef.current || !socketRef.current.connected) {
        resolve({ success: false });
        return;
      }
      socketRef.current.emit('leave:device', { deviceId }, (response) => {
        resolve(response || { success: true });
      });
    });
  }, []);

  const joinIncident = useCallback((incidentId) => {
    return new Promise((resolve) => {
      if (!socketRef.current || !socketRef.current.connected) {
        resolve({ success: false, error: 'Socket not connected' });
        return;
      }
      socketRef.current.emit('join:incident', { incidentId }, (response) => {
        resolve(response || { success: true });
      });
    });
  }, []);

  const leaveIncident = useCallback((incidentId) => {
    return new Promise((resolve) => {
      if (!socketRef.current || !socketRef.current.connected) {
        resolve({ success: false });
        return;
      }
      socketRef.current.emit('leave:incident', { incidentId }, (response) => {
        resolve(response || { success: true });
      });
    });
  }, []);

  const subscribe = useCallback((event, callback) => {
    if (!socketRef.current) return () => {};
    socketRef.current.on(event, callback);
    return () => {
      if (socketRef.current) {
        socketRef.current.off(event, callback);
      }
    };
  }, []);

  const value = {
    socket: socketRef.current,
    isConnected,
    socketError,
    joinDevice,
    leaveDevice,
    joinIncident,
    leaveIncident,
    subscribe
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};
