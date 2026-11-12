const express = require('express');
const cors = require('cors');
const path = require('path');

const { PUBLIC_DIR, ensureDirs } = require('./config/paths');
const apiRoutes = require('./routes');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { attachSession } = require('./middleware/auth.middleware');
const { httpLogger } = require('./debug/httpLogger');

ensureDirs();

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(httpLogger); // DEBUG-gated inbound/outbound HTTP interceptor
app.use(express.static(PUBLIC_DIR));

app.use('/api', attachSession);
app.use('/api', apiRoutes);
app.use('/api', notFoundHandler);

app.get('/broadcast', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'broadcast-gen.html')));
app.get('/', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'index.html')));

app.get('*', (req, res) => {
    res.status(404);

    if (req.accepts('html')) {
        return res.sendFile(path.join(PUBLIC_DIR, '404.html'));
    }

    res.json({
        success: false,
        ok: false,
        status: 404,
        error: 'Not Found'
    });
});

app.use(errorHandler);

module.exports = app;
