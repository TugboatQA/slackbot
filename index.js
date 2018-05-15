#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Start the controller
require('./lib/controller');

// Load the plugins
const plugindir = path.join(__dirname, 'lib', 'plugins');
const plugins = fs.readdirSync(plugindir);

// eslint-disable-next-line global-require,import/no-dynamic-require
plugins.forEach(plugin => require(path.join(plugindir, plugin)));
