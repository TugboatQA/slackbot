const controller = require('../controller');
const storage = require('botkit-promise-storage')(controller);

const patterns = ['^hello', '^hey', '^hi'];
const type = ['direct_message', 'direct_mention', 'mention'];
controller.hears(patterns, type, (bot, message) => {});
