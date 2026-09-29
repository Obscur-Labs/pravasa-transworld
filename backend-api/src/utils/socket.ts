import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { jwtSecret } from '../config/env';
import Admin from '../models/Admin';
import User from '../models/User';

let io: SocketIOServer;

interface SocketUser {
  id: string;
  role: 'user' | 'admin';
}

export const initSocket = (server: HttpServer) => {
  io = new SocketIOServer(server, {
    cors: {
      origin: [
        process.env.FRONTEND_URL || 'http://localhost:3000',
        process.env.ADMIN_URL || 'http://localhost:3001',
      ],
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
    if (!token) return next(new Error('Authentication error'));

    try {
      const decoded = jwt.verify(token, jwtSecret()) as { id: string; role?: string };
      const role: SocketUser['role'] = decoded.role === 'admin' ? 'admin' : 'user';
      // A valid token is not enough: the account may have been deleted or deactivated since.
      const exists = role === 'admin'
        ? await Admin.exists({ _id: decoded.id })
        : await User.exists({ _id: decoded.id, isActive: true });
      if (!exists) return next(new Error('Authentication error'));

      (socket as any).user = { id: decoded.id, role };
      next();
    } catch {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    const user = (socket as any).user as SocketUser;
    
    if (user.role === 'admin') {
      socket.join('admin_room');
      console.log(`Admin connected and joined admin_room: ${socket.id}`);
    } else {
      socket.join(`user_${user.id}`);
      console.log(`User connected and joined user_${user.id}: ${socket.id}`);
    }

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error('Socket.io not initialized!');
  }
  return io;
};
