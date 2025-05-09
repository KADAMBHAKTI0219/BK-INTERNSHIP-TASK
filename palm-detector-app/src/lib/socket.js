import { io } from 'socket.io-client';

let socket;

export const initializeSocket = () => {
  // Replace with your laptop's IP address
  const SERVER_URL = 'http://192.168.1.5:3000'; 
  
  if (!socket) {
    socket = io(SERVER_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
  }

  return socket;
};

export const getSocket = () => {
  if (!socket) throw new Error('Socket not initialized');
  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};