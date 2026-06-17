require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const database = require('./db/database');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const publicRoutes = require('./routes/public');

const app = express();
const PORT = process.env.PORT || 3000;

// ============ MIDDLEWARE ============
app.use(cors());
app.use(cookieParser());
app.use(express.json({ limit: '200mb' }));
app.use(express.urlencoded({ extended: true, limit: '200mb' }));

// Serve static files (HTML, CSS, JS, uploads)
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// ============ ROUTES ============

// Authentication routes
app.use('/api/auth', authRoutes);

// Admin routes (protected)
app.use('/api/admin', adminRoutes);

// Public API routes
app.use('/api', publicRoutes);

// Serve admin panel
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'views/admin.html'));
});

// Serve category detail page
app.get('/category/:id', (req, res) => {
  res.sendFile(path.join(__dirname, 'views/category.html'));
});

// Serve project detail page
app.get('/project/:id', (req, res) => {
  res.sendFile(path.join(__dirname, 'views/project.html'));
});

// Serve homepage (everything else defaults to index.html for SPA routing)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Handle 404s for API
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// ============ ERROR HANDLING ============
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(err.status || 500).json({ 
    error: err.message || 'Internal server error' 
  });
});

// ============ START SERVER ============
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════╗
║  Portfolio Admin Server               ║
║  http://localhost:${PORT}               ║
║  Admin: http://localhost:${PORT}/admin  ║
╚═══════════════════════════════════════╝
  `);
});

process.on('SIGINT', () => {
  console.log('\nShutting down server...');
  if (database.db) {
    database.db.close((err) => {
      if (err) console.error('Error closing database during shutdown:', err);
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
});
