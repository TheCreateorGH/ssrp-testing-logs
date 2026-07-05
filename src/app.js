const express = require('express');
const cors = require('cors');
const path = require('path');

const { PUBLIC_DIR, ensureDirs } = require('./config/paths');
const apiRoutes = require('./routes');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { attachSession } = require('./middleware/auth.middleware');

ensureDirs();

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(PUBLIC_DIR));

app.use('/api', attachSession);
app.use('/api', apiRoutes);
// Any /api/* path that didn't match a route above is a genuine 404,
// not a client-side route — return JSON instead of falling through
// to the SPA fallback below.
app.use('/api', notFoundHandler);

// SPA fallback for client-side routing — must come after API routes
// so it doesn't swallow unmatched /api/* requests.
app.get('*', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'index.html')));

// Centralized error handler — must be the last middleware registered.
app.use(errorHandler);

module.exports = app;
