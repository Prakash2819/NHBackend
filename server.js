require('dotenv').config();

const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '8.8.4.4']);

const express    = require('express');
const cors       = require('cors');
const http       = require('http');
const { Server } = require('socket.io');

// ── All requires FIRST ────────────────────────────────────────────────────────
const connectDB            = require('./database');
const patientRoutes        = require('./routes/user');
const doctorRoutes         = require('./routes/doctorRoutes');
const doctorProfileRoutes  = require('./routes/doctor');
const patientProfileRoutes = require('./routes/patientRoutes');
const appointmentRoutes    = require('./routes/appointmentRoutes');
const adminRoutes          = require('./routes/adminRoutes');

// ── App + Middleware ──────────────────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api',              patientRoutes);
app.use('/api',              doctorRoutes);
app.use('/api/doctor',       doctorProfileRoutes);
app.use('/api/doctors',      doctorProfileRoutes);
app.use('/api/patient',      patientProfileRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/admin',        adminRoutes);

// ── HTTP + Socket.io server ───────────────────────────────────────────────────
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

// ── WebRTC Signaling ──────────────────────────────────────────────────────────
// Each appointment gets its own room keyed by appointmentId.
// We relay: join, offer, answer, ice-candidate, leave between the two peers.

io.on('connection', (socket) => {
  console.log('[Socket] connected:', socket.id);

  // Join a call room
  socket.on('join-room', ({ roomId, role, displayName }) => {
    socket.join(roomId);
    socket.data = { roomId, role, displayName };
    console.log(`[Socket] ${role} (${displayName}) joined room ${roomId}`);
    // Notify the other peer that someone joined
    socket.to(roomId).emit('peer-joined', { role, displayName, socketId: socket.id });
  });

  // Relay WebRTC offer (caller → callee)
  socket.on('offer', ({ roomId, offer }) => {
    socket.to(roomId).emit('offer', { offer, from: socket.id });
  });

  // Relay WebRTC answer (callee → caller)
  socket.on('answer', ({ roomId, answer }) => {
    socket.to(roomId).emit('answer', { answer, from: socket.id });
  });

  // Relay ICE candidates
  socket.on('ice-candidate', ({ roomId, candidate }) => {
    socket.to(roomId).emit('ice-candidate', { candidate, from: socket.id });
  });

  // Relay mute/video toggle state
  socket.on('media-state', ({ roomId, audio, video }) => {
    socket.to(roomId).emit('peer-media-state', { audio, video });
  });

  // Chat message — broadcast to everyone else in the room
  socket.on('chat-message', ({ roomId, sender, text, time }) => {
    socket.to(roomId).emit('chat-message', { sender, text, time });
  });

  // Leave / hangup
  socket.on('leave-room', ({ roomId }) => {
    socket.to(roomId).emit('peer-left');
    socket.leave(roomId);
  });

  socket.on('disconnect', () => {
    if (socket.data?.roomId) {
      socket.to(socket.data.roomId).emit('peer-left');
    }
    console.log('[Socket] disconnected:', socket.id);
  });
});

// ── Database + Server ─────────────────────────────────────────────────────────
connectDB();

server.listen(4000, () => {
  console.log('Server listening on port 4000...');
});