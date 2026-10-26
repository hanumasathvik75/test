/**
 * client/api/index.js
 * Vercel Serverless Function — wraps the Milo Express backend.
 * Runs when Vercel root directory is set to "client".
 */
const express = require('express');
const cors = require('cors');
const path = require('path');

// Server code lives at client/server/ (copied from repo root /server/)
const routes = require('../server/api/routes');

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// No WebSocket in serverless — no-op broadcaster
routes.setBroadcaster(() => {});

app.use('/api', routes);
app.use('/', routes);

module.exports = app;
