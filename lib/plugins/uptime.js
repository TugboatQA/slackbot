const os = require('os');
const controller = require('../controller');

// Cache the hostname
const hostname = os.hostname();

const patterns = ['uptime', 'identify yourself', 'who are you', 'what is your name'];
controller.hears(patterns, ['direct_message', 'direct_mention', 'mention'], (bot, message) => {
    const uptime = formatUptime(process.uptime());

    const reply = `:robot_face: I am a bot named <@${
        bot.identity.name
    }>. I have been running for ${uptime} on ${hostname}.`;
    bot.reply(message, reply);
});

function formatUptime(uptime) {
    const result = [];
    let remaining = Math.floor(uptime);

    const seconds = Math.floor(remaining % 60);
    remaining /= 60;

    const minutes = Math.floor(remaining % 60);
    remaining /= 60;

    const hours = Math.floor(remaining % 24);
    remaining /= 24;

    const days = Math.floor(remaining);

    if (days) {
        result.push(`${days} ${days === 1 ? 'day' : 'days'}`);
    }

    if (days || hours) {
        result.push(`${hours} ${hours === 1 ? 'hour' : 'hours'}`);
    }

    if (days || hours || minutes) {
        result.push(`${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`);
    }

    if (days || hours || minutes || seconds) {
        result.push(`${seconds} ${seconds === 1 ? 'second' : 'seconds'}`);
    }

    return result.join(', ');
}
