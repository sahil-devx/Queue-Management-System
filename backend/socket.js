const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

function initializeSocket(server) {
  const io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || "http://localhost:5173",
      methods: ["GET", "POST"]
    }
  });

  // Socket authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      console.log('Socket auth attempt with token:', token ? 'present' : 'missing');
      
      if (!token) {
        console.log('Socket auth failed: No token provided');
        return next(new Error('Authentication token required'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log('Socket auth successful for user:', decoded.sub, 'role:', decoded.role);
      
      socket.userId = decoded.sub;
      socket.userRole = decoded.role;
      next();
    } catch (err) {
      console.log('Socket auth failed:', err.message);
      next(new Error('Invalid authentication token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`User ${socket.userId} connected with role ${socket.userRole}`);

    // Join user to their personal room for targeted notifications
    socket.join(`user_${socket.userId}`);

    // Admin joins admin room for queue updates
    if (socket.userRole === 'admin') {
      socket.join('admin_room');
    }

    socket.on('disconnect', () => {
      console.log(`User ${socket.userId} disconnected`);
    });
  });

  return io;
}

// Export functions to emit events
function emitUserCalled(io, userId, queueTitle, adminName) {
  io.to(`user_${userId}`).emit('userCalled', {
    queueTitle,
    adminName
  });
}

function emitQueueUpdate(io) {
  io.emit('queueUpdate');
}

module.exports = {
  initializeSocket,
  emitUserCalled,
  emitQueueUpdate
};
