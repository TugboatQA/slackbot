import { App } from '@slack/bolt';
import { GenericMessageEvent } from '@slack/types/dist/events/message';
import { AppMentionEvent } from '@slack/types/dist/events/app';
import { Plugin } from '../types';
import patternRegistry from '../services/pattern-registry';

const thankYouMessages: string[] = [
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

function getRandomMessage(): string {
    const index = Math.floor(Math.random() * thankYouMessages.length);
    return thankYouMessages[index];
}

const botsnackPlugin: Plugin = async (app: App): Promise<void> => {
    // Match "botsnack" in messages
    const snackRegex = /^botsnack$/i;
    
    // Register pattern with the registry with high priority
    patternRegistry.registerPattern(snackRegex, 'botsnack', 10);

    // Handle direct messages
    app.message(snackRegex, async ({ message, say }) => {
        const msg = message as GenericMessageEvent;
        await say({
            text: getRandomMessage(),
            thread_ts: msg.thread_ts || msg.ts
        });
    });

    // Handle mentions
    app.event('app_mention', async ({ event, say }) => {
        const mention = event as AppMentionEvent;
        const text = mention.text.replace(/<@[^>]+>\s*/, '').trim();
        
        if (snackRegex.test(text)) {
            await say({
                text: getRandomMessage(),
                thread_ts: mention.thread_ts || mention.ts
            });
        }
    });
};

export default botsnackPlugin; 