import { App } from '@slack/bolt';
import { GenericMessageEvent } from '@slack/types/dist/events/message';
import { AppMentionEvent } from '@slack/types/dist/events/app';
import * as os from 'os';
import { Plugin } from '../types';
import patternRegistry from '../services/pattern-registry';

// Cache the hostname
const hostname = os.hostname();

function formatUptime(uptime: number): string {
    const result: string[] = [];
    let remaining = Math.floor(uptime);

    const seconds = Math.floor(remaining % 60);
    remaining /= 60;

    const minutes = Math.floor(remaining % 60);
    remaining /= 60;

    const hours = Math.floor(remaining % 24);
    remaining /= 24;

    const days = Math.floor(remaining);

    if (days) {
        result.push(`${days} ${days === 1 ? 'day' : 'days'}`);
    }

    if (days || hours) {
        result.push(`${hours} ${hours === 1 ? 'hour' : 'hours'}`);
    }

    if (days || hours || minutes) {
        result.push(`${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`);
    }

    if (days || hours || minutes || seconds) {
        result.push(`${seconds} ${seconds === 1 ? 'second' : 'seconds'}`);
    }

    return result.join(', ');
}

const uptimePlugin: Plugin = async (app: App): Promise<void> => {
    // Handle direct messages and mentions for uptime queries
    const patterns = ['uptime', 'identify yourself', 'who are you', 'what is your name'];
    const patternRegex = new RegExp(`^(${patterns.join('|')})$`, 'i');
    
    // Register patterns with the registry with high priority
    patternRegistry.registerPattern(patternRegex, 'uptime', 10);

    app.message(patternRegex, async ({ message, client, say }) => {
        const msg = message as GenericMessageEvent;
        // Get bot's own info
        const botInfo = await client.auth.test();
        const uptime = formatUptime(process.uptime());
        
        const reply = `:robot_face: I am a bot named <@${botInfo.user_id}>. I have been running for ${uptime} on ${hostname}.`;

        await say({
            text: reply,
            thread_ts: msg.thread_ts || msg.ts
        });
    });

    // Also handle app mentions with the same patterns
    app.event('app_mention', async ({ event, client, say }) => {
        const mention = event as AppMentionEvent;
        const text = mention.text.replace(/<@[^>]+>\s*/, '').trim();
        
        if (patterns.some(pattern => text.toLowerCase() === pattern.toLowerCase())) {
            const botInfo = await client.auth.test();
            const uptime = formatUptime(process.uptime());
            
            const reply = `:robot_face: I am a bot named <@${botInfo.user_id}>. I have been running for ${uptime} on ${hostname}.`;

            await say({
                text: reply,
                thread_ts: mention.thread_ts || mention.ts
            });
        }
    });
};

export default uptimePlugin; 