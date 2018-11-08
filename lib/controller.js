const Botkit = require('botkit');

const config = require('./config');

// Create a Slackbot
const controller = Botkit.slackbot({
    retry: true,
    debug: config.debug,
    json_file_store: config.json_file_store,
});

// Start the slackbot
controller.spawn({ token: config.token }).startRTM(err => {
    if (err) {
        // eslint-disable-next-line no-console
        console.error(err);
        process.exit(1);
    }
});

module.exports = controller;
