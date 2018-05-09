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
        const matches = /^<@([-._A-Z0-9]+)>/i.exec(text);
        const info = await util.promisify(bot.api.users.info)({ user: matches[1] });
        return info.user;
    } catch (err) {
        // User not found, carry on
    }

    try {
        // Search for a user by id, username, or profile display name
        const users = await util.promisify(bot.api.users.list)({ limit: 1000 });
        const matches = /^@?(.*)/i.exec(text);
        return users.members.filter(
            user => user.id === matches[1] || [user.name, user.profile.display_name].includes(matches[1])
        )[0];
    } catch (err) {
        // User not found, carry on
    }

    return null;
}

module.exports = { getUser };
