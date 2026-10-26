/**
 * client/api/index.js - Vercel Serverless Function
 */

const express = require('express');
const cors = require('cors');
const routes = require('../server/api/routes');

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

routes.setBroadcaster(() => {});

app.use('/api', routes);
app.use('/', routes);

module.exports = app;
