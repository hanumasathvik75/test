/**
 * api/index.js - Vercel Serverless Function Entry Point
 * Wraps the Express app for Vercel's serverless environment.
 * Note: WebSocket connections are not supported in serverless mode.
 * The frontend will fall back to polling for real-time updates.
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const routes = require('../server/api/routes');

const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// No-op broadcaster in serverless (no persistent WS connections)
routes.setBroadcaster(() => {});

app.use('/api', routes);
app.use('/', routes);

module.exports = app;
