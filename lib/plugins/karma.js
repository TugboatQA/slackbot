/**
 * @file
 *
 * Handle giving/taking karma.
 *
 * Karma is stored team side, so any channel that the bot is in for this team
 * will use the same set of karma data.
 *
 *  Examples:
 *      @eojthebrave++
 *      cats++
 *      tacos--
 *      :taylor:++
 */

const controller = require('../controller');
const storage = require('botkit-promise-storage')(controller);

// The first regex matches usernames and basic words. The second matches emoji
const patterns = ['^@?(.+?)(?=[ >:]*([-+]{2,})$)', '^:.+?:(?=[ :]*([-+]{2,})$)'];

controller.hears(patterns, ['direct_message', 'direct_mention', 'mention'], async (bot, message) => {
    let team;

    try {
        team = await storage.teams.get(message.team);
    } catch (err) {
        // Team does not exist, we will create it
    }

    team = team || {};
    team.karma = team.karma || {};
    team.karma[message.text] = team.karma[message.text] || 0;
    team.karma[message.text] += 1;

    storage.teams.merge({ id: message.team, karma: team.karma });

    bot.reply(message, `${message.text} has karma of ${team.karma[message.text]}`);
});
