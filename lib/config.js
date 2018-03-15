const path = require('path');

let config = {};

try {
    // eslint-disable-next-line global-require,import/no-unresolved
    config = require('../config.js');
} catch (err) {
    // Can't read config file, or it does not exist. Use defaults
}

config.name = process.env.name || config.name || 'slackbot';
config.token = process.env.token || config.token;
config.debug = process.env.debug || config.debug;
config.json_file_store = process.env.json_file_store || config.json_file_store || path.join(__dirname, '..', 'data');

module.exports = config;
