#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const Botkit = require('botkit');
const mongoStorage = require('botkit-storage-mongo');

let config = {};

try {
    // eslint-disable-next-line global-require,import/no-unresolved
    config = require('./config.js');
} catch (err) {
    // Can't read config file, or it does not exist. Use defaults
}

// Create a Slackbot
const controller = Botkit.slackbot({
    storage: mongoStorage({ mongoUri: 'mongodb://localhost/lullabot' }),
});

// Start the slackbot
controller.spawn({ token: config.token || process.env.token }).startRTM(err => {
    if (err) {
        // eslint-disable-next-line no-console
        console.error(err);
        process.exit(1);
    }
});

// Load the plugins
const pluginpath = path.join(__dirname, 'plugins');
const plugins = fs.readdirSync(pluginpath);

// eslint-disable-next-line global-require,import/no-dynamic-require
plugins.forEach(plugin => require(path.join(pluginpath, plugin))(controller));
