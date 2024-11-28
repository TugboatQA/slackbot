/**
 * @file
 * 
 * Responds to botsnacks with messages of gratitude.
 * 
 * Features:
 * - Responds to "botsnack" with random thank you messages
 * - Supports both direct messages and mentions
 * - Includes emoji reactions
 * 
 * Examples:
 *     botsnack
 *     @bot botsnack
 */

const thankYouMessages = [
    'Thank you! :cookie:',
    'Om nom nom nom :yum:',
    'Delicious! :hamburger:',
    'Yummy! :cake:',
    'How thoughtful of you! :candy:',
    '*happy bot noises* :robot_face:',
    'I appreciate the snack! :pizza:',
    'Tasty! :taco:',
    'Mmmmm :doughnut:',
    'You\'re the best! :ice_cream:'
];

function getRandomMessage() {
    const index = Math.floor(Math.random() * thankYouMessages.length);
    return thankYouMessages[index];
}

module.exports = async (app) => {
    // Match "botsnack" in messages
    const snackRegex = /^botsnack$/i;

    // Handle direct messages
    app.message(snackRegex, async ({ message, say }) => {
        await say({
            text: getRandomMessage(),
            thread_ts: message.thread_ts || message.ts
        });
    });

    // Handle mentions
    app.event('app_mention', async ({ event, say }) => {
        const text = event.text.replace(/<@[^>]+>\s*/, '').trim();
        
        if (snackRegex.test(text)) {
            await say({
                text: getRandomMessage(),
                thread_ts: event.thread_ts || event.ts
            });
        }
    });
}; 