#!/usr/bin/env node

const fs = require('fs');
const mongoose = require('mongoose');
const path = require('path');

const Slackbot = require('slackbots');

let local = {};

try {
    // eslint-disable-next-line global-require,import/no-unresolved
    local = require('./config.js');
} catch (err) {
    // Can't read config file, or it does not exist. Use defaults
}

const defaults = {
    name: 'lullabot',
    mongodb: 'mongodb://localhost/lullabot',
};

// Load the config variable
const config = Object.assign({}, defaults, local);

// Connect to MongoDB
mongoose.connect(config.mongodb);

// Create a Slackbot
const slackbot = new Slackbot({ name: config.name, token: config.token });

// Load the plugins
const pluginpath = path.join(__dirname, 'plugins');
const plugins = fs.readdirSync(pluginpath);

// eslint-disable-next-line global-require,import/no-dynamic-require
plugins.forEach(plugin => require(path.join(pluginpath, plugin))(slackbot, config));
