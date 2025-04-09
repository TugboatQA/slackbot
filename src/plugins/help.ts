import { App } from '@slack/bolt';
import { GenericMessageEvent } from '@slack/types/dist/events/message';
import { AppMentionEvent } from '@slack/types/dist/events/app';
import { Plugin, HelpText } from '../types';
import patternRegistry from '../services/pattern-registry';

const helpText: HelpText = {
    botsnack: {
        title: 'Botsnack',
        description: 'Give the bot a treat!',
        commands: [
            { pattern: 'botsnack', description: 'Give the bot a snack' },
            { pattern: '@bot botsnack', description: 'Give the bot a snack (with mention)' }
        ]
    },
    factoids: {
        title: 'Factoids',
        description: 'Store and retrieve custom responses',
        commands: [
            { pattern: 'keyword?', description: 'Query a factoid (or use ! instead of ?)' },
            { pattern: '@bot X is Y', description: 'Set a factoid' },
            { pattern: '@bot X is <reply>Y', description: 'Set with direct reply' },
            { pattern: '@bot forget X', description: 'Delete a factoid' },
            { pattern: '!factoid: list', description: 'List all factoids' }
        ]
    },
    karma: {
        title: 'Karma System',
        description: 'Track and manage karma points',
        commands: [
            { pattern: '@user++', description: 'Give karma to user' },
            { pattern: '@user--', description: 'Take karma from user' },
            { pattern: 'thing++', description: 'Give karma to thing' },
            { pattern: 'thing--', description: 'Take karma from thing' },
            { pattern: 'karma @user', description: "Query user's karma" },
            { pattern: 'karma thing', description: "Query thing's karma" }
        ]
    },
    greetings: {
        title: 'Greetings',
        description: 'Responds to various greeting patterns',
        commands: [
            { pattern: 'hello!', description: 'Say hello' },
            { pattern: 'hey!', description: 'Say hey' },
            { pattern: 'hi!', description: 'Say hi' },
            { pattern: ':wave:', description: 'Wave emoji' }
        ]
    },
    uptime: {
        title: 'Uptime',
        description: 'Bot status information',
        commands: [
            { pattern: 'uptime', description: 'Show bot uptime' },
            { pattern: 'identify yourself', description: 'Show bot info' },
            { pattern: 'who are you', description: 'Show bot identity' }
        ]
    }
};

function formatPluginHelp(plugin: string): string | null {
    const help = helpText[plugin];
    if (!help) return null;

    let response = `*${help.title}*\n${help.description}\n\n*Commands:*\n`;
    help.commands.forEach(cmd => {
        response += `• \`${cmd.pattern}\` - ${cmd.description}\n`;
    });
    return response;
}

function formatFullHelp(): string {
    let response = '*Available Plugins:*\n\n';
    
    Object.keys(helpText).forEach(plugin => {
        const help = helpText[plugin];
        response += `*${help.title}*\n${help.description}\n`;
        response += '_Key commands:_\n';
        help.commands.slice(0, 2).forEach(cmd => {
            response += `• \`${cmd.pattern}\` - ${cmd.description}\n`;
        });
        response += '\n';
    });
    
    response += '\nFor detailed help on a specific plugin, try `@bot help <plugin>` (e.g., `@bot help karma`)';
    return response;
}

const helpPlugin: Plugin = async (app: App): Promise<void> => {
    // Match help commands
    const helpRegex = /^(?:help|commands|plugins)(?:\s+(\w+))?$/i;
    
    // Register patterns with the registry with high priority
    patternRegistry.registerPattern(/^help$/i, 'help', 10);
    patternRegistry.registerPattern(/^commands$/i, 'help', 10);
    patternRegistry.registerPattern(/^plugins$/i, 'help', 10);
    
    // Also register common question words that should have higher priority than factoids
    patternRegistry.registerPattern(/^what$/i, 'common-words', 5);
    patternRegistry.registerPattern(/^who$/i, 'common-words', 5);
    patternRegistry.registerPattern(/^how$/i, 'common-words', 5);
    patternRegistry.registerPattern(/^when$/i, 'common-words', 5);
    patternRegistry.registerPattern(/^where$/i, 'common-words', 5);
    patternRegistry.registerPattern(/^why$/i, 'common-words', 5);
    
    app.event('app_mention', async ({ event, say }) => {
        const mention = event as AppMentionEvent;
        const text = mention.text.replace(/<@[^>]+>\s*/, '').trim();
        const matches = text.match(helpRegex);

        if (matches) {
            const specificPlugin = matches[1]?.toLowerCase();
            let response: string;

            if (specificPlugin) {
                const pluginHelp = formatPluginHelp(specificPlugin);
                response = pluginHelp || `Plugin "${specificPlugin}" not found. Try one of: ${Object.keys(helpText).join(', ')}`;
            } else {
                response = formatFullHelp();
            }

            await say({
                text: response,
                thread_ts: mention.thread_ts || mention.ts
            });
        }
    });

    // Also handle direct message help requests
    app.message(helpRegex, async ({ message, say }) => {
        const msg = message as GenericMessageEvent;
        if (!msg.text) return;
        
        const matches = msg.text.match(helpRegex);
        const specificPlugin = matches?.[1]?.toLowerCase();
        let response: string;

        if (specificPlugin) {
            const pluginHelp = formatPluginHelp(specificPlugin);
            response = pluginHelp || `Plugin "${specificPlugin}" not found. Try one of: ${Object.keys(helpText).join(', ')}`;
        } else {
            response = formatFullHelp();
        }

        await say({
            text: response,
            thread_ts: msg.thread_ts || msg.ts
        });
    });
};

export default helpPlugin; 