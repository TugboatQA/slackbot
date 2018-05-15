const util = require('util');

/**
 * Check if a string of text is actually the ID or name of a Slack user.
 * If the string is a Slack user ID, we convert it to their username.
 *
 * @param text
 * @param bot
 * @returns {*}
 */
async function getUser(bot, text) {
    try {
        // Try looking for a slack-formated user ID
        const matches = /^<@([A-Z0-9]+)>$/i.exec(text);
        const info = await util.promisify(bot.api.users.info)({ user: matches[1] });
        return info.user;
    } catch (err) {
        // User not found, carry on
    }

    try {
        // Try looking up a user directly by ID
        const matches = /^([A-Z0-9]+)$/i.exec(text);
        const info = await util.promisify(bot.api.users.info)({ user: matches[1] });
        return info.user;
    } catch (err) {
        // User not found, carry on
    }

    return null;
}

module.exports = { getUser };
