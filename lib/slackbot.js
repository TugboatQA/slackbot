const util = require('util');

/**
 * Check if a string of text is actually the ID or name of a Slack user.
 * If the string is a Slack user ID, we convert it to their username.
 *
 * @param text
 * @param bot
 * @returns {*}
 */
async function getUser(text, bot) {
    try {
        // Try looking for a slack-formated user ID
        const matches = /^<@([-._a-z0-9]+)>/i.exec(text.toLowerCase());
        const info = await util.promisify(bot.api.users.info)({ user: matches[1] });
        info.user.id = info.user.id.toLowerCase();
        return info.user;
    } catch (err) {
        // User not found, carry on
    }

    try {
        // Search for a user by username or profile display name
        const matches = /^@?(.*)/i.exec(text.toLowerCase());
        const users = await util.promisify(bot.api.users.list)({ limit: 1000 });
        const result = users.members.filter(user => [user.name, user.profile.display_name].includes(matches[1]))[0];
        result.id = result.id.toLowerCase();
        return result;
    } catch (err) {
        // User not found, carry on
    }

    return false;
}

module.exports = { getUser };
