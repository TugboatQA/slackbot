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

const util = require('util');

const controller = require('../controller');
const slackbot = require('../slackbot');

// Give/take karma.
//
// Examples:
// - @eojthebrave++
// - cats++
// - tacos--
// - :taylor:++
controller.hears(/([^-]+)(-{2,}|\+{2,})\s*$/, ['ambient', 'direct_message', 'direct_mention', 'mention'], changeKarma);

// Retrieve existing karma for a term
//
// Matches requests like:
// - @bot karma tacos?
// - @bot karma tacos
controller.hears(/^karma\s*@?(.+)/, ['direct_mention', 'direct_message'], getKarma);

/**
 * Get existing karma
 *
 * @param bot
 * @param message
 */
async function getKarma(bot, message) {
    let karma, result, text;
    let index = message.match[1].trim();

    // Strip off the trailing ? if there is one. Sometimes people ask questions
    // with a question mark.
    if (index.slice(-1) === '?') {
        index = index.slice(0, -1);
    }

    // Check if the requested karma is for a user
    const user = await slackbot.getUser(bot, index);
    if (user) {
        index = user.id;
        text = user.profile ? user.profile.real_name : user.real_name || text;
    } else {
        index = index.toLowerCase();
        text = index;
    }

    // Load the team data
    try {
        karma = await util.promisify(controller.storage.teams.get)(`${message.team}_karma`);
        karma.data = karma.data || {};
        result = karma.data[index] || 0;
    } catch (err) {
        result = 0;
    }

    bot.reply(message, `${text} has karma ${result}`);
}

/**
 * Increment or decrement karma
 *
 * @param bot
 * @param message
 */
async function changeKarma(bot, message) {
    let index, text, karma, operation;

    // Clean up the message text a bit
    text = message.match[1].trim();
    // The -- or ++ is in the second capture group.
    operation = message.match[2];

    // Ignore any matches greater than 34 chars, this is arbitrary, existing
    // DB has entries up to 34 chars in length, so 34 seems reasonable
    if (text.length > 34) {
        return;
    }

    const user = await slackbot.getUser(bot, text);
    if (user) {
        // If we found a slack user that matches then we can store karma on
        // their user ID, and display their preferred real name
        index = user.id;
        text = user.profile ? user.profile.real_name : user.real_name || text;
    } else {
        index = text.toLowerCase();
    }

    if (await isNarcissism(message.user, index, bot)) {
        bot.reply(message, `Nice try <@${user.id}>, but no...`);
        return;
    }

    // Load the team karma data
    try {
        karma = await util.promisify(controller.storage.teams.get)(`${message.team}_karma`);
        karma.data = karma.data || {};
    } catch (err) {
        karma = { id: `${message.team}_karma`, data: {} };
    }

    // Initialize karma that didn't exist before
    karma.data[index] = karma.data[index] || 0;

    // Increment karma
    if (operation.indexOf('+') !== -1) {
        karma.data[index] += 1;
    }
    // Decrement karma
    else if (operation.indexOf('-') !== -1) {
        karma.data[index] -= 1;
    }

    try {
        await util.promisify(controller.storage.teams.save)(karma);
        bot.reply(message, `${text} has karma of ${karma.data[index]}`);
    } catch (err) {
        bot.botkit.log(`Failed to update karma for ${text}`);
    }
}

/**
 * Make sure a user is not trying to change their own karma
 *
 * @param giver    - The user giving the karma
 * @param receiver - The user receiving the karma
 * @param bot
 */
async function isNarcissism(giver, receiver, bot) {
    const info = await util.promisify(bot.api.users.info)({ user: giver });
    return receiver === info.user.id;
}
