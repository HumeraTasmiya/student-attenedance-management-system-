/**
 * SmartAttend – backend/server.js
 * =====================================================================
 * Express + MongoDB server for the Student Attendance Management System
 * Run: npm install && node server.js
 * =====================================================================
 */

const express  = require('express');
const mongoose = require('mongoose');
const cors     = require('cors');
const dotenv   = require('dotenv');

// Load environment variables from .env
dotenv.config();

const app = express();

// ── Middleware ──
app.use(cors({
  origin: '*', // Allow all origins in dev; restrict in production
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());           // Parse JSON request bodies
app.use(express.urlencoded({ extended: true }));

// ── Route Imports ──
const studentRoutes    = require('./routes/students');
const attendanceRoutes = require('./routes/attendance');

// ── API Routes ──
app.use('/api/students',   studentRoutes);
app.use('/api/attendance', attendanceRoutes);

// ── Health Check endpoint ──
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Root route ──
app.get('/', (req, res) => {
  res.json({ message: 'SmartAttend API is running 🎓' });
});

// ── 404 Handler ──
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ── Global Error Handler ──
app.use((err, req, res, next) => {
  console.error('Server Error:', err.message);
  res.status(500).json({ error: 'Internal server error', details: err.message });
});

// ── Connect to MongoDB & Start Server ──
const PORT     = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/smartattend';

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log('✅  Connected to MongoDB');
    app.listen(PORT, () => {
      console.log(`🚀  SmartAttend server running at http://localhost:${PORT}`);
      console.log(`📡  API Base: http://localhost:${PORT}/api`);
    });
  })
  .catch((err) => {
    console.error('❌  MongoDB connection failed:', err.message);
    process.exit(1);
  });