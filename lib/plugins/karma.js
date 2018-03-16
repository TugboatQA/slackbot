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

// Give/take karma.
//
// Examples:
// - @eojthebrave++
// - cats++
// - tacos--
// - :taylor:++
//
// The first regex matches usernames and basic words. The second matches emoji
const patterns = ['^@?(.+?)(?=[ >:]*([-+]{2,})$)', '^:.+?:(?=[ :]*([-+]{2,})$)'];
controller.hears(patterns, ['ambient', 'direct_message', 'direct_mention', 'mention'], async (bot, message) => {
    let team, text;

    // Clean up the message text a bit
    text = message.text.slice(0, -2).trim();

    // Ignore any matches greater than 34 chars, this is arbitrary, existing
    // DB has entries up to 34 chars in length, so 34 seems reasonable
    if (text.length > 34) {
        return;
    }

    const user = await isUser(text, bot);
    if (user) {
        // If we found a slack user that matches then we can swap the user ID
        // for their username. We'll store karma on the username string
        // instead of the id.
        text = user.name;
    }

    if (await isNarcissism(message.user, text, bot)) {
        bot.reply(message, `Nice try @${text}, but no...`);
        return;
    }

    // Load the team data
    try {
        team = await storage.teams.get(message.team);
    } catch (err) {
        // Team does not exist, we will create it
    }

    // Make sure the team object exists, and has a place to store karma
    team = team || {};
    team.karma = team.karma || {};

    // Initialize karma that didn't exist before
    team.karma[text] = team.karma[text] || 0;

    // Increment karma
    if (/.*\+\+/.test(message.text)) {
        team.karma[text] += 1;
    }

    // Decrement karma
    if (/.*--/.test(message.text)) {
        team.karma[text] -= 1;
    }

    storage.teams.merge({ id: message.team, karma: team.karma });

    bot.reply(message, `${text} has karma of ${team.karma[text]}`);
});

/**
 * Check if a string of text is actually the ID or name of a Slack user.
 * If the string is a Slack user ID, we convert it to their username.
 *
 * @param text
 * @param bot
 * @returns {*}
 */
function isUser(text, bot) {
    // Is this at least in the format of a Slack user ID?
    const matches = /^<@([-._a-z0-9]+)>/i.exec(text);

    // Not a user, carry on.
    if (!matches) {
        return Promise.resolve(false);
    }

    // Try to find a matching user
    return new Promise((resolve, reject) => {
        bot.api.users.info({ user: matches[1] }, (err, data) => {
            // Not a user that we know about
            if (err === 'user_not_found') {
                return resolve(false);
            }

            // Some other error
            if (err) {
                return reject(err);
            }

            // User found!
            return resolve(data.user);
        });
    });
}

/**
 * Make sure a user is not trying to change their own karma
 *
 * @param giver    - The user giving the karma
 * @param receiver - The user receiving the karma
 * @param bot
 * @returns {Promise<any>}
 */
function isNarcissism(giver, receiver, bot) {
    return new Promise((resolve, reject) => {
        bot.api.users.info({ user: giver }, (err, data) => {
            if (err) {
                return reject(err);
            }

            return resolve(receiver === data.user.name);
        });
    });
}
