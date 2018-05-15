const controller = require('../controller');

const patterns = ['^hello\\!?$', '^hey\\!?$', '^hi\\!?$', '^:wave:$'];
const type = ['direct_message', 'direct_mention', 'mention'];
controller.hears(patterns, type, (bot, message) => {
    bot.api.reactions.add({ timestamp: message.ts, channel: message.channel, name: 'wave' }, async err => {
        if (err) {
            bot.botkit.log('Failed to add emoji reaction', err);
            const user = await getUser(bot, message.user);
            bot.reply(message, `Hello <@${user.name}>!!`);
        }
    });
});

function getUser(bot, user) {
    return new Promise(resolve => {
        bot.api.users.info({ user }, (err, data) => {
            if (err) {
                bot.botkit.log(err);
                resolve({ name: '' });
            } else {
                resolve(data.user);
            }
        });
    });
}
