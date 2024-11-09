/**
 * Handle giving/taking karma points for users and items.
 * Karma is stored per team and persists across all channels.
 * Users cannot give karma to themselves.
 * 
 * Examples:
 * - @user++ (give karma to user)
 * - thing++ (give karma to thing)
 * - @user-- (take karma from user)
 * - karma @user (check user's karma)
 * - karma thing (check thing's karma)
 */

const fs = require('fs').promises;
const path = require('path');

// Storage helper functions
const storageDir = path.join(__dirname, '..', 'data');
const getStoragePath = (team) => path.join(storageDir, `${team}_karma.json`);

async function loadKarma(team) {
    try {
        await fs.mkdir(storageDir, { recursive: true });
        const data = await fs.readFile(getStoragePath(team), 'utf8');
        return JSON.parse(data);
    } catch (err) {
        return { id: `${team}_karma`, data: {} };
    }
}

async function saveKarma(team, karma) {
    await fs.mkdir(storageDir, { recursive: true });
    await fs.writeFile(getStoragePath(team), JSON.stringify(karma, null, 2));
}

// Helper function to get user info
async function getUser(client, text) {
    const userMatch = text.match(/<@([UW][A-Z0-9]+)>/);
    if (userMatch) {
        try {
            const result = await client.users.info({ user: userMatch[1] });
            return result.user;
        } catch (error) {
            console.error('Error fetching user:', error);
            return null;
        }
    }
    return null;
}

// Check if user is trying to modify their own karma
async function isNarcissism(giverId, receiverId) {
    return giverId === receiverId;
}

module.exports = async (app) => {
    // Register plugin patterns
    app.registerPlugin('karma', [
        /^karma\s+@\w+/i,
        /^karma\s+\w+$/i,
        /\s*@\w+\+\+$/,
        /\s*@\w+\-\-$/,
        /\s*\w+\+\+$/,
        /\s*\w+\-\-$/
    ]);

    // Give/take karma
    app.message(/(.+?)(-{2,}|\+{2,})\s*$/, async ({ message, context, client, say }) => {
        if (!context.matches) return;
        
        const text = context.matches[1].trim();
        const operation = context.matches[2];
        const team = message.team || 'default';

        // Ignore long entries
        if (text.length > 34) return;

        let index, displayText;
        const user = await getUser(client, text);

        if (user) {
            index = user.id;
            displayText = user.profile?.real_name || user.real_name || text;
        } else {
            index = text.toLowerCase();
            displayText = text;
        }

        // Check for self-karma
        if (user && await isNarcissism(message.user, index)) {
            await say({
                text: `Nice try <@${message.user}>, but no...`
            });
            return;
        }

        try {
            const karma = await loadKarma(team);
            karma.data[index] = karma.data[index] || 0;

            // Update karma
            if (operation.includes('+')) {
                karma.data[index] += 1;
            } else if (operation.includes('-')) {
                karma.data[index] -= 1;
            }

            await saveKarma(team, karma);
            await say({
                text: `${displayText} has karma of ${karma.data[index]}`
            });
        } catch (err) {
            console.error('Failed to update karma:', err);
            await say({
                text: `Failed to update karma for ${displayText}`
            });
        }
    });

    // Get karma
    const karmaQueryRegex = /^karma\s*@?(.+)/;

    // Handle direct messages for karma queries
    app.message(karmaQueryRegex, async ({ message, context, client, say }) => {
        if (!context.matches) return;
        
        let index = context.matches[1].trim();
        const team = message.team || 'default';

        // Remove trailing question mark
        if (index.endsWith('?')) {
            index = index.slice(0, -1);
        }

        let displayText;
        const user = await getUser(client, index);

        if (user) {
            index = user.id;
            displayText = user.profile?.real_name || user.real_name || index;
        } else {
            index = index.toLowerCase();
            displayText = index;
        }

        try {
            const karma = await loadKarma(team);
            const karmaValue = karma.data[index] || 0;

            await say({
                text: `${displayText} has karma ${karmaValue}`
            });
        } catch (err) {
            console.error('Failed to get karma:', err);
            await say({
                text: `Failed to get karma for ${displayText}`
            });
        }
    });

    // Handle app mentions for karma queries
    app.event('app_mention', async ({ event, client, say }) => {
        const text = event.text.replace(/<@[^>]+>\s*/, '').trim();
        const matches = text.match(karmaQueryRegex);
        
        if (matches) {
            let index = matches[1].trim();
            const team = event.team || 'default';

            if (index.endsWith('?')) {
                index = index.slice(0, -1);
            }

            let displayText;
            const user = await getUser(client, index);

            if (user) {
                index = user.id;
                displayText = user.profile?.real_name || user.real_name || index;
            } else {
                index = index.toLowerCase();
                displayText = index;
            }

            try {
                const karma = await loadKarma(team);
                const karmaValue = karma.data[index] || 0;

                await say({
                    text: `${displayText} has karma ${karmaValue}`
                });
            } catch (err) {
                console.error('Failed to get karma:', err);
                await say({
                    text: `Failed to get karma for ${displayText}`
                });
            }
        }
    });
};
