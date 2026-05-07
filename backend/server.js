const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, 'config.env') });

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const http = require('http');

const authRoutes = require('./routes/authRoutes');
const queueRoutes = require('./routes/queueRoutes');
const { notFoundHandler, errorHandler } = require('./middleware/errorMiddleware');
const { initializeSocket } = require('./socket');

const app = express();
const server = http.createServer(app);

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/health', (req, res) => {
  res.json({ ok: true });
});

app.get('/socket-test', (req, res) => {
  if (global.io) {
    const connectedSockets = global.io.engine.clientsCount;
    res.json({ 
      socketServer: 'running', 
      connectedClients: connectedSockets,
      message: 'Socket.IO server is active'
    });
  } else {
    res.json({ 
      socketServer: 'not running', 
      message: 'Socket.IO server not initialized' 
    });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/queue', queueRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

async function start() {
  const PORT = process.env.PORT || 5000;
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    console.error('Missing required env var: MONGODB_URI');
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');

  // Initialize Socket.IO
  const io = initializeSocket(server);
  
  // Make io available to other modules
  global.io = io;

  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Socket.IO server initialized`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});