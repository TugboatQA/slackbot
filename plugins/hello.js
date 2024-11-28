/**
 * @file
 * 
 * Responds to various greeting patterns with reactions or text responses.
 * 
 * Features:
 * - Responds to various greeting patterns
 * - Adds wave reactions to greetings
 * - Supports both direct messages and mentions
 * - Fallback to text responses if reactions fail
 * 
 * Examples:
 *     hello!
 *     hey!
 *     hi!
 *     :wave:
 */

module.exports = async (app) => {
    // Define patterns for greetings
    const patterns = ['^hello\\!?$', '^hey\\!?$', '^hi\\!?$', '^:wave:$'];
    const greetingRegex = new RegExp(`(${patterns.join('|')})`, 'i');

    // Helper function to get user info
    async function getUser(client, userId) {
        try {
            const result = await client.users.info({ user: userId });
            return result.user;
        } catch (err) {
            console.error('Error fetching user:', err);
            return { name: '' };
        }
    }

    // Handle direct messages with greetings
    app.message(greetingRegex, async ({ message, client, say }) => {
        try {
            // Try to add reaction first
            await client.reactions.add({
                timestamp: message.ts,
                channel: message.channel,
                name: 'wave'
            });
        } catch (err) {
            // If reaction fails, send a message instead
            console.error('Failed to add emoji reaction:', err);
            const user = await getUser(client, message.user);
            await say({
                text: `Hello <@${user.id}>!!`,
                thread_ts: message.thread_ts || message.ts
            });
        }
    });

    // Handle app mentions with greetings
    app.event('app_mention', async ({ event, client, say }) => {
        const text = event.text.replace(/<@[^>]+>\s*/, '').trim();
        if (greetingRegex.test(text)) {
            try {
                await client.reactions.add({
                    timestamp: event.ts,
                    channel: event.channel,
                    name: 'wave'
                });
            } catch (err) {
                console.error('Failed to add emoji reaction:', err);
                const user = await getUser(client, event.user);
                await say({
                    text: `Hello <@${user.id}>!!`,
                    thread_ts: event.thread_ts || event.ts
                });
            }
        }
    });
};
