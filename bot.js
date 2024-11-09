const { App } = require('@slack/bolt');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Initialize the Bolt app
const app = new App({
    token: process.env.BOT_TOKEN,
    signingSecret: process.env.CLIENT_SIGNING_SECRET,
    socketMode: true,
    appToken: process.env.SLACK_APP_TOKEN,
});

// Store registered plugins and their patterns
app.pluginRegistry = new Map();

// Plugin registration helper
app.registerPlugin = (name, patterns) => {
    app.pluginRegistry.set(name, patterns);
    console.log(`Registered patterns for ${name}:`, patterns);
};

// Helper to check if text matches a plugin's patterns
app.isPluginPattern = (pluginName, text) => {
    const patterns = app.pluginRegistry.get(pluginName);
    if (!patterns) return false;

    return patterns.some(pattern => {
        if (pattern instanceof RegExp) {
            return pattern.test(text);
        } else if (typeof pattern === 'string') {
            return text.includes(pattern);
        }
        return false;
    });
};

// Function to check which plugin should handle a message
function findHandler(text, isMention = false) {
    console.log('\nChecking patterns for:', text);
    
    for (const [pluginName, patterns] of app.pluginRegistry) {
        // Skip character plugin if another plugin matches
        if (pluginName === 'character') continue;

        console.log(`\nChecking ${pluginName} patterns:`);
        if (app.isPluginPattern(pluginName, text)) {
            console.log(`  Found match for ${pluginName}`);
            return pluginName;
        }
    }

    // If no other plugin matches and it's a mention or DM, use character plugin
    if (isMention || app.pluginRegistry.has('character')) {
        console.log('\nNo specific plugin match, defaulting to character plugin');
        return 'character';
    }

    console.log('\nNo handler found');
    return null;
}

// Plugin loader function
const loadPlugins = async (app) => {
    const pluginsDir = path.join(__dirname, 'plugins');
    
    if (!fs.existsSync(pluginsDir)) {
        fs.mkdirSync(pluginsDir);
    }

    const pluginFiles = fs.readdirSync(pluginsDir)
        .filter(file => file.endsWith('.js'));

    for (const file of pluginFiles) {
        try {
            const plugin = require(path.join(pluginsDir, file));
            if (typeof plugin === 'function') {
                await plugin(app);
                console.log(`Loaded plugin: ${file}`);
            }
        } catch (error) {
            console.error(`Error loading plugin ${file}:`, error);
        }
    }
};

// Add message logging
const addMessageLogging = (app) => {
    // Log all incoming messages
    app.message('.*', async ({ message, next }) => {
        if (message.bot_id || message.subtype === 'bot_message') {
            return await next();
        }

        const text = message.text;
        const channelType = message.channel_type || 'channel';
        const isMention = text?.includes(`<@${app.client.botUserId}>`);

        console.log('\n=== Incoming Message ===');
        console.log(`Channel Type: ${channelType}`);
        console.log(`Is Mention: ${isMention}`);
        console.log(`Text: ${text}`);

        // Find handler based on registered patterns
        const handler = findHandler(text, channelType === 'im' || isMention);
        if (handler) {
            console.log(`Routing to: ${handler} plugin`);
        } else {
            console.log('No specific routing - message will be processed by applicable listeners');
        }

        console.log('Registered Plugins:', Array.from(app.pluginRegistry.keys()));
        console.log('=====================\n');
        await next();
    });

    // Log app mentions
    app.event('app_mention', async ({ event, next }) => {
        console.log('\n=== App Mention ===');
        console.log(`Channel: ${event.channel}`);
        console.log(`Text: ${event.text}`);
        
        const text = event.text.replace(/<@[^>]+>\s*/, '').trim();
        const handler = findHandler(text, true);
        
        if (handler) {
            console.log(`Routing to: ${handler} plugin`);
        }
        
        console.log('=====================\n');
        await next();
    });
};

// Start the app and load plugins
(async () => {
    addMessageLogging(app);
    await loadPlugins(app);
    await app.start();
    console.log('⚡️ Bolt app is running!');
})();
