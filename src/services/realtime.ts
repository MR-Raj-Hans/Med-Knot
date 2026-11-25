import { io, type Socket } from 'socket.io-client';
import { API_BASE_URL } from '@/services/apiClient';

export function createPatientSocket(accessToken: string): Socket | null {
  if (!API_BASE_URL) return null;
  const socketOrigin = API_BASE_URL.replace(/\/api(?:\/v\d+)?\/?$/, '');
  return io(socketOrigin, {
    autoConnect: false,
    auth: { token: accessToken },
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1_000,
    reconnectionDelayMax: 15_000,
    timeout: 10_000,
  });
}
