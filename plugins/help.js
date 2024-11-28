/**
 * @file
 * 
 * Provides help information about available bot commands and plugins.
 * 
 * Features:
 * - Lists all available plugins and their commands
 * - Provides detailed help for specific plugins
 * - Responds in threads for better organization
 * - Supports multiple query formats
 * 
 * Examples:
 *     @bot help                 (Show all commands)
 *     @bot commands             (Show all commands)
 *     @bot plugins              (List available plugins)
 *     @bot help factoids        (Show factoids help)
 *     @bot help karma           (Show karma help)
 */

const helpText = {
    factoids: {
        title: 'Factoids',
        description: 'Store and retrieve custom responses',
        commands: [
            { pattern: '!factoid: X?', description: 'Query a factoid' },
            { pattern: '@Lullabot X is Y', description: 'Set a factoid' },
            { pattern: '@Lullabot X is <reply>Y', description: 'Set with reply' },
            { pattern: '@Lullabot forget X', description: 'Delete a factoid' },
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
            { pattern: 'karma @user', description: 'Query user\'s karma' },
            { pattern: 'karma thing', description: 'Query thing\'s karma' }
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

function formatPluginHelp(plugin) {
    const help = helpText[plugin];
    if (!help) return null;

    let response = `*${help.title}*\n${help.description}\n\n*Commands:*\n`;
    help.commands.forEach(cmd => {
        response += `• \`${cmd.pattern}\` - ${cmd.description}\n`;
    });
    return response;
}

function formatFullHelp() {
    let response = '*Available Plugins:*\n\n';
    
    Object.keys(helpText).forEach(plugin => {
        const help = helpText[plugin];
        response += `*${help.title}*\n${help.description}\n`;
        response += '_Key commands:_\n';
        // Show only first 2-3 commands as examples
        help.commands.slice(0, 2).forEach(cmd => {
            response += `• \`${cmd.pattern}\` - ${cmd.description}\n`;
        });
        response += '\n';
    });
    
    response += '\nFor detailed help on a specific plugin, try `@bot help <plugin>` (e.g., `@bot help karma`)';
    return response;
}

module.exports = async (app) => {
    // Match help commands
    const helpRegex = /^(?:help|commands|plugins)(?:\s+(\w+))?$/i;

    app.event('app_mention', async ({ event, say }) => {
        const text = event.text.replace(/<@[^>]+>\s*/, '').trim();
        const matches = text.match(helpRegex);

        if (matches) {
            const specificPlugin = matches[1]?.toLowerCase();
            let response;

            if (specificPlugin) {
                response = formatPluginHelp(specificPlugin);
                if (!response) {
                    response = `Plugin "${specificPlugin}" not found. Try one of: ${Object.keys(helpText).join(', ')}`;
                }
            } else {
                response = formatFullHelp();
            }

            await say({
                text: response,
                thread_ts: event.thread_ts || event.ts
            });
        }
    });

    // Also handle direct message help requests
    app.message(helpRegex, async ({ message, say }) => {
        const matches = message.text.match(helpRegex);
        const specificPlugin = matches[1]?.toLowerCase();
        let response;

        if (specificPlugin) {
            response = formatPluginHelp(specificPlugin);
            if (!response) {
                response = `Plugin "${specificPlugin}" not found. Try one of: ${Object.keys(helpText).join(', ')}`;
            }
        } else {
            response = formatFullHelp();
        }

        await say({
            text: response,
            thread_ts: message.thread_ts || message.ts
        });
    });
}; 